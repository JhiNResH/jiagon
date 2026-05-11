import { createHmac, timingSafeEqual } from "node:crypto";

type UnknownRecord = Record<string, unknown>;

export type MoonPayCommercePaymentProof = {
  event: string;
  orderId: string;
  transactionId: string;
  paylinkId: string | null;
  depositId: string | null;
  transactionSignature: string | null;
  transactionStatus: string | null;
  senderWallet: string | null;
  recipientWallet: string | null;
  amount: string | null;
  currency: string | null;
  rawIdempotencyKey: string | null;
};

export function moonPayWebhookSharedToken() {
  return (process.env.MOONPAY_COMMERCE_WEBHOOK_SHARED_TOKEN || "").trim();
}

export function verifyMoonPayWebhookSignature(input: {
  rawBody: string;
  signature: string;
  sharedToken: string;
}) {
  if (!input.rawBody || !input.signature || !input.sharedToken) return false;
  if (!/^[a-f0-9]+$/i.test(input.signature) || input.signature.length % 2 !== 0) return false;

  const computedSignature = createHmac("sha256", input.sharedToken)
    .update(input.rawBody)
    .digest("hex");
  const received = Buffer.from(input.signature, "hex");
  const computed = Buffer.from(computedSignature, "hex");
  if (received.length !== computed.length) return false;

  return timingSafeEqual(received, computed);
}

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseJsonObject(value: unknown): UnknownRecord | null {
  if (!value) return null;
  if (record(value)) return value as UnknownRecord;
  if (typeof value !== "string") return null;
  try {
    return record(JSON.parse(value));
  } catch {
    return null;
  }
}

function findOrderId(...values: unknown[]) {
  for (const value of values) {
    const candidate = stringValue(value);
    if (candidate && /^ord-[a-f0-9]{16}$/i.test(candidate)) return candidate.toLowerCase();
  }
  return null;
}

function currencySymbol(currency: UnknownRecord | null) {
  return stringValue(currency?.symbol) || stringValue(currency?.name) || null;
}

export function parseMoonPayCommercePaymentProof(payload: unknown): MoonPayCommercePaymentProof | null {
  const root = record(payload);
  if (!root) return null;

  const transactionObject = record(root.transactionObject) || parseJsonObject(root.transaction);
  const meta = record(transactionObject?.meta);
  const customerDetails = record(meta?.customerDetails);
  const productDetails = record(meta?.productDetails);
  const additionalJson = parseJsonObject(customerDetails?.additionalJSON) ||
    parseJsonObject(productDetails?.additionalJSON) ||
    parseJsonObject(root.additionalJSON) ||
    parseJsonObject(root.metadata);

  const orderId = findOrderId(
    root.orderId,
    root.merchantOrderId,
    transactionObject?.orderId,
    meta?.orderId,
    customerDetails?.orderId,
    productDetails?.orderId,
    additionalJson?.orderId,
    additionalJson?.merchantOrderId,
  );
  if (!orderId) return null;

  const event = stringValue(root.event) || "UNKNOWN";
  const transactionStatus = stringValue(meta?.transactionStatus) || stringValue(root.transactionStatus);
  const isSuccess = transactionStatus === "SUCCESS" ||
    event === "DEPOSIT_TX_CONFIRMED" ||
    event === "DEPOSIT_TX_ENRICHED";
  if (!isSuccess) return null;

  const currency = record(root.currency) || record(meta?.currency);

  return {
    event,
    orderId,
    transactionId: stringValue(transactionObject?.id) || stringValue(root.transactionId) || stringValue(root.txIdempotencyKey) || "unknown",
    paylinkId: stringValue(transactionObject?.paylinkId) || stringValue(root.paylinkId),
    depositId: stringValue(root.depositId),
    transactionSignature: stringValue(meta?.transactionSignature) || stringValue(root.transactionSignature),
    transactionStatus,
    senderWallet: stringValue(meta?.senderPK),
    recipientWallet: stringValue(meta?.recipientPK),
    amount: stringValue(root.amount) || stringValue(meta?.totalAmount) || stringValue(meta?.amount),
    currency: currencySymbol(currency),
    rawIdempotencyKey: stringValue(root.webhookDeliveryIdempotencyKey) || stringValue(root.txIdempotencyKey),
  };
}

export function moonPayReceiptMemo(proof: MoonPayCommercePaymentProof) {
  const parts = [
    `MoonPay Commerce verified payment for order ${proof.orderId}.`,
    proof.transactionId !== "unknown" ? `Transaction: ${proof.transactionId}.` : null,
    proof.transactionSignature ? `Signature: ${proof.transactionSignature}.` : null,
    proof.senderWallet ? `Payer wallet: ${proof.senderWallet}.` : null,
    proof.amount && proof.currency ? `Amount: ${proof.amount} ${proof.currency}.` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ").slice(0, 500);
}
