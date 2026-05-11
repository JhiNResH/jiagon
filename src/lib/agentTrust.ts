import { merchantProfileForId } from "@/lib/merchantCatalog";
import {
  getAgentMerchantReceiptStats,
  listAgentMerchantSignals,
  type AgentMerchantSignal,
  type AgentMerchantReceiptStats,
} from "@/server/receiptStore";

export const AGENT_PROOF_BOUNDARY = {
  order: "agent_or_merchant_order_intent",
  merchant: "merchant_completed",
  claim: "customer_claimed",
  payment: "optional_payment_backed_upgrade",
  credential: "solana_bubblegum_or_prepared_receipt_credential",
  credit: "purpose_bound_eligibility_not_open_cash_loan",
  privacy: "public aggregate proof only; private receipt inbox stays user-scoped",
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function signalForMerchant(merchantId: string, signals: AgentMerchantSignal[]) {
  const profile = merchantProfileForId(merchantId);
  const normalizedId = normalize(merchantId);
  const normalizedName = normalize(profile.name);

  return signals.find((signal) => {
    const signalId = normalize(signal.id);
    const signalName = normalize(signal.name);
    return signalId === normalizedId || signalName === normalizedName || signalName.includes(normalizedName) || normalizedName.includes(signalName);
  }) || null;
}

function trustScore(input: {
  signal: AgentMerchantSignal | null;
  stats: AgentMerchantReceiptStats;
}) {
  const signal = input.signal;
  const stats = input.stats;
  const reviewScore = signal ? Math.min(30, signal.verifiedVisits * 4 + signal.verifiedWallets * 5 + signal.averageRating * 2) : 0;
  const receiptScore = Math.min(45, stats.receiptsClaimed * 5 + stats.receiptsMinted * 10 + stats.receiptsPrepared * 4);
  const freshnessScore = signal?.lastVerifiedVisit || stats.latestReceiptAt ? 10 : 0;
  const score = Math.round(Math.min(100, 15 + reviewScore + receiptScore + freshnessScore));

  if (score >= 80) return { score, label: "high" };
  if (score >= 55) return { score, label: "medium" };
  if (score >= 30) return { score, label: "early" };
  return { score, label: "insufficient_data" };
}

export async function buildMerchantTrustProfile(merchantId: string) {
  const profile = merchantProfileForId(merchantId);
  const [signalsResult, stats] = await Promise.all([
    listAgentMerchantSignals(50),
    getAgentMerchantReceiptStats(profile.id),
  ]);
  const signal = signalForMerchant(profile.id, signalsResult.merchants);
  const trust = trustScore({ signal, stats });

  return {
    product: "Jiagon verified commerce memory",
    merchant: {
      id: profile.id,
      name: profile.name,
      location: profile.location,
      category: profile.category,
      purpose: profile.purpose,
    },
    agentTrust: {
      score: trust.score,
      label: trust.label,
      recommendationUse: "Use as a trust/reranking signal, not as an official merchant fact.",
      shouldBoostRecommendation: trust.score >= 55,
      canUnlockReceiptGatedReview: stats.receiptsClaimed > 0 || Boolean(signal && signal.verifiedVisits > 0),
      purposeBoundCreditEligible: stats.receiptsMinted > 0,
    },
    commerceMemory: {
      verifiedVisits: signal?.verifiedVisits || 0,
      verifiedWallets: signal?.verifiedWallets || 0,
      averageRating: signal?.averageRating || null,
      latestReview: signal?.latestReview || "",
      latestAttributes: signal?.latestAttributes || {},
      lastVerifiedVisit: signal?.lastVerifiedVisit || null,
      receiptsIssued: stats.receiptsIssued,
      receiptsClaimed: stats.receiptsClaimed,
      receiptsMinted: stats.receiptsMinted,
      receiptsPrepared: stats.receiptsPrepared,
      totalSpendUsd: (stats.totalSpendCents / 100).toFixed(2),
      latestReceiptAt: stats.latestReceiptAt,
      receiptHashes: stats.receiptHashes,
    },
    proofBoundary: AGENT_PROOF_BOUNDARY,
    persistence: {
      reviewSignalsConfigured: signalsResult.configured,
      receiptStatsConfigured: stats.configured,
      error: signalsResult.error || stats.error || null,
    },
    nextAgentActions: [
      "Use /api/agent/rerank to apply this merchant trust signal to external place candidates.",
      "Use /api/agent/proofs/{receiptHash} to inspect a public receipt proof.",
      "Use /api/agent/credit-eligibility?owner={validSolanaOwner} for purpose-bound credit eligibility from minted receipts.",
    ],
  };
}
