import Link from "next/link";

const endpoints = [
  {
    method: "GET",
    path: "/api/agent/merchants/{merchantId}/trust",
    title: "Merchant trust",
    body: "Returns receipt-backed trust, boost, review unlock, and credit caveats for a merchant.",
  },
  {
    method: "GET",
    path: "/api/agent/proofs/{receiptHash}",
    title: "Receipt proof",
    body: "Inspects a public receipt proof without exposing a user's private passport inbox.",
  },
  {
    method: "GET",
    path: "/api/agent/credit-eligibility?owner=...",
    title: "Credit eligibility",
    body: "Checks purpose-bound dining-deposit eligibility from minted receipt credentials.",
  },
  {
    method: "POST",
    path: "/api/agent/rerank",
    title: "Proof rerank",
    body: "Boosts external place candidates when Jiagon has stronger verified commerce memory.",
  },
];

const decision = [
  ["Public rating", "Generic place data is easy to scrape, stale, or farmed."],
  ["Jiagon proof", "Verified receipts show a paid or merchant-verified commerce event."],
  ["Agent action", "Trust the merchant, boost it, unlock a review, or check eligibility."],
];

export default function TrustApiPage() {
  return (
    <main className="trust-api-page">
      <style>{`
        .trust-api-page{min-height:100vh;padding:28px clamp(18px,4vw,56px) 56px;background:radial-gradient(circle at 14% 0%,oklch(0.98 0.008 105) 0 260px,transparent 430px),linear-gradient(135deg,oklch(0.95 0.016 115),oklch(0.90 0.018 128));color:var(--ink)}
        .trust-api-shell{max-width:1180px;margin:0 auto}
        .trust-api-nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:34px}
        .trust-api-nav a{min-height:34px;display:inline-flex;align-items:center;padding:0 12px;border:.5px solid var(--rule);border-radius:6px;background:var(--receipt);color:var(--ink-muted);text-decoration:none;font-weight:800;font-size:13px}
        .trust-api-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(360px,1fr);gap:18px;align-items:stretch}
        .trust-api-card{border:.5px solid var(--rule);border-radius:8px;background:var(--receipt);padding:18px;box-shadow:0 8px 24px rgba(24,24,24,.045)}
        .trust-api-card.dark{background:var(--panel);color:var(--panel-text);border-color:oklch(0.34 0.03 135)}
        .trust-api-kicker{font-family:var(--mono);font-size:10px;letter-spacing:.9px;text-transform:uppercase;color:var(--ink-muted)}
        .trust-api-card.dark .trust-api-kicker{color:oklch(0.82 0.02 130)}
        .trust-api-title{max-width:760px;margin:10px 0 0;font-family:var(--display);font-style:italic;font-size:clamp(44px,7vw,82px);line-height:.92;font-weight:400;color:var(--ink)}
        .trust-api-card.dark .trust-api-title{color:var(--panel-text)}
        .trust-api-copy{margin:16px 0 0;color:var(--ink-muted);font-size:16px;line-height:1.55}
        .trust-api-card.dark .trust-api-copy{color:oklch(0.88 0.014 120)}
        .trust-api-decision{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:18px}
        .trust-api-decision div,.trust-api-endpoint{border:.5px solid var(--rule);border-radius:8px;background:oklch(0.985 0.005 95 / .68);padding:12px}
        .trust-api-decision strong,.trust-api-endpoint strong{display:block;color:var(--ink);font-size:14px}
        .trust-api-decision span,.trust-api-endpoint span{display:block;margin-top:5px;color:var(--ink-muted);font-size:13px;line-height:1.45}
        .trust-api-endpoints{display:grid;gap:10px;margin-top:16px}
        .trust-api-route{display:flex;gap:8px;align-items:center;min-width:0;margin-bottom:7px}
        .trust-api-route em{flex:0 0 auto;border-radius:6px;background:var(--verified);color:var(--panel-text);padding:5px 7px;font-family:var(--mono);font-size:10px;font-style:normal;font-weight:900}
        .trust-api-route code{min-width:0;overflow:auto;font-family:var(--mono);font-size:11px;color:var(--verified)}
        .trust-api-flow{margin-top:16px;padding:16px;border-radius:8px;background:oklch(0.21 0.026 135);color:var(--panel-text);font-family:var(--mono);font-size:12px;line-height:1.75;white-space:pre-wrap;overflow:auto}
        .trust-api-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
        .trust-api-cta a{min-height:42px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;padding:0 14px;border:.5px solid var(--verified);background:var(--verified);color:var(--panel-text);text-decoration:none;font-weight:900}
        .trust-api-cta a.secondary{background:var(--receipt);color:var(--ink);border-color:var(--rule)}
        @media(max-width:860px){.trust-api-grid,.trust-api-decision{grid-template-columns:1fr}}
      `}</style>
      <div className="trust-api-shell">
        <nav className="trust-api-nav" aria-label="Trust API">
          <Link href="/">Home</Link>
          <Link href="/passport">Passport</Link>
          <Link href="/credit">Credit</Link>
          <Link href="/merchant">Merchant Demo</Link>
        </nav>
        <section className="trust-api-grid">
          <div className="trust-api-card dark">
            <div className="trust-api-kicker">Agent Trust API</div>
            <h1 className="trust-api-title">Agents need proof, not another public rating.</h1>
            <p className="trust-api-copy">
              Jiagon lets an AI agent compare weak public place data against verified receipt memory, then make a bounded
              decision: trust a merchant, boost a recommendation, unlock a receipt-backed review, or check credit
              eligibility.
            </p>
            <pre className="trust-api-flow">{`public rating / place graph = weak signal
Jiagon receipt proof = stronger signal
agent decision = trust | boost | unlock review | check credit eligibility`}</pre>
            <div className="trust-api-cta">
              <Link href="/api/agent">Open agent docs</Link>
              <Link className="secondary" href="/credit">View credit policy</Link>
            </div>
          </div>
          <div className="trust-api-card">
            <div className="trust-api-kicker">Core API surface</div>
            <div className="trust-api-endpoints">
              {endpoints.map((endpoint) => (
                <div className="trust-api-endpoint" key={endpoint.path}>
                  <div className="trust-api-route">
                    <em>{endpoint.method}</em>
                    <code>{endpoint.path}</code>
                  </div>
                  <strong>{endpoint.title}</strong>
                  <span>{endpoint.body}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="trust-api-card" style={{ marginTop: 18 }}>
          <div className="trust-api-kicker">Decision ladder</div>
          <div className="trust-api-decision">
            {decision.map(([title, body]) => (
              <div key={title}>
                <strong>{title}</strong>
                <span>{body}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
