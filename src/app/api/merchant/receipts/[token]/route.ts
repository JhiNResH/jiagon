import { getMerchantIssuedReceiptByToken, publicMerchantReceipt } from "@/server/receiptStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!token || token.length < 12) {
    return Response.json({ error: "Invalid receipt claim token." }, { status: 400 });
  }

  const result = await getMerchantIssuedReceiptByToken(token);
  if (result.error) {
    return Response.json({ error: result.error, configured: result.configured }, { status: 503 });
  }

  if (!result.receipt) {
    return Response.json({ error: "Receipt claim token was not found.", configured: result.configured }, { status: 404 });
  }

  return Response.json({
    product: "Jiagon merchant-issued receipt",
    configured: result.configured,
    receipt: publicMerchantReceipt(result.receipt),
  });
}
