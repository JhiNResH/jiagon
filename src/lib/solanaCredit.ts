import { createHash, createHmac } from "node:crypto";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((char, index) => [char, index]));
const DEFAULT_SOLANA_CLUSTER = "devnet";
const DEFAULT_SOLANA_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_SOLANA_CREDIT_PROGRAM_ID = "J1gUW4ZJwSeff33p5kvMLzPHtNMwCy4D7BAPizQzNGjB";
const PDA_MARKER = "ProgramDerivedAddress";
const ED25519_P = (BigInt(1) << BigInt(255)) - BigInt(19);
let ed25519D: bigint | null = null;

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
  metaplexCoreAsset?: string | null;
};

export type SolanaCreditMirrorInput = {
  owner?: string | null;
  solanaOwner?: string | null;
  sourceOwner?: string | null;
  receipt?: ReceiptLike | null;
  review?: ReviewLike | null;
  credential?: CredentialLike | null;
};

type SolanaCreditMirrorOptions = {
  signingSecret: string;
};

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
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

function base58Decode(value: string) {
  let decoded = BigInt(0);
  for (const char of value) {
    const digit = BASE58_INDEX.get(char);
    if (typeof digit !== "number") throw new Error("Invalid Solana public key.");
    decoded = decoded * BigInt(58) + BigInt(digit);
  }

  let hex = decoded.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let bytes = decoded === BigInt(0) ? Buffer.alloc(0) : Buffer.from(hex, "hex");

  for (const char of value) {
    if (char !== BASE58_ALPHABET[0]) break;
    bytes = Buffer.concat([Buffer.from([0]), bytes]);
  }

  if (bytes.length > 32) throw new Error("Invalid Solana public key.");
  return Buffer.concat([Buffer.alloc(32 - bytes.length), bytes]);
}

function pubkeyBytes(value: string) {
  const bytes = base58Decode(value);
  if (bytes.length !== 32) throw new Error("Invalid Solana public key.");
  return bytes;
}

function bytes32FromHex(value: string) {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) throw new Error("Invalid source receipt hash.");
  return Buffer.from(hex, "hex");
}

function mod(value: bigint) {
  const reduced = value % ED25519_P;
  return reduced >= BigInt(0) ? reduced : reduced + ED25519_P;
}

function modPow(base: bigint, exponent: bigint) {
  let result = BigInt(1);
  let current = mod(base);
  let power = exponent;

  while (power > BigInt(0)) {
    if (power & BigInt(1)) result = mod(result * current);
    current = mod(current * current);
    power >>= BigInt(1);
  }

  return result;
}

function modInv(value: bigint) {
  return modPow(value, ED25519_P - BigInt(2));
}

function getEd25519D() {
  ed25519D = ed25519D ?? mod(-BigInt(121665) * modInv(BigInt(121666)));
  return ed25519D;
}

function littleEndianToBigInt(bytes: Buffer) {
  let value = BigInt(0);
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    value = (value << BigInt(8)) + BigInt(bytes[index]);
  }
  return value;
}

function isEd25519Point(bytes: Buffer) {
  const yBytes = Buffer.from(bytes);
  yBytes[31] &= 0x7f;
  const y = littleEndianToBigInt(yBytes);
  if (y >= ED25519_P) return false;

  const y2 = mod(y * y);
  const numerator = mod(y2 - BigInt(1));
  const denominator = mod(getEd25519D() * y2 + BigInt(1));
  if (denominator === BigInt(0)) return false;

  const x2 = mod(numerator * modInv(denominator));
  if (x2 === BigInt(0)) return true;

  const candidate = modPow(x2, (ED25519_P - BigInt(1)) / BigInt(2));
  return candidate === BigInt(1);
}

function createProgramAddress(seeds: Buffer[], programId: Buffer) {
  const seedLength = seeds.reduce((total, seed) => total + seed.length, 0);
  if (seeds.length > 16 || seeds.some((seed) => seed.length > 32) || seedLength > 512) {
    throw new Error("Invalid PDA seeds.");
  }

  const hash = createHash("sha256")
    .update(Buffer.concat([...seeds, programId, Buffer.from(PDA_MARKER)]))
    .digest();

  if (isEd25519Point(hash)) throw new Error("PDA seed produced an on-curve address.");
  return hash;
}

function findProgramAddress(seeds: Buffer[], programIdText: string) {
  const programId = pubkeyBytes(programIdText);
  for (let bump = 255; bump >= 0; bump -= 1) {
    try {
      const address = createProgramAddress([...seeds, Buffer.from([bump])], programId);
      return { address: base58Encode(address), bump };
    } catch {
      continue;
    }
  }

  throw new Error("Unable to derive Solana PDA.");
}

function assertSolanaPubkey(value: string | null | undefined, label: string) {
  if (!value) throw new Error(`${label} is required.`);
  pubkeyBytes(value);
  return value;
}

export function isSolanaPubkey(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    pubkeyBytes(value.trim());
    return true;
  } catch {
    return false;
  }
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
    DEFAULT_SOLANA_CREDIT_PROGRAM_ID;

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
}: {
  owner: string;
  sourceReceiptHash: string;
}) {
  const { programId } = solanaCreditConfig();
  const ownerBytes = pubkeyBytes(owner);
  const receiptHashBytes = bytes32FromHex(sourceReceiptHash);
  const creditState = findProgramAddress([Buffer.from("jiagon-credit-state"), ownerBytes], programId);
  const receipt = findProgramAddress([Buffer.from("jiagon-receipt"), ownerBytes, receiptHashBytes], programId);

  return {
    creditStatePda: creditState.address,
    creditStateBump: creditState.bump,
    receiptPda: receipt.address,
    receiptBump: receipt.bump,
  };
}

export function buildSolanaCreditMirror(input: SolanaCreditMirrorInput, options: SolanaCreditMirrorOptions) {
  if (!options.signingSecret || options.signingSecret.trim().length < 32) {
    throw new Error("Solana adapter signing secret is not configured.");
  }

  const receipt = input.receipt || {};
  const review = input.review || {};
  const credential = input.credential || {};
  const sourceTx = receipt.txFull || receipt.txHash || "";
  const logIndex = typeof receipt.logIndex === "number" ? receipt.logIndex : 0;
  const owner = assertSolanaPubkey(input.solanaOwner || input.owner, "Solana owner");
  const sourceOwner = input.sourceOwner || receipt.safe || null;
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
  const pdas = deriveSolanaCreditPdas({ owner, sourceReceiptHash });
  const config = solanaCreditConfig();
  const now = new Date().toISOString();
  const receiptCount = credential.status === "minted" || credential.status === "prepared" ? 1 : 0;
  const spendCents = Math.floor(amountUsd * 100);
  const score = Math.min(100, receiptCount * 28 + Math.min(44, Math.floor(spendCents / 100)));
  const creditLimitCents = score >= 70 ? 10_000 : score >= 35 ? 5_000 : score > 0 ? 2_500 : 0;
  const creditLimitUsd = creditLimitCents / 100;

  const mirror = {
    version: "jiagon-solana-credit-v0",
    cluster: config.cluster,
    rpcUrl: config.rpcUrl,
    programId: config.programId,
    programConfigured: config.programConfigured,
    adapterMode: config.adapterMode,
    owner,
    sourceOwner,
    source: {
      chain: "optimism",
      txHash: sourceTx,
      logIndex,
      sourceReceiptHash,
      amountUsd,
    },
    metaplexCore: {
      status: credential.metaplexCoreAsset ? "asset-provided" : "core-asset-required",
      assetAddress: credential.metaplexCoreAsset || null,
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
      bumps: {
        creditState: pdas.creditStateBump,
        receipt: pdas.receiptBump,
      },
      seeds: {
        creditState: ["jiagon-credit-state", owner],
        receipt: ["jiagon-receipt", owner, sourceReceiptHash],
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

  const canonical = canonicalJson(mirror);
  const signature = createHmac("sha256", options.signingSecret).update(canonical).digest("hex");

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
