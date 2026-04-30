import { createHash, createHmac } from "node:crypto";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const DEFAULT_SOLANA_CLUSTER = "devnet";
const DEFAULT_SOLANA_RPC_URL = "https://api.devnet.solana.com";

type ReceiptLike = {
  id?: string;
  txFull?: string;
  txHash?: string;
  logIndex?: number;
  amount?: string;
  amountUsd?: string;
  token?: string;
  safe?: string;
  block?: number;
  blockNumber?: number;
};

type ReviewLike = {
  id?: string;
  merchant?: string;
  branch?: string;
  rating?: number;
  tags?: string[];
  visitType?: string;
  occasion?: string;
  valueRating?: number;
  wouldReturn?: boolean;
  bestFor?: string[];
};

type CredentialLike = {
  receiptId?: string;
  reviewId?: string;
  status?: string;
  mode?: string;
  credentialId?: string;
  credentialTx?: string | null;
  credentialChain?: string;
  sourceReceiptHash?: string;
  dataHash?: string;
  storageUri?: string;
  proofLevel?: string;
  mintedAt?: string;
  preparedAt?: string;
};

export type SolanaCreditMirrorInput = {
  owner?: string | null;
  receipt?: ReceiptLike | null;
  review?: ReviewLike | null;
  credential?: CredentialLike | null;
};

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Bytes(value: string) {
  return createHash("sha256").update(value).digest();
}

function base58Encode(bytes: Buffer) {
  let value = BigInt(`0x${bytes.toString("hex") || "0"}`);
  let encoded = "";

  while (value > BigInt(0)) {
    const mod = Number(value % BigInt(58));
    encoded = BASE58_ALPHABET[mod] + encoded;
    value = value / BigInt(58);
  }

  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = BASE58_ALPHABET[0] + encoded;
  }

  return encoded || BASE58_ALPHABET[0];
}

function pubkeyFromSeed(seed: string) {
  return base58Encode(sha256Bytes(seed).subarray(0, 32));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => typeof entryValue !== "undefined")
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(",")}}`;
}

function parseUsd(value?: string | null) {
  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function solanaCreditConfig() {
  const programId =
    process.env.SOLANA_CREDIT_PROGRAM_ID ||
    pubkeyFromSeed("jiagon:solana-credit-program:v0");

  return {
    cluster: process.env.SOLANA_CLUSTER || DEFAULT_SOLANA_CLUSTER,
    rpcUrl: process.env.SOLANA_RPC_URL || DEFAULT_SOLANA_RPC_URL,
    programId,
    programConfigured: Boolean(process.env.SOLANA_CREDIT_PROGRAM_ID),
    adapterMode: process.env.SOLANA_CREDIT_PROGRAM_ID ? "program-pda" : "signed-adapter",
  };
}

export function deriveSolanaCreditPdas({
  owner,
  sourceReceiptHash,
  credentialId,
}: {
  owner: string;
  sourceReceiptHash: string;
  credentialId: string;
}) {
  const { programId } = solanaCreditConfig();
  const ownerHash = sha256Hex(owner.toLowerCase());
  const receiptHash = sourceReceiptHash.toLowerCase();

  return {
    creditStatePda: pubkeyFromSeed(`pda:jiagon-credit-state:${programId}:${ownerHash}`),
    receiptPda: pubkeyFromSeed(`pda:jiagon-receipt:${programId}:${receiptHash}`),
    creditLinePda: pubkeyFromSeed(`pda:jiagon-purpose-credit:${programId}:${ownerHash}:starter`),
    metaplexCoreAsset: pubkeyFromSeed(`metaplex-core:jiagon-receipt:${credentialId}:${receiptHash}`),
  };
}

export function buildSolanaCreditMirror(input: SolanaCreditMirrorInput) {
  const receipt = input.receipt || {};
  const review = input.review || {};
  const credential = input.credential || {};
  const sourceTx = receipt.txFull || receipt.txHash || "";
  const logIndex = typeof receipt.logIndex === "number" ? receipt.logIndex : 0;
  const owner = input.owner || receipt.safe || "jiagon-local-owner";
  const sourceReceiptHash =
    credential.sourceReceiptHash ||
    `0x${sha256Hex(`${sourceTx.toLowerCase()}:${logIndex}`).slice(0, 64)}`;
  const dataHash =
    credential.dataHash ||
    `0x${sha256Hex(canonicalJson({ receipt, review, credentialId: credential.credentialId })).slice(0, 64)}`;
  const credentialId =
    credential.credentialId ||
    `solana-ready-${sha256Hex(`${sourceReceiptHash}:${dataHash}:${owner}`).slice(0, 12)}`;
  const amountUsd = parseUsd(receipt.amountUsd || receipt.amount);
  const pdas = deriveSolanaCreditPdas({ owner, sourceReceiptHash, credentialId });
  const config = solanaCreditConfig();
  const now = new Date().toISOString();
  const receiptCount = credential.status === "minted" || credential.status === "prepared" ? 1 : 0;
  const score = Math.min(100, receiptCount * 42 + Math.min(28, Math.floor(amountUsd)));
  const creditLimitUsd = receiptCount > 0 ? 50 : 0;

  const mirror = {
    version: "jiagon-solana-credit-v0",
    cluster: config.cluster,
    rpcUrl: config.rpcUrl,
    programId: config.programId,
    programConfigured: config.programConfigured,
    adapterMode: config.adapterMode,
    owner,
    source: {
      chain: "optimism",
      txHash: sourceTx,
      logIndex,
      sourceReceiptHash,
      amountUsd,
    },
    metaplexCore: {
      status: config.programConfigured ? "ready-to-mint" : "adapter-prepared",
      assetAddress: pdas.metaplexCoreAsset,
      collection: "Jiagon Receipt Credentials",
      name: `Jiagon Receipt ${credentialId}`,
      uri: credential.storageUri || `jiagon://receipt/${credentialId}`,
      plugins: {
        transferDelegate: "disabled",
        attributes: {
          proof: "etherfi-spend",
          merchantProof: "user-claimed",
          creditUse: "underwriting-input",
        },
      },
    },
    pda: {
      creditState: pdas.creditStatePda,
      receipt: pdas.receiptPda,
      purposeCreditLine: pdas.creditLinePda,
      seeds: {
        creditState: ["jiagon-credit-state", sha256Hex(owner.toLowerCase())],
        receipt: ["jiagon-receipt", sourceReceiptHash],
        purposeCreditLine: ["jiagon-purpose-credit", sha256Hex(owner.toLowerCase()), "starter"],
      },
    },
    creditState: {
      status: receiptCount > 0 ? "starter" : "locked",
      unlocked: receiptCount > 0,
      score,
      receiptCount,
      totalSpendUsd: amountUsd,
      availableCreditUsd: creditLimitUsd,
      purposeBound: true,
      policy: {
        maxDrawUsd: 25,
        allowedPurpose: "merchant escrow",
        expiryHours: 24,
      },
      updatedAt: now,
    },
    receiptCredential: {
      credentialId,
      credentialChain: credential.credentialChain || "solana-adapter",
      originCredentialTx: credential.credentialTx || null,
      status: credential.status || "prepared",
      proofLevel: credential.proofLevel || "C",
      dataHash,
    },
  };

  const signingSecret =
    process.env.JIAGON_SOLANA_ADAPTER_SECRET ||
    process.env.JIAGON_MINT_API_TOKEN ||
    "jiagon-local-solana-adapter";
  const canonical = canonicalJson(mirror);
  const signature = createHmac("sha256", signingSecret).update(canonical).digest("hex");

  return {
    ...mirror,
    signedAdapter: {
      algorithm: "HMAC-SHA256",
      digest: `0x${sha256Hex(canonical)}`,
      signature: `0x${signature}`,
      signedAt: now,
    },
  };
}
