import { buildSolanaCreditMirror } from "@/lib/solanaCredit";
import { getVerifiedReceiptReviewBySourceHash } from "@/server/receiptStore";

export const runtime = "nodejs";

function cleanSourceReceiptHash(value: unknown) {
  if (typeof value !== "string") return null;
  const hash = value.trim().toLowerCase();
  return /^0x[a-f0-9]{64}$/.test(hash) ? hash : null;
}

function cleanSolanaOwner(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Solana credit mirror requires a JSON request." }, { status: 415 });
  }

  try {
    const body = await request.json();
    const sourceReceiptHash = cleanSourceReceiptHash(
      body?.sourceReceiptHash || body?.credential?.sourceReceiptHash,
    );
    const solanaOwner = cleanSolanaOwner(body?.solanaOwner);
    const signingSecret = (process.env.JIAGON_SOLANA_ADAPTER_SECRET || "").trim();

    if (!sourceReceiptHash) {
      return Response.json({ error: "A valid source receipt hash is required." }, { status: 400 });
    }

    if (!solanaOwner) {
      return Response.json({ error: "A Solana owner public key is required before mirroring credit state." }, { status: 400 });
    }

    if (signingSecret.length < 32) {
      return Response.json({ error: "Solana adapter signing secret is not configured." }, { status: 500 });
    }

    const stored = await getVerifiedReceiptReviewBySourceHash(sourceReceiptHash);
    if (stored.error) {
      return Response.json({ error: stored.error }, { status: 502 });
    }

    if (!stored.configured) {
      return Response.json({ error: "Receipt persistence is not configured; verified Solana mirrors are unavailable." }, { status: 503 });
    }

    if (!stored.review) {
      return Response.json(
        { error: "No verified minted receipt credential was found for this source receipt hash." },
        { status: 404 },
      );
    }

    const review = stored.review;
    const mirror = buildSolanaCreditMirror({
      solanaOwner,
      sourceOwner: review.ownerSafe || review.wallet,
      receipt: {
        id: review.receiptId,
        txHash: review.sourceTx,
        logIndex: review.logIndex,
        amount: review.amount || undefined,
        token: review.token || undefined,
        safe: review.ownerSafe || undefined,
        blockNumber: review.sourceBlock || undefined,
      },
      review: {
        id: review.reviewId,
        merchant: review.merchant,
        branch: review.branch,
        rating: review.rating,
        tags: review.tags,
      },
      credential: {
        receiptId: review.receiptId,
        reviewId: review.reviewId,
        status: review.status,
        mode: review.mode || undefined,
        credentialId: review.credentialId,
        credentialTx: review.credentialTx,
        credentialChain: review.credentialChain,
        sourceReceiptHash: review.sourceReceiptHash,
        dataHash: review.dataHash,
        storageUri: review.storageUri,
        proofLevel: review.proofLevel,
      },
    }, { signingSecret });

    return Response.json(mirror);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build Solana credit PDA mirror.",
      },
      { status: 500 },
    );
  }
}
