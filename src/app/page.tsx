"use client";

import { useState, useEffect, useRef } from "react";
import { PrivyProvider, usePrivy, type PrivyClientConfig } from "@privy-io/react-auth";
import {
  OnboardingScreen, FeedScreen, InboxScreen, WriteReviewScreen,
  ReviewDetailScreen, ProfileScreen, CreditScreen,
} from "@/components/screens";
import { buildReceiptPublishMessage } from "@/lib/receiptPublish";
import { buildSolanaOwnerLinkMessage } from "@/lib/solanaOwnerLink";
import {
  buildSolayerProofMessage,
  type SolayerCreditProof,
  type SolayerProofInput,
} from "@/lib/solayerProof";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type Tab = "feed" | "inbox" | "credit" | "profile";
type VerifyStyle = "chip" | "stamp";
type Density = "compact" | "comfy";

type AuthState = {
  ready: boolean;
  authenticated: boolean;
  appConfigured: boolean;
  userLabel?: string;
  walletLabel?: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

type StoredSession = {
  userLabel?: string;
  walletLabel?: string;
  walletAddress?: string;
};

type PrivyBridge = {
  ready: boolean;
  authenticated: boolean;
  user: unknown;
  getAccessToken: () => Promise<string | null>;
  logout: () => Promise<void>;
};

const authStorageKey = "jiagon:privy-session";
const etherfiStorageKey = "jiagon:etherfi-sync";
const solayerProofsStorageKey = "jiagon:solayer-proofs";
const reviewsStorageKey = "jiagon:published-reviews";
const reviewedReceiptsStorageKey = "jiagon:reviewed-receipts";
const receiptCredentialsStorageKey = "jiagon:receipt-credentials";
const accountUserStorageKey = "jiagon:account-user-id";
const localDemoHosts = new Set(["localhost", "127.0.0.1", "::1"]);

const privyConfig: PrivyClientConfig = {
  loginMethods: ["wallet", "email", "google"],
  appearance: {
    theme: "light" as const,
    accentColor: "#A9573D" as const,
    showWalletLoginFirst: true,
    walletChainType: "ethereum-only" as const,
    walletList: [
      "detected_ethereum_wallets",
      "metamask",
      "coinbase_wallet",
      "base_account",
      "okx_wallet",
      "wallet_connect",
    ],
  },
  embeddedWallets: {
    ethereum: { createOnLogin: "off" as const },
    solana: { createOnLogin: "off" as const },
    showWalletUIs: false,
  },
};

const shortAddress = (address?: string) => {
  if (!address) return undefined;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

const getPrimaryWallet = (user: unknown) => {
  const typedUser = user as {
    wallet?: { address?: string };
    linkedAccounts?: Array<{ type?: string; address?: string }>;
  } | null;

  return (
    typedUser?.wallet?.address ||
    typedUser?.linkedAccounts?.find((account) => account.type === "wallet")?.address
  );
};

const getUserLabel = (user: unknown, walletAddress?: string) => {
  const typedUser = user as {
    id?: string;
    email?: { address?: string };
    phone?: { number?: string };
    google?: { email?: string };
    linkedAccounts?: Array<{
      type?: string;
      email?: string;
      address?: string;
      phoneNumber?: string;
    }>;
  } | null;

  const linkedEmail = typedUser?.linkedAccounts?.find((account) => account.email)?.email;
  const linkedPhone = typedUser?.linkedAccounts?.find((account) => account.phoneNumber)?.phoneNumber;

  return (
    typedUser?.email?.address ||
    typedUser?.google?.email ||
    linkedEmail ||
    typedUser?.phone?.number ||
    linkedPhone ||
    shortAddress(walletAddress) ||
    typedUser?.id
  );
};

const proofBoundary = {
  payment: "verified",
  merchant: "user_claimed",
  review: "published_after_verified_payment",
  recommendationUse: "ranking signal, not an official merchant fact",
};

type EtherfiReceipt = {
  id: string;
  txHash: string;
  txShort: string;
  blockNumber: number;
  timestamp?: number;
  amountUsd: string;
  proof: string;
  chain: string;
};

type EtherfiSyncState = {
  safe?: string;
  sourceTx?: string;
  sourceTxBlock?: number;
  status: "idle" | "scanning" | "synced" | "error";
  receipts: EtherfiReceipt[];
  totalSpendUsd?: string;
  count?: number;
  scope?: string;
  lookbackBlocks?: number;
  fromBlock?: number;
  toBlock?: number;
  scannedAt?: string;
  error?: string;
};

type EtherfiSpendPayload = Omit<EtherfiSyncState, "status" | "scannedAt" | "error">;

type ReceiptCredential = {
  receiptId: string;
  reviewId: string;
  status: string;
  mode?: string;
  network: string;
  chainId: number;
  credentialChain: string;
  credentialId: string;
  preparedCredentialId?: string;
  credentialTx?: string | null;
  explorerUrl?: string | null;
  storageLayer: string;
  storageUri: string;
  requestedStorageUri?: string;
  sourceReceiptHash?: string;
  solanaOwner?: string;
  dataHash: string;
  requestedDataHash?: string;
  dataMatchesRequest?: boolean;
  proofLevel: string;
  mintedAt: string;
  preparedAt?: string;
  minter?: string;
  note?: string;
  persistence?: {
    configured: boolean;
    persisted: boolean;
    reason?: string;
    error?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onchain?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  solana?: any;
};

const emptyEtherfiSync: EtherfiSyncState = {
  status: "idle",
  receipts: [],
};

function shortHash(value?: string | null) {
  if (!value) return "published";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFeedReviewFromPublic(record: any) {
  const branch = record.branch || "Local";
  const attributes = record.reviewAttributes || {};

  return {
    id: record.reviewId || record.receiptId,
    receiptId: record.receiptId,
    reviewId: record.reviewId,
    author: "you",
    avatar: "var(--accent-soft)",
    rep: "verified",
    handle: record.publicProofId ? `proof ${record.publicProofId}` : shortHash(record.credentialTx),
    merchant: record.merchant,
    branch,
    cat: `Local · ${branch}`,
    rating: record.rating,
    time: record.createdAt ? new Date(record.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "published",
    tags: Array.isArray(record.tags) ? record.tags : [],
    text: record.reviewText || "",
    tx: shortHash(record.credentialTx),
    amount: record.token ? `Verified ${record.token}` : "Verified receipt",
    proofLevel: `${record.proofLevel || "B"} · BNB minted`,
    credentialTx: record.credentialTx ? shortHash(record.credentialTx) : record.credentialId,
    credential: {
      status: record.status,
      mode: record.mode,
      credentialChain: record.credentialChain,
      chainId: record.chainId,
      credentialId: record.credentialId,
      credentialTx: record.credentialTx,
      explorerUrl: record.explorerUrl,
      storageUri: record.storageUri,
      dataHash: record.dataHash,
      dataMatchesRequest: record.dataMatchesRequest,
      proofLevel: record.proofLevel,
    },
    dataMatchesRequest: record.dataMatchesRequest,
    verifiedVisits: 1,
    merchantProof: "C · user claimed",
    visitType: attributes.visitType,
    occasion: attributes.occasion,
    valueRating: attributes.valueRating,
    wouldReturn: attributes.wouldReturn,
    bestFor: Array.isArray(attributes.bestFor) ? attributes.bestFor : [],
    agentSignals: {
      visitType: attributes.visitType || null,
      occasion: attributes.occasion || null,
      valueRating: attributes.valueRating || null,
      wouldReturn: typeof attributes.wouldReturn === "boolean" ? attributes.wouldReturn : null,
      bestFor: Array.isArray(attributes.bestFor) ? attributes.bestFor : [],
    },
    proofBoundary,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeReviews(current: any[], incoming: any[]) {
  const byId = new Map<string, any>();
  for (const review of incoming) {
    if (review?.id) byId.set(review.id, review);
  }
  for (const review of current) {
    if (review?.id) byId.set(review.id, review);
  }
  return Array.from(byId.values());
}

function readStoredJson(key: string) {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function normalizeRestoredEtherfiSync(value: unknown): EtherfiSyncState | null {
  if (!value || typeof value !== "object") return null;

  const state = value as Partial<EtherfiSyncState>;
  const receipts = Array.isArray(state.receipts) ? state.receipts : [];
  const status = state.status;

  if (status === "scanning") {
    if (receipts.length > 0) {
      return {
        ...state,
        status: "synced",
        receipts,
        error: undefined,
        scannedAt: state.scannedAt || new Date().toISOString(),
      } as EtherfiSyncState;
    }

    return {
      safe: state.safe,
      sourceTx: state.sourceTx,
      sourceTxBlock: state.sourceTxBlock,
      status: "idle",
      receipts: [],
    };
  }

  if (status === "idle" || status === "synced" || status === "error") {
    return {
      ...state,
      status,
      receipts,
    } as EtherfiSyncState;
  }

  return null;
}

function writeStoredEtherfiSync(state: EtherfiSyncState) {
  const normalized = normalizeRestoredEtherfiSync(state);
  if (!normalized) return;
  window.localStorage.setItem(etherfiStorageKey, JSON.stringify(normalized));
}

function normalizeRestoredSolayerProofs(value: unknown): SolayerCreditProof[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((proof): proof is SolayerCreditProof => {
      const record = proof && typeof proof === "object" ? proof as Record<string, any> : null;
      return Boolean(
        record &&
        record.provider === "solayer" &&
        record.status === "adapter-attested" &&
        typeof record.proofHash === "string" &&
        typeof record.signedAdapter?.signature === "string",
      );
    })
    .slice(0, 25);
}

function writeStoredSolayerProofs(proofs: SolayerCreditProof[]) {
  window.localStorage.setItem(solayerProofsStorageKey, JSON.stringify(normalizeRestoredSolayerProofs(proofs)));
}

function hydrateLocalPrivateState(
  setEtherfiSyncState: (state: EtherfiSyncState) => void,
  setSolayerProofsState: (proofs: SolayerCreditProof[]) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setReviewsState: (reviews: any[]) => void,
  setReviewedIdsState: (ids: string[]) => void,
  setCredentialsState: (credentials: Record<string, ReceiptCredential>) => void,
) {
  const storedEtherfiSync = normalizeRestoredEtherfiSync(readStoredJson(etherfiStorageKey));
  if (storedEtherfiSync) {
    setEtherfiSyncState(storedEtherfiSync);
    writeStoredEtherfiSync(storedEtherfiSync);
  }

  const storedSolayerProofs = normalizeRestoredSolayerProofs(readStoredJson(solayerProofsStorageKey));
  if (storedSolayerProofs.length > 0) {
    setSolayerProofsState(storedSolayerProofs);
    writeStoredSolayerProofs(storedSolayerProofs);
  }

  const storedReviews = readStoredJson(reviewsStorageKey);
  if (Array.isArray(storedReviews)) setReviewsState(storedReviews);

  const storedReviewedReceiptIds = readStoredJson(reviewedReceiptsStorageKey);
  if (Array.isArray(storedReviewedReceiptIds)) setReviewedIdsState(storedReviewedReceiptIds);

  const storedReceiptCredentials = readStoredJson(receiptCredentialsStorageKey);
  if (
    storedReceiptCredentials &&
    typeof storedReceiptCredentials === "object" &&
    !Array.isArray(storedReceiptCredentials)
  ) {
    setCredentialsState(storedReceiptCredentials as Record<string, ReceiptCredential>);
  }
}

function initialTabFromPath(): Tab {
  if (typeof window === "undefined") return "inbox";
  if (window.location.pathname === "/credit") return "credit";
  return "inbox";
}

function pathForTab(tab: Tab) {
  return tab === "credit" ? "/credit" : "/";
}

const webTabs: Array<{ id: Tab; label: string; sub: string }> = [
  { id: "inbox", label: "Receipts", sub: "Scan tx and claim proof" },
  { id: "credit", label: "Credit", sub: "Passport and draw" },
  { id: "feed", label: "Taste", sub: "Published proof feed" },
  { id: "profile", label: "Profile", sub: "Wallet and reputation" },
];

const webShellStyles = `
.jiagon-web-shell{min-height:100vh;display:grid;grid-template-columns:300px minmax(0,1fr);background:radial-gradient(circle at 10% 0%,oklch(0.98 0.008 105) 0 280px,transparent 430px),linear-gradient(135deg,oklch(0.945 0.016 115) 0%,oklch(0.91 0.014 92) 58%,oklch(0.90 0.018 128) 100%);color:var(--ink)}.jiagon-web-sidebar{min-height:100vh;padding:26px 18px;border-right:.5px solid var(--rule);background:oklch(0.985 0.005 95 / .74);backdrop-filter:blur(18px);display:flex;flex-direction:column;gap:18px}.jiagon-web-brand{display:flex;align-items:center;gap:13px;padding:4px 4px 12px}.jiagon-web-mark{width:54px;height:54px;border:3px solid var(--verified);border-radius:9px;background:var(--receipt);color:var(--verified);display:grid;place-items:center;position:relative;flex:0 0 auto;box-shadow:0 10px 24px rgba(24,58,38,.10)}.jiagon-web-mark span{font-family:Georgia,'Times New Roman',serif;font-size:36px;font-weight:700;line-height:1;transform:translateY(-2px)}.jiagon-web-mark i{position:absolute;left:9px;right:18px;bottom:8px;border-bottom:2px dotted var(--verified)}.jiagon-web-mark b{position:absolute;top:4px;right:4px;width:16px;height:16px;border-radius:999px;background:var(--ink);color:var(--receipt);display:grid;place-items:center;font-family:var(--ui);font-size:10px}.jiagon-web-wordmark{font-family:var(--display);font-size:36px;line-height:.9;color:var(--verified)}.jiagon-web-kicker{font-family:var(--mono);font-size:10px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:1px}.jiagon-web-primary{min-height:46px;border:none;border-radius:10px;background:var(--verified);color:var(--panel-text);font-family:var(--ui);font-size:14px;font-weight:800;cursor:pointer}.jiagon-web-nav{display:grid;gap:7px}.jiagon-web-nav-item{text-align:left;border:.5px solid transparent;border-radius:10px;background:transparent;color:var(--ink);padding:12px;cursor:pointer}.jiagon-web-nav-item:hover,.jiagon-web-nav-item[data-active="true"]{border-color:var(--rule);background:var(--receipt);box-shadow:0 1px 0 rgba(24,24,24,.04)}.jiagon-web-nav-item span{display:block;font-family:var(--ui);font-size:14px;font-weight:800}.jiagon-web-nav-item small{display:block;margin-top:3px;font-family:var(--mono);font-size:9.5px;line-height:1.3;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.55px}.jiagon-web-status{margin-top:auto;border:.5px solid var(--rule);border-radius:12px;background:var(--receipt);padding:14px}.jiagon-web-status-grid{display:grid;grid-template-columns:1fr;gap:7px;margin-top:10px}.jiagon-web-status-grid div{display:flex;justify-content:space-between;gap:12px;font-family:var(--mono);font-size:10.5px;padding:6px 0;border-bottom:.5px dashed var(--rule)}.jiagon-web-status-grid span{color:var(--ink-muted)}.jiagon-web-status-grid strong{color:var(--ink)}.jiagon-web-status p{margin:10px 0 0;color:var(--ink-muted);font-size:12.5px;line-height:1.45}.jiagon-web-main{min-width:0;min-height:100vh;padding:28px clamp(22px,4vw,56px);position:relative}.jiagon-web-top{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:18px}.jiagon-web-top h1{margin:5px 0 0;font-family:var(--display);font-style:italic;font-weight:400;font-size:clamp(42px,5vw,70px);line-height:.92;color:var(--ink)}.jiagon-web-proofline{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.jiagon-web-proofline span{border:.5px solid var(--rule);border-radius:999px;background:var(--receipt);color:var(--ink-muted);padding:7px 10px;font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.65px}.jiagon-web-workspace{min-height:0!important;border:0!important;border-radius:0!important;background:transparent!important;overflow:visible!important;box-shadow:none!important}.jiagon-web-content{max-width:1040px;position:relative;background:transparent!important}.jiagon-web-content>div{height:auto!important;min-height:0!important;background:transparent!important;overflow:visible!important}.jiagon-web-content>div>div:first-child{background:transparent!important}.jiagon-web-modal-root{position:absolute;inset:28px clamp(22px,4vw,56px);pointer-events:none;z-index:50}.jiagon-web-modal-root .screen{pointer-events:auto;position:absolute;inset:0;max-width:920px;margin:auto;border:.5px solid var(--rule);border-radius:12px;overflow:hidden;box-shadow:0 24px 90px rgba(24,24,24,.18)}@media(max-width:900px){.jiagon-web-shell{grid-template-columns:1fr}.jiagon-web-sidebar{min-height:auto;border-right:none;border-bottom:.5px solid var(--rule);padding:16px}.jiagon-web-nav{grid-template-columns:repeat(4,minmax(120px,1fr));overflow-x:auto}.jiagon-web-status{display:none}.jiagon-web-main{min-height:78vh;padding:18px 14px 28px}.jiagon-web-top{display:grid;align-items:start}.jiagon-web-proofline{justify-content:flex-start}.jiagon-web-workspace{min-height:0!important}}
`;

const logoMarkStyles = `
.jiagon-logo-mark{display:block;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(24,58,38,.10));flex:0 0 auto}.jiagon-logo-mark-sidebar{width:64px;height:70px}.jiagon-logo-mark-passport{width:92px;height:101px}
`;

const webUiPolishStyles = `
.jiagon-web-shell{grid-template-columns:280px minmax(0,1fr)!important;height:100vh!important;min-height:100vh!important;overflow:hidden!important}.jiagon-web-sidebar{padding:24px 18px!important;gap:16px!important;height:100vh!important;min-height:100vh!important;position:sticky!important;top:0!important;overflow:hidden!important}.jiagon-web-brand{gap:10px!important}.jiagon-web-wordmark{font-size:34px!important}.jiagon-web-main{padding:24px clamp(24px,4vw,64px) 42px!important;height:100vh!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain!important}.jiagon-web-top{align-items:center!important;margin-bottom:22px!important}.jiagon-web-top h1{display:none!important}.jiagon-web-proofline{margin-left:auto}.jiagon-web-content{max-width:1120px!important}.jiagon-web-content:not(.jiagon-web-content-onboarding)>div>div:first-child{padding-top:0!important;padding-bottom:14px!important;position:relative!important;top:auto!important;background:transparent!important;border-bottom:0!important}.jiagon-web-content:not(.jiagon-web-content-onboarding)>div>div:first-child>div:first-child{padding-left:0!important;padding-right:0!important}.jiagon-web-content:not(.jiagon-web-content-onboarding)>div>div:first-child>div:last-child{padding-left:0!important;padding-right:0!important}.jiagon-web-content:not(.jiagon-web-content-onboarding) .jiagon-topbar{padding-top:0!important;padding-bottom:18px!important;position:relative!important;top:auto!important;z-index:1!important;background:transparent!important;border-bottom:0!important}.jiagon-web-content:not(.jiagon-web-content-onboarding) .jiagon-topbar-controls{display:none!important}.jiagon-web-content:not(.jiagon-web-content-onboarding) .jiagon-topbar-copy{padding:0!important}.jiagon-web-content:not(.jiagon-web-content-onboarding) .jiagon-topbar-title{font-size:clamp(42px,4.6vw,58px)!important;line-height:.9!important;letter-spacing:0!important}.jiagon-web-content:not(.jiagon-web-content-onboarding) .jiagon-topbar-sub{margin-top:8px!important;font-size:10px!important}.jiagon-web-nav{gap:6px!important}.jiagon-web-nav-item{padding:12px!important}.jiagon-web-nav-item[data-active="true"]{background:oklch(0.992 0.004 100)!important;border-color:color-mix(in oklch,var(--verified) 24%,var(--rule))!important}.jiagon-web-status{background:oklch(0.992 0.004 100 / .82)!important;padding:12px!important}.jiagon-web-status-grid{gap:4px!important;margin-top:8px!important}.jiagon-web-status-grid div{padding:5px 0!important}.jiagon-web-status p{font-size:11.5px!important;line-height:1.35!important;margin-top:8px!important}.jiagon-web-primary{box-shadow:0 8px 22px rgba(0,96,48,.16)}.jiagon-credit-screen{height:auto!important;overflow:visible!important;background:transparent!important;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(330px,380px)!important;gap:14px!important;align-items:start!important}.jiagon-credit-screen .jiagon-topbar{grid-column:1/-1}.jiagon-credit-panel-wrap{padding:0!important;min-width:0}.jiagon-credit-panel-wrap>div{border-radius:10px!important}.jiagon-credit-panel-wrap button{border-radius:10px!important}.jiagon-credit-passport-wrap{grid-column:1/-1}.jiagon-credit-next-wrap,.jiagon-credit-solayer-wrap{grid-column:1}.jiagon-credit-draw-wrap{grid-column:2}.jiagon-credit-draw-wrap-unlocked{grid-column:1/-1}@media(max-height:980px) and (min-width:901px){.jiagon-web-sidebar{gap:12px!important}.jiagon-web-brand{padding-bottom:6px!important}.jiagon-web-status{display:none!important}.jiagon-web-nav-item{padding:10px 12px!important}}@media(max-width:1100px){.jiagon-credit-screen{grid-template-columns:1fr!important}.jiagon-credit-passport-wrap,.jiagon-credit-next-wrap,.jiagon-credit-solayer-wrap,.jiagon-credit-draw-wrap{grid-column:1/-1!important}}@media(max-width:900px){.jiagon-web-shell{grid-template-columns:1fr!important;height:auto!important;min-height:100vh!important;overflow:visible!important}.jiagon-web-sidebar{height:auto!important;min-height:auto!important;position:relative!important;overflow:visible!important}.jiagon-web-main{padding:16px 14px 30px!important;height:auto!important;min-height:78vh!important;overflow:visible!important}.jiagon-web-top{display:grid!important}.jiagon-web-content:not(.jiagon-web-content-onboarding)>div>div:first-child{padding-top:0!important}}
`;

const webDialogStyles = `
.jiagon-web-modal-root-active{position:fixed!important;inset:0!important;z-index:1000!important;pointer-events:auto!important;background:rgba(24,32,26,.28)!important;backdrop-filter:blur(8px);display:grid!important;place-items:center!important;padding:36px!important}.jiagon-web-modal-root-active .screen{position:relative!important;inset:auto!important;width:min(920px,calc(100vw - 72px))!important;height:min(820px,calc(100vh - 72px))!important;max-width:none!important;margin:0!important;border-radius:12px!important}.jiagon-web-modal-close{position:fixed;top:18px;right:18px;z-index:1100;border:.5px solid var(--rule);border-radius:999px;background:var(--receipt);color:var(--ink);min-height:38px;padding:0 14px;font-family:var(--ui);font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 10px 28px rgba(24,24,24,.14)}.jiagon-web-modal-close:hover{background:var(--verified-soft)}@media(max-width:900px){.jiagon-web-modal-root-active{padding:12px!important;place-items:stretch!important}.jiagon-web-modal-root-active .screen{width:100%!important;height:calc(100vh - 24px)!important}.jiagon-web-modal-close{top:18px;right:18px}}
`;

function WebNav({
  active,
  onChange,
  onImport,
  authenticated,
  receiptCount,
  credentialCount,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  onImport: () => void;
  authenticated: boolean;
  receiptCount: number;
  credentialCount: number;
}) {
  return (
    <aside className="jiagon-web-sidebar">
      <div className="jiagon-web-brand">
        <img className="jiagon-logo-mark jiagon-logo-mark-sidebar" src="/jiagon-logo-mark.png" alt="" aria-hidden="true" />
        <div>
          <div className="jiagon-web-wordmark">Jiagon</div>
          <div className="jiagon-web-kicker">Receipt-backed credit</div>
        </div>
      </div>

      <button className="jiagon-web-primary" onClick={onImport}>
        Scan spend tx
      </button>

      <nav className="jiagon-web-nav" aria-label="Jiagon sections">
        {webTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className="jiagon-web-nav-item"
            data-active={active === item.id ? "true" : undefined}
            onClick={() => onChange(item.id)}
          >
            <span>{item.label}</span>
            <small>{item.sub}</small>
          </button>
        ))}
      </nav>

      <div className="jiagon-web-status">
        <div className="jiagon-web-kicker">MVP status</div>
        <div className="jiagon-web-status-grid">
          <div>
            <span>Auth</span>
            <strong>{authenticated ? "Connected" : "Local"}</strong>
          </div>
          <div>
            <span>Receipts</span>
            <strong>{receiptCount}</strong>
          </div>
          <div>
            <span>Credentials</span>
            <strong>{credentialCount}</strong>
          </div>
        </div>
        <p>Scan a real spend proof first. Credit unlocks only after receipt proof becomes credential state.</p>
      </div>
    </aside>
  );
}

function HomeShell({ privy }: { privy?: PrivyBridge | null }) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTabFromPath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reviewing, setReviewing] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detail, setDetail] = useState<any>(null);
  const [showOnboard, setShowOnboard] = useState(() => initialTabFromPath() !== "credit");
  const [authBusy, setAuthBusy] = useState(false);
  const [authSession, setAuthSession] = useState<StoredSession | null>(null);
  const [etherfiSync, setEtherfiSync] = useState<EtherfiSyncState>(emptyEtherfiSync);
  const [solayerProofs, setSolayerProofs] = useState<SolayerCreditProof[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [publishedReviews, setPublishedReviews] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [publicReviews, setPublicReviews] = useState<any[]>([]);
  const [reviewedReceiptIds, setReviewedReceiptIds] = useState<string[]>([]);
  const [receiptCredentials, setReceiptCredentials] = useState<Record<string, ReceiptCredential>>({});
  const [accountStateReady, setAccountStateReady] = useState(false);
  const [accountStateUpdatedAt, setAccountStateUpdatedAt] = useState<string | null>(null);
  const privyUserIdRef = useRef<string | null>(null);
  const localHydratedUserRef = useRef<string | null>(null);
  const etherfiScanKeyRef = useRef<string | null>(null);
  const lastPersistableEtherfiSyncRef = useRef<EtherfiSyncState | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    const stored = window.localStorage.getItem(authStorageKey);
    if (stored) {
      try {
        const session = JSON.parse(stored) as StoredSession;
        if (session.userLabel === "preview@jiagon.local" || session.walletLabel === "0xpreview") {
          window.localStorage.removeItem(authStorageKey);
        } else {
          setAuthSession(session);
        }
      } catch {
        window.localStorage.removeItem(authStorageKey);
      }
    }

    if (!stored) {
      window.localStorage.removeItem(accountUserStorageKey);
    }
  }, []);

  const verifyStyle: VerifyStyle = "chip";
  const density: Density = "comfy";
  const dark = false;
  const hasPrivyAppId = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

  const clearAccountScopedState = () => {
    etherfiScanKeyRef.current = null;
    localHydratedUserRef.current = null;
    lastPersistableEtherfiSyncRef.current = null;
    setEtherfiSync(emptyEtherfiSync);
    setSolayerProofs([]);
    setPublishedReviews([]);
    setReviewedReceiptIds([]);
    setReceiptCredentials({});
    window.localStorage.removeItem(etherfiStorageKey);
    window.localStorage.removeItem(solayerProofsStorageKey);
    window.localStorage.removeItem(reviewsStorageKey);
    window.localStorage.removeItem(reviewedReceiptsStorageKey);
    window.localStorage.removeItem(receiptCredentialsStorageKey);
  };

  useEffect(() => {
    if (!mounted || !privy?.ready || !privy.authenticated) return;

    const typedUser = privy.user as { id?: string } | null;
    const privyUserId = typedUser?.id || null;
    const previousPrivyUserId = privyUserIdRef.current;
    const storedPrivyUserId = window.localStorage.getItem(accountUserStorageKey);
    const accountChanged = Boolean(
      (privyUserId && storedPrivyUserId !== privyUserId) ||
      (privyUserId && previousPrivyUserId && privyUserId !== previousPrivyUserId),
    );

    if (accountChanged) {
      clearAccountScopedState();
      setAccountStateReady(false);
      setAccountStateUpdatedAt(null);
    }

    privyUserIdRef.current = privyUserId;
    if (privyUserId) {
      if (!accountChanged && storedPrivyUserId === privyUserId && localHydratedUserRef.current !== privyUserId) {
        hydrateLocalPrivateState(setEtherfiSync, setSolayerProofs, setPublishedReviews, setReviewedReceiptIds, setReceiptCredentials);
        localHydratedUserRef.current = privyUserId;
      }

      window.localStorage.setItem(accountUserStorageKey, privyUserId);
    }

    const walletAddress = getPrimaryWallet(privy.user);
    const session: StoredSession = {
      userLabel: getUserLabel(privy.user, walletAddress),
      walletLabel: shortAddress(walletAddress),
      walletAddress,
    };

    setAuthSession(session);
    window.localStorage.setItem(authStorageKey, JSON.stringify(session));
  }, [mounted, privy?.authenticated, privy?.ready, privy?.user]);

  useEffect(() => {
    if (!mounted || !privy?.ready) return;
    if (!privy.authenticated) {
      setAccountStateReady(false);
      return;
    }

    let cancelled = false;

    const hydrateAccountState = async () => {
      const token = await privy.getAccessToken();
      if (!token || cancelled) return;

      const response = await fetch("/api/account/state", {
        cache: "no-store",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      if (cancelled) return;
      if (!response.ok) {
        setAccountStateReady(false);
        return;
      }

      const payload = await response.json();
      const state = payload?.state;

      if (!state) {
        setAccountStateUpdatedAt(payload?.updatedAt || null);
        setAccountStateReady(true);
        return;
      }

      const restoredEtherfiSync = normalizeRestoredEtherfiSync(state.etherfiSync);
      if (restoredEtherfiSync) {
        setEtherfiSync(restoredEtherfiSync);
        writeStoredEtherfiSync(restoredEtherfiSync);
      }

      const restoredSolayerProofs = normalizeRestoredSolayerProofs(state.solayerProofs);
      if (restoredSolayerProofs.length > 0) {
        setSolayerProofs(restoredSolayerProofs);
        writeStoredSolayerProofs(restoredSolayerProofs);
      }

      if (Array.isArray(state.publishedReviews)) {
        setPublishedReviews(state.publishedReviews);
        window.localStorage.setItem(reviewsStorageKey, JSON.stringify(state.publishedReviews));
      }

      if (Array.isArray(state.reviewedReceiptIds)) {
        setReviewedReceiptIds(state.reviewedReceiptIds);
        window.localStorage.setItem(reviewedReceiptsStorageKey, JSON.stringify(state.reviewedReceiptIds));
      }

      if (state.receiptCredentials && typeof state.receiptCredentials === "object" && !Array.isArray(state.receiptCredentials)) {
        setReceiptCredentials(state.receiptCredentials);
        window.localStorage.setItem(receiptCredentialsStorageKey, JSON.stringify(state.receiptCredentials));
      }

      setAccountStateUpdatedAt(payload?.updatedAt || null);
      setAccountStateReady(true);
    };

    hydrateAccountState().catch(() => {
      if (!cancelled) setAccountStateReady(false);
    });

    return () => {
      cancelled = true;
    };
  }, [mounted, privy?.authenticated, privy?.getAccessToken, privy?.ready, privy?.user]);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;

    const loadPublicReviews = async () => {
      const response = await fetch("/api/receipts/reviews?limit=50", { cache: "no-store" });
      if (!response.ok || cancelled) return;

      const payload = await response.json();
      const publicReviews = Array.isArray(payload?.reviews)
        ? payload.reviews.map(toFeedReviewFromPublic)
        : [];

      if (publicReviews.length === 0 || cancelled) return;

      setPublicReviews(publicReviews);
    };

    loadPublicReviews().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !accountStateReady || !privy?.ready || !privy.authenticated) return;

    const timeout = window.setTimeout(async () => {
      const token = await privy.getAccessToken();
      if (!token) return;
      const persistableEtherfiSync = etherfiSync.status === "scanning"
        ? lastPersistableEtherfiSyncRef.current || undefined
        : etherfiSync;

      await fetch("/api/account/state", {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          wallet: authSession?.walletAddress || null,
          userLabel: authSession?.userLabel || authSession?.walletLabel || null,
          ifUnmodifiedSince: accountStateUpdatedAt,
          state: {
            etherfiSync: persistableEtherfiSync,
            solayerProofs,
            publishedReviews,
            reviewedReceiptIds,
            receiptCredentials,
          },
        }),
      }).then(async (response) => {
        if (response.status === 409) {
          const payload = await response.json();
          const state = payload?.state;
          if (state) {
            const restoredEtherfiSync = normalizeRestoredEtherfiSync(state.etherfiSync);
            if (restoredEtherfiSync) {
              setEtherfiSync(restoredEtherfiSync);
              writeStoredEtherfiSync(restoredEtherfiSync);
            }
            const restoredSolayerProofs = normalizeRestoredSolayerProofs(state.solayerProofs);
            if (restoredSolayerProofs.length > 0) {
              setSolayerProofs(restoredSolayerProofs);
              writeStoredSolayerProofs(restoredSolayerProofs);
            }
            if (Array.isArray(state.publishedReviews)) {
              setPublishedReviews(state.publishedReviews);
              window.localStorage.setItem(reviewsStorageKey, JSON.stringify(state.publishedReviews));
            }
            if (Array.isArray(state.reviewedReceiptIds)) {
              setReviewedReceiptIds(state.reviewedReceiptIds);
              window.localStorage.setItem(reviewedReceiptsStorageKey, JSON.stringify(state.reviewedReceiptIds));
            }
            if (state.receiptCredentials && typeof state.receiptCredentials === "object" && !Array.isArray(state.receiptCredentials)) {
              setReceiptCredentials(state.receiptCredentials);
              window.localStorage.setItem(receiptCredentialsStorageKey, JSON.stringify(state.receiptCredentials));
            }
          }
          setAccountStateUpdatedAt(payload?.updatedAt || null);
          return;
        }

        if (response.ok) {
          const payload = await response.json();
          setAccountStateUpdatedAt(payload?.updatedAt || null);
        }
      });
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [
    accountStateReady,
    accountStateUpdatedAt,
    authSession?.userLabel,
    authSession?.walletAddress,
    authSession?.walletLabel,
    etherfiSync,
    mounted,
    privy?.authenticated,
    privy?.getAccessToken,
    privy?.ready,
    publishedReviews,
    receiptCredentials,
    reviewedReceiptIds,
    solayerProofs,
  ]);

  useEffect(() => {
    if (etherfiSync.status === "scanning") return;
    const normalized = normalizeRestoredEtherfiSync(etherfiSync);
    if (normalized) lastPersistableEtherfiSyncRef.current = normalized;
  }, [etherfiSync]);

  const visibleReviews = mergeReviews(publishedReviews, publicReviews);

  const auth: AuthState = {
    ready: !authBusy,
    authenticated: Boolean(authSession),
    appConfigured: hasPrivyAppId,
    userLabel: authSession?.userLabel,
    walletLabel: authSession?.walletLabel,
    login: async () => {
      if (hasPrivyAppId) {
        window.location.href = "/auth";
        return;
      }

      setAuthBusy(false);
    },
    logout: async () => {
      await privy?.logout();
      setAuthSession(null);
      setAuthBusy(false);
      clearAccountScopedState();
      window.localStorage.removeItem(authStorageKey);
      window.localStorage.removeItem(accountUserStorageKey);
      setAccountStateReady(false);
      setAccountStateUpdatedAt(null);
      privyUserIdRef.current = null;
    },
  };

  const scanEtherfiProof = async (proof: string) => {
    const nextProof = proof.trim();
    const isTx = /^0x[a-fA-F0-9]{64}$/.test(nextProof);
    const queryKey = isTx ? "tx" : "safe";
    const scanKey = `${queryKey}:${nextProof}:${Date.now()}`;
    etherfiScanKeyRef.current = scanKey;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    const toSyncState = (payload: EtherfiSpendPayload): EtherfiSyncState => ({
      safe: payload.safe,
      sourceTx: payload.sourceTx,
      sourceTxBlock: payload.sourceTxBlock,
      status: "synced",
      receipts: payload.receipts || [],
      totalSpendUsd: payload.totalSpendUsd,
      count: payload.count,
      scope: payload.scope,
      lookbackBlocks: payload.lookbackBlocks,
      fromBlock: payload.fromBlock,
      toBlock: payload.toBlock,
      scannedAt: new Date().toISOString(),
    });

    setEtherfiSync((current) => ({
      ...current,
      safe: isTx ? current.safe : nextProof,
      sourceTx: isTx ? nextProof : current.sourceTx,
      status: "scanning",
      error: undefined,
    }));

    let payload;

    try {
      const initialScope = isTx ? "source" : "full";
      const initialLimit = isTx ? 20 : 100;
      const response = await fetch(`/api/etherfi/spends?${queryKey}=${encodeURIComponent(nextProof)}&limit=${initialLimit}&scope=${initialScope}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      payload = await response.json();

      if (!response.ok) {
        const message = payload?.error || "Unable to scan ether.fi Cash spend events.";
        if (etherfiScanKeyRef.current === scanKey) {
          setEtherfiSync((current) => ({
            ...current,
            safe: isTx ? current.safe : nextProof,
            sourceTx: isTx ? nextProof : current.sourceTx,
            status: "error",
            error: message,
          }));
        }
        throw new Error(message);
      }
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "Receipt scan timed out. Try again or add a smaller block window later."
          : error instanceof Error
            ? error.message
            : "Unable to scan ether.fi Cash spend events.";

      if (etherfiScanKeyRef.current === scanKey) {
        setEtherfiSync((current) => ({
          ...current,
          safe: isTx ? current.safe : nextProof,
          sourceTx: isTx ? nextProof : current.sourceTx,
          status: "error",
          error: message,
        }));
      }
      throw new Error(message);
    } finally {
      window.clearTimeout(timeout);
    }

    const nextSync = toSyncState(payload);

    if (etherfiScanKeyRef.current !== scanKey) return nextSync;

    setEtherfiSync(nextSync);
    writeStoredEtherfiSync(nextSync);

    if (isTx) {
      fetch(`/api/etherfi/spends?${queryKey}=${encodeURIComponent(nextProof)}&limit=100&scope=full`, {
        cache: "no-store",
      })
        .then(async (response) => {
          const fullPayload = await response.json();
          if (!response.ok) return;
          if (etherfiScanKeyRef.current !== scanKey) return;
          const fullSync = toSyncState(fullPayload);
          setEtherfiSync(fullSync);
          writeStoredEtherfiSync(fullSync);
        })
        .catch(() => undefined);
    }

    return nextSync;
  };

  const etherfi = {
    ...etherfiSync,
    scan: scanEtherfiProof,
  };

  const uploadSolayerProof = async (proof: SolayerProofInput) => {
    const signer = authSession?.walletAddress;

    if (!signer) {
      throw new Error("Wallet login is required before uploading Solayer proof.");
    }

    const ethereum = window.ethereum as EthereumProvider | undefined;
    if (!ethereum) {
      throw new Error("Wallet signature is required before uploading Solayer proof.");
    }

    const signature = await ethereum.request({
      method: "personal_sign",
      params: [buildSolayerProofMessage({ wallet: signer, proof }), signer],
    });

    if (typeof signature !== "string") {
      throw new Error("Wallet did not return a valid Solayer proof signature.");
    }

    const response = await fetch("/api/solayer/proofs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wallet: signer,
        proof,
        ownership: {
          signer,
          signature,
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Unable to upload Solayer proof.");
    }

    const nextProofs = [payload, ...solayerProofs.filter((item) => item.id !== payload.id)].slice(0, 25);
    setSolayerProofs(nextProofs);
    writeStoredSolayerProofs(nextProofs);
    return payload as SolayerCreditProof;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signReceiptPublish = async (review: any, receipt: any) => {
    if (localDemoHosts.has(window.location.hostname)) return undefined;

    const signer = authSession?.walletAddress;
    const sourceTx = receipt.txFull || receipt.txHash;

    if (!signer) {
      throw new Error("Wallet login is required before minting a production receipt.");
    }

    if (!sourceTx || typeof receipt.logIndex !== "number") {
      throw new Error("A verified ether.fi Spend transaction and log index are required before minting.");
    }

    const ethereum = window.ethereum as EthereumProvider | undefined;
    if (!ethereum) {
      throw new Error("Wallet signature is required before minting. Open Jiagon with the wallet used for the ether.fi Spend event.");
    }

    const message = buildReceiptPublishMessage({
      sourceTx,
      logIndex: receipt.logIndex,
      provider: receipt.provider,
      amount: receipt.amount,
      amountUsd: receipt.amountUsd,
      token: receipt.token,
      reviewId: review.id,
      merchant: review.merchant,
      branch: review.branch,
      rating: review.rating,
      placeProvider: review.placeProvider,
      googlePlaceId: review.googlePlaceId,
      tags: review.tags,
      visitType: review.visitType,
      occasion: review.occasion,
      valueRating: review.valueRating,
      wouldReturn: review.wouldReturn,
      bestFor: review.bestFor,
      text: review.text,
      wallet: signer,
    });
    const signature = await ethereum.request({
      method: "personal_sign",
      params: [message, signer],
    });

    if (typeof signature !== "string") {
      throw new Error("Wallet did not return a valid receipt publish signature.");
    }

    return {
      signer,
      signature,
    };
  };

  const postReceiptCredential = (path: string, review: any, receipt: any, ownership?: { signer: string; signature: string }) =>
    fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        owner: authSession?.walletAddress || authSession?.walletLabel || "privy-user",
        receipt,
        review,
        ownership,
      }),
    });

  const signSolanaCreditMirror = async (credential: ReceiptCredential) => {
    const signer = authSession?.walletAddress;

    if (!signer) {
      throw new Error("Wallet login is required before mirroring credit to Solana.");
    }

    if (!credential.sourceReceiptHash || !credential.solanaOwner) {
      throw new Error("A verified receipt hash and Solana owner are required before credit mirroring.");
    }

    const ethereum = window.ethereum as EthereumProvider | undefined;
    if (!ethereum) {
      throw new Error("Wallet signature is required before mirroring credit to Solana.");
    }

    const signature = await ethereum.request({
      method: "personal_sign",
      params: [
        buildSolanaOwnerLinkMessage({
          sourceReceiptHash: credential.sourceReceiptHash,
          solanaOwner: credential.solanaOwner,
        }),
        signer,
      ],
    });

    if (typeof signature !== "string") {
      throw new Error("Wallet did not return a valid Solana mirror signature.");
    }

    return {
      signer,
      signature,
    };
  };

  const mirrorSolanaCredit = async (credential: ReceiptCredential) => {
    if (!credential.sourceReceiptHash) {
      throw new Error("A verified source receipt hash is required before Solana mirroring.");
    }

    const ownership = await signSolanaCreditMirror(credential);
    const response = await fetch("/api/solana/credit/mirror", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceReceiptHash: credential.sourceReceiptHash,
        solanaOwner: credential.solanaOwner,
        ownerSigner: ownership.signer,
        ownerSignature: ownership.signature,
        solayerProofs,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Unable to build Solana credit PDA mirror.");
    }

    return payload;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mintReceiptCredential = async (review: any, receipt: any) => {
    const ownership = await signReceiptPublish(review, receipt);
    let response = await postReceiptCredential("/api/receipts/publish", review, receipt, ownership);
    let payload = await response.json();

    if (response.status === 403 && payload?.error === "App receipt publishing is disabled on this server.") {
      response = await postReceiptCredential("/api/receipts/mint", review, receipt, ownership);
      payload = await response.json();
    }

    if (!response.ok) {
      throw new Error(payload?.error || "Unable to mint BNB testnet receipt credential.");
    }

    const credential: ReceiptCredential = {
      receiptId: receipt.id,
      reviewId: review.id,
      status: payload.status,
      network: payload.network,
      chainId: payload.chainId,
      credentialChain: payload.credentialChain,
      credentialId: payload.credentialId,
      preparedCredentialId: payload.preparedCredentialId,
      credentialTx: payload.credentialTx,
      explorerUrl: payload.explorerUrl,
      storageLayer: payload.storageLayer,
      storageUri: payload.storageUri,
      requestedStorageUri: payload.requestedStorageUri,
      sourceReceiptHash: payload.sourceReceiptHash,
      dataHash: payload.dataHash,
      requestedDataHash: payload.requestedDataHash,
      dataMatchesRequest: payload.dataMatchesRequest,
      proofLevel: payload.proofLevel,
      mode: payload.mode,
      mintedAt: payload.mintedAt || payload.preparedAt || new Date().toISOString(),
      preparedAt: payload.preparedAt,
      minter: payload.minter,
      note: payload.note,
      persistence: payload.persistence,
      onchain: payload.onchain,
      solanaOwner: payload.solanaOwner || receipt.solanaOwner || review.solanaOwner,
    };

    if (credential.solanaOwner) {
      try {
        credential.solana = await mirrorSolanaCredit(credential);
      } catch (error) {
        credential.solana = {
          status: "adapter-error",
          error: error instanceof Error ? error.message : "Unable to build Solana credit PDA mirror.",
        };
      }
    } else {
      credential.solana = {
        status: "solana-owner-required",
        error: "Connect a Solana wallet before mirroring this receipt into a credit PDA.",
      };
    }

    return credential;
  };

  const refreshSolanaCreditMirror = async () => {
    const credential = Object.values(receiptCredentials)
      .slice()
      .reverse()
      .find((item) => item?.sourceReceiptHash && item?.solanaOwner);

    if (!credential) {
      throw new Error("Mint a receipt credential with a Solana owner before refreshing the credit mirror.");
    }

    const solana = await mirrorSolanaCredit(credential);
    const nextCredentials = {
      ...receiptCredentials,
      [credential.receiptId]: {
        ...credential,
        solana,
      },
    };

    setReceiptCredentials(nextCredentials);
    window.localStorage.setItem(receiptCredentialsStorageKey, JSON.stringify(nextCredentials));
    return solana;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publishReview = async (review: any, receipt: any) => {
    const credential = await mintReceiptCredential(review, receipt);
    const agentSignals = {
      visitType: review.visitType || null,
      occasion: review.occasion || null,
      valueRating: review.valueRating || null,
      wouldReturn: typeof review.wouldReturn === "boolean" ? review.wouldReturn : null,
      bestFor: Array.isArray(review.bestFor) ? review.bestFor : [],
    };
    const reviewWithCredential = {
      ...review,
      agentSignals,
      proofBoundary,
      credential,
      proofLevel:
        credential.status === "minted"
          ? credential.mode === "already-minted"
            ? `${credential.proofLevel} · BNB existing`
            : `${credential.proofLevel} · BNB minted`
          : `${credential.proofLevel} · prepared`,
      credentialTx: credential.credentialTx
        ? `${credential.credentialTx.slice(0, 6)}…${credential.credentialTx.slice(-4)}`
        : credential.credentialId,
      storageLayer: credential.storageLayer,
      credentialMode: credential.mode,
      dataMatchesRequest: credential.dataMatchesRequest,
    };
    const nextReviews = [reviewWithCredential, ...publishedReviews.filter((item) => item.id !== review.id)];
    const nextReviewedReceiptIds = Array.from(new Set([review.receiptId, ...reviewedReceiptIds]));
    const nextCredentials = {
      ...receiptCredentials,
      [receipt.id]: credential,
    };

    setPublishedReviews(nextReviews);
    setReviewedReceiptIds(nextReviewedReceiptIds);
    setReceiptCredentials(nextCredentials);
    window.localStorage.setItem(reviewsStorageKey, JSON.stringify(nextReviews));
    window.localStorage.setItem(reviewedReceiptsStorageKey, JSON.stringify(nextReviewedReceiptIds));
    window.localStorage.setItem(receiptCredentialsStorageKey, JSON.stringify(nextCredentials));
    setTab("credit");
    return credential;
  };

  // Apply theme + accent
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    if (!mounted) return;

    const syncFromPath = () => {
      const nextTab = initialTabFromPath();
      setTab(nextTab);
      setShowOnboard(nextTab !== "credit");
    };

    window.addEventListener("popstate", syncFromPath);
    return () => window.removeEventListener("popstate", syncFromPath);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    const nextPath = showOnboard ? "/" : pathForTab(tab);
    if (window.location.pathname !== nextPath) {
      window.history.replaceState(null, "", nextPath);
    }
  }, [mounted, showOnboard, tab]);

  useEffect(() => {
    if (!detail && !reviewing) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDetail(null);
      setReviewing(null);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detail, reviewing]);

  const tabContent: Record<Tab, React.ReactNode> = {
    feed: (
      <FeedScreen
        onOpenReview={(r: unknown) => setDetail(r)}
        density={density}
        verifyStyle={verifyStyle}
        userReviews={visibleReviews}
      />
    ),
    inbox: (
      <InboxScreen
        onOpenReceipt={(r: unknown) => setReviewing(r)}
        auth={auth}
        etherfi={etherfi}
        reviewedReceiptIds={reviewedReceiptIds}
        receiptCredentials={receiptCredentials}
      />
    ),
    credit: (
      <CreditScreen
        auth={auth}
        etherfi={etherfi}
        userReviews={publishedReviews}
        reviewedReceiptIds={reviewedReceiptIds}
        receiptCredentials={receiptCredentials}
        solayerProofs={solayerProofs}
        onUploadSolayer={uploadSolayerProof}
        onRefreshSolana={refreshSolanaCreditMirror}
        onScan={() => {
          setShowOnboard(false);
          setTab("inbox");
        }}
      />
    ),
    profile: <ProfileScreen verifyStyle={verifyStyle} auth={auth} etherfi={etherfi} userReviews={visibleReviews} receiptCredentials={receiptCredentials} />,
  };
  const credentialCount = Object.keys(receiptCredentials).length;
  const activeContent = showOnboard ? (
    <OnboardingScreen
      auth={auth}
      etherfi={etherfi}
      onDone={() => { setShowOnboard(false); setTab("feed"); }}
      onImportDone={() => { setShowOnboard(false); setTab("inbox"); }}
    />
  ) : tabContent[tab];

  return (
    <>
      <style>{webShellStyles + logoMarkStyles + webUiPolishStyles + webDialogStyles}</style>
      <div className="jiagon-web-shell" ref={stageRef} suppressHydrationWarning>
        {mounted && (
          <>
            <WebNav
              active={showOnboard ? "inbox" : tab}
              onChange={(nextTab) => {
                setShowOnboard(false);
                setTab(nextTab);
              }}
              onImport={() => {
                setShowOnboard(false);
                setTab("inbox");
              }}
              authenticated={auth.authenticated}
              receiptCount={etherfi.receipts?.length || 0}
              credentialCount={credentialCount}
            />

            <main className="jiagon-web-main">
              <header className="jiagon-web-top">
                <div>
                  <div className="jiagon-web-kicker">JIAGON · RECEIPT CREDIT MVP · v0.2</div>
                </div>
                <div className="jiagon-web-proofline">
                  <span>zkTLS-compatible adapter</span>
                  <span>Metaplex Core</span>
                  <span>Solana PDA</span>
                </div>
              </header>

              <section className="jiagon-web-workspace">
                <div className={`jiagon-web-content jiagon-web-content-${showOnboard ? "onboarding" : tab}`}>
                  {activeContent}
                </div>
              </section>

              {(detail || reviewing) && (
              <div
                className="jiagon-web-modal-root jiagon-web-modal-root-active"
                onMouseDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  setDetail(null);
                  setReviewing(null);
                }}
              >
              <button
                type="button"
                className="jiagon-web-modal-close"
                onClick={() => {
                  setDetail(null);
                  setReviewing(null);
                }}
              >
                Close
              </button>
              {detail && (
                <div className="screen modal-enter" style={{ zIndex: 30 }} onMouseDown={(event) => event.stopPropagation()}>
                  <ReviewDetailScreen review={detail} onClose={() => setDetail(null)} verifyStyle={verifyStyle} />
                </div>
              )}

              {reviewing && (
                <div className="screen modal-enter" style={{ zIndex: 40 }} onMouseDown={(event) => event.stopPropagation()}>
                  <WriteReviewScreen receipt={reviewing} onClose={() => setReviewing(null)} onSubmit={publishReview} />
                </div>
              )}
              </div>
              )}
            </main>
          </>
        )}
      </div>
    </>
  );
}

function PrivyHome() {
  const privy = usePrivy();
  return <HomeShell privy={privy} />;
}

export default function Home() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <HomeShell privy={null} />;

  return (
    <PrivyProvider appId={appId} config={privyConfig}>
      <PrivyHome />
    </PrivyProvider>
  );
}
