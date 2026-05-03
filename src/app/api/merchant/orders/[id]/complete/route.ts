import { authorizeMerchantDashboard } from "@/server/merchantAuth";
import { completeMerchantOrderWithReceipt, publicMerchantOrder } from "@/server/merchantOrderStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 160) : fallback;
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

  let body: Record<string, unknown> = {};
  try {
    const rawBody = await request.text();
    if (rawBody.length > 10_000) {
      return Response.json({ error: "Merchant order completion payload is too large." }, { status: 413 });
    }
    if (rawBody) {
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return Response.json({ error: "JSON body must be an object." }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    }
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

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
    issuedBy: cleanText(body.issuedBy, "Jiagon merchant dashboard"),
  });

  if (!result.updated || !result.order) {
    return Response.json(
      {
        error: result.error || "Merchant order completion failed.",
        configured: result.configured,
        receipt: result.receipt || null,
        order: result.order ? publicMerchantOrder(result.order) : null,
      },
      { status: result.order ? 409 : 404 },
    );
  }

  return Response.json({
    product: "Jiagon completed merchant order receipt",
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
  });
}
