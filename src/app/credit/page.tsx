import Link from "next/link";

const policy = [
  ["Eligibility first", "A wallet is eligible or not eligible based on verified receipt memory."],
  ["Allowed purpose", "The MVP policy is a dining deposit, not unrestricted cash."],
  ["Bounded recipient", "Funds should move to merchant escrow or an approved merchant account."],
  ["Bounded amount", "The cap is tied to receipt credentials and repayment history."],
  ["Proof weighted", "L4/L5 payment-backed or minted receipts count more than L2/L3 pilot attestations."],
];

const states = [
  ["Eligible", "Minted receipt memory supports a capped dining-deposit line."],
  ["Not eligible", "The wallet has no qualifying receipt credentials yet."],
  ["Needs stronger proof", "L2/L3 activity can help recommendations, but L4/L5 carries more credit weight."],
];

export default function CreditPage() {
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
        .credit-list,.credit-state-list{display:grid;gap:10px;margin-top:16px}
        .credit-rule,.credit-state{display:grid;gap:4px;border:.5px solid var(--rule);border-radius:8px;background:oklch(0.985 0.005 95 / .68);padding:12px}
        .credit-rule strong,.credit-state strong{color:var(--ink)}
        .credit-rule span,.credit-state span{color:var(--ink-muted);font-size:13px;line-height:1.45}
        .credit-state-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:18px}
        .credit-state{background:var(--receipt)}
        .credit-flow{margin-top:16px;padding:16px;border-radius:8px;background:oklch(0.21 0.026 135);color:var(--panel-text);font-family:var(--mono);font-size:12px;line-height:1.75;white-space:pre-wrap;overflow:auto}
        .credit-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
        .credit-cta a{min-height:42px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;padding:0 14px;border:.5px solid var(--verified);background:var(--verified);color:var(--panel-text);text-decoration:none;font-weight:900}
        .credit-cta a.secondary{background:var(--receipt);color:var(--ink);border-color:var(--rule)}
        @media(max-width:860px){.credit-grid,.credit-state-grid{grid-template-columns:1fr}}
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
            <h1 className="credit-title">Credit starts as a policy check, not an open loan.</h1>
            <p className="credit-copy">
              Jiagon turns verified receipt memory into an eligibility signal for capped dining deposits. The product is
              not production lending yet, and it does not offer unrestricted cash borrowing.
            </p>
            <pre className="credit-flow">{`verified receipt memory
-> eligible / not eligible
-> purpose = dining deposit
-> recipient = approved merchant escrow
-> amount = bounded
-> L4/L5 proof weighs more than L2/L3`}</pre>
            <div className="credit-cta">
              <Link href="/api/agent">Open agent docs</Link>
              <Link className="secondary" href="/passport">Open passport</Link>
            </div>
          </div>
          <div className="credit-card">
            <div className="credit-kicker">Policy rails</div>
            <div className="credit-list">
              {policy.map(([title, body]) => (
                <div className="credit-rule" key={title}>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="credit-card" style={{ marginTop: 18 }}>
          <div className="credit-kicker">Agent-readable state</div>
          <div className="credit-state-grid">
            {states.map(([title, body]) => (
              <div className="credit-state" key={title}>
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
