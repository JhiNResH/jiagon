import { handleMintReceiptRequest, verifyEtherfiSpend } from "@/app/api/receipts/mint/route";
import { buildReceiptPublishMessage, receiptPublishPayloadSummary } from "@/lib/receiptPublish";
import { recoverMessageAddress, type Hex } from "viem";

export const runtime = "nodejs";

const LOCAL_DEMO_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const MINT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MINTS_PER_WINDOW = 5;

type PublishRateLimitEntry = {
  count: number;
  resetAt: number;
};

type PublishRateLimitGlobal = typeof globalThis & {
  jiagonPublishRateLimit?: Map<string, PublishRateLimitEntry>;
};

type PublishReceiptRequest = {
  owner?: string;
  receipt?: {
    txFull?: string;
    txHash?: string;
    logIndex?: number;
    provider?: string;
    amount?: string;
    amountUsd?: string;
    token?: string;
    safe?: string;
  };
  review?: {
    id?: string;
    merchant?: string;
    branch?: string;
    rating?: number;
    tags?: string[];
    visitType?: string;
    occasion?: string;
    valueRating?: number;
    wouldReturn?: boolean;
    bestFor?: string[];
    text?: string;
  };
  ownership?: {
    signer?: string;
    signature?: string;
  };
};

function isLocalDemoHost(request: Request) {
  const requestHost = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!requestHost) return false;
  return LOCAL_DEMO_HOSTS.has(requestHost);
}

function isTrustedLocalDemo(request: Request) {
  return process.env.NODE_ENV !== "production" && isLocalDemoHost(request);
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const host = request.headers.get("host")?.toLowerCase();
  if (!host) return false;

  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

function clientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function configuredMintLimit() {
  const configured = Number(process.env.JIAGON_PUBLIC_MINTS_PER_HOUR || DEFAULT_MINTS_PER_WINDOW);
  if (!Number.isFinite(configured)) return DEFAULT_MINTS_PER_WINDOW;
  return Math.min(25, Math.max(1, Math.trunc(configured)));
}

function checkPublishRateLimit(request: Request) {
  if (isTrustedLocalDemo(request)) {
    return { ok: true as const };
  }

  const globalStore = globalThis as PublishRateLimitGlobal;
  const store = globalStore.jiagonPublishRateLimit || new Map<string, PublishRateLimitEntry>();
  globalStore.jiagonPublishRateLimit = store;

  const now = Date.now();
  const limit = configuredMintLimit();
  const key = clientIp(request);
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + MINT_WINDOW_MS });
    return { ok: true as const };
  }

  if (current.count >= limit) {
    return {
      ok: false as const,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { ok: true as const };
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isSignature(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[a-fA-F0-9]{130}$/.test(value);
}

function isTxHash(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

async function verifyPublishOwnership(body: PublishReceiptRequest) {
  const sourceTx = body.receipt?.txFull || body.receipt?.txHash;
  const logIndex = body.receipt?.logIndex;
  const merchant = cleanText(body.review?.merchant);
  const branch = cleanText(body.review?.branch);
  const rating = Number(body.review?.rating || 0);
  const signer = body.ownership?.signer;
  const signature = body.ownership?.signature;

  if (!isTxHash(sourceTx)) {
    return { ok: false as const, status: 400, error: "A valid ether.fi Cash Optimism source transaction is required." };
  }

  if (typeof logIndex !== "number") {
    return { ok: false as const, status: 400, error: "Receipt log index is required for production minting." };
  }

  if (!merchant || merchant.length < 3 || !branch || branch.length < 2 || rating < 1 || rating > 5) {
    return { ok: false as const, status: 400, error: "Merchant, branch, and rating are required before minting." };
  }

  if (!isAddress(signer) || !isSignature(signature)) {
    return { ok: false as const, status: 401, error: "Wallet signature is required before production receipt minting." };
  }

  const spend = await verifyEtherfiSpend(sourceTx, logIndex);
  if (!spend.wallet || !isAddress(spend.wallet)) {
    return { ok: false as const, status: 400, error: "Unable to derive the spender wallet from the ether.fi Spend event." };
  }

  if (signer.toLowerCase() !== spend.wallet.toLowerCase()) {
    return { ok: false as const, status: 403, error: "Signed wallet does not match the ether.fi Spend event wallet." };
  }

  const message = buildReceiptPublishMessage({
    sourceTx,
    logIndex: spend.logIndex,
    provider: body.receipt?.provider,
    amount: body.receipt?.amount,
    amountUsd: body.receipt?.amountUsd,
    token: body.receipt?.token,
    reviewId: body.review?.id,
    merchant,
    branch,
    rating,
    tags: body.review?.tags,
    visitType: body.review?.visitType,
    occasion: body.review?.occasion,
    valueRating: body.review?.valueRating,
    wouldReturn: body.review?.wouldReturn,
    bestFor: body.review?.bestFor,
    text: body.review?.text,
    wallet: spend.wallet,
  });
  const recovered = await recoverMessageAddress({ message, signature });

  if (recovered.toLowerCase() !== spend.wallet.toLowerCase()) {
    return { ok: false as const, status: 403, error: "Receipt publish signature is invalid for this Spend event." };
  }

  return {
    ok: true as const,
    spend,
  };
}

function canonicalizeSignedBody(body: PublishReceiptRequest, spend: Awaited<ReturnType<typeof verifyEtherfiSpend>>) {
  const sourceTx = body.receipt?.txFull || body.receipt?.txHash || "";
  const payload = receiptPublishPayloadSummary({
    sourceTx,
    logIndex: spend.logIndex,
    provider: body.receipt?.provider,
    amount: body.receipt?.amount,
    amountUsd: body.receipt?.amountUsd,
    token: body.receipt?.token,
    reviewId: body.review?.id,
    merchant: body.review?.merchant || "",
    branch: body.review?.branch || "",
    rating: Number(body.review?.rating || 0),
    tags: body.review?.tags,
    visitType: body.review?.visitType,
    occasion: body.review?.occasion,
    valueRating: body.review?.valueRating,
    wouldReturn: body.review?.wouldReturn,
    bestFor: body.review?.bestFor,
    text: body.review?.text,
    wallet: spend.wallet || "",
  }) as {
    receipt: {
      provider?: string;
      amount?: string;
      token?: string;
    };
    review: {
      id?: string;
      merchant: string;
      branch: string;
      rating: number;
      tags: string[];
      attributes: {
        visitType?: string;
        occasion?: string;
        valueRating?: number;
        wouldReturn?: boolean;
        bestFor: string[];
      };
      text: string;
    };
  };

  return {
    ...body,
    owner: spend.safe || body.owner,
    receipt: {
      ...body.receipt,
      provider: payload.receipt.provider,
      txFull: sourceTx.toLowerCase(),
      txHash: sourceTx.toLowerCase(),
      logIndex: spend.logIndex,
      amount: payload.receipt.amount,
      amountUsd: undefined,
      token: payload.receipt.token,
      safe: spend.safe || body.receipt?.safe,
    },
    review: {
      ...body.review,
      id: payload.review.id,
      merchant: payload.review.merchant,
      branch: payload.review.branch,
      rating: payload.review.rating,
      tags: payload.review.tags,
      visitType: payload.review.attributes.visitType,
      occasion: payload.review.attributes.occasion,
      valueRating: payload.review.attributes.valueRating,
      wouldReturn: payload.review.attributes.wouldReturn,
      bestFor: payload.review.attributes.bestFor,
      text: payload.review.text,
    },
  };
}

export async function POST(request: Request) {
  if (process.env.JIAGON_APP_MINT_ENABLED !== "true") {
    return Response.json(
      {
        error: "App receipt publishing is disabled on this server.",
      },
      { status: 403 },
    );
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json(
      {
        error: "Receipt publishing requires a JSON request.",
      },
      { status: 415 },
    );
  }

  const mintToken = (process.env.JIAGON_MINT_API_TOKEN || "").trim();
  if (!mintToken) {
    return Response.json(
      {
        error: "Server mint token is not configured.",
      },
      { status: 500 },
    );
  }

  const localDemo = isTrustedLocalDemo(request);
  if (!localDemo && !isSameOrigin(request)) {
    return Response.json(
      {
        error: "Receipt publishing must be requested from the Jiagon app origin.",
      },
      { status: 403 },
    );
  }

  let body: PublishReceiptRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!localDemo) {
    const ownership = await verifyPublishOwnership(body);
    if (!ownership.ok) {
      return Response.json({ error: ownership.error }, { status: ownership.status });
    }

    body = canonicalizeSignedBody(body, ownership.spend);
  }

  const rateLimit = checkPublishRateLimit(request);
  if (!rateLimit.ok) {
    return Response.json(
      {
        error: "Receipt mint limit reached. Try again later.",
      },
      {
        status: 429,
        headers: {
          "retry-after": String(rateLimit.retryAfter),
        },
      },
    );
  }

  const handlerHeaders = new Headers(request.headers);
  handlerHeaders.delete("content-length");

  return handleMintReceiptRequest(
    new Request(request.url, {
      method: "POST",
      headers: handlerHeaders,
      body: JSON.stringify(body),
    }),
    mintToken,
  );
}
