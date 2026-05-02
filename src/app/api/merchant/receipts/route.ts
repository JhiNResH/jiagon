import { timingSafeEqual } from "node:crypto";
import { createMerchantIssuedReceipt } from "@/server/receiptStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 160) : fallback;
}

function cleanLongText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 500) : "";
}

function parseAmountCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (typeof value !== "string") return 0;
  const normalized = value.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 0;
  return Math.round(Number(normalized) * 100);
}

function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const originHeader = request.headers.get("origin");
  if (originHeader) {
    try {
      const origin = new URL(originHeader);
      if (origin.protocol === "http:" || origin.protocol === "https:") return origin.origin;
    } catch {
      // Fall through to the route URL.
    }
  }
  return url.origin;
}

function isLocalRequest(request: Request) {
  return localHosts.has(new URL(request.url).hostname);
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorizeMerchantIssue(request: Request) {
  const configuredKey = (process.env.JIAGON_MERCHANT_ISSUER_KEY || "").trim();
  const signingSecret = (process.env.JIAGON_MERCHANT_RECEIPT_SIGNING_SECRET || "").trim();
  const localOrDemo = isLocalRequest(request) || process.env.JIAGON_ALLOW_DEMO_MERCHANT_ISSUE === "true";

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
    body = JSON.parse(rawBody);
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
    origin: requestOrigin(request),
  });

  const status = result.persisted || !result.configured ? 201 : 503;
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
