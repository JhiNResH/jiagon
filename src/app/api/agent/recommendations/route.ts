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
      caveat: "Payment is onchain-verified; merchant identity is reviewer-claimed until an official card API or uploaded receipt verifies it.",
    },
    reasons: [
      "Strong quiet-coffee taste signal.",
      "Receipt-backed visits support recommendation confidence.",
      "Best for coffee-focused queries rather than general food search.",
    ],
  },
];

const scoreMerchant = (query: string, merchant: (typeof DEMO_MERCHANTS)[number]) => {
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

  const recommendations = DEMO_MERCHANTS
    .map((merchant) => ({
      ...merchant,
      agentScore: scoreMerchant(query, merchant),
    }))
    .sort((a, b) => b.agentScore - a.agentScore)
    .slice(0, limit);

  return Response.json({
    query,
    product: "Jiagon verified local memory layer",
    privacy: "Demo response only includes published or aggregate signals. Private receipts should require user consent.",
    proofLevels: {
      A: "Onchain card spend event",
      B: "Official card API or webhook",
      C: "User-claimed merchant on top of verified payment",
      D: "Self-claimed review without payment proof",
    },
    recommendations,
  });
}
