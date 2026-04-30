import { createHash } from "node:crypto";
import { verifyEtherfiSpend } from "@/app/api/receipts/mint/route";
import { buildReceiptPublishMessage, receiptPublishPayloadSummary } from "@/lib/receiptPublish";
import { isSolanaPubkey } from "@/lib/solanaCredit";
import { mintJiagonBubblegumReceipt, solanaBubblegumConfig } from "@/server/solanaBubblegum";
import { recoverMessageAddress, type Hex } from "viem";

export const runtime = "nodejs";

type SolanaReceiptMintRequest = {
  receipt?: {
    id?: string;
    provider?: string;
    txFull?: string;
    txHash?: string;
    logIndex?: number;
    amount?: string;
    amountUsd?: string;
    token?: string;
    safe?: string;
  };
  review?: {
    id?: string;
    merchant?: string;
    branch?: string;
    rating?: number;
    placeProvider?: string;
    googlePlaceId?: string;
    tags?: string[];
    visitType?: string;
    occasion?: string;
    valueRating?: number;
    wouldReturn?: boolean;
    bestFor?: string[];
    text?: string;
    solanaOwner?: string;
  };
  ownership?: {
    signer?: string;
    signature?: string;
  };
  solanaOwner?: string;
};

const LOCAL_DEMO_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sourceReceiptHash(sourceTx: string, logIndex: number) {
  return `0x${sha256Hex(`optimism:etherfi-cash:${sourceTx.toLowerCase()}:${logIndex}`)}`;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => typeof nested !== "undefined")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, stable(nested)]),
  );
}

function dataHash(value: unknown) {
  return `0x${sha256Hex(JSON.stringify(stable(value)))}`;
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

function cleanTxHash(value: unknown) {
  if (typeof value !== "string") return null;
  const tx = value.trim();
  return /^0x[a-fA-F0-9]{64}$/.test(tx) ? tx : null;
}

function cleanText(value: unknown, maxLength = 80) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function isTrustedLocalDemo(request: Request) {
  const requestHost = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  return process.env.NODE_ENV !== "production" && Boolean(requestHost && LOCAL_DEMO_HOSTS.has(requestHost));
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.toLowerCase();
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Solana Bubblegum mint requires a JSON request." }, { status: 415 });
  }

  if (!isTrustedLocalDemo(request) && !sameOrigin(request)) {
    return Response.json({ error: "Solana Bubblegum mint must be requested from the Jiagon app origin." }, { status: 403 });
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 200_000) {
      return Response.json({ error: "Solana Bubblegum mint payload is too large." }, { status: 413 });
    }

    const body = JSON.parse(rawBody) as SolanaReceiptMintRequest;
    const sourceTx = cleanTxHash(body.receipt?.txFull || body.receipt?.txHash);
    const logIndex = body.receipt?.logIndex;
    const merchant = cleanText(body.review?.merchant);
    const branch = cleanText(body.review?.branch);
    const rating = Number(body.review?.rating || 0);
    const solanaOwner = cleanText(
      body.solanaOwner || body.review?.solanaOwner || process.env.SOLANA_BUBBLEGUM_DEFAULT_LEAF_OWNER,
      64,
    );

    if (!sourceTx) {
      return Response.json({ error: "A valid ether.fi Cash Optimism source transaction is required." }, { status: 400 });
    }
    if (typeof logIndex !== "number") {
      return Response.json({ error: "Receipt log index is required before Solana Bubblegum minting." }, { status: 400 });
    }
    if (!merchant || merchant.length < 3 || !branch || branch.length < 2 || rating < 1 || rating > 5) {
      return Response.json({ error: "Merchant, branch, and rating are required before Solana Bubblegum minting." }, { status: 400 });
    }
    if (!isSolanaPubkey(solanaOwner)) {
      return Response.json({ error: "A valid Solana owner public key is required before minting the receipt cNFT." }, { status: 400 });
    }

    const spend = await verifyEtherfiSpend(sourceTx, logIndex);
    const localDemo = isTrustedLocalDemo(request);
    const signer = cleanAddress(body.ownership?.signer);
    const signature = cleanSignature(body.ownership?.signature);

    if (!localDemo) {
      if (!spend.wallet || !cleanAddress(spend.wallet)) {
        return Response.json({ error: "Unable to derive the spender wallet from the ether.fi Spend event." }, { status: 400 });
      }
      if (!signer || !signature) {
        return Response.json({ error: "Wallet signature is required before Solana Bubblegum minting." }, { status: 401 });
      }
      if (signer !== spend.wallet.toLowerCase()) {
        return Response.json({ error: "Signed wallet does not match the ether.fi Spend event wallet." }, { status: 403 });
      }

      const message = buildReceiptPublishMessage({
        sourceTx,
        logIndex: spend.logIndex,
        provider: body.receipt?.provider,
        amount: body.receipt?.amount,
        amountUsd: body.receipt?.amountUsd,
        token: body.receipt?.token,
        reviewId: body.review?.id,
        merchant,
        branch,
        rating,
        placeProvider: body.review?.placeProvider,
        googlePlaceId: body.review?.googlePlaceId,
        tags: body.review?.tags,
        visitType: body.review?.visitType,
        occasion: body.review?.occasion,
        valueRating: body.review?.valueRating,
        wouldReturn: body.review?.wouldReturn,
        bestFor: body.review?.bestFor,
        text: body.review?.text,
        wallet: spend.wallet,
      });
      const recovered = await recoverMessageAddress({ message, signature });
      if (recovered.toLowerCase() !== spend.wallet.toLowerCase()) {
        return Response.json({ error: "Receipt publish signature is invalid for this Spend event." }, { status: 403 });
      }
    }

    const sourceHash = sourceReceiptHash(sourceTx, spend.logIndex);
    const metadataObject = {
      name: `Jiagon Receipt ${sourceHash.slice(2, 10)}`,
      symbol: "JIAGON",
      description: "Jiagon receipt credential minted as a Bubblegum compressed NFT from a verified ether.fi Cash spend.",
      source: {
        chain: "optimism",
        provider: "ether.fi Cash",
        txHash: sourceTx,
        logIndex: spend.logIndex,
        sourceReceiptHash: sourceHash,
      },
      receipt: {
        amount: body.receipt?.amount || `$${spend.amountUsd}`,
        amountUsd: spend.amountUsd,
        token: body.receipt?.token || "OP USDC",
        ownerSafe: body.receipt?.safe || spend.safe || null,
      },
      review: receiptPublishPayloadSummary({
        sourceTx,
        logIndex: spend.logIndex,
        provider: body.receipt?.provider,
        amount: body.receipt?.amount,
        amountUsd: body.receipt?.amountUsd,
        token: body.receipt?.token,
        reviewId: body.review?.id,
        merchant,
        branch,
        rating,
        placeProvider: body.review?.placeProvider,
        googlePlaceId: body.review?.googlePlaceId,
        tags: body.review?.tags,
        visitType: body.review?.visitType,
        occasion: body.review?.occasion,
        valueRating: body.review?.valueRating,
        wouldReturn: body.review?.wouldReturn,
        bestFor: body.review?.bestFor,
        text: body.review?.text,
        wallet: spend.wallet || signer || "local-demo",
      }),
      solanaOwner,
      proofLevel: "A+C",
    };
    const receiptDataHash = dataHash(metadataObject);
    const metadataUri = `jiagon://receipt/${sourceHash.slice(2)}`;
    const config = solanaBubblegumConfig();

    if (!config.mintConfigured) {
      return Response.json({
        status: "prepared",
        mode: "bubblegum-prepare-only",
        network: `Solana ${config.cluster}`,
        credentialChain: "solana-devnet",
        standard: "bubblegum-v2-cnft",
        sourceReceiptHash: sourceHash,
        dataHash: receiptDataHash,
        storageUri: metadataUri,
        solanaOwner,
        metaplexBubblegum: {
          status: "tree-or-minter-required",
          tree: config.merkleTree,
          dasRequired: true,
        },
        metadata: metadataObject,
        note: "OP spend verified. Solana Bubblegum cNFT mint is prepare-only until SOLANA_BUBBLEGUM_TREE and SOLANA_BUBBLEGUM_MINTER_SECRET_KEY are configured.",
      });
    }

    const mint = await mintJiagonBubblegumReceipt({
      leafOwner: solanaOwner,
      sourceReceiptHash: sourceHash,
      dataHash: receiptDataHash,
      metadataUri,
      name: metadataObject.name,
    });

    return Response.json({
      ...mint,
      mode: "bubblegum-minted",
      credentialId: mint.assetId,
      solanaOwner,
      metaplexCoreAsset: mint.assetId,
      metadata: metadataObject,
      note: "OP spend verified and Solana Bubblegum receipt cNFT minted.",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to mint Solana Bubblegum receipt cNFT.",
      },
      { status: 500 },
    );
  }
}
