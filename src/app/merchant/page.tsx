"use client";

import { useMemo, useState } from "react";

type IssuedReceiptResponse = {
  mode: string;
  persistence: {
    configured: boolean;
    persisted: boolean;
    error?: string;
  };
  claimUrl: string;
  receipt: {
    id: string;
    merchantId: string;
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
};

const defaultMerchant = {
  merchantName: "Consensus Cafe",
  merchantId: "consensus-cafe",
  location: "Miami Beach",
  amountUsd: "6.50",
  category: "Cafe",
  purpose: "cafe_purchase",
  receiptNumber: "COF-001",
  issuedBy: "Jiagon demo merchant",
  memo: "Merchant-issued receipt for Jiagon receipt passport demo.",
};

function shortHash(value?: string | null) {
  if (!value) return "not signed";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export default function MerchantPage() {
  const [form, setForm] = useState(defaultMerchant);
  const [issuerKey, setIssuerKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<IssuedReceiptResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = useMemo(() => {
    return form.merchantName.trim().length >= 2 && Number(form.amountUsd) > 0 && !busy;
  }, [busy, form.amountUsd, form.merchantName]);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const issueReceipt = async () => {
    setBusy(true);
    setError("");
    setCopied(false);
    setIssued(null);

    try {
      const response = await fetch("/api/merchant/receipts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(issuerKey.trim() ? { "x-jiagon-merchant-key": issuerKey.trim() } : {}),
        },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to issue receipt.");
      }
      setIssued(payload);
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : "Unable to issue receipt.");
    } finally {
      setBusy(false);
    }
  };

  const copyClaimLink = async () => {
    if (!issued?.claimUrl) return;
    await navigator.clipboard.writeText(issued.claimUrl);
    setCopied(true);
  };

  return (
    <main className="merchant-page">
      <style>{merchantStyles}</style>
      <section className="merchant-shell">
        <header className="merchant-header">
          <a className="merchant-brand" href="/">
            <img src="/jiagon-logo-mark.png" alt="" />
            <span>Jiagon</span>
          </a>
          <nav>
            <a href="/">Receipts</a>
            <a href="/credit">Credit</a>
          </nav>
        </header>

        <div className="merchant-grid">
          <section className="merchant-copy">
            <div className="merchant-kicker">Merchant dashboard</div>
            <h1>Issue a wallet-bound receipt.</h1>
            <p>
              Create a merchant-issued receipt without POS integration. Jiagon returns a one-time claim link that a
              customer can claim into their receipt passport in the next step.
            </p>
            <div className="merchant-flow">
              <span>Issue receipt</span>
              <span>Claim link</span>
              <span>Passport ready</span>
            </div>
          </section>

          <section className="merchant-card">
            <div className="merchant-form-grid">
              <label>
                <span>Merchant</span>
                <input value={form.merchantName} onChange={(event) => update("merchantName", event.target.value)} />
              </label>
              <label>
                <span>Merchant slug</span>
                <input value={form.merchantId} onChange={(event) => update("merchantId", event.target.value)} />
              </label>
              <label>
                <span>Amount USD</span>
                <input inputMode="decimal" value={form.amountUsd} onChange={(event) => update("amountUsd", event.target.value)} />
              </label>
              <label>
                <span>Receipt id</span>
                <input value={form.receiptNumber} onChange={(event) => update("receiptNumber", event.target.value)} />
              </label>
              <label>
                <span>Category</span>
                <input value={form.category} onChange={(event) => update("category", event.target.value)} />
              </label>
              <label>
                <span>Purpose</span>
                <input value={form.purpose} onChange={(event) => update("purpose", event.target.value)} />
              </label>
              <label>
                <span>Location</span>
                <input value={form.location} onChange={(event) => update("location", event.target.value)} />
              </label>
              <label>
                <span>Issued by</span>
                <input value={form.issuedBy} onChange={(event) => update("issuedBy", event.target.value)} />
              </label>
              <label className="merchant-wide">
                <span>Memo</span>
                <textarea value={form.memo} onChange={(event) => update("memo", event.target.value)} />
              </label>
              <label className="merchant-wide">
                <span>Issuer key</span>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="Required outside local demo mode"
                  value={issuerKey}
                  onChange={(event) => setIssuerKey(event.target.value)}
                />
              </label>
            </div>

            {error && <div className="merchant-error">{error}</div>}

            <button className="merchant-primary" type="button" disabled={!canSubmit} onClick={issueReceipt}>
              {busy ? "Issuing receipt..." : "Issue receipt"}
            </button>
          </section>
        </div>

        {issued && (
          <section className="merchant-result">
            <div>
              <div className="merchant-kicker">One-time claim link</div>
              <h2>{issued.receipt.merchantName}</h2>
              <p>
                ${issued.receipt.amountUsd} {issued.receipt.category} receipt issued. Claim flow is the next atomic PR.
              </p>
            </div>
            <div className="merchant-claim">
              <code>{issued.claimUrl}</code>
              <button type="button" onClick={copyClaimLink}>
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <div className="merchant-proof-grid">
              <div>
                <span>Status</span>
                <strong>{issued.receipt.status}</strong>
              </div>
              <div>
                <span>Storage</span>
                <strong>{issued.mode}</strong>
              </div>
              <div>
                <span>Receipt hash</span>
                <strong>{shortHash(issued.receipt.receiptHash)}</strong>
              </div>
              <div>
                <span>Signature</span>
                <strong>{shortHash(issued.receipt.signature)}</strong>
              </div>
            </div>
            {issued.persistence.error && <div className="merchant-error">{issued.persistence.error}</div>}
          </section>
        )}
      </section>
    </main>
  );
}

const merchantStyles = `
.merchant-page{min-height:100vh;background:radial-gradient(circle at 12% 0%,oklch(0.98 0.008 105) 0 260px,transparent 430px),linear-gradient(135deg,oklch(0.945 0.016 115) 0%,oklch(0.91 0.014 92) 58%,oklch(0.90 0.018 128) 100%);color:var(--ink);padding:24px clamp(18px,4vw,56px) 48px}.merchant-shell{max-width:1160px;margin:0 auto}.merchant-header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:44px}.merchant-brand{display:flex;align-items:center;gap:10px;color:var(--verified);text-decoration:none}.merchant-brand img{width:54px;height:60px;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(24,58,38,.10))}.merchant-brand span{font-family:var(--display);font-size:34px;line-height:.9}.merchant-header nav{display:flex;gap:8px}.merchant-header nav a{min-height:36px;display:inline-flex;align-items:center;border:.5px solid var(--rule);border-radius:8px;background:oklch(0.992 0.004 100 / .75);padding:0 12px;color:var(--ink-muted);font-size:13px;font-weight:800;text-decoration:none}.merchant-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(420px,1fr);gap:28px;align-items:start}.merchant-copy{padding-top:26px}.merchant-kicker{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--ink-muted)}.merchant-copy h1{max-width:520px;margin:10px 0 0;font-family:var(--display);font-style:italic;font-weight:400;font-size:clamp(52px,7vw,86px);line-height:.9;color:var(--ink)}.merchant-copy p{max-width:520px;margin:18px 0 0;color:var(--ink-muted);font-size:16px;line-height:1.55}.merchant-flow{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}.merchant-flow span{border:.5px solid var(--rule);border-radius:999px;background:oklch(0.992 0.004 100 / .72);padding:8px 10px;font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.7px;color:var(--verified)}.merchant-card,.merchant-result{border:.5px solid var(--rule);border-radius:12px;background:oklch(0.992 0.004 100 / .86);box-shadow:0 22px 80px rgba(24,58,38,.10);padding:18px}.merchant-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.merchant-form-grid label{display:grid;gap:6px}.merchant-form-grid span{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.75px;color:var(--ink-muted)}.merchant-form-grid input,.merchant-form-grid textarea{width:100%;border:.5px solid var(--rule);border-radius:8px;background:var(--receipt);color:var(--ink);padding:11px 12px;font-family:var(--ui);font-size:14px;outline:none}.merchant-form-grid textarea{min-height:78px;resize:vertical}.merchant-form-grid input:focus,.merchant-form-grid textarea:focus{border-color:color-mix(in oklch,var(--verified) 48%,var(--rule));box-shadow:0 0 0 3px color-mix(in oklch,var(--verified-soft) 64%,transparent)}.merchant-wide{grid-column:1/-1}.merchant-primary{width:100%;min-height:48px;margin-top:14px;border:none;border-radius:10px;background:var(--verified);color:var(--panel-text);font-family:var(--ui);font-size:14px;font-weight:900;cursor:pointer;box-shadow:0 10px 28px rgba(0,96,48,.16)}.merchant-primary:disabled{opacity:.52;cursor:not-allowed}.merchant-error{margin-top:12px;border:.5px solid oklch(0.76 .08 32);border-radius:8px;background:oklch(0.96 .03 42);color:oklch(0.38 .08 36);padding:10px 12px;font-size:13px;font-weight:750}.merchant-result{margin-top:26px;display:grid;gap:16px}.merchant-result h2{margin:6px 0 0;font-family:var(--display);font-style:italic;font-weight:400;font-size:38px;line-height:.95;color:var(--ink)}.merchant-result p{margin:8px 0 0;color:var(--ink-muted);font-size:14px}.merchant-claim{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.merchant-claim code{min-height:44px;display:flex;align-items:center;overflow:auto;border:.5px solid var(--rule);border-radius:8px;background:var(--surface-raised);padding:0 12px;color:var(--ink);font-family:var(--mono);font-size:11px}.merchant-claim button{border:none;border-radius:8px;background:var(--verified);color:var(--panel-text);padding:0 14px;font-weight:850;cursor:pointer}.merchant-proof-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:.5px solid var(--rule);border-radius:10px;overflow:hidden}.merchant-proof-grid div{display:grid;gap:5px;padding:12px;border-right:.5px solid var(--rule);background:oklch(0.985 0.005 95 / .76)}.merchant-proof-grid div:last-child{border-right:none}.merchant-proof-grid span{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.7px;color:var(--ink-muted)}.merchant-proof-grid strong{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:13px;color:var(--ink)}@media(max-width:900px){.merchant-header{align-items:flex-start}.merchant-grid{grid-template-columns:1fr}.merchant-copy{padding-top:0}.merchant-form-grid,.merchant-claim,.merchant-proof-grid{grid-template-columns:1fr}.merchant-proof-grid div{border-right:none;border-bottom:.5px solid var(--rule)}.merchant-proof-grid div:last-child{border-bottom:none}}
`;
