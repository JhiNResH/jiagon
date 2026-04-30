import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  canonicalJson,
  solayerProofSigningPayload,
  type SolayerCreditProof,
} from "@/lib/solayerProof";

export function solayerProofSigningSecret() {
  return (process.env.JIAGON_SOLAYER_ADAPTER_SECRET || process.env.JIAGON_SOLANA_ADAPTER_SECRET || "").trim();
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function signSolayerProofAdapter(
  proof: Omit<SolayerCreditProof, "signedAdapter">,
  signingSecret: string,
) {
  if (!signingSecret || signingSecret.length < 32) {
    throw new Error("Solayer adapter signing secret is not configured.");
  }

  const canonical = canonicalJson(solayerProofSigningPayload(proof));
  const digest = `0x${sha256Hex(canonical)}`;
  const signature = `0x${createHmac("sha256", signingSecret).update(canonical).digest("hex")}`;

  return {
    algorithm: "HMAC-SHA256" as const,
    digest,
    signature,
    signedAt: new Date().toISOString(),
  };
}

export function verifySolayerProofAdapter(proof: unknown, signingSecret: string): SolayerCreditProof | null {
  if (!proof || typeof proof !== "object") return null;
  const candidate = proof as SolayerCreditProof;
  if (!candidate.signedAdapter?.signature || !candidate.signedAdapter?.digest) return null;

  const unsigned = {
    ...candidate,
    signedAdapter: undefined,
  } as Omit<SolayerCreditProof, "signedAdapter">;

  try {
    const expected = signSolayerProofAdapter(unsigned, signingSecret);
    const expectedSignature = Buffer.from(expected.signature.slice(2), "hex");
    const actualSignature = Buffer.from(candidate.signedAdapter.signature.slice(2), "hex");
    const digestMatches = candidate.signedAdapter.digest === expected.digest;
    const signatureMatches =
      expectedSignature.length === actualSignature.length &&
      timingSafeEqual(expectedSignature, actualSignature);

    return digestMatches && signatureMatches ? candidate : null;
  } catch {
    return null;
  }
}
