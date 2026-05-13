import { agentDiscovery, originFromRequest } from "@/lib/agentDiscovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = originFromRequest(request);

  return Response.json({
    ...agentDiscovery(origin),
    howAgentsUseThis: [
      "Read /api/agent or /.well-known/jiagon-agent.json to discover endpoints.",
      "For the Call My Agent demo, treat Jiagon as a merchant negotiator: it quotes first, orders second, and leaves proof after fulfillment.",
      "For commerce execution, first call /api/agent/merchants/{merchantId}/capabilities, then /quote, and only call /orders if the quote is feasible or the user accepts an alternative.",
      "If the quote cannot satisfy budget, time, stock, or shipping constraints, return the reasons and alternatives instead of ordering blindly.",
      "Call /api/agent/proofs/{receiptHash} to inspect a public receipt proof without reading a private passport inbox.",
      "Use /api/agent/merchants/{merchantId}/orders as the primary YC order path. Older /api/agent/orders and Shopify routes are optional adapters.",
      "Use Google Places, recommendations, rerank, trust, or credit endpoints only outside the core hackathon demo.",
      "Use proofLevel, proofBoundary, reasons, freshness, verifiedVisits, and verifiedWallets to decide whether to recommend a merchant.",
      "Do not treat user-claimed merchant identity as an official merchant fact unless a stronger proof level is present.",
    ],
    coffeeExample: {
      userIntent: "Get me an iced latte from Raposa under $10, ready in 15 minutes.",
      agentRequest: {
        method: "POST",
        url: `${origin}/api/agent/merchants/raposa-coffee/quote`,
        body: {
          userIntent: "Get me an iced latte from Raposa under $10, ready in 15 minutes.",
          maxSpendUsd: "10.00",
          deadlineMinutes: 15,
        },
      },
      agentDecisionProcess: [
        "Read Raposa capabilities.",
        "Quote the requested item against budget and pickup deadline.",
        "If feasible, call the merchant-scoped order endpoint with the same constraints.",
        "Return pickup code and merchant handoff status, not a fake receipt.",
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
        "Use receipt and credit fields outside the core YC merchant-negotiator demo.",
      ],
    },
    orderingExample: {
      adapterBoundary: "This is the primary Call My Agent flow: negotiate first, then create the merchant handoff.",
      userIntent: "Get me an iced latte within 15 minutes under $10 and use Solana Pay.",
      quoteFirst: {
        method: "POST",
        url: `${origin}/api/agent/merchants/raposa-coffee/quote`,
        body: {
          userIntent: "Get me an iced latte within 15 minutes under $10 and use Solana Pay.",
          maxSpendUsd: "10.00",
          deadlineMinutes: 15,
        },
      },
      orderIfFeasible: {
        method: "POST",
        url: `${origin}/api/agent/merchants/raposa-coffee/orders`,
        body: {
          agentId: "hermes-demo-agent",
          userIntent: "Get me an iced latte within 15 minutes under $10 and use Solana Pay.",
          maxSpendUsd: "10.00",
          deadlineMinutes: 15,
          paymentMode: "crypto_pay",
        },
      },
      agentDecisionProcess: [
        "Personal Order Agent reads merchant capabilities and asks for a quote before creating the order.",
        "If the quote cannot meet budget or time constraints, return alternatives instead of ordering blindly.",
        "If the quote is feasible, create a merchant-scoped order and route user-approved payment.",
        "Merchant Take-Order Agent receives the order pass through Jiagon's merchant queue, Telegram terminal, Shopify checkout, or payment webhook.",
        "Return only the user-visible pickup result plus payment approval step until fulfillment or payment proof arrives.",
        "Track merchant fulfillment and receipt claim so completed real-world action leaves proof.",
      ],
    },
  });
}
