import { buildSolanaCreditMirror, isSolanaPubkey } from "@/lib/solanaCredit";
import type { SolayerCreditProof } from "@/lib/solayerProof";
import { buildSolanaOwnerLinkMessage } from "@/lib/solanaOwnerLink";
import { getVerifiedReceiptReviewBySourceHash } from "@/server/receiptStore";
import { solayerProofSigningSecret, verifySolayerProofAdapter } from "@/server/solayerProofSigner";
import { recoverMessageAddress, type Hex } from "viem";

export const runtime = "nodejs";

function cleanSourceReceiptHash(value: unknown) {
  if (typeof value !== "string") return null;
  const hash = value.trim().toLowerCase();
  return /^0x[a-f0-9]{64}$/.test(hash) ? hash : null;
}

function cleanSolanaOwner(value: unknown) {
  if (typeof value !== "string") return null;
  const owner = value.trim();
  return isSolanaPubkey(owner) ? owner : null;
}

function cleanAddress(value: unknown) {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(address) ? address : null;
}

function cleanSignature(value: unknown): Hex | null {
  if (typeof value !== "string") return null;
  return /^0x[a-fA-F0-9]{130}$/.test(value.trim()) ? value.trim() as Hex : null;
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
    const ownerSigner = cleanAddress(body?.ownerSigner || body?.ownership?.signer);
    const ownerSignature = cleanSignature(body?.ownerSignature || body?.ownership?.signature);
    const signingSecret = (process.env.JIAGON_SOLANA_ADAPTER_SECRET || "").trim();
    const submittedSolayerProofs = Array.isArray(body?.solayerProofs) ? body.solayerProofs.slice(0, 5) : [];

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
    const expectedSigner = cleanAddress(review.wallet || review.ownerSafe);
    if (!ownerSigner || !ownerSignature) {
      return Response.json({ error: "A valid wallet signer and ownership signature are required." }, { status: 400 });
    }

    if (!expectedSigner || ownerSigner !== expectedSigner) {
      return Response.json({ error: "Solana mirror ownership verification failed." }, { status: 403 });
    }

    let recovered: string;
    try {
      recovered = await recoverMessageAddress({
        message: buildSolanaOwnerLinkMessage({ sourceReceiptHash, solanaOwner }),
        signature: ownerSignature,
      });
    } catch {
      return Response.json({ error: "Solana mirror ownership signature is malformed." }, { status: 400 });
    }
    if (recovered.toLowerCase() !== expectedSigner) {
      return Response.json({ error: "Solana mirror ownership verification failed." }, { status: 403 });
    }

    const solayerSigningSecret = solayerProofSigningSecret();
    if (submittedSolayerProofs.length > 0 && solayerSigningSecret.length < 32) {
      return Response.json({ error: "Solayer adapter signing secret is not configured." }, { status: 500 });
    }
    const solayerProofs: Array<SolayerCreditProof | null> = submittedSolayerProofs.map((proof: unknown) =>
      verifySolayerProofAdapter(proof, solayerSigningSecret),
    );
    if (solayerProofs.some((proof: SolayerCreditProof | null) => !proof)) {
      return Response.json({ error: "A submitted Solayer proof adapter signature is invalid." }, { status: 400 });
    }
    if (solayerProofs.some((proof) => proof?.owner.toLowerCase() !== expectedSigner)) {
      return Response.json({ error: "Submitted Solayer proof owner does not match the receipt owner." }, { status: 403 });
    }

    const mirror = buildSolanaCreditMirror({
      solanaOwner,
      sourceOwner: review.ownerSafe || review.wallet,
      receipt: {
        id: review.receiptId,
        txHash: review.sourceTx,
        logIndex: review.logIndex,
        amount: review.amount || undefined,
        amountUsd: review.amountUsd || undefined,
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
      solayerProofs: solayerProofs.filter((proof): proof is SolayerCreditProof => Boolean(proof)),
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
