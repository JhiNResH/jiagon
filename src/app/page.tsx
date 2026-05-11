import Link from "next/link";

const demoCurl = `curl https://jiagon.vercel.app/api/agent/merchants/raposa-coffee/trust
curl "https://jiagon.vercel.app/api/agent/recommendations?query=coffee%20irvine&limit=3"
curl -X POST https://jiagon.vercel.app/api/agent/rerank \\
  -H "content-type: application/json" \\
  -d '{"query":"coffee irvine","candidates":[{"provider":"google","name":"Raposa Coffee","branch":"Irvine","category":"Cafe","rating":4.6,"openNow":true}]}'
curl https://jiagon.vercel.app/api/agent/proofs/{receiptHash}
curl "https://jiagon.vercel.app/api/agent/credit-eligibility?owner={validSolanaOwner}"`;

const pillars = [
  ["01", "Passport first", "Users claim merchant-verified receipts into a portable Jiagon Passport."],
  ["02", "Receipt sources", "Merchant tools, NFC/QR, Telegram, Shopify, MoonPay, and Solana Pay can feed the same Passport."],
  ["03", "Agent Trust API", "Agents read proof, trust, rerank, and credit eligibility signals without seeing a private inbox."],
  ["04", "Purpose-bound credit", "Minted receipt credentials can unlock bounded dining deposit eligibility, not open cash."],
];

function JiagonMark() {
  return (
    <div className="home-mark" aria-label="Jiagon">
      <span>J</span>
      <i />
      <b>✓</b>
    </div>
  );
}

function StatusPill({ children }: { children: string }) {
  return <span className="home-pill">{children}</span>;
}

export default function Home() {
  return (
    <main className="home-shell">
      <style>{`
        .home-shell {
          min-height: 100vh;
          padding: 28px clamp(18px, 4vw, 56px) 56px;
          background:
            radial-gradient(circle at 18% 0%, oklch(0.98 0.008 105) 0 280px, transparent 420px),
            linear-gradient(135deg, oklch(0.95 0.016 115) 0%, oklch(0.91 0.014 92) 58%, oklch(0.90 0.018 128) 100%);
        }
        .home-inner { max-width: 1380px; margin: 0 auto; }
        .home-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 42px;
        }
        .home-brand { display: flex; align-items: center; gap: 14px; }
        .home-wordmark {
          font-family: var(--display);
          font-size: 42px;
          line-height: .9;
          color: var(--verified);
        }
        .home-sub, .home-kicker, .home-label {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: .9px;
          text-transform: uppercase;
          color: var(--ink-muted);
        }
        .home-sub { margin-top: 5px; }
        .home-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 6px;
          border: .5px solid var(--rule);
          border-radius: 8px;
          background: oklch(0.985 0.005 95 / .72);
          backdrop-filter: blur(16px);
        }
        .home-nav a {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          padding: 0 12px;
          border-radius: 6px;
          color: var(--ink-muted);
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }
        .home-nav a:hover { background: var(--verified-soft); color: var(--verified); }
        .home-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 520px);
          gap: 18px;
          align-items: stretch;
        }
        .home-title {
          max-width: 860px;
          margin: 10px 0 0;
          font-family: var(--display);
          font-size: clamp(48px, 8vw, 98px);
          line-height: .9;
          font-weight: 400;
          font-style: italic;
          color: var(--ink);
        }
        .home-copy {
          max-width: 720px;
          margin: 18px 0 0;
          color: var(--ink-muted);
          font-size: 17px;
          line-height: 1.55;
        }
        .home-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
        .home-button {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
          border-radius: 8px;
          border: .5px solid var(--verified);
          background: var(--verified);
          color: var(--panel-text);
          font-weight: 800;
          text-decoration: none;
        }
        .home-button.secondary { background: var(--surface); color: var(--ink); border-color: var(--rule); }
        .home-card {
          border: .5px solid var(--rule);
          border-radius: 8px;
          background: var(--receipt);
          padding: 18px;
          box-shadow: 0 1px 0 rgba(24,24,24,.05), 0 8px 24px rgba(24,24,24,.045);
        }
        .home-card.dark { background: var(--panel); color: var(--panel-text); border-color: oklch(0.34 0.03 135); }
        .home-grid {
          display: grid;
          grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
          gap: 18px;
          margin-top: 18px;
        }
        .home-panel-title {
          margin: 8px 0 0;
          font-family: var(--display);
          font-style: italic;
          font-weight: 400;
          font-size: 34px;
          line-height: .95;
        }
        .home-flow { display: grid; gap: 10px; margin-top: 16px; }
        .home-step {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
          padding: 12px;
          border: .5px solid var(--rule);
          border-radius: 8px;
          background: oklch(0.985 0.005 95 / .64);
        }
        .home-step code {
          font-family: var(--mono);
          color: var(--verified);
          font-size: 11px;
        }
        .home-step strong { display: block; font-size: 14px; }
        .home-step span { display: block; color: var(--ink-muted); font-size: 13px; line-height: 1.4; margin-top: 3px; }
        .home-code {
          margin: 14px 0 0;
          padding: 16px;
          border-radius: 8px;
          border: .5px solid oklch(0.38 0.03 135);
          background: oklch(0.21 0.026 135);
          color: var(--panel-text);
          font-family: var(--mono);
          font-size: 12px;
          line-height: 1.7;
          overflow: auto;
          white-space: pre-wrap;
        }
        .home-pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
        .home-pill {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 9px;
          border-radius: 6px;
          border: .5px solid color-mix(in oklch, var(--verified) 34%, var(--rule));
          background: var(--verified-soft);
          color: var(--verified);
          font-family: var(--mono);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .3px;
          text-transform: uppercase;
        }
        .home-note {
          margin-top: 18px;
          padding: 12px;
          border-radius: 8px;
          border: .5px solid var(--rule);
          background: oklch(0.985 0.005 95 / .64);
          color: var(--ink-muted);
          font-size: 13px;
          line-height: 1.45;
        }
        .home-note a { color: var(--verified); font-weight: 900; text-decoration: none; }
        .home-mark {
          width: 56px;
          height: 56px;
          position: relative;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border: 3px solid var(--verified);
          border-radius: 10px;
          background: var(--receipt);
          color: var(--verified);
          font-family: Georgia, serif;
          font-size: 39px;
          font-weight: 800;
          line-height: .9;
          box-shadow: 0 10px 24px rgba(24,58,38,.10);
        }
        .home-mark span { transform: translateY(-2px); }
        .home-mark i {
          position: absolute;
          left: 14%;
          right: 28%;
          bottom: 13%;
          border-bottom: 3px dotted var(--verified);
        }
        .home-mark b {
          position: absolute;
          top: 6%;
          right: 5%;
          width: 24%;
          height: 24%;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: var(--ink);
          color: var(--receipt);
          font-family: var(--ui);
          font-size: 10px;
        }
        @media (max-width: 920px) {
          .home-top, .home-hero, .home-grid { grid-template-columns: 1fr; display: grid; }
          .home-nav { justify-content: start; }
        }
      `}</style>
      <div className="home-inner">
        <header className="home-top">
          <div className="home-brand">
            <JiagonMark />
            <div>
              <div className="home-wordmark">Jiagon</div>
              <div className="home-sub">Receipt Passport + Agent Trust API + Purpose-bound Credit.</div>
            </div>
          </div>
          <nav className="home-nav" aria-label="Primary">
            <Link href="/passport">Passport</Link>
            <Link href="/trust-api">Trust API</Link>
            <Link href="/credit">Credit</Link>
            <Link href="/passport#receipt-sources">Receipt Sources</Link>
            <Link href="/merchant">Merchant Tools</Link>
          </nav>
        </header>

        <section className="home-hero">
          <div>
            <div className="home-kicker">Receipt sources &rarr; Passport &rarr; agent-readable trust &rarr; bounded credit eligibility</div>
            <h1 className="home-title">The receipt passport for AI agents.</h1>
            <p className="home-copy">
              Jiagon turns paid or merchant-verified commerce events into a user-owned Passport: claimable receipts,
              optional Bubblegum credentials, trust signals, and purpose-bound dining credit eligibility.
            </p>
            <div className="home-actions">
              <Link className="home-button" href="/passport">Open Receipt Passport</Link>
              <Link className="home-button secondary" href="/passport#receipt-sources">View Receipt Sources</Link>
              <Link className="home-button secondary" href="/credit">View Credit Policy</Link>
            </div>
          </div>
          <section className="home-card">
            <div className="home-label">Product pillars</div>
            <div className="home-flow">
              {pillars.map(([id, title, body]) => (
                <div className="home-step" key={id}>
                  <code>{id}</code>
                  <div>
                    <strong>{title}</strong>
                    <span>{body}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="home-grid">
          <section className="home-card dark">
            <div className="home-label">Core agent API</div>
            <h2 className="home-panel-title">Agents consume proof and policy signals before they act.</h2>
            <pre className="home-code">{demoCurl}</pre>
          </section>
          <section className="home-card">
            <div className="home-label">Adapter boundary</div>
            <h2 className="home-panel-title">Receipts are the product. Ordering is only one receipt source.</h2>
            <p className="home-copy">
              Merchant tools, claim links, NFC/QR stations, Telegram orders, merchant-configured Shopify and MoonPay
              webhooks, and SPL-verified Solana Pay flows can all feed Passport. Jiagon does not replace a POS, shopping
              graph, or production lending stack.
            </p>
            <div className="home-pill-row">
              <StatusPill>Receipt Passport</StatusPill>
              <StatusPill>Receipt Sources</StatusPill>
              <StatusPill>Trust API</StatusPill>
              <StatusPill>Dining Deposit</StatusPill>
            </div>
            <div className="home-note">
              Optional adapter: <Link href="/agent-order">agent order source</Link>. It can create receipt memory after
              merchant fulfillment, but Passport remains the primary Jiagon product surface.
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
