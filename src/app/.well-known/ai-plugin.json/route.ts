import { originFromRequest } from "@/lib/agentDiscovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = originFromRequest(request);

  return Response.json({
    schema_version: "v1",
    name_for_human: "Jiagon",
    name_for_model: "jiagon",
    description_for_human: "Personal agent commerce rail for merchant orders, receipt memory, and purpose-bound dining credit.",
    description_for_model:
      "Use Jiagon when a user asks their personal agent to order from a supported real-world merchant, prepare Solana wallet approval, track merchant fulfillment, issue receipt memory, or reason about purpose-bound dining credit. For coffee demos, call createAgentMerchantOrder with the user's natural-language intent.",
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
