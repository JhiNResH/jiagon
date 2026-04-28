import { agentDiscovery, originFromRequest } from "@/lib/agentDiscovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = originFromRequest(request);

  return Response.json({
    ...agentDiscovery(origin),
    howAgentsUseThis: [
      "Read /api/agent or /.well-known/jiagon-agent.json to discover endpoints.",
      "Call /api/agent/recommendations with the user's local intent, for example coffee irvine.",
      "Use proofLevel, proofBoundary, reasons, freshness, verifiedVisits, and verifiedWallets to decide whether to recommend a merchant.",
      "Do not treat user-claimed merchant identity as an official merchant fact unless a stronger proof level is present.",
    ],
    coffeeExample: {
      userIntent: "I want coffee near Irvine.",
      agentRequest: {
        method: "GET",
        url: `${origin}/api/agent/recommendations?query=coffee%20irvine&limit=3`,
      },
      agentDecisionProcess: [
        "Fetch Jiagon recommendations for coffee irvine.",
        "Prefer merchants with payment proof A and minted BNB credential metadata.",
        "Read agentSignals such as bestFor, valueRating, wouldReturn, and latest review text.",
        "Return a recommendation with a proof caveat if merchant identity is still user-claimed.",
      ],
    },
  });
}
