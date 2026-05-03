"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PrivyProvider, usePrivy, type PrivyClientConfig } from "@privy-io/react-auth";

type ClaimReceipt = {
  id: string;
  merchantName: string;
  location: string | null;
  receiptNumber: string;
  amountUsd: string;
  currency: string;
  category: string;
  purpose: string;
  status: string;
  receiptHash: string;
  signature: string | null;
  signatureAlgorithm: string;
  issuedAt: string;
};

const privyConfig: PrivyClientConfig = {
  loginMethods: ["wallet", "email", "google"],
  appearance: {
    theme: "light" as const,
    accentColor: "#A9573D" as const,
    showWalletLoginFirst: true,
    walletChainType: "ethereum-only" as const,
    walletList: ["detected_ethereum_wallets", "metamask", "coinbase_wallet", "base_account", "okx_wallet", "wallet_connect"],
  },
  embeddedWallets: {
    ethereum: { createOnLogin: "off" as const },
    solana: { createOnLogin: "off" as const },
    showWalletUIs: false,
  },
};

function shortHash(value?: string | null) {
  if (!value) return "not signed";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function getPrimaryWallet(user: unknown) {
  const typedUser = user as {
    wallet?: { address?: string };
    linkedAccounts?: Array<{ type?: string; address?: string }>;
  } | null;

  return typedUser?.wallet?.address || typedUser?.linkedAccounts?.find((account) => account.type === "wallet")?.address || null;
}

function getUserLabel(user: unknown, walletAddress?: string | null) {
  const typedUser = user as {
    id?: string;
    email?: { address?: string };
    google?: { email?: string };
    linkedAccounts?: Array<{ email?: string; phoneNumber?: string }>;
  } | null;
  return (
    typedUser?.email?.address ||
    typedUser?.google?.email ||
    typedUser?.linkedAccounts?.find((account) => account.email)?.email ||
    typedUser?.linkedAccounts?.find((account) => account.phoneNumber)?.phoneNumber ||
    walletAddress ||
    typedUser?.id ||
    null
  );
}

function mergeStoredMerchantReceipt(receipt: ClaimReceipt, privyUserId?: string | null) {
  const storageKey = "jiagon:merchant-receipts";
  const accountUserStorageKey = "jiagon:account-user-id";
  let current: unknown = [];
  try {
    const stored = window.localStorage.getItem(storageKey);
    current = stored ? JSON.parse(stored) : [];
  } catch {
    current = [];
  }
  const receipts = Array.isArray(current) ? current : [];
  const existing = receipts.find((item) => {
    const record = item && typeof item === "object" ? item as { id?: unknown } : null;
    return record?.id === receipt.id;
  });
  const existingReceipt = existing && typeof existing === "object" ? existing as Record<string, unknown> : null;
  const nextReceipt = {
    ...existingReceipt,
    ...receipt,
    source: "merchant-issued",
    mintStatus: typeof existingReceipt?.mintStatus === "string" ? existingReceipt.mintStatus : "ready",
    creditImpact:
      existingReceipt?.creditImpact && typeof existingReceipt.creditImpact === "object"
        ? existingReceipt.creditImpact
        : {
            eligible: false,
            unlockedCreditUsd: 25,
            reason: "Merchant-issued receipt must be minted as a Bubblegum cNFT before credit unlock.",
          },
  };
  const merged = [
    nextReceipt,
    ...receipts.filter((item) => {
      const record = item && typeof item === "object" ? item as { id?: unknown } : null;
      return record?.id !== receipt.id;
    }),
  ].slice(0, 250);
  try {
    if (privyUserId) {
      window.localStorage.setItem(accountUserStorageKey, privyUserId);
    }
    window.localStorage.setItem(storageKey, JSON.stringify(merged));
  } catch {
    // Local cache is best-effort; the backend claim already succeeded.
  }
}

function ClaimContent({ token }: { token: string }) {
  const { ready, authenticated, user, login, getAccessToken } = usePrivy();
  const [receipt, setReceipt] = useState<ClaimReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState("");

  const wallet = useMemo(() => getPrimaryWallet(user), [user]);
  const userLabel = useMemo(() => getUserLabel(user, wallet), [user, wallet]);

  useEffect(() => {
    let cancelled = false;
    async function loadReceipt() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/merchant/receipts/${encodeURIComponent(token)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Receipt was not found.");
        if (!cancelled) setReceipt(payload.receipt);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Receipt was not found.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadReceipt();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const claimReceipt = async () => {
    if (!authenticated) {
      await login();
      return;
    }

    setClaiming(true);
    setError("");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Privy access token is required.");
      const response = await fetch(`/api/merchant/receipts/${encodeURIComponent(token)}/claim`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ wallet, userLabel }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to claim receipt.");
      setReceipt(payload.receipt);
      mergeStoredMerchantReceipt(payload.receipt, (user as { id?: string } | null)?.id);
      setClaimed(true);
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Unable to claim receipt.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <main className="claim-page">
      <style>{claimStyles}</style>
      <section className="claim-shell">
        <header className="claim-header">
          <a className="claim-brand" href="/">
            <img src="/jiagon-logo-mark.png" alt="" />
            <span>Jiagon</span>
          </a>
          <a className="claim-nav" href="/merchant">Merchant dashboard</a>
        </header>

        <section className="claim-card">
          <div className="claim-kicker">Receipt claim</div>
          <h1>{loading ? "Loading receipt." : receipt ? "Claim this receipt." : "Receipt unavailable."}</h1>
          <p>
            Merchant-issued receipts become wallet-bound Jiagon passport entries. Minting to Bubblegum cNFT is the next
            step after claim.
          </p>

          <div className="claim-flow" aria-label="Receipt credit flow">
            <div className={receipt ? "is-active" : ""}>
              <span>1</span>
              <strong>Review receipt</strong>
              <small>merchant signed</small>
            </div>
            <div className={claimed || receipt?.status === "claimed" ? "is-active" : ""}>
              <span>2</span>
              <strong>Claim passport</strong>
              <small>Privy account</small>
            </div>
            <div>
              <span>3</span>
              <strong>Mint cNFT</strong>
              <small>unlock credit</small>
            </div>
          </div>

          {receipt && (
            <div className="claim-receipt">
              <div>
                <span>Merchant</span>
                <strong>{receipt.merchantName}</strong>
              </div>
              <div>
                <span>Amount</span>
                <strong>
                  ${receipt.amountUsd} {receipt.currency}
                </strong>
              </div>
              <div>
                <span>Purpose</span>
                <strong>{receipt.purpose}</strong>
              </div>
              <div>
                <span>Receipt id</span>
                <strong>{receipt.receiptNumber}</strong>
              </div>
              <div>
                <span>Hash</span>
                <strong>{shortHash(receipt.receiptHash)}</strong>
              </div>
              <div>
                <span>Signature</span>
                <strong>{shortHash(receipt.signature)}</strong>
              </div>
            </div>
          )}

          {error && <div className="claim-error">{error}</div>}
          {claimed && (
            <div className="claim-success">
              Receipt claimed into your Jiagon account. Open Passport and mint the receipt cNFT to unlock deposit credit.
            </div>
          )}

          <div className="claim-actions">
            <button type="button" disabled={!ready || loading || !receipt || claiming || receipt?.status !== "issued"} onClick={claimReceipt}>
              {!ready
                ? "Loading Privy"
                : !authenticated
                  ? "Log in to claim"
                  : claiming
                    ? "Claiming receipt..."
                    : receipt?.status === "claimed"
                      ? "Already claimed"
                      : "Claim receipt"}
            </button>
            <a href="/passport">{claimed || receipt?.status === "claimed" ? "Open Passport to mint" : "Open Passport"}</a>
          </div>
        </section>
      </section>
    </main>
  );
}

export default function ClaimReceiptPage() {
  const params = useParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token || "";
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return (
      <main className="claim-page">
        <style>{claimStyles}</style>
        <section className="claim-shell">
          <section className="claim-card">
            <div className="claim-kicker">Receipt claim</div>
            <h1>Privy is not configured.</h1>
            <p>Set NEXT_PUBLIC_PRIVY_APP_ID to claim merchant-issued receipts into a wallet-bound Jiagon account.</p>
          </section>
        </section>
      </main>
    );
  }

  return (
    <PrivyProvider appId={appId} config={privyConfig}>
      <ClaimContent token={token} />
    </PrivyProvider>
  );
}

const claimStyles = `
.claim-page{min-height:100vh;background:radial-gradient(circle at 18% 0%,oklch(0.98 0.008 105) 0 260px,transparent 430px),linear-gradient(135deg,oklch(0.945 0.016 115) 0%,oklch(0.91 0.014 92) 58%,oklch(0.90 0.018 128) 100%);color:var(--ink);padding:24px clamp(18px,4vw,56px) 48px}.claim-shell{max-width:980px;margin:0 auto}.claim-header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:54px}.claim-brand{display:flex;align-items:center;gap:10px;color:var(--verified);text-decoration:none}.claim-brand img{width:54px;height:60px;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(24,58,38,.10))}.claim-brand span{font-family:var(--display);font-size:34px;line-height:.9}.claim-nav{min-height:36px;display:inline-flex;align-items:center;border:.5px solid var(--rule);border-radius:8px;background:oklch(0.992 0.004 100 / .75);padding:0 12px;color:var(--ink-muted);font-size:13px;font-weight:800;text-decoration:none}.claim-card{border:.5px solid var(--rule);border-radius:12px;background:oklch(0.992 0.004 100 / .88);box-shadow:0 22px 80px rgba(24,58,38,.10);padding:clamp(20px,4vw,34px)}.claim-kicker{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--ink-muted)}.claim-card h1{max-width:720px;margin:10px 0 0;font-family:var(--display);font-style:italic;font-weight:400;font-size:clamp(50px,7vw,84px);line-height:.9;color:var(--ink)}.claim-card p{max-width:680px;margin:16px 0 0;color:var(--ink-muted);font-size:16px;line-height:1.55}.claim-flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:22px}.claim-flow div{border:.5px solid var(--rule);border-radius:10px;background:var(--receipt);padding:12px;display:grid;gap:5px}.claim-flow div.is-active{background:var(--verified-soft);border-color:color-mix(in oklch,var(--verified) 26%,var(--rule))}.claim-flow span{width:24px;height:24px;border-radius:999px;display:grid;place-items:center;background:var(--bg);font-family:var(--mono);font-size:10px;font-weight:900;color:var(--ink)}.claim-flow strong{font-size:13px;color:var(--ink)}.claim-flow small{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:var(--ink-muted)}.claim-receipt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:.5px solid var(--rule);border-radius:10px;overflow:hidden;margin-top:24px}.claim-receipt div{display:grid;gap:6px;padding:14px;border-right:.5px solid var(--rule);border-bottom:.5px solid var(--rule);background:oklch(0.985 0.005 95 / .74)}.claim-receipt div:nth-child(3n){border-right:none}.claim-receipt div:nth-last-child(-n+3){border-bottom:none}.claim-receipt span{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.7px;color:var(--ink-muted)}.claim-receipt strong{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:14px;color:var(--ink)}.claim-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.claim-actions button,.claim-actions a{min-height:46px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;padding:0 16px;font-family:var(--ui);font-size:14px;font-weight:900;text-decoration:none}.claim-actions button{border:none;background:var(--verified);color:var(--panel-text);cursor:pointer;box-shadow:0 10px 28px rgba(0,96,48,.16)}.claim-actions button:disabled{opacity:.52;cursor:not-allowed}.claim-actions a{border:.5px solid var(--rule);background:var(--receipt);color:var(--ink)}.claim-error,.claim-success{margin-top:14px;border-radius:8px;padding:11px 12px;font-size:13px;font-weight:750}.claim-error{border:.5px solid oklch(0.76 .08 32);background:oklch(0.96 .03 42);color:oklch(0.38 .08 36)}.claim-success{border:.5px solid color-mix(in oklch,var(--verified) 32%,var(--rule));background:var(--verified-soft);color:var(--verified)}@media(max-width:760px){.claim-header{align-items:flex-start}.claim-flow{grid-template-columns:1fr}.claim-receipt{grid-template-columns:1fr}.claim-receipt div{border-right:none}.claim-receipt div:nth-last-child(-n+3){border-bottom:.5px solid var(--rule)}.claim-receipt div:last-child{border-bottom:none}}
`;
