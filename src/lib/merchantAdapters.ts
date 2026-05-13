import { knownMerchantProfileForId, type MerchantProfile } from "./merchantCatalog";

export type MerchantAdapterKind = "offline_pickup" | "online_shipping" | "venue_pickup";

export type MerchantAdapterMode = "pickup" | "shipping" | "venue";

export type MerchantAdapter = {
  id: string;
  merchantId: string;
  kind: MerchantAdapterKind;
  mode: MerchantAdapterMode;
  label: string;
  description: string;
  channels: string[];
  paymentRails: string[];
  proofPolicy: {
    receiptPolicy: string;
    proofLevelBeforeFulfillment: "order_intent_only";
    proofUpgrade: string;
    requiresMerchantFulfillment: boolean;
    requiresPaymentWebhook: boolean;
  };
};

export type MerchantAdapterMetadata = Pick<
  MerchantAdapter,
  "id" | "merchantId" | "kind" | "mode" | "label" | "description" | "channels" | "paymentRails" | "proofPolicy"
>;

export const merchantAdapters: Record<string, MerchantAdapter> = {
  "raposa-coffee": {
    id: "raposa-coffee-counter-adapter",
    merchantId: "raposa-coffee",
    kind: "offline_pickup",
    mode: "pickup",
    label: "Cafe pickup negotiator",
    description: "Agent-facing adapter for pickup quotes, counter payment handoff, staff fulfillment, and receipt claim.",
    channels: ["agent_api", "merchant_queue", "telegram_terminal", "nfc_receipt_station"],
    paymentRails: ["counter_pos", "solana_pay_adapter"],
    proofPolicy: {
      receiptPolicy: "receipt_memory_requires_merchant_fulfillment",
      proofLevelBeforeFulfillment: "order_intent_only",
      proofUpgrade: "merchant marks Paid + Done, then customer claims the receipt at the NFC station.",
      requiresMerchantFulfillment: true,
      requiresPaymentWebhook: false,
    },
  },
  "raposa-shop": {
    id: "raposa-shop-checkout-adapter",
    merchantId: "raposa-shop",
    kind: "online_shipping",
    mode: "shipping",
    label: "Ecommerce shipping negotiator",
    description: "Agent-facing adapter for online catalog, stock, shipping quote, and checkout-required handoff.",
    channels: ["agent_api", "merchant_checkout", "payment_webhook"],
    paymentRails: ["merchant_checkout", "shopify_webhook", "moonpay_commerce"],
    proofPolicy: {
      receiptPolicy: "receipt_memory_requires_merchant_payment_webhook_or_fulfillment_proof",
      proofLevelBeforeFulfillment: "order_intent_only",
      proofUpgrade: "Shopify or MoonPay Commerce payment proof can upgrade the order into claimable receipt memory.",
      requiresMerchantFulfillment: false,
      requiresPaymentWebhook: true,
    },
  },
  "solyd-cases": {
    id: "solyd-cases-checkout-adapter",
    merchantId: "solyd-cases",
    kind: "online_shipping",
    mode: "shipping",
    label: "Product shipping negotiator",
    description: "Agent-facing adapter for accessory catalog, stock, shipping quote, and checkout-required handoff.",
    channels: ["agent_api", "merchant_checkout", "payment_webhook"],
    paymentRails: ["merchant_checkout", "shopify_webhook", "moonpay_commerce"],
    proofPolicy: {
      receiptPolicy: "receipt_memory_requires_merchant_payment_webhook_or_fulfillment_proof",
      proofLevelBeforeFulfillment: "order_intent_only",
      proofUpgrade: "Merchant checkout or payment webhook can upgrade the order into claimable receipt memory.",
      requiresMerchantFulfillment: false,
      requiresPaymentWebhook: true,
    },
  },
  "theme-park-cafe": {
    id: "theme-park-cafe-venue-adapter",
    merchantId: "theme-park-cafe",
    kind: "venue_pickup",
    mode: "venue",
    label: "Venue pickup negotiator",
    description: "Generic theme park venue adapter for pickup windows, counter payment handoff, and receipt claim.",
    channels: ["agent_api", "venue_pickup_window", "merchant_queue", "nfc_receipt_station"],
    paymentRails: ["venue_counter_pos", "solana_pay_adapter"],
    proofPolicy: {
      receiptPolicy: "receipt_memory_requires_venue_fulfillment",
      proofLevelBeforeFulfillment: "order_intent_only",
      proofUpgrade: "Venue staff completes the pickup order, then the guest claims the receipt at a venue station.",
      requiresMerchantFulfillment: true,
      requiresPaymentWebhook: false,
    },
  },
};

function cloneAdapter(adapter: MerchantAdapter): MerchantAdapter {
  return {
    ...adapter,
    channels: [...adapter.channels],
    paymentRails: [...adapter.paymentRails],
    proofPolicy: { ...adapter.proofPolicy },
  };
}

function fallbackAdapterForProfile(profile: MerchantProfile): MerchantAdapter {
  const fulfillment = profile.fulfillment || "pickup";
  const isShipping = fulfillment === "shipping";
  return {
    id: `${profile.id}-adapter`,
    merchantId: profile.id,
    kind: isShipping ? "online_shipping" : "offline_pickup",
    mode: isShipping ? "shipping" : "pickup",
    label: isShipping ? "Shipping negotiator" : "Pickup negotiator",
    description: "Agent-facing merchant adapter generated from catalog metadata.",
    channels: isShipping
      ? ["agent_api", "merchant_checkout", "payment_webhook"]
      : ["agent_api", "merchant_queue", "nfc_receipt_station"],
    paymentRails: isShipping
      ? ["merchant_checkout", "shopify_webhook", "moonpay_commerce"]
      : ["counter_pos", "solana_pay_adapter"],
    proofPolicy: {
      receiptPolicy: isShipping
        ? "receipt_memory_requires_merchant_payment_webhook_or_fulfillment_proof"
        : "receipt_memory_requires_merchant_fulfillment",
      proofLevelBeforeFulfillment: "order_intent_only",
      proofUpgrade: isShipping
        ? "Payment or fulfillment proof upgrades the order into claimable receipt memory."
        : "Merchant fulfillment upgrades the order into claimable receipt memory.",
      requiresMerchantFulfillment: !isShipping,
      requiresPaymentWebhook: isShipping,
    },
  };
}

export function merchantAdapterForId(merchantId: string): MerchantAdapter | null {
  const adapter = merchantAdapters[merchantId];
  if (adapter) return cloneAdapter(adapter);

  const profile = knownMerchantProfileForId(merchantId);
  if (!profile) return null;
  return fallbackAdapterForProfile(profile);
}

export function merchantAdapterMetadata(merchantId: string): MerchantAdapterMetadata | null {
  const adapter = merchantAdapterForId(merchantId);
  if (!adapter) return null;
  return {
    id: adapter.id,
    merchantId: adapter.merchantId,
    kind: adapter.kind,
    mode: adapter.mode,
    label: adapter.label,
    description: adapter.description,
    channels: adapter.channels,
    paymentRails: adapter.paymentRails,
    proofPolicy: adapter.proofPolicy,
  };
}
