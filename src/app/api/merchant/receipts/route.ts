import { timingSafeEqual } from "node:crypto";
import { createMerchantIssuedReceipt } from "@/server/receiptStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 160) : fallback;
}

function cleanLongText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 500) : "";
}

function parseAmountCents(value: unknown) {
  const normalized =
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : typeof value === "string"
        ? value.trim().replace(/[$,\s]/g, "")
        : "";
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 0;
  return Math.round(Number(normalized) * 100);
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

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorizeMerchantIssue(request: Request) {
  const configuredKey = (process.env.JIAGON_MERCHANT_ISSUER_KEY || "").trim();
  const signingSecret = (process.env.JIAGON_MERCHANT_RECEIPT_SIGNING_SECRET || "").trim();
  const localOrDemo = process.env.JIAGON_ALLOW_DEMO_MERCHANT_ISSUE === "true";

  if (!signingSecret && !localOrDemo) {
    return "JIAGON_MERCHANT_RECEIPT_SIGNING_SECRET is required to issue merchant receipts outside local demo mode.";
  }

  if (!configuredKey) {
    return localOrDemo
      ? null
      : "JIAGON_MERCHANT_ISSUER_KEY is required to issue merchant receipts outside local demo mode.";
  }

  const submitted =
    request.headers.get("x-jiagon-merchant-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  if (!submitted || !safeEqual(submitted.trim(), configuredKey)) {
    return "Invalid merchant issuer key.";
  }

  return null;
}

export async function POST(request: Request) {
  const authError = authorizeMerchantIssue(request);
  if (authError) {
    return Response.json({ error: authError }, { status: authError.startsWith("Invalid") ? 401 : 503 });
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 50_000) {
      return Response.json({ error: "Merchant receipt payload is too large." }, { status: 413 });
    }
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ error: "JSON body must be an object." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const merchantName = cleanText(body.merchantName);
  const merchantId = cleanText(body.merchantId);
  const amountCents = parseAmountCents(body.amountUsd ?? body.amount);
  const receiptNumber = cleanText(body.receiptNumber);
  const category = cleanText(body.category, "Dining");
  const purpose = cleanText(body.purpose, "merchant_receipt");
  const location = cleanText(body.location);
  const issuedBy = cleanText(body.issuedBy);
  const memo = cleanLongText(body.memo);

  if (merchantName.length < 2) {
    return Response.json({ error: "Merchant name is required." }, { status: 400 });
  }

  if (amountCents <= 0 || amountCents > 100_000) {
    return Response.json({ error: "Amount must be greater than $0 and at most $1,000 for the MVP issuer." }, { status: 400 });
  }

  if (receiptNumber && receiptNumber.length < 3) {
    return Response.json({ error: "Receipt id must be at least 3 characters." }, { status: 400 });
  }

  const origin = requestOrigin(request);
  if (!origin) {
    return Response.json(
      { error: "JIAGON_APP_ORIGIN or NEXT_PUBLIC_APP_URL is required to issue merchant receipt claim links." },
      { status: 503 },
    );
  }

  const result = await createMerchantIssuedReceipt({
    merchantId,
    merchantName,
    location,
    receiptNumber,
    amountCents,
    currency: "USD",
    category,
    purpose,
    issuedBy,
    memo,
    origin,
  });

  const status = result.persisted || !result.configured ? 201 : 503;
  if (status !== 201) {
    return Response.json(
      {
        error: result.error || "Failed to persist merchant receipt.",
        persistence: {
          configured: result.configured,
          persisted: result.persisted,
        },
      },
      { status: 503 },
    );
  }

  return Response.json(
    {
      product: "Jiagon merchant-issued receipt",
      mode: result.configured ? "database" : "local-demo-memory",
      persistence: {
        configured: result.configured,
        persisted: result.persisted,
        error: result.error,
      },
      claimToken: result.claimToken,
      claimUrl: result.receipt.claimUrl,
      receipt: {
        id: result.receipt.id,
        merchantId: result.receipt.merchantId,
        merchantName: result.receipt.merchantName,
        location: result.receipt.location,
        receiptNumber: result.receipt.receiptNumber,
        amountCents: result.receipt.amountCents,
        amountUsd: result.receipt.amountUsd,
        currency: result.receipt.currency,
        category: result.receipt.category,
        purpose: result.receipt.purpose,
        status: result.receipt.status,
        receiptHash: result.receipt.receiptHash,
        signature: result.receipt.signature,
        signatureAlgorithm: result.receipt.signatureAlgorithm,
        issuedAt: result.receipt.issuedAt,
      },
    },
    { status },
  );
}
