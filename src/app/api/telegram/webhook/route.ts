import { createHash, timingSafeEqual } from "node:crypto";
import { merchantProfileForId } from "@/lib/merchantCatalog";
import {
  completeMerchantOrderWithReceipt,
  createMerchantOrder,
  publicMerchantOrder,
  recordMerchantPilotEvent,
  updateMerchantOrderStatus,
  type MerchantOrder,
  type MerchantOrderItem,
} from "@/server/merchantOrderStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramMessage = {
  message_id?: number;
  text?: string;
  chat?: {
    id?: number | string;
  };
  from?: TelegramUser;
};

type TelegramCallbackQuery = {
  id?: string;
  data?: string;
  message?: TelegramMessage;
  from?: TelegramUser;
};

type TelegramWebhookPayload = {
  update_id?: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type ParsedCommand =
  | { kind: "help"; merchantId?: string }
  | { kind: "menu"; merchantId: string }
  | { kind: "order"; merchantId: string; itemId: string; quantity: number; notes: string };

const DEFAULT_MERCHANT_ID = "raposa-coffee";
const MAX_TELEGRAM_BODY_BYTES = 20_000;
const DEFAULT_TELEGRAM_API_TIMEOUT_MS = 5_000;

let warnedMissingProductionOrigin = false;

function cleanToken(value: string | undefined, fallback = "") {
  return (value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function cleanNotes(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 240);
}

function quantityFrom(value: string | undefined) {
  const parsed = Number.parseInt(value || "1", 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), 20);
}

function dollarsToCents(amountUsd: string) {
  const normalized = amountUsd.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 0;
  return Math.round(Number(normalized) * 100);
}

function messageDigest(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function telegramOrderIdempotencyKey(payload: TelegramWebhookPayload, message: TelegramMessage, merchantId: string) {
  if (typeof payload.update_id === "number") {
    return `telegram:${merchantId}:update:${payload.update_id}`;
  }

  const chatId = message.chat?.id ?? "unknown-chat";
  const fromId = message.from?.id ?? "unknown-from";
  const messageId = message.message_id ?? "unknown-message";
  return `telegram:${merchantId}:message:${chatId}:${fromId}:${messageId}:${messageDigest(message.text || "")}`;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function validateTelegramSecret(request: Request) {
  const expected = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (!expected && process.env.NODE_ENV === "production") {
    return "TELEGRAM_WEBHOOK_SECRET is required before enabling the Telegram webhook in production.";
  }
  if (!expected) return null;

  const submitted = request.headers.get("x-telegram-bot-api-secret-token") || "";
  return safeEqual(submitted, expected) ? null : "Invalid Telegram webhook secret.";
}

function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();
  const [command = "", merchantArg, itemArg, quantityArg, ...rest] = trimmed.split(/\s+/);
  const normalizedCommand = command.split("@")[0].toLowerCase();
  const merchantId = cleanToken(merchantArg, DEFAULT_MERCHANT_ID);

  if (normalizedCommand === "/menu") {
    return { kind: "menu", merchantId };
  }

  if (normalizedCommand === "/order") {
    return {
      kind: "order",
      merchantId,
      itemId: cleanToken(itemArg),
      quantity: quantityFrom(quantityArg),
      notes: cleanNotes(rest.join(" ")),
    };
  }

  if (normalizedCommand === "/start" || normalizedCommand === "/help") {
    return { kind: "help", merchantId };
  }

  return { kind: "help", merchantId };
}

function telegramCustomerLabel(from: TelegramUser | undefined) {
  if (!from) return "Telegram user";
  if (from.username) return `@${from.username}`;
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
  return name || (from.id ? `tg:${from.id}` : "Telegram user");
}

function menuText(merchantId: string) {
  const merchant = merchantProfileForId(merchantId);
  const items = merchant.menu
    .map((item) => `- ${item.id} · ${item.name} · $${item.amountUsd}`)
    .join("\n");

  return [
    `${merchant.name} menu`,
    items,
    "",
    `Order: /order ${merchant.id} ${merchant.menu[0]?.id || "coffee"} 1`,
    "After pickup, tap the NFC receipt card or scan the QR claim link at the counter.",
  ].join("\n");
}

function helpText(merchantId = DEFAULT_MERCHANT_ID) {
  return [
    "Jiagon Telegram POS",
    "",
    `Menu: /menu ${merchantId}`,
    `Order: /order ${merchantId} espresso 1`,
    "",
    "Telegram creates the order. NFC or QR is used at pickup to claim the receipt into Passport.",
  ].join("\n");
}

function telegramResponse(chatId: number | string | null, text: string, status = 200) {
  return Response.json(
    {
      method: "sendMessage",
      chat_id: chatId,
      text,
    },
    { status },
  );
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

  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;

  if (!warnedMissingProductionOrigin) {
    warnedMissingProductionOrigin = true;
    console.warn(
      "Jiagon Telegram webhook cannot issue receipt claim links because JIAGON_APP_ORIGIN, NEXT_PUBLIC_APP_URL, and VERCEL_URL are unset.",
    );
  }

  return "";
}

function telegramBotToken() {
  return (process.env.TELEGRAM_BOT_TOKEN || "").trim();
}

function merchantGroupChatId() {
  return (process.env.TELEGRAM_MERCHANT_GROUP_CHAT_ID || "").trim();
}

function telegramApiTimeoutMs() {
  const configured = Number.parseInt(process.env.TELEGRAM_API_TIMEOUT_MS || "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TELEGRAM_API_TIMEOUT_MS;
}

async function sendTelegramMethod(method: string, payload: Record<string, unknown>) {
  const token = telegramBotToken();
  if (!token) return { sent: false, skipped: true };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), telegramApiTimeoutMs());
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { sent: response.ok, skipped: false };
  } catch {
    return { sent: false, skipped: false };
  } finally {
    clearTimeout(timeoutId);
  }
}

function telegramOrderLines(order: MerchantOrder) {
  return order.items.map((item) => `- ${item.quantity}x ${item.name}`).join("\n");
}

async function notifyMerchantGroup(order: MerchantOrder) {
  const chatId = merchantGroupChatId();
  if (!chatId) return { sent: false, skipped: true };
  if (!telegramBotToken()) return { sent: false, skipped: false };

  const text = [
    `New Raposa order #${order.pickupCode}`,
    "",
    `Customer: ${order.customerLabel || "Telegram customer"}`,
    telegramOrderLines(order),
    `Estimated total: $${order.subtotalUsd}`,
    order.notes ? `Notes: ${order.notes}` : "",
    "",
    `Pickup code: ${order.pickupCode}`,
    "Payment: counter POS / cash / card",
  ]
    .filter(Boolean)
    .join("\n");

  return sendTelegramMethod("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Paid + Done", callback_data: `paid_done:${order.id}` },
          { text: "Cancel", callback_data: `cancel:${order.id}` },
        ],
      ],
    },
  });
}

function callbackData(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(paid_done|cancel):(ord-[a-f0-9]{16})$/.exec(value.trim());
  return match ? { action: match[1], orderId: match[2] } : null;
}

function sameTelegramChat(left: number | string | null, right: string) {
  return String(left ?? "").trim() === right.trim();
}

async function handleCallback(request: Request, callback: TelegramCallbackQuery) {
  const chatId = callback.message?.chat?.id ?? null;
  const parsed = callbackData(callback.data);
  if (!parsed) {
    await sendTelegramMethod("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Unsupported Jiagon action.",
      show_alert: false,
    });
    return telegramResponse(chatId, "Unsupported Jiagon order action.", 200);
  }

  const expectedGroupChatId = merchantGroupChatId();
  if (expectedGroupChatId && !sameTelegramChat(chatId, expectedGroupChatId)) {
    await sendTelegramMethod("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Merchant group only.",
      show_alert: true,
    });
    return telegramResponse(chatId, "Jiagon order actions are only enabled in the configured merchant Telegram group.", 200);
  }

  if (parsed.action === "cancel") {
    const result = await updateMerchantOrderStatus({ id: parsed.orderId, nextStatus: "cancelled" });
    const order = result.order ? publicMerchantOrder(result.order) : null;
    const text = result.updated && order
      ? `Cancelled order #${order.pickupCode}.`
      : `Could not cancel order ${parsed.orderId}: ${result.error || "order not found"}`;
    await sendTelegramMethod("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: result.updated ? "Cancelled" : "Cancel failed",
      show_alert: false,
    });
    return telegramResponse(chatId, text, 200);
  }

  const origin = requestOrigin(request);
  if (!origin) {
    await sendTelegramMethod("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Missing app origin configuration",
      show_alert: true,
    });
    return telegramResponse(chatId, "JIAGON_APP_ORIGIN or NEXT_PUBLIC_APP_URL is required to issue claim links.", 200);
  }

  const result = await completeMerchantOrderWithReceipt({
    id: parsed.orderId,
    origin,
    issuedBy: "Raposa Coffee Telegram staff",
  });
  const order = result.order ? publicMerchantOrder(result.order) : null;
  const text = result.updated && order
    ? [
        `Paid + Done: #${order.pickupCode}`,
        "",
        `Receipt claim: ${order.receiptClaimUrl || "(claim link unavailable)"}`,
        "Proof: merchant_completed -> customer_claimed after customer claim.",
      ].join("\n")
    : `Could not complete order ${parsed.orderId}: ${result.error || "order not found"}`;

  await sendTelegramMethod("answerCallbackQuery", {
    callback_query_id: callback.id,
    text: result.updated ? "Receipt ready" : "Complete failed",
    show_alert: false,
  });

  return telegramResponse(chatId, text, 200);
}

export async function POST(request: Request) {
  const authError = validateTelegramSecret(request);
  if (authError) {
    return Response.json({ error: authError }, { status: authError.startsWith("Invalid") ? 401 : 503 });
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Telegram webhook requires JSON." }, { status: 415 });
  }

  let payload: TelegramWebhookPayload;
  try {
    const rawBody = await request.text();
    const rawBodyBytes = new TextEncoder().encode(rawBody).length;
    if (rawBodyBytes > MAX_TELEGRAM_BODY_BYTES) {
      return Response.json({ error: "Telegram webhook payload is too large." }, { status: 413 });
    }
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ error: "Telegram webhook payload must be an object." }, { status: 400 });
    }
    payload = parsed as TelegramWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid Telegram webhook JSON." }, { status: 400 });
  }

  if (payload.callback_query) {
    return handleCallback(request, payload.callback_query);
  }

  const message = payload.message;
  const chatId = message?.chat?.id ?? null;
  const text = typeof message?.text === "string" ? message.text : "";
  if (!message || !text) {
    return telegramResponse(chatId, helpText(), 200);
  }

  const command = parseCommand(text);
  if (command.kind === "help") {
    return telegramResponse(chatId, helpText(command.merchantId), 200);
  }
  if (command.kind === "menu") {
    return telegramResponse(chatId, menuText(command.merchantId), 200);
  }

  const merchant = merchantProfileForId(command.merchantId);
  const menuItem = merchant.menu.find((item) => item.id === command.itemId);
  if (!menuItem) {
    return telegramResponse(
      chatId,
      [`Item not found: ${command.itemId || "(missing)"}`, "", menuText(command.merchantId)].join("\n"),
      200,
    );
  }

  const item: MerchantOrderItem = {
    id: menuItem.id,
    name: menuItem.name,
    quantity: command.quantity,
    unitAmountCents: dollarsToCents(menuItem.amountUsd),
  };
  if (item.unitAmountCents <= 0) {
    return Response.json({ error: "Configured menu item has an invalid price." }, { status: 500 });
  }

  const result = await createMerchantOrder({
    idempotencyKey: telegramOrderIdempotencyKey(payload, message, merchant.id),
    merchantId: merchant.id,
    merchantName: merchant.name,
    location: merchant.location,
    customerLabel: telegramCustomerLabel(message?.from),
    source: "telegram",
    items: [item],
    notes: command.notes || null,
  });

  if (result.configured && !result.persisted) {
    return Response.json(
      {
        error: result.error || "Failed to persist Telegram merchant order.",
        configured: result.configured,
        persisted: result.persisted,
      },
      { status: 503 },
    );
  }

  const order = publicMerchantOrder(result.order);
  try {
    const pilotEvent = await recordMerchantPilotEvent({
      merchantId: merchant.id,
      eventName: "order_started",
      source: "telegram-order",
    });
    if (!pilotEvent.recorded) {
      console.warn("Jiagon Telegram order_started pilot event was not recorded.", {
        merchantId: merchant.id,
        error: pilotEvent.error,
      });
    }
  } catch (error) {
    console.warn("Jiagon Telegram order_started pilot event failed.", {
      merchantId: merchant.id,
      error,
    });
  }
  const merchantNotify = await notifyMerchantGroup(result.order);
  if (!merchantNotify.sent && !merchantNotify.skipped) {
    console.warn("Jiagon Telegram merchant group dispatch failed.", {
      orderId: order.id,
      pickupCode: order.pickupCode,
      merchantId: merchant.id,
    });
    return Response.json(
      {
        error: "Order created but merchant dispatch failed. Please retry /order.",
        order: {
          id: order.id,
          pickupCode: order.pickupCode,
        },
      },
      { status: 503 },
    );
  }
  const reply = [
    `Order created: #${order.pickupCode}`,
    `${item.quantity}x ${item.name} · $${order.subtotalUsd}`,
    `Status: ${order.status}`,
    "",
    `Show pickup code ${order.pickupCode} at Raposa. Pay at the counter as usual.`,
    "After staff taps Paid + Done, use Telegram, NFC, or QR at pickup to claim the receipt into Jiagon Passport.",
  ].join("\n");

  return telegramResponse(chatId, reply);
}
