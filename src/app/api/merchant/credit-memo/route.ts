import { authorizeMerchantDashboard } from "@/server/merchantAuth";
import { getMerchantCreditMemo } from "@/server/merchantOrderStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 160) : "";
}

export async function GET(request: Request) {
  const authError = authorizeMerchantDashboard(request);
  if (authError) {
    return Response.json({ error: authError }, { status: authError.startsWith("Invalid") ? 401 : 503 });
  }

  const url = new URL(request.url);
  const merchantId = cleanText(url.searchParams.get("merchantId"));
  const merchantName = cleanText(url.searchParams.get("merchantName"));
  if (!merchantId) {
    return Response.json({ error: "merchantId is required." }, { status: 400 });
  }

  const result = await getMerchantCreditMemo({ merchantId, merchantName });
  return Response.json({
    product: "Jiagon merchant credit memo",
    mode: result.configured ? "database" : "local-demo-memory",
    configured: result.configured,
    memo: result.memo,
    error: result.error,
  }, { status: result.error ? 503 : 200 });
}

