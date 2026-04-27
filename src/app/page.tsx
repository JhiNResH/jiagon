"use client";

import { useState, useEffect, useRef } from "react";
import { IOSDevice } from "@/components/IOSFrame";
import { TabBar } from "@/components/AppData";
import {
  OnboardingScreen, FeedScreen, InboxScreen, WriteReviewScreen,
  ReviewDetailScreen, DiscoverScreen, ProfileScreen,
} from "@/components/screens";

type Tab = "feed" | "inbox" | "discover" | "profile";
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

const authStorageKey = "jiagon:privy-session";
const etherfiStorageKey = "jiagon:etherfi-sync";
const reviewsStorageKey = "jiagon:published-reviews";
const reviewedReceiptsStorageKey = "jiagon:reviewed-receipts";
const receiptCredentialsStorageKey = "jiagon:receipt-credentials";

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
};

const emptyEtherfiSync: EtherfiSyncState = {
  status: "idle",
  receipts: [],
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("inbox");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reviewing, setReviewing] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detail, setDetail] = useState<any>(null);
  const [showOnboard, setShowOnboard] = useState(true);
  const [scale, setScale] = useState(1);
  const [authPreview, setAuthPreview] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authSession, setAuthSession] = useState<StoredSession | null>(null);
  const [etherfiSync, setEtherfiSync] = useState<EtherfiSyncState>(emptyEtherfiSync);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [publishedReviews, setPublishedReviews] = useState<any[]>([]);
  const [reviewedReceiptIds, setReviewedReceiptIds] = useState<string[]>([]);
  const [receiptCredentials, setReceiptCredentials] = useState<Record<string, ReceiptCredential>>({});
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    const stored = window.localStorage.getItem(authStorageKey);
    if (stored) {
      try {
        setAuthSession(JSON.parse(stored));
      } catch {
        window.localStorage.removeItem(authStorageKey);
      }
    }

    const storedEtherfi = window.localStorage.getItem(etherfiStorageKey);
    if (storedEtherfi) {
      try {
        setEtherfiSync(JSON.parse(storedEtherfi));
      } catch {
        window.localStorage.removeItem(etherfiStorageKey);
      }
    }

    const storedReviews = window.localStorage.getItem(reviewsStorageKey);
    if (storedReviews) {
      try {
        setPublishedReviews(JSON.parse(storedReviews));
      } catch {
        window.localStorage.removeItem(reviewsStorageKey);
      }
    }

    const storedReviewedReceipts = window.localStorage.getItem(reviewedReceiptsStorageKey);
    if (storedReviewedReceipts) {
      try {
        setReviewedReceiptIds(JSON.parse(storedReviewedReceipts));
      } catch {
        window.localStorage.removeItem(reviewedReceiptsStorageKey);
      }
    }

    const storedCredentials = window.localStorage.getItem(receiptCredentialsStorageKey);
    if (storedCredentials) {
      try {
        setReceiptCredentials(JSON.parse(storedCredentials));
      } catch {
        window.localStorage.removeItem(receiptCredentialsStorageKey);
      }
    }
  }, []);

  const verifyStyle: VerifyStyle = "chip";
  const density: Density = "comfy";
  const dark = false;
  const hasPrivyAppId = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

  const auth: AuthState = {
    ready: !authBusy,
    authenticated: authPreview || Boolean(authSession),
    appConfigured: hasPrivyAppId,
    userLabel: authSession?.userLabel || (authPreview ? "preview@jiagon.local" : undefined),
    walletLabel: authSession?.walletLabel || (authPreview ? "0xpreview" : undefined),
    login: async () => {
      if (hasPrivyAppId) {
        window.location.href = "/auth";
        return;
      }

      setAuthBusy(true);
      window.setTimeout(() => {
        setAuthPreview(true);
        setAuthBusy(false);
      }, hasPrivyAppId ? 350 : 0);
    },
    logout: async () => {
      setAuthPreview(false);
      setAuthSession(null);
      setAuthBusy(false);
      setEtherfiSync(emptyEtherfiSync);
      setPublishedReviews([]);
      setReviewedReceiptIds([]);
      setReceiptCredentials({});
      window.localStorage.removeItem(authStorageKey);
      window.localStorage.removeItem(etherfiStorageKey);
      window.localStorage.removeItem(reviewsStorageKey);
      window.localStorage.removeItem(reviewedReceiptsStorageKey);
      window.localStorage.removeItem(receiptCredentialsStorageKey);
    },
  };

  const scanEtherfiProof = async (proof: string) => {
    const nextProof = proof.trim();
    const isTx = /^0x[a-fA-F0-9]{64}$/.test(nextProof);
    const queryKey = isTx ? "tx" : "safe";
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);

    setEtherfiSync((current) => ({
      ...current,
      safe: isTx ? current.safe : nextProof,
      sourceTx: isTx ? nextProof : current.sourceTx,
      status: "scanning",
      error: undefined,
    }));

    let payload;

    try {
      const response = await fetch(`/api/etherfi/spends?${queryKey}=${encodeURIComponent(nextProof)}&limit=100&scope=full`, {
        cache: "no-store",
        signal: controller.signal,
      });
      payload = await response.json();

      if (!response.ok) {
        const message = payload?.error || "Unable to scan ether.fi Cash spend events.";
        setEtherfiSync((current) => ({
          ...current,
          safe: isTx ? current.safe : nextProof,
          sourceTx: isTx ? nextProof : current.sourceTx,
          status: "error",
          error: message,
        }));
        throw new Error(message);
      }
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "Receipt scan timed out. Try again or add a smaller block window later."
          : error instanceof Error
            ? error.message
            : "Unable to scan ether.fi Cash spend events.";

      setEtherfiSync((current) => ({
        ...current,
        safe: isTx ? current.safe : nextProof,
        sourceTx: isTx ? nextProof : current.sourceTx,
        status: "error",
        error: message,
      }));
      throw new Error(message);
    } finally {
      window.clearTimeout(timeout);
    }

    const nextSync: EtherfiSyncState = {
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
    };

    setEtherfiSync(nextSync);
    window.localStorage.setItem(etherfiStorageKey, JSON.stringify(nextSync));
    return nextSync;
  };

  const etherfi = {
    ...etherfiSync,
    scan: scanEtherfiProof,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postReceiptCredential = (path: string, review: any, receipt: any) =>
    fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        owner: authSession?.walletAddress || authSession?.walletLabel || "privy-user",
        receipt,
        review,
      }),
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mintReceiptCredential = async (review: any, receipt: any) => {
    let response = await postReceiptCredential("/api/receipts/publish", review, receipt);
    if (response.status === 403) {
      response = await postReceiptCredential("/api/receipts/mint", review, receipt);
    }

    const payload = await response.json();

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
    };

    return credential;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publishReview = async (review: any, receipt: any) => {
    const credential = await mintReceiptCredential(review, receipt);
    const reviewWithCredential = {
      ...review,
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
    setTab("feed");
    return credential;
  };

  // Apply theme + accent
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  // Fit device to viewport
  useEffect(() => {
    const fit = () => {
      const W = window.innerWidth - 60;
      const H = window.innerHeight - 60;
      const dw = 402, dh = 874;
      const s = Math.min(W / dw, H / dh, 1.05);
      setScale(s);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const tabContent: Record<Tab, React.ReactNode> = {
    feed: (
      <FeedScreen
        onOpenReview={(r: unknown) => setDetail(r)}
        density={density}
        verifyStyle={verifyStyle}
        userReviews={publishedReviews}
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
    discover: <DiscoverScreen />,
    profile: <ProfileScreen verifyStyle={verifyStyle} auth={auth} etherfi={etherfi} userReviews={publishedReviews} receiptCredentials={receiptCredentials} />,
  };

  return (
    <>
      <div className="label">
        <span className="accent">●</span>&nbsp;&nbsp;JIAGON · ETHER.FI RECEIPT MVP · v0.1
      </div>

      <div className="stage" ref={stageRef} suppressHydrationWarning>
        {mounted && (
        <div className="device-shell" style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
          <IOSDevice width={402} height={874} dark={dark}>
            <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0 }}>
                {tabContent[tab]}
                <TabBar active={tab} onChange={setTab} />
              </div>

              {detail && (
                <div className="screen modal-enter" style={{ zIndex: 30 }}>
                  <ReviewDetailScreen review={detail} onClose={() => setDetail(null)} verifyStyle={verifyStyle} />
                </div>
              )}

              {reviewing && (
                <div className="screen modal-enter" style={{ zIndex: 40 }}>
                  <WriteReviewScreen receipt={reviewing} onClose={() => setReviewing(null)} onSubmit={publishReview} />
                </div>
              )}

              {showOnboard && (
                <div className="screen" style={{ zIndex: 50 }}>
                  <OnboardingScreen auth={auth} etherfi={etherfi} onDone={() => { setShowOnboard(false); setTab("inbox"); }} />
                </div>
              )}
            </div>
          </IOSDevice>
        </div>
        )}
      </div>
    </>
  );
}
