import { authorizeMerchantDashboard } from "@/server/merchantAuth";
import {
  publicMerchantOrder,
  updateMerchantOrderStatus,
  type MerchantOrderStatus,
} from "@/server/merchantOrderStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function orderStatus(value: unknown): MerchantOrderStatus | null {
  return value === "accepted" || value === "completed" || value === "cancelled" ? value : null;
}

async function updateStatus(request: Request, context: { params: Promise<{ id?: string }> }) {
  const authError = authorizeMerchantDashboard(request);
  if (authError) {
    return Response.json({ error: authError }, { status: authError.startsWith("Invalid") ? 401 : 503 });
  }

  const { id } = await context.params;
  const orderId = typeof id === "string" ? id.trim() : "";
  if (!/^ord-[a-f0-9]{16}$/.test(orderId)) {
    return Response.json({ error: "Invalid merchant order id." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 10_000) {
      return Response.json({ error: "Merchant order status payload is too large." }, { status: 413 });
    }
    const parsed: unknown = rawBody ? JSON.parse(rawBody) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ error: "JSON body must be an object." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const nextStatus = orderStatus(body.status);
  if (!nextStatus) {
    return Response.json({ error: "Status must be accepted, completed, or cancelled." }, { status: 400 });
  }
  if (nextStatus === "completed") {
    return Response.json(
      { error: "Use /api/merchant/orders/{id}/complete to complete an order and issue its claimable receipt." },
      { status: 400 },
    );
  }

  const result = await updateMerchantOrderStatus({ id: orderId, nextStatus });
  if (!result.updated || !result.order) {
    return Response.json(
      {
        error: result.error || "Merchant order status update failed.",
        configured: result.configured,
        order: result.order ? publicMerchantOrder(result.order) : null,
      },
      { status: result.order ? 409 : 404 },
    );
  }

  return Response.json({
    product: "Jiagon agentic merchant order status",
    mode: result.configured ? "database" : "local-demo-memory",
    configured: result.configured,
    updated: result.updated,
    order: publicMerchantOrder(result.order),
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id?: string }> }) {
  return updateStatus(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ id?: string }> }) {
  return updateStatus(request, context);
}
