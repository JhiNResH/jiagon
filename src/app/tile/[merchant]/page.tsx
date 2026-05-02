"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";

const merchantProfiles: Record<string, { name: string; location: string; category: string; purpose: string }> = {
  "consensus-cafe": {
    name: "Consensus Cafe",
    location: "Miami Beach",
    category: "Cafe",
    purpose: "cafe_purchase",
  },
  "mume-taipei": {
    name: "MUME Taipei",
    location: "Taipei",
    category: "Dining",
    purpose: "premium_restaurant_deposit",
  },
};

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function TilePage() {
  const params = useParams<{ merchant?: string | string[] }>();
  const merchantId = Array.isArray(params.merchant) ? params.merchant[0] : params.merchant || "consensus-cafe";
  const merchant = merchantProfiles[merchantId] || {
    name: titleFromSlug(merchantId),
    location: "Local",
    category: "Merchant",
    purpose: "merchant_receipt",
  };

  const issueUrl = useMemo(() => {
    const query = new URLSearchParams({
      merchantId,
      merchantName: merchant.name,
      location: merchant.location,
      category: merchant.category,
      purpose: merchant.purpose,
    });
    return `/merchant?${query.toString()}`;
  }, [merchant.category, merchant.location, merchant.name, merchant.purpose, merchantId]);

  return (
    <main className="tile-page">
      <style>{tileStyles}</style>
      <section className="tile-shell">
        <header className="tile-header">
          <a className="tile-brand" href="/passport">
            <img src="/jiagon-logo-mark.png" alt="" />
            <span>Jiagon</span>
          </a>
          <a className="tile-nav" href="/passport">Passport</a>
        </header>

        <section className="tile-card">
          <div className="tile-kicker">NFC merchant tile</div>
          <h1>{merchant.name}</h1>
          <p>
            This is the fixed URL for an NFC card or sticker. The merchant still issues a one-time claim receipt from
            the dashboard after purchase.
          </p>

          <div className="tile-grid">
            <div>
              <span>Merchant</span>
              <strong>{merchant.name}</strong>
            </div>
            <div>
              <span>Location</span>
              <strong>{merchant.location}</strong>
            </div>
            <div>
              <span>Receipt source</span>
              <strong>Merchant-issued</strong>
            </div>
            <div>
              <span>Claim method</span>
              <strong>NFC page + QR token</strong>
            </div>
          </div>

          <div className="tile-actions">
            <a href={issueUrl}>Issue receipt</a>
            <a href="/merchant">Open dashboard</a>
          </div>
        </section>
      </section>
    </main>
  );
}

const tileStyles = `
.tile-page{min-height:100vh;background:radial-gradient(circle at 14% 0%,oklch(0.98 0.008 105) 0 260px,transparent 430px),linear-gradient(135deg,oklch(0.945 0.016 115) 0%,oklch(0.91 0.014 92) 58%,oklch(0.90 0.018 128) 100%);color:var(--ink);padding:24px clamp(18px,4vw,56px) 48px}.tile-shell{max-width:940px;margin:0 auto}.tile-header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:56px}.tile-brand{display:flex;align-items:center;gap:10px;color:var(--verified);text-decoration:none}.tile-brand img{width:54px;height:60px;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(24,58,38,.10))}.tile-brand span{font-family:var(--display);font-size:34px;line-height:.9}.tile-nav{min-height:36px;display:inline-flex;align-items:center;border:.5px solid var(--rule);border-radius:8px;background:oklch(0.992 0.004 100 / .75);padding:0 12px;color:var(--ink-muted);font-size:13px;font-weight:800;text-decoration:none}.tile-card{border:.5px solid var(--rule);border-radius:12px;background:oklch(0.992 0.004 100 / .88);box-shadow:0 22px 80px rgba(24,58,38,.10);padding:clamp(22px,4vw,36px)}.tile-kicker{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--ink-muted)}.tile-card h1{margin:10px 0 0;font-family:var(--display);font-style:italic;font-weight:400;font-size:clamp(56px,9vw,104px);line-height:.88;color:var(--ink)}.tile-card p{max-width:680px;margin:16px 0 0;color:var(--ink-muted);font-size:16px;line-height:1.55}.tile-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:.5px solid var(--rule);border-radius:10px;overflow:hidden;margin-top:24px}.tile-grid div{display:grid;gap:6px;padding:14px;border-right:.5px solid var(--rule);background:oklch(0.985 0.005 95 / .76)}.tile-grid div:last-child{border-right:none}.tile-grid span{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.7px;color:var(--ink-muted)}.tile-grid strong{font-size:14px;color:var(--ink)}.tile-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.tile-actions a{min-height:46px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;padding:0 16px;font-size:14px;font-weight:900;text-decoration:none}.tile-actions a:first-child{border:none;background:var(--verified);color:var(--panel-text);box-shadow:0 10px 28px rgba(0,96,48,.16)}.tile-actions a:last-child{border:.5px solid var(--rule);background:var(--receipt);color:var(--ink)}@media(max-width:760px){.tile-header{align-items:flex-start}.tile-grid{grid-template-columns:1fr}.tile-grid div{border-right:none;border-bottom:.5px solid var(--rule)}.tile-grid div:last-child{border-bottom:none}}
`;
