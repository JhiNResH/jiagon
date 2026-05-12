import { createHash } from "node:crypto";
import { knownMerchantProfileForId } from "@/lib/merchantCatalog";
import { quoteMerchantIntent } from "@/server/merchantNegotiation";
import {
  createMerchantOrder,
  publicMerchantOrder,
  recordMerchantPilotEvent,
  type MerchantOrderItem,
} from "@/server/merchantOrderStore";
import { nfcStationUrl, notifyMerchantGroup } from "@/server/telegramMerchantNotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function parseBody(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 25_000) {
      return { error: "Merchant order payload is too large.", status: 413 as const };
    }
    const parsed: unknown = rawBody ? JSON.parse(rawBody) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "JSON body must be an object.", status: 400 as const };
    }
    return { body: parsed as Record<string, unknown> };
  } catch {
    return { error: "Invalid JSON body.", status: 400 as const };
  }
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 180) : fallback;
}

function cleanLongText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 500) : "";
}

function centsFromUsd(value: string) {
  const normalized = value.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 0;
  return Math.round(Number(normalized) * 100);
}

function idempotencyKey(body: Record<string, unknown>, merchantId: string, agentId: string) {
  const requestId = cleanText(body.requestId ?? body.idempotencyKey);
  if (!requestId) return null;
  const digest = createHash("sha256").update(`${merchantId}:${agentId}:${requestId}`).digest("hex").slice(0, 32);
  return `agent-negotiated:${merchantId}:${digest}`;
}

function requestOrigin(request: Request) {
  const configured = (process.env.JIAGON_APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
    } catch {
      // Fall through to request URL.
    }
  }
  return new URL(request.url).origin;
}

function paymentMode(body: Record<string, unknown>) {
  const payment = body.payment && typeof body.payment === "object" ? body.payment as Record<string, unknown> : {};
  const mode = cleanText(body.paymentMode ?? payment.mode).toLowerCase().replace(/[-\s]/g, "_");
  if (mode === "crypto_pay" || mode === "solana_pay" || mode === "helio_pay") return "crypto_pay";
  return "pay_at_counter";
}

function merchantOrderItemFromQuote(quote: Awaited<ReturnType<typeof quoteMerchantIntent>>): MerchantOrderItem | null {
  if (!quote.ok) return null;
  const item = quote.quote.item;
  const unitAmountCents = centsFromUsd(item.amountUsd);
  if (unitAmountCents <= 0) return null;
  return {
    id: item.id,
    name: item.name,
    quantity: Math.max(1, Math.min(item.quantity || 1, 20)),
    unitAmountCents,
  };
}

export async function POST(request: Request, context: { params: Promise<{ merchantId?: string }> }) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Merchant-scoped order requires a JSON request." }, { status: 415 });
  }

  const { merchantId } = await context.params;
  const merchant = typeof merchantId === "string" ? merchantId.trim().toLowerCase() : "";
  if (!merchant) return Response.json({ error: "merchantId is required." }, { status: 400 });

  const profile = knownMerchantProfileForId(merchant);
  if (!profile) {
    return Response.json(
      { error: "Unknown merchant for agent ordering.", supportedMerchants: ["raposa-coffee", "solyd-cases"] },
      { status: 404 },
    );
  }

  const parsed = await parseBody(request);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: parsed.status });

  const quote = await quoteMerchantIntent(merchant, parsed.body);
  if (!quote.ok) return Response.json({ error: quote.error }, { status: quote.status });
  if (!quote.quote.feasible) {
    return Response.json(
      {
        error: "Merchant quote is not feasible. Ask the user to accept an alternative before creating an order.",
        quote,
      },
      { status: 409 },
    );
  }

  const item = merchantOrderItemFromQuote(quote);
  if (!item) return Response.json({ error: "Quoted item cannot be converted into an order item." }, { status: 422 });

  const agentId = cleanText(parsed.body.agentId, "personal-agent");
  const fulfillment = profile.fulfillment || "pickup";
  const requestedPaymentMode = paymentMode(parsed.body);
  const userIntent = cleanLongText(parsed.body.userIntent ?? parsed.body.intent ?? parsed.body.message ?? parsed.body.instruction);
  const notes = [
    userIntent ? `User intent: ${userIntent}` : "",
    `Negotiated quote: ${JSON.stringify(quote.quote).slice(0, 900)}`,
    requestedPaymentMode === "crypto_pay" ? "Payment requested: external Solana wallet approval." : "",
    cleanLongText(parsed.body.notes),
  ].filter(Boolean).join(" ");

  const result = await createMerchantOrder({
    idempotencyKey: idempotencyKey(parsed.body, profile.id, agentId),
    merchantId: profile.id,
    merchantName: profile.name,
    location: profile.location,
    customerLabel: cleanText(parsed.body.customerLabel ?? parsed.body.userLabel, `${agentId} user`),
    source: "agent",
    items: [item],
    notes,
  });

  if (result.configured && !result.persisted) {
    return Response.json(
      {
        error: result.error || "Failed to persist negotiated merchant order.",
        configured: result.configured,
        persisted: result.persisted,
      },
      { status: 503 },
    );
  }

  try {
    await recordMerchantPilotEvent({
      merchantId: profile.id,
      eventName: "order_started",
      source: "agent-negotiated-order",
    });
  } catch (error) {
    console.warn("Jiagon negotiated order_started pilot event failed.", {
      merchantId: profile.id,
      error,
    });
  }

  const origin = requestOrigin(request);
  const order = publicMerchantOrder(result.order);
  const payment = fulfillment === "shipping"
    ? {
        mode: requestedPaymentMode,
        status: "checkout_adapter_required",
        provider: "shopify_or_moonpay_commerce",
        rail: requestedPaymentMode === "crypto_pay" ? "solana_or_card_checkout" : "merchant_checkout",
        note: "Solyd is currently a mock ecommerce adapter. A Shopify or MoonPay Commerce webhook should upgrade payment proof into claimable receipt memory.",
      }
    : {
        mode: requestedPaymentMode,
        status: requestedPaymentMode === "crypto_pay" ? "wallet_approval_required" : "external_payment_required",
        provider: requestedPaymentMode === "crypto_pay" ? "solana_payment_adapter" : "counter_pos",
        note: requestedPaymentMode === "crypto_pay"
          ? "Use /api/agent/orders for the full Solana Pay pilot path, or configure a merchant payment adapter."
          : "Payment is collected by the merchant; Jiagon receipt issuance still requires merchant fulfillment.",
      };

  if (fulfillment === "shipping") {
    return Response.json(
      {
        product: "Jiagon merchant negotiation order",
        status: "checkout_required",
        proofLevel: "order_intent_only",
        mode: result.configured ? "database" : "local-demo-memory",
        configured: result.configured,
        persisted: result.persisted,
        agent: {
          id: agentId,
          role: "personal_negotiator_agent",
          policy: {
            merchantId: profile.id,
            paymentMode: requestedPaymentMode,
            receiptPolicy: "receipt_memory_requires_merchant_payment_webhook_or_fulfillment_proof",
          },
        },
        merchant: {
          id: profile.id,
          name: profile.name,
          location: profile.location,
          fulfillment,
        },
        quote: quote.quote,
        order,
        shipping: {
          estimatedDays: quote.quote.estimate.shippingDays,
          deliveryWindowSatisfied: true,
        },
        payment,
        receiptPassport: {
          status: "awaiting_payment_or_fulfillment_webhook",
          next: "Shopify or MoonPay Commerce payment proof upgrades this order into claimable receipt memory.",
        },
        customerInstructions: [
          `${profile.name} can satisfy the quoted order; checkout/payment adapter is required before fulfillment.`,
          "No pickup or NFC receipt station is returned for shipping merchants.",
        ],
        urls: {},
        next: "Connect the merchant checkout webhook to issue verified receipt memory after payment.",
      },
      { status: 202 },
    );
  }

  const merchantNotify = await notifyMerchantGroup(result.order);
  const stationUrl = nfcStationUrl(origin, profile.id);
  const pairUrl = `${origin}/tile/${encodeURIComponent(profile.id)}?pass=${encodeURIComponent(order.pickupCode)}&source=agent`;

  return Response.json(
    {
      product: "Jiagon merchant negotiation order",
      status: "order_pass_created",
      proofLevel: "order_intent_only",
      mode: result.configured ? "database" : "local-demo-memory",
      configured: result.configured,
      persisted: result.persisted,
      agent: {
        id: agentId,
        role: "personal_negotiator_agent",
        policy: {
          merchantId: profile.id,
          paymentMode: requestedPaymentMode,
          receiptPolicy: "receipt_memory_requires_merchant_fulfillment",
        },
      },
      merchant: {
        id: profile.id,
        name: profile.name,
        location: profile.location,
        fulfillment,
      },
      quote: quote.quote,
      order,
      pickup: {
        minutes: quote.quote.estimate.readyInMinutes,
        readyAt: quote.quote.estimate.readyAt,
        label: quote.quote.estimate.readyInMinutes === null
          ? "merchant estimate pending"
          : `about ${quote.quote.estimate.readyInMinutes} minutes`,
      },
      payment,
      adapterHandoff: {
        personalNegotiatorAgent: {
          status: "quote_checked",
          handled: ["merchant capabilities", "budget constraint", "time constraint", "menu match"],
        },
        merchantTakeOrderAgent: {
          status: merchantNotify.sent ? "dispatch_sent" : merchantNotify.skipped ? "dispatch_skipped" : "dispatch_failed",
          channels: ["merchant queue", "telegram terminal", "nfc receipt station"],
        },
        receiptPassport: {
          status: "awaiting_merchant_fulfillment",
          next: "Fulfillment creates the claimable receipt for Passport.",
        },
      },
      staffDispatch: merchantNotify.sent ? "sent" : merchantNotify.skipped ? "skipped" : "failed",
      customerInstructions: [
        `Pickup at ${profile.name} with Order Pass ${order.pickupCode}.`,
        `Pickup target: ${quote.quote.estimate.readyInMinutes === null ? "merchant estimate pending" : `about ${quote.quote.estimate.readyInMinutes} minutes`}.`,
        "After staff marks the order fulfilled, tap the NFC receipt station to claim verified receipt memory into Jiagon Passport.",
      ],
      urls: {
        nfcStation: stationUrl,
        pairPhoneForNfcClaim: pairUrl,
      },
      next: "Merchant fulfillment upgrades the order to merchant_completed; NFC claim upgrades it to verified receipt memory for future purpose-bound credit.",
    },
    { status: 201 },
  );
}
