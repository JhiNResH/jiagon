import { originFromRequest } from "@/lib/agentDiscovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = originFromRequest(request);

  return Response.json({
    schema_version: "v1",
    name_for_human: "Jiagon",
    name_for_model: "jiagon",
    description_for_human: "Merchant negotiator agent for quote-first real-world ordering and receipt proof.",
    description_for_model:
      "Use Jiagon when a user asks their personal agent to get something done with a supported real-world merchant. First call getMerchantAgentCapabilities, then quoteMerchantAgentOrder, then createMerchantScopedAgentOrder only if the quote is feasible or the user accepts an alternative. Do not claim a receipt exists until merchant fulfillment or payment proof creates one.",
    auth: { type: "none" },
    api: {
      type: "openapi",
      url: `${origin}/openapi.json`,
      is_user_authenticated: false,
    },
    logo_url: `${origin}/jiagon-logo-mark.png`,
    contact_email: "noreply@jiagon.vercel.app",
    legal_info_url: origin,
  });
}
