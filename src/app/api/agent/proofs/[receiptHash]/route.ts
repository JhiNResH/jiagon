import { AGENT_PROOF_BOUNDARY } from "@/lib/agentTrust";
import { getMerchantIssuedReceiptByHash } from "@/server/receiptStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ receiptHash?: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { receiptHash } = await context.params;
  const cleanHash = typeof receiptHash === "string" ? receiptHash.trim() : "";

  if (!cleanHash) {
    return Response.json({ error: "receiptHash is required." }, { status: 400 });
  }

  const result = await getMerchantIssuedReceiptByHash(cleanHash);

  if (result.error === "Invalid receipt hash.") {
    return Response.json({ error: result.error, configured: result.configured }, { status: 400 });
  }

  if (result.error) {
    return Response.json({ error: result.error, configured: result.configured }, { status: 503 });
  }

  if (!result.receipt) {
    return Response.json(
      {
        error: "Receipt proof was not found.",
        configured: result.configured,
      },
      { status: 404 },
    );
  }

  return Response.json({
    product: "Jiagon public receipt proof",
    usage: "Agent-readable proof for trust, review unlock, and purpose-bound credit eligibility. It is not a private receipt inbox.",
    configured: result.configured,
    proofBoundary: AGENT_PROOF_BOUNDARY,
    proofLevel: {
      current:
        result.receipt.mintStatus === "minted"
          ? "B"
          : result.receipt.status === "claimed"
            ? "C"
            : "D",
      levels: {
        B: "Bubblegum receipt cNFT minted from merchant-completed, passport-claimed receipt.",
        C: "Merchant-completed receipt claimed into passport memory.",
        D: "Issued receipt or order intent before customer claim.",
      },
    },
    receipt: result.receipt,
  });
}
