import Link from "next/link";

const quoteCurl = `curl -X POST https://jiagon.vercel.app/api/agent/merchants/raposa-coffee/quote \\
  -H "content-type: application/json" \\
  -d '{"userIntent":"Get me an iced latte under $10, ready in 15 minutes","maxSpendUsd":"10.00","deadlineMinutes":15}'`;

const orderCurl = `curl -X POST https://jiagon.vercel.app/api/agent/merchants/raposa-coffee/orders \\
  -H "content-type: application/json" \\
  -d '{"agentId":"yc-demo-agent","userIntent":"Get me an iced latte under $10, ready in 15 minutes","maxSpendUsd":"10.00","deadlineMinutes":15,"paymentMode":"pay_at_counter"}'`;

const steps = [
  ["01", "Understand intent", "A user asks for a real-world outcome, not a form submission."],
  ["02", "Negotiate constraints", "Jiagon checks merchant capability, budget, time, stock, and alternatives."],
  ["03", "Create the handoff", "If feasible, Jiagon creates the order pass and merchant-facing fulfillment task."],
  ["04", "Leave proof", "Fulfillment creates a receipt trail the user and future agents can inspect."],
];

const merchants = [
  {
    name: "Raposa Coffee",
    mode: "Pickup negotiator",
    ask: "Iced latte under $10, ready in 15 minutes",
    proof: "Pickup code, staff fulfillment, receipt claim",
  },
  {
    name: "SOLYD",
    mode: "Shopping negotiator",
    ask: "Black MagSafe iPhone case, in stock, ship this week",
    proof: "Stock quote, checkout handoff, payment-backed receipt later",
  },
];

function JiagonMark() {
  return (
    <div className="home-mark" aria-label="Jiagon">
      <span>J</span>
      <b>✓</b>
    </div>
  );
}

export default function Home() {
  return (
    <main className="yc-home">
      <style>{`
        .yc-home {
          min-height: 100vh;
          padding: 28px clamp(18px, 4vw, 56px) 56px;
          background:
            radial-gradient(circle at 14% 0%, oklch(0.98 0.008 105) 0 260px, transparent 430px),
            linear-gradient(135deg, oklch(0.95 0.016 115) 0%, oklch(0.91 0.014 92) 58%, oklch(0.90 0.018 128) 100%);
        }
        .yc-shell { max-width: 1380px; margin: 0 auto; }
        .yc-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 42px;
        }
        .yc-brand { display: flex; align-items: center; gap: 14px; }
        .yc-wordmark {
          font-family: var(--display);
          font-size: 42px;
          line-height: .9;
          color: var(--verified);
        }
        .yc-sub,
        .yc-kicker,
        .yc-label {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: .9px;
          text-transform: uppercase;
          color: var(--ink-muted);
        }
        .yc-sub { margin-top: 5px; }
        .yc-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 6px;
          border: .5px solid var(--rule);
          border-radius: 8px;
          background: oklch(0.985 0.005 95 / .72);
          backdrop-filter: blur(16px);
        }
        .yc-nav a {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          padding: 0 12px;
          border-radius: 6px;
          color: var(--ink-muted);
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }
        .yc-nav a:hover { background: var(--verified-soft); color: var(--verified); }
        .yc-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 520px);
          gap: 18px;
          align-items: stretch;
        }
        .yc-card {
          border: .5px solid var(--rule);
          border-radius: 8px;
          background: var(--receipt);
          padding: 18px;
          box-shadow: 0 1px 0 rgba(24,24,24,.05), 0 8px 24px rgba(24,24,24,.045);
        }
        .yc-card.dark { background: var(--panel); color: var(--panel-text); border-color: oklch(0.34 0.03 135); }
        .yc-title {
          max-width: 900px;
          margin: 10px 0 0;
          font-family: var(--display);
          font-size: clamp(50px, 8vw, 104px);
          line-height: .9;
          font-weight: 400;
          font-style: italic;
          color: var(--ink);
        }
        .yc-copy {
          max-width: 760px;
          margin: 18px 0 0;
          color: var(--ink-muted);
          font-size: 17px;
          line-height: 1.55;
        }
        .yc-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
        .yc-button {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
          border-radius: 8px;
          border: .5px solid var(--verified);
          background: var(--verified);
          color: var(--panel-text);
          font-weight: 900;
          text-decoration: none;
        }
        .yc-button.secondary { background: var(--surface); color: var(--ink); border-color: var(--rule); }
        .yc-steps { display: grid; gap: 10px; margin-top: 16px; }
        .yc-step {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 12px;
          padding: 12px;
          border: .5px solid var(--rule);
          border-radius: 8px;
          background: oklch(0.985 0.005 95 / .68);
        }
        .yc-step code {
          font-family: var(--mono);
          color: var(--verified);
          font-size: 11px;
        }
        .yc-step strong { display: block; font-size: 14px; }
        .yc-step span { display: block; color: var(--ink-muted); font-size: 13px; line-height: 1.4; margin-top: 3px; }
        .yc-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-top: 18px;
        }
        .yc-panel-title {
          margin: 8px 0 0;
          font-family: var(--display);
          font-style: italic;
          font-weight: 400;
          font-size: 34px;
          line-height: .95;
        }
        .yc-merchant-list { display: grid; gap: 10px; margin-top: 16px; }
        .yc-merchant {
          padding: 14px;
          border-radius: 8px;
          border: .5px solid var(--rule);
          background: var(--surface);
        }
        .yc-merchant strong { display: block; color: var(--ink); }
        .yc-merchant p { margin: 6px 0 0; color: var(--ink-muted); font-size: 13px; line-height: 1.45; }
        .yc-code {
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
        .yc-pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
        .yc-pill {
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
          font-weight: 900;
          letter-spacing: .3px;
          text-transform: uppercase;
        }
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
        .home-mark b {
          position: absolute;
          right: -7px;
          top: -7px;
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: oklch(0.16 0.01 95);
          color: white;
          font-size: 14px;
          font-family: var(--ui);
        }
        @media (max-width: 980px) {
          .yc-top,
          .yc-hero { display: block; }
          .yc-nav { margin-top: 18px; }
          .yc-card + .yc-card { margin-top: 18px; }
          .yc-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="yc-shell">
        <header className="yc-top">
          <div className="yc-brand">
            <JiagonMark />
            <div>
              <div className="yc-wordmark">Jiagon</div>
              <div className="yc-sub">Merchant negotiator agent</div>
            </div>
          </div>
          <nav className="yc-nav" aria-label="Jiagon demo navigation">
            <Link href="/agent-order">Live Demo</Link>
            <Link href="/merchant">Merchant Queue</Link>
            <Link href="/passport">Receipts</Link>
            <Link href="/api/agent">Agent API</Link>
          </nav>
        </header>

        <section className="yc-hero">
          <div className="yc-card">
            <div className="yc-kicker">YC Call My Agent Hackathon</div>
            <h1 className="yc-title">An agent that gets merchant errands done.</h1>
            <p className="yc-copy">
              Jiagon turns a user request into a real merchant negotiation: it checks capability,
              price, time, stock, and fulfillment before creating the order handoff. The receipt is
              not the pitch; it is the proof that the agent completed useful work.
            </p>
            <div className="yc-actions">
              <Link className="yc-button" href="/agent-order">Run the negotiator</Link>
              <Link className="yc-button secondary" href="/merchant">Open merchant terminal</Link>
            </div>
            <div className="yc-pill-row" aria-label="Demo scope">
              <span className="yc-pill">Doer</span>
              <span className="yc-pill">Negotiator</span>
              <span className="yc-pill">Real-world merchant handoff</span>
              <span className="yc-pill">Receipt as proof</span>
            </div>
          </div>

          <aside className="yc-card">
            <div className="yc-kicker">What the agent does</div>
            <div className="yc-steps">
              {steps.map(([number, title, body]) => (
                <div className="yc-step" key={number}>
                  <code>{number}</code>
                  <div>
                    <strong>{title}</strong>
                    <span>{body}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="yc-grid">
          <div className="yc-card">
            <div className="yc-kicker">First merchant targets</div>
            <h2 className="yc-panel-title">Cafe pickup and commerce shipping.</h2>
            <div className="yc-merchant-list">
              {merchants.map((merchant) => (
                <div className="yc-merchant" key={merchant.name}>
                  <strong>{merchant.name} · {merchant.mode}</strong>
                  <p><b>Ask:</b> {merchant.ask}</p>
                  <p><b>Proof:</b> {merchant.proof}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="yc-card dark">
            <div className="yc-kicker">Agent calls</div>
            <h2 className="yc-panel-title">Quote first. Order only if feasible.</h2>
            <pre className="yc-code">{quoteCurl}</pre>
            <pre className="yc-code">{orderCurl}</pre>
          </div>
        </section>
      </div>
    </main>
  );
}
