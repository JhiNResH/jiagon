import { merchantCapabilities } from "@/server/merchantNegotiation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ merchantId?: string }> }) {
  const { merchantId } = await context.params;
  const merchant = typeof merchantId === "string" ? merchantId.trim().toLowerCase() : "";
  if (!merchant) return Response.json({ error: "merchantId is required." }, { status: 400 });

  const capabilities = merchantCapabilities(merchant);
  if (!capabilities) {
    return Response.json(
      { error: "Unknown merchant for agent capabilities.", supportedMerchants: ["raposa-coffee", "solyd-cases"] },
      { status: 404 },
    );
  }

  return Response.json({
    product: "Jiagon merchant capability layer",
    ...capabilities,
  });
}
