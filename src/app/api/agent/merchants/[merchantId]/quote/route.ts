import { quoteMerchantIntent } from "@/server/merchantNegotiation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function parseBody(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 25_000) {
      return { error: "Merchant quote payload is too large.", status: 413 as const };
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

export async function POST(request: Request, context: { params: Promise<{ merchantId?: string }> }) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Merchant quote requires a JSON request." }, { status: 415 });
  }

  const { merchantId } = await context.params;
  const merchant = typeof merchantId === "string" ? merchantId.trim().toLowerCase() : "";
  if (!merchant) return Response.json({ error: "merchantId is required." }, { status: 400 });

  const parsed = await parseBody(request);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: parsed.status });

  const quote = await quoteMerchantIntent(merchant, parsed.body);
  if (!quote.ok) return Response.json({ error: quote.error }, { status: quote.status });
  return Response.json(quote);
}
