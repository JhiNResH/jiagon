type ReceiptPublishMessageInput = {
  sourceTx: string;
  logIndex: number;
  provider?: string;
  amount?: string;
  amountUsd?: string;
  token?: string;
  reviewId?: string;
  merchant: string;
  branch: string;
  rating: number;
  placeProvider?: string;
  googlePlaceId?: string;
  tags?: string[];
  visitType?: string;
  occasion?: string;
  valueRating?: number;
  wouldReturn?: boolean;
  bestFor?: string[];
  text?: string;
  wallet: string;
};

const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ");
const normalizeOptionalText = (value: unknown) => (typeof value === "string" ? normalizeText(value) : undefined);
const normalizeStringList = (value: unknown, maxItems: number, maxLength: number) =>
  Array.isArray(value)
    ? Array.from(new Set(value
        .map((item) => (typeof item === "string" ? normalizeText(item).slice(0, maxLength) : ""))
        .filter(Boolean)))
        .slice(0, maxItems)
    : [];

const boundedRating = (value: unknown) => {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return undefined;
  return Math.min(5, Math.max(1, Math.trunc(rating)));
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, stable(nested)]),
  );
}

function receiptAmount(input: ReceiptPublishMessageInput) {
  if (input.amount) return normalizeText(input.amount);
  if (input.amountUsd) return `$${normalizeText(input.amountUsd)}`;
  return undefined;
}

export function receiptPublishPayloadSummary(input: ReceiptPublishMessageInput) {
  return stable({
    receipt: {
      provider: normalizeOptionalText(input.provider) || "ether.fi Cash",
      amount: receiptAmount(input),
      token: normalizeOptionalText(input.token) || "OP USDC",
    },
    review: {
      id: normalizeOptionalText(input.reviewId),
      merchant: normalizeText(input.merchant),
      branch: normalizeText(input.branch),
      rating: input.rating,
      placeProvider: normalizeOptionalText(input.placeProvider),
      googlePlaceId: normalizeOptionalText(input.googlePlaceId),
      tags: normalizeStringList(input.tags, 10, 40),
      attributes: {
        visitType: normalizeOptionalText(input.visitType)?.slice(0, 80),
        occasion: normalizeOptionalText(input.occasion)?.slice(0, 80),
        valueRating: boundedRating(input.valueRating),
        wouldReturn: typeof input.wouldReturn === "boolean" ? input.wouldReturn : undefined,
        bestFor: normalizeStringList(input.bestFor, 8, 40),
      },
      text: typeof input.text === "string" ? input.text : "",
    },
  });
}

export function buildReceiptPublishMessage(input: ReceiptPublishMessageInput) {
  const payload = receiptPublishPayloadSummary(input);

  return [
    "Jiagon receipt publish",
    "Purpose: mint a BNB testnet receipt credential for a verified ether.fi Cash Spend event.",
    `Source chain: optimism`,
    `Provider: ether.fi Cash`,
    `Source tx: ${input.sourceTx.toLowerCase()}`,
    `Log index: ${input.logIndex}`,
    `Merchant: ${normalizeText(input.merchant)}`,
    `Branch: ${normalizeText(input.branch)}`,
    `Rating: ${input.rating}`,
    `Signer wallet: ${input.wallet.toLowerCase()}`,
    `Payload: ${JSON.stringify(payload)}`,
  ].join("\n");
}
