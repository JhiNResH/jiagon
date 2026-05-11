import {
  moonPayReceiptMemo,
  moonPayWebhookSharedToken,
  parseMoonPayCommercePaymentProof,
  verifyMoonPayWebhookSignature,
} from "@/server/moonpayCommerce";
import { completeMerchantOrderWithReceipt, publicMerchantOrder } from "@/server/merchantOrderStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanConfiguredOrigin(value: string) {
  const configured = value.trim();
  if (!configured) return "";

  try {
    const url = new URL(configured);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

function requestOrigin(request: Request) {
  const configuredOrigin = cleanConfiguredOrigin(
    process.env.JIAGON_APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "",
  );
  if (configuredOrigin) return configuredOrigin;

  const vercelHost = (process.env.VERCEL_URL || "").trim();
  if (vercelHost) return cleanConfiguredOrigin(`https://${vercelHost}`);

  return process.env.NODE_ENV !== "production" ? new URL(request.url).origin : "";
}

export async function POST(request: Request) {
  const sharedToken = moonPayWebhookSharedToken();
  if (!sharedToken) {
    return Response.json(
      { error: "MOONPAY_COMMERCE_WEBHOOK_SHARED_TOKEN is required." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > 250_000) {
    return Response.json({ error: "Webhook payload is too large." }, { status: 413 });
  }

  const authorization = request.headers.get("authorization") || "";
  if (authorization !== `Bearer ${sharedToken}`) {
    return Response.json({ error: "Invalid MoonPay Commerce bearer token." }, { status: 401 });
  }

  const signature = request.headers.get("x-signature") || "";
  if (!verifyMoonPayWebhookSignature({ rawBody, signature, sharedToken })) {
    return Response.json({ error: "Invalid MoonPay Commerce webhook signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return Response.json({ error: "Invalid JSON webhook payload." }, { status: 400 });
  }

  const proof = parseMoonPayCommercePaymentProof(payload);
  if (!proof) {
    return Response.json(
      {
        accepted: true,
        ignored: true,
        reason: "Webhook is authenticated, but it is not a successful payment event with a Jiagon orderId.",
      },
      { status: 202 },
    );
  }

  const origin = requestOrigin(request);
  if (!origin) {
    return Response.json(
      { error: "JIAGON_APP_ORIGIN or NEXT_PUBLIC_APP_URL is required to issue receipt claim links." },
      { status: 503 },
    );
  }

  const result = await completeMerchantOrderWithReceipt({
    id: proof.orderId,
    origin,
    issuedBy: "MoonPay Commerce webhook",
    paymentProvider: "moonpay_commerce",
    paymentStatus: "moonpay_verified_paid",
    receiptPurpose: "moonpay_commerce_payment_receipt",
    receiptMemo: moonPayReceiptMemo(proof),
  });

  if (!result.updated || !result.order) {
    return Response.json(
      {
        error: result.error || "MoonPay Commerce payment could not attach a Jiagon receipt.",
        paymentProof: proof,
        configured: result.configured,
      },
      { status: result.order ? 409 : 404 },
    );
  }

  return Response.json({
    accepted: true,
    product: "Jiagon MoonPay Commerce receipt adapter",
    paymentProof: proof,
    receiptPersistence: {
      configured: result.receiptConfigured,
      persisted: result.receiptPersisted,
    },
    claimToken: result.claimToken || null,
    claimUrl: result.order.receiptClaimUrl,
    receipt: result.receipt || null,
    order: publicMerchantOrder(result.order),
  });
}
