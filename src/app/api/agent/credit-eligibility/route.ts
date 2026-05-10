import { PublicKey } from "@solana/web3.js";

import { AGENT_PROOF_BOUNDARY } from "@/lib/agentTrust";
import { getMerchantReceiptCreditProfileBySolanaOwner } from "@/server/receiptStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = (searchParams.get("owner") || "").trim();

  if (!owner) {
    return Response.json({ error: "owner query parameter is required." }, { status: 400 });
  }

  let solanaOwner = "";
  try {
    solanaOwner = new PublicKey(owner).toBase58();
  } catch {
    return Response.json({ error: "owner must be a valid Solana public key." }, { status: 400 });
  }

  const profile = await getMerchantReceiptCreditProfileBySolanaOwner(solanaOwner);

  if (profile.error && profile.configured) {
    return Response.json(
      {
        error: profile.error,
        configured: profile.configured,
      },
      { status: 503 },
    );
  }

  return Response.json({
    product: "Jiagon purpose-bound credit eligibility",
    owner: solanaOwner,
    usage: "Eligibility signal for a future purpose-bound dining deposit draw. This endpoint does not transfer funds.",
    proofBoundary: AGENT_PROOF_BOUNDARY,
    purposeBoundCredit: {
      eligible: profile.unlockedCreditCents > 0,
      unlockedCreditCents: profile.unlockedCreditCents,
      unlockedCreditUsd: (profile.unlockedCreditCents / 100).toFixed(2),
      mintedReceiptCount: profile.mintedReceiptCount,
      receiptIds: profile.receiptIds,
      maxDemoCreditCents: 2_500,
      allowedPurpose: "dining_deposit",
    },
    persistence: {
      configured: profile.configured,
      error: profile.error || null,
    },
  });
}
