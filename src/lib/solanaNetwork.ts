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
const TESTNET_RPC_ALLOWLIST_ENV = "JIAGON_ALLOWED_TESTNET_RPC_ORIGINS";

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

function normalizeUrl(value: string) {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

function explicitTestnetRpcAllowed(rpcUrl: string, allowlist: string | undefined) {
  const candidate = normalizeUrl(rpcUrl);
  if (!candidate) return false;

  return (allowlist || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .some((entry) => {
      const allowed = normalizeUrl(entry);
      if (!allowed) return false;

      const originOnly = allowed.pathname === "/" && !allowed.search && !allowed.hash;
      return originOnly ? candidate.origin === allowed.origin : candidate.href === allowed.href;
    });
}

export function solanaTestnetConfigFromEnv() {
  const rawCluster = process.env.SOLANA_CLUSTER;
  const rawRpcUrl = process.env.SOLANA_RPC_URL;
  assertSolanaTestnetOnly({ cluster: rawCluster, rpcUrl: rawRpcUrl });
  const cluster = normalizeSolanaTestCluster(rawCluster);
  const rpcUrl = rawRpcUrl?.trim() || DEFAULT_SOLANA_RPC_URLS[cluster];
  if (!rpcUrlAllowedForCluster(cluster, rpcUrl) && !explicitTestnetRpcAllowed(rpcUrl, process.env[TESTNET_RPC_ALLOWLIST_ENV])) {
    throw new Error(
      `Jiagon Solana verification only allows the default devnet/testnet/localnet RPC for SOLANA_CLUSTER. Custom testnet RPCs must match an origin or full URL in ${TESTNET_RPC_ALLOWLIST_ENV}; mainnet cluster/RPC endpoints remain blocked.`,
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
