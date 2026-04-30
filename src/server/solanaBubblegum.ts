import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mintV2, mplBubblegum, parseLeafFromMintV2Transaction, type MetadataArgsV2Args } from "@metaplex-foundation/mpl-bubblegum";
import { base58, keypairIdentity, none, publicKey, some, type OptionOrNullable, type PublicKey } from "@metaplex-foundation/umi";

const DEFAULT_SOLANA_CLUSTER = "devnet";
const DEFAULT_SOLANA_RPC_URL = "https://api.devnet.solana.com";

function configuredSecret(value: string | undefined) {
  const secret = (value || "").trim();
  return secret.length > 0 ? secret : null;
}

function parseSecretKey(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("Solana minter secret key JSON must be an array.");
    return Uint8Array.from(parsed.map((item) => {
      const byte = Number(item);
      if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
        throw new Error("Solana minter secret key contains an invalid byte.");
      }
      return byte;
    }));
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length > 80) {
    const decoded = Buffer.from(trimmed, "base64");
    if (decoded.length === 64) return new Uint8Array(decoded);
  }

  return base58.serialize(trimmed);
}

function clusterParam(cluster: string) {
  return cluster === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(cluster)}`;
}

export function solanaBubblegumConfig() {
  const cluster = process.env.SOLANA_CLUSTER || DEFAULT_SOLANA_CLUSTER;
  const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_SOLANA_RPC_URL;
  const merkleTree = configuredSecret(process.env.SOLANA_BUBBLEGUM_TREE);
  const minterSecret = configuredSecret(process.env.SOLANA_BUBBLEGUM_MINTER_SECRET_KEY);
  const collection = configuredSecret(process.env.SOLANA_BUBBLEGUM_COLLECTION);

  return {
    cluster,
    rpcUrl,
    merkleTree,
    collection,
    mintConfigured: Boolean(merkleTree && minterSecret),
    dasRequired: true,
  };
}

export async function mintJiagonBubblegumReceipt({
  leafOwner,
  sourceReceiptHash,
  dataHash,
  metadataUri,
  name,
}: {
  leafOwner: string;
  sourceReceiptHash: string;
  dataHash: string;
  metadataUri: string;
  name: string;
}) {
  const config = solanaBubblegumConfig();
  const minterSecret = configuredSecret(process.env.SOLANA_BUBBLEGUM_MINTER_SECRET_KEY);

  if (!config.merkleTree || !minterSecret) {
    throw new Error("Solana Bubblegum tree and minter are not configured.");
  }

  const umi = createUmi(config.rpcUrl).use(mplBubblegum());
  const keypair = umi.eddsa.createKeypairFromSecretKey(parseSecretKey(minterSecret));
  umi.use(keypairIdentity(keypair));

  const collection = config.collection ? publicKey(config.collection) as PublicKey : null;
  const metadata: MetadataArgsV2Args = {
    name: name.slice(0, 32),
    symbol: "JIAGON",
    uri: metadataUri,
    sellerFeeBasisPoints: 0,
    collection: (collection ? some(collection) : none()) as OptionOrNullable<PublicKey>,
    creators: [{ address: umi.identity.publicKey, verified: false, share: 100 }],
  };

  const { signature } = await mintV2(umi, {
    leafOwner: publicKey(leafOwner),
    merkleTree: publicKey(config.merkleTree),
    ...(collection ? { coreCollection: collection } : {}),
    metadata,
  }).sendAndConfirm(umi);
  const signatureText = base58.deserialize(signature)[0];
  const leaf = await parseLeafFromMintV2Transaction(umi, signature);
  const assetId = String(leaf.id);

  return {
    status: "minted" as const,
    network: `Solana ${config.cluster}`,
    cluster: config.cluster,
    credentialChain: `solana-${config.cluster}`,
    standard: "bubblegum-v2-cnft",
    merkleTree: config.merkleTree,
    leafOwner,
    assetId,
    leafNonce: Number(leaf.nonce),
    credentialTx: signatureText,
    explorerUrl: `https://solscan.io/tx/${signatureText}${clusterParam(config.cluster)}`,
    assetExplorerUrl: `https://solscan.io/token/${assetId}${clusterParam(config.cluster)}`,
    sourceReceiptHash,
    dataHash,
    storageUri: metadataUri,
    mintedAt: new Date().toISOString(),
    metaplex: {
      program: "mpl-bubblegum",
      version: "v2",
      collection: config.collection || null,
      dasRequired: true,
    },
  };
}
