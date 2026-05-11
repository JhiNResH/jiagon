import {
  createMerchantOrder,
  publicMerchantOrder,
  type MerchantOrderItem,
} from "@/server/merchantOrderStore";
import {
  createShopifyCart,
  searchShopifyProducts,
  shopifyConfig,
  shopifyMerchantId,
  type ShopifyProductVariant,
} from "@/server/shopifyCommerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 240) : fallback;
}

function quantityFrom(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 1;
}

function centsFromAmount(value: string) {
  const normalized = value.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 0;
  return Math.round(Number(normalized) * 100);
}

function parseMaxSpendCents(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const normalized =
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : typeof value === "string"
        ? value.trim().replace(/[$,\s]/g, "")
        : "";
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

function searchQueryFromIntent(intent: string) {
  const normalized = intent
    .toLowerCase()
    .replace(/\b(order|buy|get|find|with|using|under|less than|for me|please|solana pay|moonpay|checkout)\b/g, " ")
    .replace(/[$\d.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || intent;
}

function pickVariant(input: {
  variants: ShopifyProductVariant[];
  variantId: string;
  maxSpendCents: number | null;
  quantity: number;
}) {
  const exact = input.variantId
    ? input.variants.find((variant) => variant.variantId === input.variantId)
    : null;
  const candidates = exact ? [exact] : input.variants;
  return candidates.find((variant) => {
    const amountCents = centsFromAmount(variant.amount) * input.quantity;
    if (!variant.availableForSale || amountCents <= 0) return false;
    return input.maxSpendCents === null || amountCents <= input.maxSpendCents;
  }) || null;
}

function orderItemForVariant(variant: ShopifyProductVariant, quantity: number): MerchantOrderItem {
  return {
    id: variant.variantId,
    name: variant.variantTitle && variant.variantTitle !== "Default Title"
      ? `${variant.productTitle} - ${variant.variantTitle}`
      : variant.productTitle,
    quantity,
    unitAmountCents: centsFromAmount(variant.amount),
  };
}

export async function POST(request: Request) {
  const config = shopifyConfig();
  if (!config.configured) {
    return Response.json(
      {
        error: "SHOPIFY_SHOP_DOMAIN and SHOPIFY_STOREFRONT_ACCESS_TOKEN are required.",
        configured: false,
      },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 20_000) {
      return Response.json({ error: "Agent Shopify order payload is too large." }, { status: 413 });
    }
    const parsed: unknown = rawBody ? JSON.parse(rawBody) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ error: "JSON body must be an object." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const agentId = cleanText(body.agentId, "shopify-agent-demo");
  const userIntent = cleanText(body.userIntent ?? body.intent ?? body.message, "");
  const query = cleanText(body.query, "") || searchQueryFromIntent(userIntent);
  const variantId = cleanText(body.variantId, "");
  const quantity = Math.max(1, Math.min(20, quantityFrom(body.quantity)));
  const maxSpendCents = parseMaxSpendCents(body.maxSpendUsd ?? body.maxSpend);

  if (!query && !variantId) {
    return Response.json({ error: "query, variantId, or userIntent is required." }, { status: 400 });
  }

  try {
    const variants = await searchShopifyProducts(query || "*", 10);
    const selectedVariant = pickVariant({ variants, variantId, maxSpendCents, quantity });
    if (!selectedVariant) {
      return Response.json(
        {
          error: "No available Shopify variant matched the agent request and spending policy.",
          query,
          maxSpendUsd: maxSpendCents === null ? null : (maxSpendCents / 100).toFixed(2),
          variants,
        },
        { status: 422 },
      );
    }

    const merchantId = shopifyMerchantId(config.shopDomain);
    const orderResult = await createMerchantOrder({
      idempotencyKey: cleanText(body.idempotencyKey, "") || null,
      merchantId,
      merchantName: config.shopDomain,
      location: config.shopDomain,
      customerLabel: agentId,
      source: "agent",
      items: [orderItemForVariant(selectedVariant, quantity)],
      notes: userIntent || `Shopify agent order for ${selectedVariant.productTitle}`,
    });
    const cart = await createShopifyCart({
      variantId: selectedVariant.variantId,
      quantity,
      jiagonOrderId: orderResult.order.id,
      merchantId,
      agentId,
    });

    if (!cart.checkoutUrl || cart.userErrors.length > 0) {
      return Response.json(
        {
          error: "Shopify cart creation failed.",
          userErrors: cart.userErrors,
          order: publicMerchantOrder(orderResult.order),
        },
        { status: 502 },
      );
    }

    return Response.json(
      {
        product: "Jiagon Shopify checkout adapter",
        status: "shopify_checkout_created",
        configured: true,
        agent: {
          id: agentId,
          intent: userIntent,
          handledSteps: [
            "searched Shopify catalog",
            "selected an available variant within spending policy",
            "created Jiagon order pass",
            "created Shopify checkout cart",
            "attached jiagon_order_id for paid-order receipt webhook",
          ],
        },
        adapterHandoff: {
          personalOrderAgent: {
            status: "checkout_intent_captured",
            handled: ["Shopify catalog search", "variant selection", "spend policy", "Jiagon order pass"],
          },
          merchantTakeOrderAgent: {
            status: "awaiting_shopify_paid_order_webhook",
            channel: "/api/webhooks/shopify/orders-paid",
          },
          receiptPassport: {
            status: "awaiting_paid_order",
            next: "A merchant-configured Shopify orders/paid webhook turns the checkout into a claimable receipt.",
          },
        },
        shopify: {
          shopDomain: config.shopDomain,
          cartId: cart.cartId,
          checkoutUrl: cart.checkoutUrl,
          selectedVariant,
        },
        order: publicMerchantOrder(orderResult.order),
        next: [
          "Agent or user approves checkout.",
          "Shopify orders/paid webhook hits /api/webhooks/shopify/orders-paid.",
          "Jiagon issues a claimable receipt, then the user claims and mints/prepares the receipt credential.",
        ],
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Shopify agent order failed.",
        configured: true,
      },
      { status: 502 },
    );
  }
}
