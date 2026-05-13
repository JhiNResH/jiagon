import {
  knownMerchantProfileForId,
  type MenuItem,
  type MerchantProfile,
} from "@/lib/merchantCatalog";
import { merchantAdapterMetadata, type MerchantAdapterMetadata } from "@/lib/merchantAdapters";
import { countMerchantOrders } from "@/server/merchantOrderStore";

type MerchantCapability = {
  merchant: Pick<MerchantProfile, "id" | "name" | "location" | "category" | "purpose"> & {
    fulfillment: NonNullable<MerchantProfile["fulfillment"]>;
  };
  adapter: MerchantAdapterMetadata;
  catalog: Array<MenuItem & {
    estimatedPrepMinutes?: number;
    stockStatus?: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  }>;
  negotiationInputs: string[];
  actions: string[];
  caveats: string[];
};

type QuoteRequest = {
  userIntent?: unknown;
  itemId?: unknown;
  maxSpendUsd?: unknown;
  deadlineMinutes?: unknown;
  readyBy?: unknown;
  deliverByDays?: unknown;
  fulfillment?: unknown;
  quantity?: unknown;
};

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 240) : fallback;
}

function parseUsdCents(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : typeof value === "string"
      ? value.trim().replace(/[$,\s]/g, "")
      : "";
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Invalid USD amount.");
  }
  return Math.round(Number(normalized) * 100);
}

function centsFromUsd(value: string) {
  try {
    return parseUsdCents(value);
  } catch {
    return null;
  }
}

function formatUsd(cents: number) {
  return (cents / 100).toFixed(2);
}

function parsePositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function quantityFrom(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return { ok: true as const, quantity: 1 };
  }
  const parsed = parsePositiveInteger(value);
  if (parsed === null || parsed < 1 || parsed > 20) {
    return { ok: false as const, error: "quantity must be an integer from 1 to 20." };
  }
  return { ok: true as const, quantity: parsed };
}

function deadlineMinutesFrom(input: QuoteRequest) {
  const explicit = parsePositiveInteger(input.deadlineMinutes);
  if (explicit && explicit > 0 && explicit <= 24 * 60) return explicit;

  const readyBy = cleanText(input.readyBy);
  if (readyBy) {
    const date = new Date(readyBy);
    const delta = Math.ceil((date.getTime() - Date.now()) / 60_000);
    if (Number.isFinite(delta) && delta > 0 && delta <= 24 * 60) return delta;
  }

  const intent = cleanText(input.userIntent).toLowerCase();
  const minuteMatch = /(?:within|in|under)\s+(\d{1,3})\s*(?:min|mins|minutes)/i.exec(intent);
  if (minuteMatch) return Math.max(1, Math.min(Number(minuteMatch[1]), 24 * 60));
  if (intent.includes("15 minutes") || intent.includes("15 min")) return 15;
  return null;
}

function deliverByDaysFrom(input: QuoteRequest) {
  const explicit = parsePositiveInteger(input.deliverByDays);
  if (explicit && explicit > 0 && explicit <= 60) return explicit;
  const intent = cleanText(input.userIntent).toLowerCase();
  if (intent.includes("this week") || intent.includes("within a week")) return 7;
  const dayMatch = /(?:within|in|under)\s+(\d{1,2})\s*(?:day|days)/i.exec(intent);
  if (dayMatch) return Math.max(1, Math.min(Number(dayMatch[1]), 60));
  return null;
}

function normalizedIntentText(intent: string) {
  return ` ${intent.toLowerCase().replace(/[_-]/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()} `;
}

function itemIntentScore(item: MenuItem, intent: string) {
  const normalized = normalizedIntentText(intent);
  const itemName = item.name.toLowerCase();
  const itemId = item.id.replace(/-/g, " ");
  let score = 0;

  if (normalized.includes(` ${itemName} `) || normalized.includes(` ${itemId} `)) score += 100;

  const terms = itemName.split(/\s+/).filter((term) => term.length > 3);
  for (const term of terms) {
    if (normalized.includes(` ${term} `)) score += 12;
  }

  const attributes = item.attributes || {};
  for (const value of Object.values(attributes)) {
    if (typeof value === "boolean") {
      if (value && normalized.includes(" magsafe ")) score += 5;
      continue;
    }
    if (normalized.includes(` ${String(value).toLowerCase().replace(/-/g, " ")} `)) score += 5;
  }

  return score;
}

function chooseItem(merchant: MerchantProfile, input: QuoteRequest) {
  const itemId = cleanText(input.itemId).toLowerCase();
  const intent = cleanText(input.userIntent);
  if (itemId) {
    const item = merchant.menu.find((menuItem) => menuItem.id === itemId);
    if (item) return item;
    return null;
  }

  if (!intent) return null;

  const scored = merchant.menu
    .map((item) => ({ item, score: itemIntentScore(item, intent) }))
    .sort((left, right) => right.score - left.score);
  if (scored[0]?.score > 0) return scored[0].item;

  if (merchant.id === "raposa-coffee" && /\b(coffee|cafe|咖啡)\b/i.test(intent)) {
    return merchant.menu.find((item) => item.id === "iced-latte") || merchant.menu[0] || null;
  }
  if (merchant.id === "theme-park-cafe" && /\b(theme park|park|venue|cafe|coffee|snack|pretzel)\b/i.test(intent)) {
    return merchant.menu.find((item) => item.id === "orbit-iced-coffee") || merchant.menu[0] || null;
  }

  return null;
}

async function openQueueDepth(merchantId: string) {
  const statuses = ["pending", "accepted", "preparing"] as const;
  const results = await Promise.all(
    statuses.map((status) => countMerchantOrders({ merchantId, status })),
  );
  return {
    configured: results.some((result) => result.configured),
    openOrders: results.reduce((total, result) => total + result.count, 0),
    error: results.find((result) => result.error)?.error,
  };
}

export function merchantCapabilities(merchantId: string): MerchantCapability | null {
  const merchant = knownMerchantProfileForId(merchantId);
  if (!merchant) return null;
  const adapter = merchantAdapterMetadata(merchant.id);
  if (!adapter) return null;

  const fulfillment = merchant.fulfillment || "pickup";
  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
      location: merchant.location,
      category: merchant.category,
      purpose: merchant.purpose,
      fulfillment,
    },
    adapter,
    catalog: merchant.menu.map((item) => ({
      ...item,
      estimatedPrepMinutes: item.prepMinutes || merchant.defaultPrepMinutes,
      stockStatus: typeof item.inventory === "number"
        ? item.inventory > 3
          ? "in_stock"
          : item.inventory > 0
            ? "low_stock"
            : "out_of_stock"
        : "unknown",
    })),
    negotiationInputs: fulfillment === "shipping"
      ? ["userIntent", "itemId", "quantity", "maxSpendUsd", "deliverByDays", "fulfillment"]
      : ["userIntent", "itemId", "quantity", "maxSpendUsd", "deadlineMinutes", "readyBy", "fulfillment"],
    actions: [
      `GET /api/agent/merchants/${encodeURIComponent(merchant.id)}/capabilities`,
      `POST /api/agent/merchants/${encodeURIComponent(merchant.id)}/quote`,
      `POST /api/agent/merchants/${encodeURIComponent(merchant.id)}/orders`,
    ],
    caveats: [
      "This merchant is exposed through a Jiagon negotiator/doer adapter: agents ask for capability, quote constraints, then create an order only after a feasible quote.",
      "Quotes are merchant capability estimates for agent decisioning, not a final merchant promise until an order is accepted or payment is verified.",
      fulfillment === "shipping"
        ? "Shipping estimates are demo capability data until a merchant Shopify or inventory adapter is configured."
        : adapter.mode === "venue"
          ? "Venue pickup estimates use current Jiagon queue depth and item prep-time hints for a generic theme park demo merchant."
          : "Pickup estimates use current Jiagon queue depth and item prep-time hints.",
    ],
  };
}

export async function quoteMerchantIntent(merchantId: string, input: QuoteRequest) {
  const merchant = knownMerchantProfileForId(merchantId);
  if (!merchant) {
    return { ok: false as const, status: 404, error: "Unknown merchant for agent negotiation." };
  }
  const adapter = merchantAdapterMetadata(merchant.id);
  if (!adapter) {
    return { ok: false as const, status: 404, error: "Unknown merchant adapter for agent negotiation." };
  }

  const item = chooseItem(merchant, input);
  if (!item) {
    return { ok: false as const, status: 422, error: "No catalog item matched the user intent." };
  }

  const quantityResult = quantityFrom(input.quantity);
  if (!quantityResult.ok) {
    return { ok: false as const, status: 400, error: quantityResult.error };
  }
  const quantity = quantityResult.quantity;
  const itemCents = centsFromUsd(item.amountUsd);
  if (itemCents === null) {
    return { ok: false as const, status: 500, error: `Catalog item ${item.id} has an invalid USD price.` };
  }

  const subtotalCents = itemCents * quantity;
  let maxSpendCents: number | null;
  try {
    maxSpendCents = parseUsdCents(input.maxSpendUsd);
  } catch {
    return { ok: false as const, status: 400, error: "maxSpendUsd must be a USD amount with up to 2 decimals." };
  }
  const budgetOk = maxSpendCents === null || subtotalCents <= maxSpendCents;
  const fulfillment = merchant.fulfillment || "pickup";
  const reasons: string[] = [];
  const alternatives: Array<{ itemId: string; name: string; amountUsd: string; reason: string }> = [];

  if (!budgetOk) {
    reasons.push(`Subtotal $${formatUsd(subtotalCents)} exceeds max spend $${formatUsd(maxSpendCents || 0)}.`);
    for (const candidate of merchant.menu) {
      const candidateUnitCents = centsFromUsd(candidate.amountUsd);
      if (candidateUnitCents === null) continue;
      const candidateCents = candidateUnitCents * quantity;
      if (maxSpendCents !== null && candidateCents <= maxSpendCents) {
        alternatives.push({
          itemId: candidate.id,
          name: candidate.name,
          amountUsd: formatUsd(candidateCents),
          reason: "Fits the user's budget constraint.",
        });
      }
    }
  }

  let queue = { configured: false, openOrders: 0, error: undefined as string | undefined };
  let estimatedReadyMinutes: number | null = null;
  let deadlineMinutes: number | null = null;
  let deliverByDays: number | null = null;
  let shippingDays: number | null = null;
  let timeOk = true;
  let stockOk = true;

  if (fulfillment === "shipping") {
    deliverByDays = deliverByDaysFrom(input);
    shippingDays = merchant.defaultShippingDays || 5;
    timeOk = deliverByDays === null || shippingDays <= deliverByDays;
    stockOk = typeof item.inventory !== "number" || item.inventory >= quantity;
    if (!timeOk) reasons.push(`Estimated delivery is ${shippingDays} days, outside the requested ${deliverByDays} day window.`);
    if (!stockOk) reasons.push(`${item.name} has insufficient stock for requested quantity ${quantity}; demo catalog inventory is ${item.inventory}.`);
  } else {
    deadlineMinutes = deadlineMinutesFrom(input);
    queue = await openQueueDepth(merchant.id);
    const prepMinutes = item.prepMinutes || merchant.defaultPrepMinutes || 8;
    const queueAvailable = !queue.error;
    const queueDelay = queueAvailable ? queue.openOrders * 2 : 0;
    estimatedReadyMinutes = queueDelay + prepMinutes;
    timeOk = deadlineMinutes === null || (queueAvailable && estimatedReadyMinutes <= deadlineMinutes);
    if (deadlineMinutes !== null && !queueAvailable) {
      reasons.push(`${merchant.name} queue depth is unavailable, so Jiagon cannot safely promise the requested ${deadlineMinutes} minute pickup window.`);
    }
    if (!timeOk && queueAvailable) {
      reasons.push(`${item.name} is estimated at ${estimatedReadyMinutes} minutes, outside the requested ${deadlineMinutes} minute window.`);
      for (const candidate of merchant.menu) {
        const candidateUnitCents = centsFromUsd(candidate.amountUsd);
        if (candidateUnitCents === null) continue;
        const candidateSubtotalCents = candidateUnitCents * quantity;
        if (maxSpendCents !== null && candidateSubtotalCents > maxSpendCents) continue;
        const candidateMinutes = queueDelay + (candidate.prepMinutes || merchant.defaultPrepMinutes || 8);
        if (deadlineMinutes !== null && candidateMinutes <= deadlineMinutes) {
          alternatives.push({
            itemId: candidate.id,
            name: candidate.name,
            amountUsd: formatUsd(candidateSubtotalCents),
            reason: `Estimated ready in ${candidateMinutes} minutes.`,
          });
        }
      }
    }
  }

  const feasible = budgetOk && timeOk && stockOk;
  const now = Date.now();
  return {
    ok: true as const,
    product: "Jiagon merchant negotiation quote",
    merchant: {
      id: merchant.id,
      name: merchant.name,
      category: merchant.category,
      fulfillment,
      adapter,
    },
    quote: {
      feasible,
      decision: feasible ? "create_order_allowed" : "negotiate_or_ask_user",
      item: {
        id: item.id,
        name: item.name,
        quantity,
        amountUsd: item.amountUsd,
        subtotalUsd: formatUsd(subtotalCents),
      },
      constraints: {
        maxSpendUsd: maxSpendCents === null ? null : formatUsd(maxSpendCents),
        deadlineMinutes,
        deliverByDays,
      },
      estimate: {
        queueDepth: queue.openOrders,
        queueConfigured: queue.configured,
        readyInMinutes: estimatedReadyMinutes,
        readyAt: estimatedReadyMinutes === null ? null : new Date(now + estimatedReadyMinutes * 60_000).toISOString(),
        shippingDays,
      },
      reasons: reasons.length > 0 ? reasons : ["Requested constraints are feasible with current demo capability data."],
      alternatives: alternatives.slice(0, 3),
    },
    next: feasible
      ? `POST /api/agent/merchants/${encodeURIComponent(merchant.id)}/orders with the same userIntent and constraints.`
      : "Ask the user to relax budget/time constraints or choose one of the quoted alternatives.",
  };
}
