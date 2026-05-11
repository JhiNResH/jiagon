import Link from "next/link";

const currentSurfaces = [
  {
    href: "/passport",
    title: "Receipt Passport",
    body: "Claim and inspect merchant-issued receipt memory before an agent uses it.",
  },
  {
    href: "/merchant",
    title: "Merchant Dashboard",
    body: "Issue receipts, claim orders, and create the proof source behind Passport entries.",
  },
  {
    href: "/trust-api",
    title: "Agent Trust API",
    body: "Read receipt-backed trust, proof, rerank, and eligibility signals through API routes.",
  },
  {
    href: "/credit",
    title: "Credit Eligibility",
    body: "Review the purpose-bound dining-deposit policy and current eligibility language.",
  },
];

export default function VerifyPage() {
  return (
    <main className="verify-page">
      <style>{`
        .verify-page{min-height:100vh;padding:28px clamp(18px,4vw,56px) 56px;background:radial-gradient(circle at 18% 0%,oklch(0.98 0.008 105) 0 260px,transparent 430px),linear-gradient(135deg,oklch(0.95 0.016 115),oklch(0.90 0.018 128));color:var(--ink)}
        .verify-shell{max-width:1180px;margin:0 auto}
        .verify-nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:34px}
        .verify-nav a{min-height:34px;display:inline-flex;align-items:center;padding:0 12px;border:.5px solid var(--rule);border-radius:6px;background:var(--receipt);color:var(--ink-muted);text-decoration:none;font-weight:800;font-size:13px}
        .verify-nav a:hover{background:var(--verified-soft);color:var(--verified)}
        .verify-grid{display:grid;grid-template-columns:minmax(0,.92fr) minmax(340px,1fr);gap:18px;align-items:stretch}
        .verify-card{border:.5px solid var(--rule);border-radius:8px;background:var(--receipt);padding:18px;box-shadow:0 8px 24px rgba(24,24,24,.045)}
        .verify-card.dark{background:var(--panel);color:var(--panel-text);border-color:oklch(0.34 0.03 135)}
        .verify-kicker{font-family:var(--mono);font-size:10px;letter-spacing:.9px;text-transform:uppercase;color:var(--ink-muted)}
        .verify-card.dark .verify-kicker{color:oklch(0.82 0.02 130)}
        .verify-title{max-width:760px;margin:10px 0 0;font-family:var(--display);font-style:italic;font-size:clamp(44px,7vw,82px);line-height:.92;font-weight:400;color:var(--ink)}
        .verify-card.dark .verify-title{color:var(--panel-text)}
        .verify-copy{margin:16px 0 0;color:var(--ink-muted);font-size:16px;line-height:1.55}
        .verify-card.dark .verify-copy{color:oklch(0.88 0.014 120)}
        .verify-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
        .verify-cta a{min-height:42px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;padding:0 14px;border:.5px solid var(--verified);background:var(--verified);color:var(--panel-text);text-decoration:none;font-weight:900}
        .verify-cta a.secondary{background:var(--receipt);color:var(--ink);border-color:var(--rule)}
        .verify-list{display:grid;gap:10px;margin-top:16px}
        .verify-surface{display:grid;gap:5px;border:.5px solid var(--rule);border-radius:8px;background:oklch(0.985 0.005 95 / .68);padding:12px;color:inherit;text-decoration:none}
        .verify-surface:hover{background:var(--verified-soft)}
        .verify-surface strong{color:var(--ink);font-size:15px}
        .verify-surface span{color:var(--ink-muted);font-size:13px;line-height:1.45}
        .verify-note{margin-top:18px;border:.5px solid color-mix(in oklch,var(--verified) 34%,var(--rule));border-radius:8px;background:var(--verified-soft);padding:12px;color:var(--verified);font-size:13px;font-weight:800;line-height:1.45}
        @media(max-width:860px){.verify-grid{grid-template-columns:1fr}}
      `}</style>
      <div className="verify-shell">
        <nav className="verify-nav" aria-label="Verify">
          <Link href="/">Home</Link>
          <Link href="/passport">Passport</Link>
          <Link href="/merchant">Merchant Demo</Link>
          <Link href="/trust-api">Trust API</Link>
          <Link href="/credit">Credit</Link>
        </nav>
        <section className="verify-grid">
          <div className="verify-card dark">
            <div className="verify-kicker">Verify route update</div>
            <h1 className="verify-title">Jiagon verification now lives in the current product surfaces.</h1>
            <p className="verify-copy">
              The old verify demo has been retired. Jiagon now presents receipt memory, merchant issuance, agent trust,
              and purpose-bound credit eligibility as separate surfaces.
            </p>
            <div className="verify-cta">
              <Link href="/passport">Open Passport</Link>
              <Link className="secondary" href="/trust-api">Open Trust API</Link>
            </div>
          </div>
          <div className="verify-card">
            <div className="verify-kicker">Current product paths</div>
            <div className="verify-list">
              {currentSurfaces.map((surface) => (
                <Link className="verify-surface" href={surface.href} key={surface.href}>
                  <strong>{surface.title}</strong>
                  <span>{surface.body}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <div className="verify-note">
          This page does not simulate signed proof, merchant escrow, credit draw, or repayment actions.
        </div>
      </div>
    </main>
  );
}
