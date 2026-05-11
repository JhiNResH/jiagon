import { agentDiscovery, originFromRequest } from "@/lib/agentDiscovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = originFromRequest(request);

  return Response.json({
    ...agentDiscovery(origin),
    howAgentsUseThis: [
      "Read /api/agent or /.well-known/jiagon-agent.json to discover endpoints.",
      "Use Google Places or another place graph to get candidates when Jiagon does not have enough coverage.",
      "Call /api/agent/rerank with those candidates to apply Jiagon receipt proof boosts.",
      "Call /api/agent/recommendations directly when you only want places already present in Jiagon taste signals.",
      "Call /api/agent/merchants/{merchantId}/trust when you need a direct merchant trust profile.",
      "Call /api/agent/proofs/{receiptHash} to inspect a public receipt proof without reading a private passport inbox.",
      "Call /api/agent/credit-eligibility?owner={validSolanaOwner} to check purpose-bound credit eligibility from minted receipt credentials.",
      "Use /api/agent/orders or /api/agent/shopify/orders only when the user explicitly delegates ordering or checkout creation.",
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
        "Fetch coffee candidates from Google Places or another place graph.",
        "Send those candidates to /api/agent/rerank.",
        "Prefer candidates with merchant-completed, passport-claimed, and Solana-minted receipt credentials.",
        "Read agentSignals such as bestFor, valueRating, wouldReturn, and latest review text.",
        "Return a recommendation with a proof caveat if merchant identity is still user-claimed.",
      ],
    },
    trustExample: {
      userIntent: "Can I trust Raposa Coffee enough to order through my agent?",
      agentRequest: {
        method: "GET",
        url: `${origin}/api/agent/merchants/raposa-coffee/trust`,
      },
      agentDecisionProcess: [
        "Read aggregate receipt and review memory for the merchant.",
        "Use shouldBoostRecommendation as a reranking signal, not as official merchant identity proof.",
        "Use purposeBoundCreditEligible only after minted receipt credentials exist.",
      ],
    },
    orderingExample: {
      adapterBoundary: "This is a two-agent handoff into receipt memory, not the core Jiagon proof API.",
      userIntent: "I want a coffee. Keep it under $10 and use crypto pay if possible.",
      agentRequest: {
        method: "POST",
        url: `${origin}/api/agent/orders`,
        body: {
          agentId: "seeker-demo-agent",
          userIntent: "I want a coffee. Keep it under $10 and use crypto pay if possible.",
          maxSpendUsd: "10.00",
          paymentMode: "crypto_pay",
        },
      },
      agentDecisionProcess: [
        "Personal Order Agent captures intent, merchant policy, max spend, and preferred payment mode.",
        "Merchant Take-Order Agent receives the order pass through Jiagon's merchant queue, Telegram terminal, Shopify checkout, or payment webhook.",
        "Return only the user-visible pickup result plus payment approval step until fulfillment or payment proof arrives.",
        "Track merchant fulfillment and receipt claim so the receipt passport, not ordering, remains the durable product output.",
      ],
    },
  });
}
