"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CachedReceipt = {
  id?: string;
  merchantName?: string;
  location?: string | null;
  receiptNumber?: string;
  amountUsd?: string;
  currency?: string;
  category?: string;
  purpose?: string;
  status?: string;
  receiptHash?: string;
  issuedAt?: string;
  claimedAt?: string | null;
  mintStatus?: string;
  credentialId?: string;
  credentialChain?: string;
  standard?: string;
  solanaOwner?: string;
  explorerUrl?: string | null;
  assetExplorerUrl?: string | null;
  creditImpact?: {
    eligible?: boolean;
    unlockedCreditUsd?: number;
    reason?: string;
  };
  source?: string;
};

const proofLabels: Record<string, string> = {
  minted: "L5 Bubblegum minted",
  prepared: "L4 claim prepared",
  ready: "L3 passport claimed",
  claimed: "L3 passport claimed",
  issued: "L2 merchant issued",
};

function readCachedReceipts() {
  try {
    const stored = window.localStorage.getItem("jiagon:merchant-receipts");
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CachedReceipt => Boolean(item && typeof item === "object"));
  } catch {
    return [];
  }
}

function currency(receipt: CachedReceipt) {
  const amount = Number(receipt.amountUsd || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "n/a";
  return `$${amount.toFixed(2)} ${receipt.currency || "USD"}`;
}

function shortHash(value?: string | null) {
  if (!value) return "no proof hash";
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function getProofLevel(receipt: CachedReceipt) {
  if (receipt.mintStatus === "minted") return proofLabels.minted;
  if (receipt.mintStatus === "prepared") return proofLabels.prepared;
  if (receipt.status === "claimed" || receipt.mintStatus === "ready") return proofLabels.ready;
  if (receipt.status === "issued") return proofLabels.issued;
  return "L1 local cache";
}

function getCredentialStatus(receipt: CachedReceipt) {
  if (receipt.mintStatus === "minted") return "minted";
  if (receipt.mintStatus === "prepared") return "prepared";
  if (receipt.mintStatus === "ready" || receipt.status === "claimed") return "ready";
  return "not prepared";
}

function formatDate(value?: string | null) {
  if (!value) return "not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not recorded";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function PassportPage() {
  const [receipts, setReceipts] = useState<CachedReceipt[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setReceipts(readCachedReceipts());
    setLoaded(true);
  }, []);

  const metrics = useMemo(() => {
    const claimed = receipts.filter((receipt) => receipt.status === "claimed").length;
    const minted = receipts.filter((receipt) => receipt.mintStatus === "minted").length;
    const prepared = receipts.filter((receipt) => receipt.mintStatus === "prepared").length;
    const creditUnlocked = receipts.reduce((total, receipt) => {
      if (!receipt.creditImpact?.eligible) return total;
      const amount = Number(receipt.creditImpact.unlockedCreditUsd || 0);
      return Number.isFinite(amount) ? total + amount : total;
    }, 0);
    return { claimed, minted, prepared, creditUnlocked };
  }, [receipts]);

  return (
    <main className="passport-page">
      <style>{`
        .passport-page {
          min-height: 100vh;
          padding: 28px clamp(18px, 4vw, 56px) 56px;
          background:
            radial-gradient(circle at 18% 0%, oklch(0.98 0.008 105) 0 260px, transparent 430px),
            linear-gradient(135deg, oklch(0.95 0.016 115), oklch(0.90 0.018 128));
        }
        .passport-shell { max-width: 1180px; margin: 0 auto; }
        .passport-nav { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:34px; }
        .passport-nav a {
          min-height:34px; display:inline-flex; align-items:center; padding:0 12px;
          border:.5px solid var(--rule); border-radius:6px; background:var(--receipt);
          color:var(--ink-muted); text-decoration:none; font-weight:800; font-size:13px;
        }
        .passport-nav a:hover { background: var(--verified-soft); color: var(--verified); }
        .passport-hero {
          display:grid; grid-template-columns:minmax(0,1fr) minmax(320px,.72fr);
          gap:18px; align-items:stretch;
        }
        .passport-card {
          border:.5px solid var(--rule); border-radius:8px; background:var(--receipt);
          padding:18px; box-shadow:0 8px 24px rgba(24,24,24,.045);
        }
        .passport-card.dark { background:var(--panel); color:var(--panel-text); border-color:oklch(0.34 0.03 135); }
        .passport-kicker {
          font-family:var(--mono); font-size:10px; letter-spacing:.9px; text-transform:uppercase;
          color:var(--ink-muted);
        }
        .passport-card.dark .passport-kicker { color:oklch(0.82 0.02 130); }
        .passport-title {
          max-width:760px; margin:10px 0 0; font-family:var(--display); font-style:italic;
          font-size:clamp(44px,7vw,82px); line-height:.92; font-weight:400; color:var(--ink);
        }
        .passport-card.dark .passport-title { color:var(--panel-text); }
        .passport-copy { margin:16px 0 0; color:var(--ink-muted); font-size:16px; line-height:1.55; }
        .passport-card.dark .passport-copy { color:oklch(0.88 0.014 120); }
        .passport-cta { display:flex; flex-wrap:wrap; gap:10px; margin-top:24px; }
        .passport-cta a {
          min-height:42px; display:inline-flex; align-items:center; justify-content:center;
          border-radius:8px; padding:0 14px; border:.5px solid var(--verified);
          background:var(--verified); color:var(--panel-text); text-decoration:none; font-weight:900;
        }
        .passport-cta a.secondary { background:var(--receipt); color:var(--ink); border-color:var(--rule); }
        .passport-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-top:18px; }
        .passport-metric {
          border:.5px solid var(--rule); border-radius:8px; background:oklch(0.985 0.005 95 / .68);
          padding:12px; min-width:0;
        }
        .passport-metric span {
          display:block; font-family:var(--mono); font-size:9.5px; letter-spacing:.7px;
          text-transform:uppercase; color:var(--ink-muted);
        }
        .passport-metric strong { display:block; margin-top:6px; font-size:24px; color:var(--ink); }
        .passport-list { display:grid; gap:10px; margin-top:16px; }
        .passport-receipt {
          display:grid; gap:12px; border:.5px solid var(--rule); border-radius:8px;
          background:oklch(0.985 0.005 95 / .68); padding:14px;
        }
        .passport-receipt-head {
          display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
        }
        .passport-receipt h2 { margin:0; font-size:17px; color:var(--ink); }
        .passport-receipt p { margin:4px 0 0; color:var(--ink-muted); font-size:13px; line-height:1.45; }
        .passport-badge {
          flex:0 0 auto; min-height:26px; display:inline-flex; align-items:center; padding:0 8px;
          border-radius:6px; background:var(--verified-soft); color:var(--verified);
          font-family:var(--mono); font-size:9.5px; font-weight:900; text-transform:uppercase;
        }
        .passport-fields { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); border:.5px solid var(--rule); border-radius:8px; overflow:hidden; }
        .passport-field { min-width:0; padding:10px; border-right:.5px solid var(--rule); border-bottom:.5px solid var(--rule); background:var(--receipt); }
        .passport-field:nth-child(3n) { border-right:none; }
        .passport-field:nth-last-child(-n+3) { border-bottom:none; }
        .passport-field span { display:block; font-family:var(--mono); font-size:9px; letter-spacing:.6px; text-transform:uppercase; color:var(--ink-muted); }
        .passport-field strong { display:block; margin-top:5px; color:var(--ink); font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .passport-links { display:flex; flex-wrap:wrap; gap:8px; }
        .passport-links a {
          min-height:32px; display:inline-flex; align-items:center; padding:0 10px;
          border:.5px solid var(--rule); border-radius:7px; background:var(--receipt);
          color:var(--ink); text-decoration:none; font-size:12px; font-weight:900;
        }
        .passport-empty {
          display:grid; gap:12px; margin-top:16px; border:.5px dashed color-mix(in oklch,var(--verified) 38%,var(--rule));
          border-radius:8px; background:oklch(0.985 0.005 95 / .68); padding:18px;
        }
        .passport-empty strong { color:var(--ink); }
        .passport-empty span { color:var(--ink-muted); font-size:14px; line-height:1.5; }
        @media(max-width:860px){
          .passport-hero,.passport-metrics{grid-template-columns:1fr}
          .passport-fields{grid-template-columns:1fr}
          .passport-field,.passport-field:nth-child(3n),.passport-field:nth-last-child(-n+3){border-right:none;border-bottom:.5px solid var(--rule)}
          .passport-field:last-child{border-bottom:none}
        }
      `}</style>
      <div className="passport-shell">
        <nav className="passport-nav" aria-label="Passport">
          <Link href="/">Home</Link>
          <Link href="/trust-api">Trust API</Link>
          <Link href="/credit">Credit</Link>
          <Link href="/merchant">Claim</Link>
          <Link href="/merchant">Merchant Demo</Link>
          <Link href="/agent-order">Adapters</Link>
        </nav>
        <section className="passport-hero">
          <div className="passport-card">
            <div className="passport-kicker">Receipt Passport</div>
            <h1 className="passport-title">Your verified receipt memory.</h1>
            <p className="passport-copy">
              Passport shows locally cached merchant receipts after claim. Claimed receipts can be prepared or minted as
              Bubblegum credentials, then read by Jiagon agent APIs for trust and purpose-bound credit checks.
            </p>
            <div className="passport-cta">
              <Link href="/merchant">Claim a receipt</Link>
              <Link className="secondary" href="/trust-api">Open Trust API</Link>
              <Link className="secondary" href="/credit">Check Credit</Link>
            </div>
          </div>
          <div className="passport-card dark">
            <div className="passport-kicker">Summary</div>
            <h2 className="passport-title">Passport state</h2>
            <p className="passport-copy">
              {loaded
                ? `${receipts.length} cached receipt${receipts.length === 1 ? "" : "s"} found on this device.`
                : "Loading cached receipts from this device."}
            </p>
          </div>
        </section>

        <section className="passport-metrics" aria-label="Passport summary metrics">
          <div className="passport-metric">
            <span>Verified receipts</span>
            <strong>{receipts.length}</strong>
          </div>
          <div className="passport-metric">
            <span>Claimed</span>
            <strong>{metrics.claimed}</strong>
          </div>
          <div className="passport-metric">
            <span>Prepared / minted</span>
            <strong>{metrics.prepared + metrics.minted}</strong>
          </div>
          <div className="passport-metric">
            <span>Credit unlocked</span>
            <strong>${metrics.creditUnlocked.toFixed(0)}</strong>
          </div>
        </section>

        {!loaded ? null : receipts.length === 0 ? (
          <section className="passport-empty">
            <strong>No claimed receipts are cached on this device yet.</strong>
            <span>
              Claim a merchant-issued receipt first. After claim, this dashboard will show the receipt hash, proof
              level, mint or prepared status, and any purpose-bound credit unlocked by a minted credential.
            </span>
            <div className="passport-cta">
              <Link href="/merchant">Open Merchant Demo</Link>
              <Link className="secondary" href="/trust-api">View Agent Trust API</Link>
            </div>
          </section>
        ) : (
          <section className="passport-list" aria-label="Cached receipt passport entries">
            {receipts.map((receipt, index) => (
              <article className="passport-receipt" key={receipt.id || receipt.receiptHash || index}>
                <div className="passport-receipt-head">
                  <div>
                    <h2>{receipt.merchantName || "Merchant receipt"}</h2>
                    <p>
                      {receipt.category || receipt.purpose || "Verified purchase"} · {currency(receipt)} · claimed{" "}
                      {formatDate(receipt.claimedAt || receipt.issuedAt)}
                    </p>
                  </div>
                  <span className="passport-badge">{getCredentialStatus(receipt)}</span>
                </div>
                <div className="passport-fields">
                  <div className="passport-field">
                    <span>Proof level</span>
                    <strong>{getProofLevel(receipt)}</strong>
                  </div>
                  <div className="passport-field">
                    <span>Receipt hash</span>
                    <strong>{shortHash(receipt.receiptHash)}</strong>
                  </div>
                  <div className="passport-field">
                    <span>Credit</span>
                    <strong>
                      {receipt.creditImpact?.eligible
                        ? `$${Number(receipt.creditImpact.unlockedCreditUsd || 0).toFixed(0)} unlocked`
                        : "not unlocked"}
                    </strong>
                  </div>
                  <div className="passport-field">
                    <span>Credential</span>
                    <strong>{receipt.credentialId ? shortHash(receipt.credentialId) : getCredentialStatus(receipt)}</strong>
                  </div>
                  <div className="passport-field">
                    <span>Owner</span>
                    <strong>{shortHash(receipt.solanaOwner)}</strong>
                  </div>
                  <div className="passport-field">
                    <span>Source</span>
                    <strong>{receipt.source || "merchant-issued"}</strong>
                  </div>
                </div>
                <div className="passport-links">
                  {receipt.receiptHash && <Link href={`/api/agent/proofs/${encodeURIComponent(receipt.receiptHash)}`}>Proof API</Link>}
                  <Link href="/trust-api">Trust API</Link>
                  <Link href="/credit">Credit</Link>
                  {receipt.assetExplorerUrl && <a href={receipt.assetExplorerUrl}>Asset</a>}
                  {receipt.explorerUrl && <a href={receipt.explorerUrl}>Transaction</a>}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
