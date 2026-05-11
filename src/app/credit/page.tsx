"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Readiness = {
  product?: string;
  enabled?: boolean;
  configured?: boolean;
  cluster?: string;
  mode?: string;
  error?: string;
};

type Eligibility = {
  product?: string;
  owner?: string;
  usage?: string;
  purposeBoundCredit?: {
    eligible?: boolean;
    unlockedCreditCents?: number;
    unlockedCreditUsd?: string;
    mintedReceiptCount?: number;
    receiptIds?: string[];
    maxDemoCreditCents?: number;
    allowedPurpose?: string;
  };
  persistence?: {
    configured?: boolean;
    error?: string | null;
  };
  error?: string;
};

const CREDIT_OWNER_STORAGE_KEY = "jiagon:credit-owner";
const SHARED_OWNER_STORAGE_KEY = "jiagon:solana-owner";
const SOLANA_PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const policyRails = [
  ["Allowed purpose", "dining_deposit only"],
  ["Recipient rail", "approved merchant escrow or bounded merchant account"],
  ["Amount rail", "capped by minted receipt credentials and demo policy"],
];

function isPlausibleSolanaOwner(owner: string) {
  return SOLANA_PUBLIC_KEY_PATTERN.test(owner.trim());
}

function formatBoolean(value: boolean | undefined) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}

function statusTone(status: "ready" | "blocked" | "pending") {
  if (status === "ready") return "ready";
  if (status === "blocked") return "blocked";
  return "pending";
}

async function readJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}.`);
  }
  return payload;
}

export default function CreditPage() {
  const [owner, setOwner] = useState("");
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [readinessError, setReadinessError] = useState("");
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [eligibilityError, setEligibilityError] = useState("");
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityCheckedOwner, setEligibilityCheckedOwner] = useState("");

  const normalizedOwner = owner.trim();
  const hasOwner = normalizedOwner.length > 0;
  const ownerLooksValid = isPlausibleSolanaOwner(normalizedOwner);
  const credit = eligibility?.purposeBoundCredit;
  const eligibilityPending = hasOwner && ownerLooksValid && (eligibilityLoading || eligibilityCheckedOwner !== normalizedOwner);

  useEffect(() => {
    try {
      setOwner(window.localStorage.getItem(SHARED_OWNER_STORAGE_KEY) || window.localStorage.getItem(CREDIT_OWNER_STORAGE_KEY) || "");
    } catch {
      setOwner("");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    readJson<Readiness>("/api/solana/credit/deposit", controller.signal)
      .then((payload) => {
        setReadiness(payload);
        setReadinessError("");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setReadiness(null);
        setReadinessError(error instanceof Error ? error.message : "Unable to load devnet route readiness.");
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    try {
      if (normalizedOwner) {
        window.localStorage.setItem(CREDIT_OWNER_STORAGE_KEY, normalizedOwner);
        if (ownerLooksValid) {
          window.localStorage.setItem(SHARED_OWNER_STORAGE_KEY, normalizedOwner);
        }
      } else {
        window.localStorage.removeItem(CREDIT_OWNER_STORAGE_KEY);
      }
    } catch {
      // Local persistence is best-effort; the eligibility check still works.
    }
  }, [normalizedOwner, ownerLooksValid]);

  useEffect(() => {
    setEligibility(null);
    setEligibilityError("");
    setEligibilityCheckedOwner("");

    if (!normalizedOwner) return;
    if (!ownerLooksValid) {
      setEligibilityError("Enter a valid Solana owner public key to check minted receipt eligibility.");
      return;
    }

    const controller = new AbortController();
    setEligibilityLoading(true);
    const timer = window.setTimeout(() => {
      readJson<Eligibility>(
        `/api/agent/credit-eligibility?owner=${encodeURIComponent(normalizedOwner)}`,
        controller.signal,
      )
        .then((payload) => {
          setEligibility(payload);
          setEligibilityError(payload.persistence?.error || "");
          setEligibilityCheckedOwner(normalizedOwner);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setEligibility(null);
          setEligibilityError(error instanceof Error ? error.message : "Unable to load credit eligibility.");
          setEligibilityCheckedOwner(normalizedOwner);
        })
        .finally(() => {
          if (!controller.signal.aborted) setEligibilityLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
      setEligibilityLoading(false);
    };
  }, [normalizedOwner, ownerLooksValid]);

  const readinessStatus = useMemo<"ready" | "blocked" | "pending">(() => {
    if (readinessError) return "blocked";
    if (!readiness) return "pending";
    return readiness.enabled && readiness.configured ? "ready" : "blocked";
  }, [readiness, readinessError]);

  const eligibilityStatus = useMemo<"ready" | "blocked" | "pending">(() => {
    if (eligibilityLoading) return "pending";
    if (!hasOwner) return "pending";
    if (ownerLooksValid && eligibilityCheckedOwner !== normalizedOwner) return "pending";
    if (eligibilityError) return "blocked";
    return credit?.eligible ? "ready" : "blocked";
  }, [credit?.eligible, eligibilityCheckedOwner, eligibilityError, eligibilityLoading, hasOwner, normalizedOwner, ownerLooksValid]);

  return (
    <main className="credit-page">
      <style>{`
        .credit-page{min-height:100vh;padding:28px clamp(18px,4vw,56px) 56px;background:linear-gradient(135deg,oklch(0.95 0.016 115),oklch(0.90 0.018 128));color:var(--ink)}
        .credit-shell{max-width:1180px;margin:0 auto}
        .credit-nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:34px}
        .credit-nav a{min-height:34px;display:inline-flex;align-items:center;padding:0 12px;border:.5px solid var(--rule);border-radius:6px;background:var(--receipt);color:var(--ink-muted);text-decoration:none;font-weight:800;font-size:13px}
        .credit-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.82fr);gap:18px;align-items:stretch}
        .credit-card{border:.5px solid var(--rule);border-radius:8px;background:var(--receipt);padding:18px;box-shadow:0 8px 24px rgba(24,24,24,.045)}
        .credit-card.dark{background:var(--panel);color:var(--panel-text);border-color:oklch(0.34 0.03 135)}
        .credit-kicker{font-family:var(--mono);font-size:10px;letter-spacing:.9px;text-transform:uppercase;color:var(--ink-muted)}
        .credit-card.dark .credit-kicker{color:oklch(0.82 0.02 130)}
        .credit-title{max-width:760px;margin:10px 0 0;font-family:var(--display);font-style:italic;font-size:clamp(44px,7vw,82px);line-height:.92;font-weight:400;color:var(--ink)}
        .credit-card.dark .credit-title{color:var(--panel-text)}
        .credit-copy{margin:16px 0 0;color:var(--ink-muted);font-size:16px;line-height:1.55}
        .credit-card.dark .credit-copy{color:oklch(0.88 0.014 120)}
        .credit-input{display:grid;gap:8px;margin-top:20px}
        .credit-input label{font-family:var(--mono);font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:oklch(0.82 0.02 130)}
        .credit-input input{width:100%;min-height:44px;border:.5px solid oklch(0.42 0.035 135);border-radius:8px;background:oklch(0.18 0.02 135);color:var(--panel-text);padding:0 12px;font:600 14px var(--mono);outline:none}
        .credit-input input:focus{border-color:var(--verified);box-shadow:0 0 0 3px oklch(0.64 0.11 145 / .22)}
        .credit-help{min-height:18px;color:oklch(0.86 0.018 120);font-size:12px;line-height:1.45}
        .credit-status-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px}
        .credit-status{display:grid;gap:9px;border:.5px solid var(--rule);border-radius:8px;background:oklch(0.985 0.005 95 / .76);padding:13px}
        .credit-status strong{color:var(--ink);line-height:1.25}
        .credit-status span,.credit-status small{color:var(--ink-muted);font-size:13px;line-height:1.45}
        .credit-status small{font-family:var(--mono);font-size:11px}
        .credit-pill{width:max-content;max-width:100%;border-radius:999px;border:.5px solid var(--rule);padding:4px 8px;font-family:var(--mono);font-size:10px;text-transform:uppercase;color:var(--ink-muted);background:var(--receipt)}
        .credit-pill.ready{border-color:oklch(0.64 0.11 145);color:oklch(0.38 0.10 145);background:oklch(0.94 0.04 145)}
        .credit-pill.blocked{border-color:oklch(0.68 0.13 42);color:oklch(0.48 0.12 42);background:oklch(0.96 0.035 70)}
        .credit-pill.pending{border-color:oklch(0.74 0.04 110);color:var(--ink-muted);background:oklch(0.97 0.012 100)}
        .credit-list{display:grid;gap:10px;margin-top:16px}
        .credit-rule{display:grid;gap:4px;border:.5px solid var(--rule);border-radius:8px;background:oklch(0.985 0.005 95 / .68);padding:12px}
        .credit-rule strong{color:var(--ink)}
        .credit-rule span{color:var(--ink-muted);font-size:13px;line-height:1.45}
        .credit-flow{margin-top:16px;padding:16px;border-radius:8px;background:oklch(0.21 0.026 135);color:var(--panel-text);font-family:var(--mono);font-size:12px;line-height:1.75;white-space:pre-wrap;overflow:auto}
        .credit-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
        .credit-cta a{min-height:42px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;padding:0 14px;border:.5px solid var(--verified);background:var(--verified);color:var(--panel-text);text-decoration:none;font-weight:900}
        .credit-cta a.secondary{background:var(--receipt);color:var(--ink);border-color:var(--rule)}
        @media(max-width:900px){.credit-grid,.credit-status-grid{grid-template-columns:1fr}}
      `}</style>
      <div className="credit-shell">
        <nav className="credit-nav" aria-label="Credit">
          <Link href="/">Home</Link>
          <Link href="/passport">Passport</Link>
          <Link href="/trust-api">Trust API</Link>
          <Link href="/merchant">Merchant Demo</Link>
        </nav>
        <section className="credit-grid">
          <div className="credit-card dark">
            <div className="credit-kicker">Purpose-bound eligibility</div>
            <h1 className="credit-title">Credit starts with receipt eligibility.</h1>
            <p className="credit-copy">
              Jiagon checks whether minted receipt credentials unlock a capped dining-deposit signal, then separately
              shows whether the devnet draw route is configured. This is not production lending, open cash, or a full
              underwriting model.
            </p>
            <div className="credit-input">
              <label htmlFor="credit-owner">Solana owner public key</label>
              <input
                id="credit-owner"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                placeholder="Paste wallet owner to check eligibility"
                spellCheck={false}
                autoComplete="off"
              />
              <div className="credit-help">
                {eligibilityLoading
                  ? "Checking minted receipt credentials..."
                  : eligibilityError || "Saved on this device only. Jiagon calls the public eligibility endpoint when the key is valid."}
              </div>
            </div>
            <div className="credit-cta">
              <Link href="/passport">Open Passport</Link>
              <Link className="secondary" href="/merchant">Claim or mint receipt</Link>
              <Link className="secondary" href="/trust-api">Open Trust API</Link>
            </div>
          </div>
          <div className="credit-card">
            <div className="credit-kicker">Live checks</div>
            <div className="credit-list">
              <div className="credit-rule">
                <strong>Eligibility before draw readiness</strong>
                <span>Minted receipt credentials decide whether any capped demo credit is unlocked for this owner.</span>
              </div>
              <div className="credit-rule">
                <strong>Draw route is separate</strong>
                <span>
                  The devnet route must be enabled and fully configured before any real draw transaction can be sent.
                </span>
              </div>
              <div className="credit-rule">
                <strong>No draw or repay buttons here</strong>
                <span>This page reports readiness only. It does not simulate or submit credit transactions.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="credit-status-grid" aria-label="Credit status">
          <article className="credit-status">
            <div className={`credit-pill ${statusTone(eligibilityStatus)}`}>
              {eligibilityStatus === "ready" ? "eligible" : eligibilityStatus === "blocked" ? "not eligible" : "waiting"}
            </div>
            <strong>Minted receipt eligibility</strong>
            <span>
              {hasOwner
                ? eligibilityPending
                  ? "Checking minted receipt credentials for this owner..."
                  : credit?.eligible
                    ? `$${credit.unlockedCreditUsd || "0.00"} unlocked from minted receipt credentials.`
                    : eligibilityError || "No unlocked credit found for this owner yet."
                : "Enter a Solana owner to check receipt-backed eligibility."}
            </span>
            <small>minted receipts: {credit?.mintedReceiptCount ?? "unknown"}</small>
          </article>
          <article className="credit-status">
            <div className={`credit-pill ${statusTone(readinessStatus)}`}>
              {readinessStatus === "ready" ? "route ready" : readinessStatus === "blocked" ? "route blocked" : "loading"}
            </div>
            <strong>Devnet draw route</strong>
            <span>
              {readinessError
                ? readinessError
                : readiness
                  ? `${readiness.product || "Devnet credit route"} is ${readiness.enabled && readiness.configured ? "configured" : "not ready"}.`
                  : "Loading route readiness from the app API."}
            </span>
            <small>
              enabled: {formatBoolean(readiness?.enabled)} / configured: {formatBoolean(readiness?.configured)} / cluster:{" "}
              {readiness?.cluster || "unknown"}
            </small>
          </article>
          <article className="credit-status">
            <div className="credit-pill pending">policy rails</div>
            <strong>Bounded dining deposit</strong>
            <span>Allowed purpose is dining_deposit, sent only through an approved merchant escrow path and bounded amount.</span>
            <small>max demo cap: ${((credit?.maxDemoCreditCents ?? 2500) / 100).toFixed(2)}</small>
          </article>
        </section>

        <section className="credit-card" style={{ marginTop: 18 }}>
          <div className="credit-kicker">Policy rails</div>
          <div className="credit-status-grid">
            {policyRails.map(([title, body]) => (
              <div className="credit-status" key={title}>
                <strong>{title}</strong>
                <span>{body}</span>
              </div>
            ))}
          </div>
          <pre className="credit-flow">{`minted receipt credential
-> eligibility signal
-> purpose = dining_deposit
-> recipient = approved merchant escrow
-> amount = bounded by demo policy
-> draw only when devnet route is enabled and configured`}</pre>
        </section>
      </div>
    </main>
  );
}
