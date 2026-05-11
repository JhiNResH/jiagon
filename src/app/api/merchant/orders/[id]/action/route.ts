import { authorizeMerchantDashboard } from "@/server/merchantAuth";
import {
  DEFAULT_AGENTIC_ORDER_RECEIPT_PURPOSE,
  completeMerchantOrderWithReceipt,
  publicMerchantOrder,
  updateMerchantOrderStatus,
  type MerchantOrderStatus,
} from "@/server/merchantOrderStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TakeOrderAction = "accept" | "preparing" | "paid_done" | "reject" | "cancel";

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 160) : fallback;
}

function cleanLongText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 500) : "";
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

function takeOrderAction(value: unknown): TakeOrderAction | null {
  if (
    value === "accept" ||
    value === "preparing" ||
    value === "paid_done" ||
    value === "reject" ||
    value === "cancel"
  ) {
    return value;
  }
  return null;
}

function nextStatusForAction(action: Exclude<TakeOrderAction, "paid_done">): MerchantOrderStatus {
  if (action === "reject" || action === "cancel") return "cancelled";
  if (action === "preparing") return "preparing";
  return "accepted";
}

async function parseBody(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 10_000) {
      return { error: "Take-order action payload is too large.", status: 413 as const };
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

export async function POST(request: Request, context: { params: Promise<{ id?: string }> }) {
  const authError = authorizeMerchantDashboard(request);
  if (authError) {
    return Response.json({ error: authError }, { status: authError.startsWith("Invalid") ? 401 : 503 });
  }

  const { id } = await context.params;
  const orderId = typeof id === "string" ? id.trim() : "";
  if (!/^ord-[a-f0-9]{16}$/.test(orderId)) {
    return Response.json({ error: "Invalid merchant order id." }, { status: 400 });
  }

  const parsed = await parseBody(request);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }

  const action = takeOrderAction(parsed.body.action);
  if (!action) {
    return Response.json(
      { error: "Action must be accept, preparing, paid_done, reject, or cancel." },
      { status: 400 },
    );
  }

  if (action === "paid_done") {
    const origin = requestOrigin(request);
    if (!origin) {
      return Response.json(
        { error: "JIAGON_APP_ORIGIN or NEXT_PUBLIC_APP_URL is required to issue merchant receipt claim links." },
        { status: 503 },
      );
    }

    const result = await completeMerchantOrderWithReceipt({
      id: orderId,
      origin,
      issuedBy: cleanText(parsed.body.actor, cleanText(parsed.body.issuedBy, "Jiagon take-order agent")),
      receiptPurpose: cleanText(parsed.body.receiptPurpose, DEFAULT_AGENTIC_ORDER_RECEIPT_PURPOSE),
      receiptMemo: cleanLongText(parsed.body.receiptMemo),
    });

    if (!result.updated || !result.order) {
      return Response.json(
        {
          error: result.error || "Take-order paid_done action failed.",
          configured: result.configured,
          action,
          receipt: result.receipt || null,
          order: result.order ? publicMerchantOrder(result.order) : null,
        },
        { status: result.order ? 409 : 404 },
      );
    }

    return Response.json({
      product: "Jiagon take-order agent action",
      action,
      mode: result.configured ? "database" : "local-demo-memory",
      configured: result.configured,
      updated: result.updated,
      receiptPersistence: {
        configured: result.receiptConfigured,
        persisted: result.receiptPersisted,
      },
      claimToken: result.claimToken,
      claimUrl: result.order.receiptClaimUrl,
      receipt: result.receipt || null,
      order: publicMerchantOrder(result.order),
      next: "Customer can claim this fulfilled order receipt into Jiagon Passport.",
    });
  }

  const result = await updateMerchantOrderStatus({
    id: orderId,
    nextStatus: nextStatusForAction(action),
  });

  if (!result.updated || !result.order) {
    return Response.json(
      {
        error: result.error || "Take-order action failed.",
        configured: result.configured,
        action,
        order: result.order ? publicMerchantOrder(result.order) : null,
      },
      { status: result.order ? 409 : 404 },
    );
  }

  return Response.json({
    product: "Jiagon take-order agent action",
    action,
    mode: result.configured ? "database" : "local-demo-memory",
    configured: result.configured,
    updated: result.updated,
    order: publicMerchantOrder(result.order),
    next: action === "preparing"
      ? "Order is now preparing for the merchant pilot."
      : "Merchant action recorded. Fulfillment plus receipt claim upgrades this order into passport memory.",
  });
}
