import { buildMerchantTrustProfile } from "@/lib/agentTrust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ merchantId?: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { merchantId } = await context.params;
  const cleanMerchantId = typeof merchantId === "string" ? merchantId.trim() : "";

  if (!cleanMerchantId) {
    return Response.json({ error: "merchantId is required." }, { status: 400 });
  }

  const profile = await buildMerchantTrustProfile(cleanMerchantId);

  return Response.json(profile);
}
