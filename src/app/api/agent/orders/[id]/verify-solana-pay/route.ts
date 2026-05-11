import {
  completeMerchantOrderWithReceipt,
  getMerchantOrderById,
  publicMerchantOrder,
} from "@/server/merchantOrderStore";
import {
  solanaPayMemo,
  solanaPayReference,
  verifySolanaPayOrderPayment,
} from "@/server/solanaPay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 180) : fallback;
}

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

async function parseBody(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody) return { body: {} as Record<string, unknown> };
    if (rawBody.length > 5_000) {
      return { error: "Solana Pay verification payload is too large.", status: 413 as const };
    }
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "JSON body must be an object.", status: 400 as const };
    }
    return { body: parsed as Record<string, unknown> };
  } catch {
    return { error: "Invalid JSON body.", status: 400 as const };
  }
}

export async function POST(request: Request, context: { params: Promise<{ id?: string }> }) {
  const { id } = await context.params;
  const orderId = typeof id === "string" ? id.trim() : "";
  if (!/^ord-[a-f0-9]{16}$/.test(orderId)) {
    return Response.json({ error: "Invalid merchant order id." }, { status: 400 });
  }

  const parsed = await parseBody(request);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }

  const lookup = await getMerchantOrderById(orderId);
  if (lookup.error) {
    return Response.json({ error: lookup.error, configured: lookup.configured }, { status: 503 });
  }
  if (!lookup.order) {
    return Response.json({ error: "Merchant order was not found.", configured: lookup.configured }, { status: 404 });
  }

  if (lookup.order.receiptClaimUrl) {
    return Response.json({
      accepted: true,
      idempotent: true,
      product: "Jiagon Solana Pay order receipt adapter",
      paymentProof: {
        provider: "solana_pay",
        status: lookup.order.paymentStatus,
        reference: solanaPayReference(lookup.order.id),
        memo: solanaPayMemo(lookup.order.id),
        alreadyReceipted: true,
      },
      claimUrl: lookup.order.receiptClaimUrl,
      receipt: null,
      order: publicMerchantOrder(lookup.order),
    });
  }

  const origin = requestOrigin(request);
  if (!origin) {
    return Response.json(
      { error: "JIAGON_APP_ORIGIN or NEXT_PUBLIC_APP_URL is required to issue receipt claim links." },
      { status: 503 },
    );
  }

  const verification = await verifySolanaPayOrderPayment({
    order: lookup.order,
    signature: cleanText(parsed.body.signature),
  });
  if (!verification.ok) {
    if ("setup" in verification) {
      const setup = verification.setup;
      if (!setup) {
        return Response.json(
          { error: "Solana Pay verification setup failed.", order: publicMerchantOrder(lookup.order) },
          { status: 503 },
        );
      }
      return Response.json(
        {
          error: setup.error,
          missing: setup.missing || [],
          paymentProof: {
            provider: "solana_pay",
            reference: solanaPayReference(lookup.order.id),
            memo: solanaPayMemo(lookup.order.id),
            expectedAmountUsd: lookup.order.subtotalUsd,
          },
          order: publicMerchantOrder(lookup.order),
        },
        { status: setup.status },
      );
    }

    return Response.json(
      {
        error: verification.error,
        validationErrors: verification.validationErrors || [],
        paymentProof: verification.paymentProof || {
          provider: "solana_pay",
          reference: solanaPayReference(lookup.order.id),
          memo: solanaPayMemo(lookup.order.id),
          expectedAmountUsd: lookup.order.subtotalUsd,
        },
        order: publicMerchantOrder(lookup.order),
      },
      { status: verification.status },
    );
  }

  const result = await completeMerchantOrderWithReceipt({
    id: lookup.order.id,
    origin,
    issuedBy: "Solana Pay verifier",
    paymentProvider: "solana_pay",
    paymentStatus: "solana_pay_verified_paid",
    receiptPurpose: "solana_pay_verified_order_receipt",
    receiptMemo: `Solana Pay verified payment for order ${lookup.order.id}. Signature: ${verification.paymentProof.signature}. Reference: ${verification.paymentProof.reference}.`,
    expectedSubtotalCents: lookup.order.subtotalCents,
  });

  if (!result.updated || !result.order) {
    return Response.json(
      {
        error: result.error || "Solana Pay payment verified, but the Jiagon receipt could not be attached.",
        configured: result.configured,
        paymentProof: verification.paymentProof,
        receipt: result.receipt || null,
        order: result.order ? publicMerchantOrder(result.order) : publicMerchantOrder(lookup.order),
      },
      { status: result.order ? 409 : 404 },
    );
  }

  return Response.json({
    accepted: true,
    product: "Jiagon Solana Pay order receipt adapter",
    mode: result.configured ? "database" : "local-demo-memory",
    configured: result.configured,
    updated: result.updated,
    paymentProof: verification.paymentProof,
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
