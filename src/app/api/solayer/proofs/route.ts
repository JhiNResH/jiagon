import {
  buildSolayerProofMessage,
  canonicalJson,
  normalizeSolayerProofInput,
  type SolayerProofInput,
} from "@/lib/solayerProof";
import {
  sha256Hex,
  signSolayerProofAdapter,
  solayerProofSigningSecret,
} from "@/server/solayerProofSigner";
import { recoverMessageAddress, type Hex } from "viem";

export const runtime = "nodejs";

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
    return Response.json({ error: "Solayer proof upload requires a JSON request." }, { status: 415 });
  }

  let body: {
    wallet?: unknown;
    proof?: SolayerProofInput;
    ownership?: {
      signer?: unknown;
      signature?: unknown;
    };
  };

  try {
    const rawBody = await request.text();
    if (rawBody.length > 200_000) {
      return Response.json({ error: "Solayer proof payload is too large." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const wallet = cleanAddress(body.wallet);
    const signer = cleanAddress(body.ownership?.signer);
    const signature = cleanSignature(body.ownership?.signature);
    const signingSecret = solayerProofSigningSecret();

    if (!wallet || !signer || wallet !== signer) {
      return Response.json({ error: "A matching wallet signer is required for Solayer proof upload." }, { status: 400 });
    }

    if (!signature) {
      return Response.json({ error: "A wallet signature is required for Solayer proof upload." }, { status: 400 });
    }

    if (signingSecret.length < 32) {
      return Response.json({ error: "Solayer adapter signing secret is not configured." }, { status: 500 });
    }

    const normalized = normalizeSolayerProofInput(body.proof || {});
    if (!normalized.account || normalized.positionUsd <= 0) {
      return Response.json({ error: "Solayer account and position amount are required." }, { status: 400 });
    }

    let recovered: string;
    try {
      recovered = await recoverMessageAddress({
        message: buildSolayerProofMessage({ wallet, proof: body.proof || {} }),
        signature,
      });
    } catch {
      return Response.json({ error: "Solayer proof signature is malformed." }, { status: 400 });
    }

    if (recovered.toLowerCase() !== wallet) {
      return Response.json({ error: "Solayer proof ownership verification failed." }, { status: 403 });
    }

    const proofHash = `0x${sha256Hex(canonicalJson({ owner: wallet, proof: normalized }))}`;
    const generatedAt = new Date().toISOString();
    const unsignedProof = {
      id: `solayer-${proofHash.slice(2, 14)}`,
      owner: wallet,
      provider: "solayer" as const,
      account: normalized.account,
      asset: normalized.asset,
      positionUsd: normalized.positionUsd,
      sourceUri: normalized.sourceUri,
      proofType: normalized.proofType,
      verifier: normalized.verifier,
      verifierSignature: normalized.verifierSignature,
      proofHash,
      proofLevel: "B" as const,
      status: "adapter-attested" as const,
      verificationStatus: "wallet-attested" as const,
      adapterMode: "zktls-compatible-signed-adapter" as const,
      generatedAt,
    };

    return Response.json({
      ...unsignedProof,
      signedAdapter: signSolayerProofAdapter(unsignedProof, signingSecret),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Solayer proof adapter.",
      },
      { status: 500 },
    );
  }
}
