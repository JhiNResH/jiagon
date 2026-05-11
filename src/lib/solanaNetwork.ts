export type JiagonSolanaCluster = "devnet" | "testnet" | "localnet";

export const DEFAULT_SOLANA_CLUSTER: JiagonSolanaCluster = "devnet";
export const DEFAULT_SOLANA_RPC_URL = "https://api.devnet.solana.com";

const MAINNET_CLUSTER_VALUES = new Set(["mainnet", "mainnet-beta"]);
const MAINNET_RPC_HINTS = [
  "api.mainnet-beta.solana.com",
  "mainnet",
  "mainnet.helius",
  "mainnet.quicknode",
  "mainnet.rpcpool",
  "mainnet.solana",
];
const DEFAULT_SOLANA_RPC_URLS: Record<JiagonSolanaCluster, string> = {
  devnet: DEFAULT_SOLANA_RPC_URL,
  testnet: "https://api.testnet.solana.com",
  localnet: "http://127.0.0.1:8899",
};
const LOCALNET_RPC_URLS = new Set([
  "http://127.0.0.1:8899",
  "http://localhost:8899",
  "http://0.0.0.0:8899",
]);

export function normalizeSolanaTestCluster(value: string | undefined): JiagonSolanaCluster {
  const cluster = (value || "").trim().toLowerCase();
  if (cluster === "devnet" || cluster === "testnet" || cluster === "localnet") return cluster;
  return DEFAULT_SOLANA_CLUSTER;
}

export function assertSolanaTestnetOnly(input: {
  cluster?: string;
  rpcUrl?: string;
}) {
  const cluster = (input.cluster || "").trim().toLowerCase();
  if (MAINNET_CLUSTER_VALUES.has(cluster)) {
    throw new Error("Jiagon demo is testnet-only. SOLANA_CLUSTER must be devnet, testnet, or localnet.");
  }

  const rpcUrl = (input.rpcUrl || "").trim().toLowerCase();
  if (MAINNET_RPC_HINTS.some((hint) => rpcUrl.includes(hint))) {
    throw new Error("Jiagon demo is testnet-only. SOLANA_RPC_URL must not point to mainnet.");
  }
}

function rpcUrlAllowedForCluster(cluster: JiagonSolanaCluster, rpcUrl: string) {
  if (rpcUrl === DEFAULT_SOLANA_RPC_URLS[cluster]) return true;
  return cluster === "localnet" && LOCALNET_RPC_URLS.has(rpcUrl);
}

export function solanaTestnetConfigFromEnv() {
  const rawCluster = process.env.SOLANA_CLUSTER;
  const rawRpcUrl = process.env.SOLANA_RPC_URL;
  assertSolanaTestnetOnly({ cluster: rawCluster, rpcUrl: rawRpcUrl });
  const cluster = normalizeSolanaTestCluster(rawCluster);
  const rpcUrl = rawRpcUrl?.trim() || DEFAULT_SOLANA_RPC_URLS[cluster];
  const allowCustomRpc = process.env.JIAGON_ALLOW_CUSTOM_TESTNET_RPC === "true";
  if (!allowCustomRpc && !rpcUrlAllowedForCluster(cluster, rpcUrl)) {
    throw new Error(
      "Jiagon Solana verification only allows the default devnet/testnet/localnet RPC for SOLANA_CLUSTER unless JIAGON_ALLOW_CUSTOM_TESTNET_RPC=true.",
    );
  }
  return {
    cluster,
    rpcUrl,
  };
}

export function solscanClusterParam(cluster: string) {
  const normalized = normalizeSolanaTestCluster(cluster);
  return `?cluster=${encodeURIComponent(normalized)}`;
}
