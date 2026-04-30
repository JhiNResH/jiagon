"use client";

import { useState, type ReactNode } from "react";

type DemoState = "fresh" | "verified" | "drawn" | "repaid";
export type JiagonView = "passport" | "verify" | "credit" | "api";

const wallet = "7xK9n1aQ91p7dF4mV2s9";
const proofHash = "8f2a4c...19c0";
const assetId = "core_jiagon_receipt_85c";
const reputationPda = "pda_rep_7xK...91p";

const short = (value: string) => `${value.slice(0, 4)}...${value.slice(-4)}`;

const dashboardStyles = `
.jiagon-page{min-height:100vh;background:radial-gradient(circle at 18% 0%,oklch(0.98 0.008 105) 0 280px,transparent 420px),linear-gradient(135deg,oklch(0.95 0.016 115) 0%,oklch(0.91 0.014 92) 58%,oklch(0.90 0.018 128) 100%);padding:28px clamp(18px,4vw,56px) 48px}.jiagon-header{max-width:1440px;margin:0 auto 30px;display:flex;align-items:center;justify-content:space-between;gap:24px}.jiagon-brand{display:flex;align-items:center;gap:14px}.jiagon-wordmark{font-family:var(--display);font-size:38px;line-height:.9;color:var(--verified)}.jiagon-brand-sub,.jiagon-eyebrow,.jiagon-mini-label{font-family:var(--mono);font-size:10px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.9px}.jiagon-brand-sub{margin-top:5px}.jiagon-nav{display:flex;align-items:center;gap:8px;padding:6px;border:.5px solid var(--rule);border-radius:8px;background:oklch(0.985 0.005 95 / .74);backdrop-filter:blur(16px)}.jiagon-nav a{min-height:34px;display:inline-flex;align-items:center;padding:0 12px;border-radius:6px;color:var(--ink-muted);font-size:13px;font-weight:700}.jiagon-nav a:hover,.jiagon-nav a[data-active="true"]{background:var(--verified-soft);color:var(--verified)}
.jiagon-hero{max-width:1440px;margin:0 auto 22px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:24px}.jiagon-hero h1{margin:8px 0 0;max-width:760px;font-family:var(--display);font-size:clamp(42px,7vw,86px);line-height:.92;font-weight:400;font-style:italic;color:var(--ink)}.jiagon-hero p{max-width:760px;margin:16px 0 0;color:var(--ink-muted);font-size:16px;line-height:1.5}.jiagon-hero-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.jiagon-dashboard{max-width:1440px;margin:0 auto;display:grid;grid-template-columns:minmax(340px,.9fr) minmax(360px,1fr) minmax(360px,1fr);gap:16px;align-items:start}.jiagon-panel{min-width:0;display:grid;gap:12px}.jiagon-panel-api{grid-column:2/4}.jiagon-panel h2{margin:4px 0 0;font-family:var(--display);font-size:36px;line-height:.96;font-weight:400;font-style:italic;color:var(--ink)}.jiagon-panel p{margin:8px 0 0;color:var(--ink-muted);font-size:13px;line-height:1.45}.jiagon-panel-body{display:grid;gap:12px}
.jiagon-card{background:var(--receipt);border:.5px solid var(--rule);border-radius:8px;padding:16px;box-shadow:0 1px 0 rgba(24,24,24,.05),0 8px 24px rgba(24,24,24,.045)}.jiagon-passport-card{padding:18px}.jiagon-passport-top,.jiagon-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.jiagon-credit-amount{margin-top:4px;font-size:46px;line-height:1;font-weight:800;color:var(--ink)}.jiagon-divider{height:1px;border-top:1px dashed var(--rule);margin:18px 0 8px}.jiagon-row{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:.5px dashed var(--rule);font-family:var(--mono);font-size:11px}.jiagon-row span{color:var(--ink-muted)}.jiagon-row strong{color:var(--ink);text-align:right;min-width:0;overflow-wrap:anywhere;font-weight:500}.jiagon-chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.jiagon-badge{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:6px;font-family:var(--mono);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap}.jiagon-badge-green{color:var(--verified);background:var(--verified-soft);border:.5px solid color-mix(in oklch,var(--verified) 34%,var(--rule))}.jiagon-badge-blue{color:var(--info);background:var(--info-soft);border:.5px solid color-mix(in oklch,var(--info) 34%,var(--rule))}.jiagon-badge-ink{color:var(--ink-muted);background:var(--surface);border:.5px solid var(--rule)}.jiagon-button{min-height:44px;border-radius:8px;border:.5px solid var(--verified);background:var(--verified);color:var(--panel-text);font-family:var(--ui);font-size:14px;font-weight:700;padding:0 14px;cursor:pointer}.jiagon-button-secondary{border-color:var(--rule);background:var(--surface);color:var(--ink)}
.jiagon-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.jiagon-actions-three{grid-template-columns:repeat(3,1fr)}.jiagon-request{margin:9px 0 0;font-size:18px;line-height:1.3;color:var(--ink)}.jiagon-code{margin:0;min-height:260px;padding:18px;border-radius:8px;border:.5px solid var(--rule);background:var(--panel);color:var(--panel-text);font-family:var(--mono);font-size:12px;line-height:1.6;overflow:auto;white-space:pre-wrap}.jiagon-mark{border-style:solid;border-color:var(--verified);color:var(--verified);display:grid;place-items:center;position:relative;background:var(--receipt);box-shadow:0 10px 24px rgba(24,58,38,.10);font-family:Georgia,'Times New Roman',serif;font-style:normal;font-weight:700;line-height:.9;flex-shrink:0}.jiagon-mark-j{transform:translateY(-2%)}.jiagon-mark-dots{position:absolute;left:13%;right:26%;bottom:13%;height:0;border-bottom:max(2px,.045em) dotted var(--verified);opacity:.88}.jiagon-mark-notch{position:absolute;left:50%;bottom:-6.5%;width:14%;height:14%;background:var(--receipt);border-right:max(2px,.055em) solid var(--verified);border-bottom:max(2px,.055em) solid var(--verified);transform:translateX(-50%) rotate(45deg)}.jiagon-mark-check{position:absolute;top:8%;right:6%;width:24%;height:24%;border-radius:999px;background:var(--ink);color:var(--receipt);display:grid;place-items:center;font-family:var(--ui);font-size:16%;font-weight:900;box-shadow:0 0 0 max(2px,.035em) var(--receipt)}
.jiagon-page-main{max-width:1440px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:18px;align-items:start}.jiagon-route-main{min-width:0}.jiagon-route-main .jiagon-panel{max-width:860px}.jiagon-route-main .jiagon-panel-api{grid-column:auto;max-width:920px}.jiagon-side{position:sticky;top:24px}.jiagon-side .jiagon-panel h2{font-size:32px}.jiagon-side .jiagon-panel-head p{display:none}
@media (max-width:1180px){.jiagon-dashboard{grid-template-columns:minmax(320px,.9fr) minmax(360px,1fr)}.jiagon-panel-api{grid-column:1/-1}.jiagon-page-main{grid-template-columns:1fr}.jiagon-side{position:static}.jiagon-route-main .jiagon-panel{max-width:none}.jiagon-route-main .jiagon-panel-api{max-width:none}}@media (max-width:820px){.jiagon-page{padding:18px 14px 36px}.jiagon-header,.jiagon-hero{display:grid;grid-template-columns:1fr}.jiagon-nav{overflow-x:auto;justify-content:start}.jiagon-hero-actions{justify-content:start}.jiagon-dashboard{grid-template-columns:1fr}.jiagon-panel-api{grid-column:auto}.jiagon-actions-three{grid-template-columns:1fr}}
`;

function JiagonMark({ size = 42 }: { size?: number }) {
  return (
    <div
      className="jiagon-mark"
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(2, size * 0.055),
        borderRadius: size * 0.16,
        fontSize: size * 0.7,
      }}
      aria-label="Jiagon mark"
    >
      <span className="jiagon-mark-j">J</span>
      <span className="jiagon-mark-dots" />
      <span className="jiagon-mark-notch" />
      <span className="jiagon-mark-check">✓</span>
    </div>
  );
}

function Badge({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "ink" | "blue" }) {
  return <span className={`jiagon-badge jiagon-badge-${tone}`}>{children}</span>;
}

function Button({
  children,
  onClick,
  secondary = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
}) {
  return (
    <button className={secondary ? "jiagon-button jiagon-button-secondary" : "jiagon-button"} onClick={onClick}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`jiagon-card ${className}`}>{children}</section>;
}

function Panel({
  id,
  title,
  eyebrow,
  sub,
  children,
  className = "",
}: {
  id: string;
  title: string;
  eyebrow: string;
  sub: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`jiagon-panel ${className}`}>
      <div className="jiagon-panel-head">
        <div>
          <div className="jiagon-eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
      </div>
      <div className="jiagon-panel-body">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="jiagon-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PassportPanel({ state, compact = false }: { state: DemoState; compact?: boolean }) {
  const hasReceipt = state !== "fresh";
  const hasDraw = state === "drawn";
  const repaid = state === "repaid";
  const available = hasDraw ? 30 : 50;

  return (
    <Panel
      id="passport"
      title="Credit Passport"
      eyebrow="Metaplex Core soulbound asset"
      sub={compact ? "" : "Non-transferable credit reputation backed by verified real-world activity."}
      className="jiagon-panel-passport"
    >
      <Card className="jiagon-passport-card">
        <div className="jiagon-passport-top">
          <div>
            <Badge>Metaplex Core</Badge>
            <div className="jiagon-mini-label">Available purpose-bound credit</div>
            <div className="jiagon-credit-amount">${available}</div>
          </div>
          <JiagonMark size={76} />
        </div>

        <div className="jiagon-divider" />
        <Row label="wallet" value={short(wallet)} />
        <Row label="status" value={repaid ? "Starter+" : "Starter"} />
        <Row label="draw limit" value="$25" />
        <Row label="verified receipts" value={hasReceipt ? 1 : 0} />
        <Row label="cashflow proof" value="not connected" />
        <Row label="repayment" value={repaid ? "1 repaid / 0 late" : "0 repaid / 0 late"} />
        <Row label="proof mode" value="zkTLS-compatible adapter" />

        <div className="jiagon-chip-row">
          <Badge tone="ink">Soulbound</Badge>
          <Badge tone="blue">Reputation PDA</Badge>
          <Badge>Credit Passport</Badge>
        </div>
      </Card>
    </Panel>
  );
}

function VerifyPanel({ state, setState }: { state: DemoState; setState: (state: DemoState) => void }) {
  const verified = state !== "fresh";

  return (
    <Panel
      id="verify"
      title="Verify Activity"
      eyebrow="zkTLS-compatible signed adapter"
      sub="Turn a Solayer card order into a receipt credential and reputation update."
    >
      <Card>
        <div className="jiagon-card-head">
          <Badge tone="blue">Solayer order</Badge>
          <Badge>{verified ? "Verified" : "Ready"}</Badge>
        </div>
        <Row label="merchant" value="85C BAKERY CAFE USA" />
        <Row label="type" value="card_spend" />
        <Row label="amount" value="$4.95" />
        <Row label="city" value="IRVINE" />
        <Row label="status" value="Success" />
        <Row label="bucket" value="2025-11" />
      </Card>

      <Card>
        <div className="jiagon-mini-label">Proof boundary</div>
        <Row label="mode" value="signed-demo" />
        <Row label="compatible with" value="Reclaim / zkPass / TLSNotary" />
        <Row label="proof hash" value={proofHash} />
        <Row label="raw data" value="hidden" />
        <div className="jiagon-actions">
          <Button onClick={() => setState("verified")}>Verify Proof</Button>
          <Button onClick={() => setState("verified")} secondary>Mint Credential</Button>
        </div>
      </Card>

      {verified && (
        <Card>
          <Badge>Receipt Credential minted</Badge>
          <Row label="asset" value={assetId} />
          <Row label="standard" value="Metaplex Core" />
          <Row label="reputation" value={`${reputationPda} updated`} />
          <Row label="unlocked" value="$50 purpose-bound credit" />
        </Card>
      )}
    </Panel>
  );
}

function CreditPanel({ state, setState }: { state: DemoState; setState: (state: DemoState) => void }) {
  const drawn = state === "drawn" || state === "repaid";
  const repaid = state === "repaid";

  return (
    <Panel
      id="credit"
      title="Purpose-Bound Credit"
      eyebrow="Undercollateralized credit draw"
      sub="Draw and repay small credit under amount, category, recipient, and expiry policy."
    >
      <Card>
        <div className="jiagon-mini-label">Credit request</div>
        <p className="jiagon-request">Draw $20 from a $50 Jiagon credit line for a restaurant deposit.</p>
      </Card>

      <Card>
        <div className="jiagon-card-head">
          <Badge>Purpose-bound draw</Badge>
          <Badge tone="blue">restaurant</Badge>
        </div>
        <Row label="task" value="restaurant deposit" />
        <Row label="merchant" value="Demo Restaurant / 85C" />
        <Row label="merchant trust" value="receipt-backed activity" />
        <Row label="requested prepay" value="$20" />
        <Row label="credit source" value="Jiagon Credit Passport" />
      </Card>

      <Card>
        <div className="jiagon-mini-label">Execute credit task</div>
        <div className="jiagon-actions jiagon-actions-three">
          <Button onClick={() => setState("drawn")}>Authorize</Button>
          <Button onClick={() => setState("drawn")} secondary>Draw</Button>
          <Button onClick={() => setState("repaid")} secondary>Repay</Button>
        </div>
      </Card>

      <Card>
        <div className="jiagon-mini-label">Policy</div>
        <Row label="max spend" value="$25" />
        <Row label="recipient" value="merchant escrow" />
        <Row label="expiry" value="24h" />
        <Row label="spend authority" value="one task only" />
        <Row label="available credit" value={drawn && !repaid ? "$30" : "$50"} />
      </Card>

      {drawn && (
        <Card>
          <Badge tone={repaid ? "green" : "blue"}>{repaid ? "Repayment confirmed" : "PurposeDraw PDA created"}</Badge>
          <Row label="draw" value="$20 devnet USDC" />
          <Row label="escrow" value="simulated merchant" />
          <Row label="credit tier" value={repaid ? "Starter+" : "Starter"} />
          <Row label="repayment count" value={repaid ? 1 : 0} />
        </Card>
      )}
    </Panel>
  );
}

function ApiPanel({ state }: { state: DemoState }) {
  const repaid = state === "repaid";
  const drawn = state === "drawn";
  const json = {
    wallet: "7xK...91p",
    verifiedReceipts: state === "fresh" ? 0 : 1,
    creditTier: repaid ? "starter+" : "starter",
    availableCredit: drawn ? 30 : 50,
    purposeBoundLimit: 25,
    trustedCategories: ["restaurant", "bakery"],
    recommendedAction: "can_execute_purpose_bound_draw",
  };

  return (
    <Panel
      id="api"
      title="Credit API"
      eyebrow="Policy-safe trust profile"
      sub="Apps and lenders read credential state without raw private financial data."
      className="jiagon-panel-api"
    >
      <Card>
        <div className="jiagon-chip-row">
          <Badge>Metaplex Core Receipt</Badge>
          <Badge>Credit Passport</Badge>
          <Badge tone="blue">Reputation PDA</Badge>
          <Badge tone="blue">PurposeDraw PDA</Badge>
          <Badge tone="ink">Bubblegum later</Badge>
        </div>
      </Card>
      <pre className="jiagon-code">{JSON.stringify(json, null, 2)}</pre>
      <Card>
        <Row label="endpoint" value="/api/credit/trust?wallet=..." />
        <Row label="raw private data" value="not exposed" />
        <Row label="credit action" value="execute purpose-bound draw" />
      </Card>
    </Panel>
  );
}

const viewContent = {
  passport: {
    eyebrow: "Metaplex Core · Solana PDA · devnet USDC",
    title: "Credit reputation for purpose-bound lending.",
    sub: "Your Jiagon Credit Passport is the starting point: verified activity becomes non-transferable credit reputation.",
  },
  verify: {
    eyebrow: "zkTLS-compatible signed adapter",
    title: "Verify activity before credit.",
    sub: "Prove a card order, mint a Metaplex Receipt Credential, then update the Reputation PDA.",
  },
  credit: {
    eyebrow: "Purpose-bound undercollateralized credit",
    title: "Draw credit under policy.",
    sub: "Credit is capped by amount, category, recipient, expiry, and repayment obligation.",
  },
  api: {
    eyebrow: "Policy-safe trust profile",
    title: "Expose credit reputation, not raw data.",
    sub: "Apps and lenders read credential state without seeing private receipts or bank records.",
  },
} satisfies Record<JiagonView, { eyebrow: string; title: string; sub: string }>;

const routes = [
  { view: "passport", label: "Passport", href: "/" },
  { view: "verify", label: "Verify", href: "/verify" },
  { view: "credit", label: "Credit", href: "/credit" },
  { view: "api", label: "API", href: "/trust-api" },
] satisfies Array<{ view: JiagonView; label: string; href: string }>;

function readInitialState(): DemoState {
  if (typeof window === "undefined") return "fresh";
  const stored = window.localStorage.getItem("jiagon-credit-demo-state");
  return stored === "verified" || stored === "drawn" || stored === "repaid" ? stored : "fresh";
}

export function JiagonApp({ view = "passport" }: { view?: JiagonView }) {
  const [state, setStateValue] = useState<DemoState>(readInitialState);
  const copy = viewContent[view];
  const showSidePassport = view !== "passport";

  const setState = (next: DemoState) => {
    setStateValue(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("jiagon-credit-demo-state", next);
    }
  };

  const mainPanel = {
    passport: <PassportPanel state={state} />,
    verify: <VerifyPanel state={state} setState={setState} />,
    credit: <CreditPanel state={state} setState={setState} />,
    api: <ApiPanel state={state} />,
  } satisfies Record<JiagonView, ReactNode>;

  return (
    <>
      <style>{dashboardStyles}</style>
      <main className="jiagon-page">
        <header className="jiagon-header">
          <div className="jiagon-brand">
            <JiagonMark size={54} />
            <div>
              <div className="jiagon-wordmark">Jiagon</div>
              <div className="jiagon-brand-sub">Solana credit reputation</div>
            </div>
          </div>
          <nav className="jiagon-nav" aria-label="Primary">
            {routes.map((route) => (
              <a
                key={route.view}
                href={route.href}
                data-active={route.view === view ? "true" : undefined}
                aria-current={route.view === view ? "page" : undefined}
              >
                {route.label}
              </a>
            ))}
          </nav>
        </header>

        <section className="jiagon-hero">
          <div>
            <div className="jiagon-eyebrow">{copy.eyebrow}</div>
            <h1>{copy.title}</h1>
            <p>{copy.sub}</p>
          </div>
          <div className="jiagon-hero-actions">
            <Button onClick={() => setState("verified")}>Run proof demo</Button>
            <Button onClick={() => setState("repaid")} secondary>Show repaid state</Button>
          </div>
        </section>

        <section className="jiagon-page-main" aria-label="Jiagon page">
          <div className="jiagon-route-main">{mainPanel[view]}</div>
          {showSidePassport && (
            <aside className="jiagon-side" aria-label="Credit Passport summary">
              <PassportPanel state={state} compact />
            </aside>
          )}
        </section>
      </main>
    </>
  );
}
