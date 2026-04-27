import { listAgentMerchantSignals } from "@/server/receiptStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_MERCHANTS = [
  {
    id: "85c-irvine",
    name: "85C Bakery Cafe",
    branch: "Irvine",
    category: "Bakery",
    verifiedVisits: 12,
    verifiedWallets: 7,
    averageRating: 4.5,
    totalVerifiedSpendUsd: "59.40",
    lastVerifiedVisit: "2026-04-25",
    proofLevel: {
      payment: "A",
      merchant: "C",
      source: "ether.fi Cash OP Spend event",
      credentialChain: "BNB Smart Chain testnet",
      storageLayer: "BNB Greenfield testnet",
      caveat: "Payment is onchain-verified; merchant identity is reviewer-claimed until an official card API or uploaded receipt verifies it.",
    },
    reasons: [
      "Recent receipt-backed bakery visits in Irvine.",
      "High repeat-visit signal for quick pastry and coffee stops.",
      "Best for lightweight recommendations where payment proof matters more than merchant API verification.",
    ],
  },
  {
    id: "tartine-sf",
    name: "Tartine",
    branch: "San Francisco",
    category: "Bakery",
    verifiedVisits: 8,
    verifiedWallets: 6,
    averageRating: 4.2,
    totalVerifiedSpendUsd: "171.12",
    lastVerifiedVisit: "2026-04-24",
    proofLevel: {
      payment: "A",
      merchant: "C",
      source: "ether.fi Cash OP Spend event",
      credentialChain: "BNB Smart Chain testnet",
      storageLayer: "BNB Greenfield testnet",
      caveat: "Payment is onchain-verified; merchant identity is reviewer-claimed until an official card API or uploaded receipt verifies it.",
    },
    reasons: [
      "Consistent bakery signal across multiple verified wallets.",
      "Good pickup recommendation, weaker sit-down signal.",
      "Useful when the query optimizes for proven repeat spend.",
    ],
  },
  {
    id: "fuglen-tokyo",
    name: "Fuglen Coffee",
    branch: "Tokyo",
    category: "Cafe",
    verifiedVisits: 5,
    verifiedWallets: 4,
    averageRating: 4.8,
    totalVerifiedSpendUsd: "41.84",
    lastVerifiedVisit: "2026-04-24",
    proofLevel: {
      payment: "A",
      merchant: "C",
      source: "ether.fi Cash OP Spend event",
      credentialChain: "BNB Smart Chain testnet",
      storageLayer: "BNB Greenfield testnet",
      caveat: "Payment is onchain-verified; merchant identity is reviewer-claimed until an official card API or uploaded receipt verifies it.",
    },
    reasons: [
      "Strong quiet-coffee taste signal.",
      "Receipt-backed visits support recommendation confidence.",
      "Best for coffee-focused queries rather than general food search.",
    ],
  },
];

type RecommendationMerchant = {
  name: string;
  branch: string;
  category: string;
  averageRating: number;
  verifiedVisits: number;
  verifiedWallets: number;
};

const scoreMerchant = (query: string, merchant: RecommendationMerchant) => {
  const normalized = query.toLowerCase();
  let score = merchant.averageRating * 10 + merchant.verifiedVisits + merchant.verifiedWallets;

  if (normalized.includes(merchant.category.toLowerCase())) score += 18;
  if (normalized.includes(merchant.branch.toLowerCase())) score += 18;
  if (normalized.includes(merchant.name.toLowerCase())) score += 24;
  if (normalized.includes("coffee") && merchant.category.toLowerCase() === "cafe") score += 12;
  if (normalized.includes("bakery") && merchant.category.toLowerCase() === "bakery") score += 12;

  return score;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const limit = Math.min(5, Math.max(1, Number(searchParams.get("limit") || 3)));
  const persisted = await listAgentMerchantSignals(50);

  if (persisted.configured && persisted.error) {
    return Response.json(
      {
        error: "Unable to load Jiagon receipt memory.",
        persistence: {
          configured: true,
          error: persisted.error,
        },
      },
      { status: 503 },
    );
  }

  const merchantSource =
    persisted.merchants.length > 0
      ? persisted.merchants.map((merchant) => ({
          ...merchant,
          proofLevel: {
            payment: "A",
            merchant: "C",
            source: "ether.fi Cash OP Spend event",
            credentialChain: "BNB Smart Chain testnet",
            storageLayer: "BNB Greenfield testnet pointer",
            caveat: "Payment is onchain-verified; merchant identity is reviewer-claimed until an official card API or uploaded receipt verifies it.",
          },
          reasons: [
            "Built from persisted receipt-backed Jiagon reviews.",
            `Recent verified visit signal: ${merchant.lastVerifiedVisit}.`,
            merchant.latestReview
              ? `Latest review note: ${merchant.latestReview.slice(0, 120)}${merchant.latestReview.length > 120 ? "..." : ""}`
              : "No long-form review text was published.",
          ],
        }))
      : DEMO_MERCHANTS;

  const recommendations = merchantSource
    .map((merchant) => ({
      ...merchant,
      agentScore: scoreMerchant(query, merchant),
    }))
    .sort((a, b) => b.agentScore - a.agentScore)
    .slice(0, limit);

  return Response.json({
    query,
    product: "Jiagon verified local memory layer",
    privacy: "Response includes published or aggregate receipt review signals. Private receipt inbox data should stay user-scoped.",
    dataSource: persisted.merchants.length > 0 ? "postgres-merchant-signals" : "demo-fixture",
    persistence: {
      configured: persisted.configured,
      error: persisted.error,
    },
    architecture: {
      sourceChain: "optimism",
      credentialChain: "bnb-testnet",
      storageLayer: "greenfield-testnet",
      flow: "OP Spend event -> Jiagon verification -> BNB testnet receipt credential -> Greenfield data object",
    },
    proofLevels: {
      A: "Onchain card spend event",
      B: "BNB testnet receipt credential minted from verified payment and user-claimed merchant",
      C: "User-claimed merchant on top of verified payment",
      D: "Self-claimed review without payment proof",
    },
    recommendations,
  });
}
