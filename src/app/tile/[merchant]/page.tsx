"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

type MenuItem = {
  id: string;
  name: string;
  amountUsd: string;
};

type MerchantProfile = {
  name: string;
  location: string;
  category: string;
  purpose: string;
  menu: MenuItem[];
};

type MerchantOrderResponse = {
  order?: {
    id: string;
    status: string;
    subtotalUsd: string;
    proofLevel: string;
  };
  error?: string;
};

const merchantProfiles: Record<string, MerchantProfile> = {
  "consensus-cafe": {
    name: "Consensus Cafe",
    location: "Miami Beach",
    category: "Cafe",
    purpose: "cafe_purchase",
    menu: [
      { id: "espresso", name: "Espresso", amountUsd: "4.50" },
      { id: "iced-latte", name: "Iced latte", amountUsd: "6.50" },
      { id: "croissant", name: "Butter croissant", amountUsd: "5.25" },
    ],
  },
  "mume-taipei": {
    name: "MUME Taipei",
    location: "Taipei",
    category: "Dining",
    purpose: "premium_restaurant_deposit",
    menu: [
      { id: "deposit", name: "Reservation deposit", amountUsd: "25.00" },
      { id: "sparkling-water", name: "Sparkling water", amountUsd: "8.00" },
      { id: "dessert", name: "Dessert add-on", amountUsd: "14.00" },
    ],
  },
};

const fallbackMenu: MenuItem[] = [
  { id: "coffee", name: "Coffee", amountUsd: "5.00" },
  { id: "deposit", name: "Reservation deposit", amountUsd: "20.00" },
];

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function clampQuantity(value: string) {
  const parsed = Number.parseInt(value || "1", 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), 20);
}

export default function TilePage() {
  const params = useParams<{ merchant?: string | string[] }>();
  const merchantId = Array.isArray(params.merchant) ? params.merchant[0] : params.merchant || "consensus-cafe";
  const merchant = merchantProfiles[merchantId] || {
    name: titleFromSlug(merchantId),
    location: "Local",
    category: "Merchant",
    purpose: "merchant_receipt",
    menu: fallbackMenu,
  };
  const [selectedItemId, setSelectedItemId] = useState(merchant.menu[0]?.id || fallbackMenu[0].id);
  const [quantity, setQuantity] = useState(1);
  const [customerLabel, setCustomerLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<MerchantOrderResponse["order"] | null>(null);
  const selectedItem = merchant.menu.find((item) => item.id === selectedItemId) || merchant.menu[0] || fallbackMenu[0];
  const subtotal = (Number(selectedItem.amountUsd) * quantity).toFixed(2);

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

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOrder(null);

    try {
      const response = await fetch("/api/merchant/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchantId,
          merchantName: merchant.name,
          location: merchant.location,
          source: "tile",
          customerLabel,
          notes,
          items: [
            {
              id: selectedItem.id,
              name: selectedItem.name,
              quantity,
              unitAmountUsd: selectedItem.amountUsd,
            },
          ],
        }),
      });
      const payload = await response.json() as MerchantOrderResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Order failed.");
      }
      if (!payload.order) {
        throw new Error("Order response is missing.");
      }
      setOrder(payload.order);
      setNotes("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Order failed.");
    } finally {
      setBusy(false);
    }
  }

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
          <div className="tile-kicker">NFC / Telegram order tile</div>
          <h1>{merchant.name}</h1>
          <p>
            Tap from NFC or open from Telegram to place an order intent. The merchant completes the order into a
            claimable Jiagon receipt after fulfillment.
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
              <span>Order source</span>
              <strong>NFC / Telegram</strong>
            </div>
            <div>
              <span>Receipt proof</span>
              <strong>Merchant completion</strong>
            </div>
          </div>

          <form className="tile-order" onSubmit={submitOrder}>
            <div className="tile-order-head">
              <div>
                <span>Order</span>
                <strong>${subtotal}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{order ? order.status : "Ready"}</strong>
              </div>
            </div>

            <div className="tile-menu">
              {merchant.menu.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={selectedItem.id === item.id ? "selected" : ""}
                  onClick={() => setSelectedItemId(item.id)}
                >
                  <span>{item.name}</span>
                  <strong>${item.amountUsd}</strong>
                </button>
              ))}
            </div>

            <label className="tile-field">
              <span>Quantity</span>
              <input
                type="number"
                min="1"
                max="20"
                value={quantity}
                onChange={(event) => setQuantity(clampQuantity(event.target.value))}
              />
            </label>
            <label className="tile-field">
              <span>Name or table</span>
              <input
                value={customerLabel}
                onChange={(event) => setCustomerLabel(event.target.value)}
                placeholder="Alex / Table 4"
                maxLength={80}
              />
            </label>
            <label className="tile-field">
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Less ice, pickup time, allergy notes"
                maxLength={280}
              />
            </label>

            {error ? <p className="tile-alert error">{error}</p> : null}
            {order ? (
              <p className="tile-alert success">
                Order {order.id} is pending merchant confirmation. Receipt proof upgrades after completion.
              </p>
            ) : null}

            <button className="tile-submit" type="submit" disabled={busy}>
              {busy ? "Sending order..." : "Send order"}
            </button>
          </form>

          <div className="tile-actions">
            <a href={issueUrl}>Merchant receipt issuer</a>
            <a href="/merchant">Open dashboard</a>
          </div>
        </section>
      </section>
    </main>
  );
}

const tileStyles = `
.tile-page{min-height:100vh;background:radial-gradient(circle at 14% 0%,oklch(0.98 0.008 105) 0 260px,transparent 430px),linear-gradient(135deg,oklch(0.945 0.016 115) 0%,oklch(0.91 0.014 92) 58%,oklch(0.90 0.018 128) 100%);color:var(--ink);padding:24px clamp(18px,4vw,56px) 48px}.tile-shell{max-width:1040px;margin:0 auto}.tile-header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:44px}.tile-brand{display:flex;align-items:center;gap:10px;color:var(--verified);text-decoration:none}.tile-brand img{width:54px;height:60px;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(24,58,38,.10))}.tile-brand span{font-family:var(--display);font-size:34px;line-height:.9}.tile-nav{min-height:36px;display:inline-flex;align-items:center;border:.5px solid var(--rule);border-radius:8px;background:oklch(0.992 0.004 100 / .75);padding:0 12px;color:var(--ink-muted);font-size:13px;font-weight:800;text-decoration:none}.tile-card{border:.5px solid var(--rule);border-radius:12px;background:oklch(0.992 0.004 100 / .88);box-shadow:0 22px 80px rgba(24,58,38,.10);padding:clamp(22px,4vw,36px)}.tile-kicker{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--ink-muted)}.tile-card h1{margin:10px 0 0;font-family:var(--display);font-style:italic;font-weight:400;font-size:clamp(56px,8vw,96px);line-height:.88;color:var(--ink)}.tile-card p{max-width:760px;margin:16px 0 0;color:var(--ink-muted);font-size:16px;line-height:1.55}.tile-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:.5px solid var(--rule);border-radius:10px;overflow:hidden;margin-top:24px}.tile-grid div{display:grid;gap:6px;padding:14px;border-right:.5px solid var(--rule);background:oklch(0.985 0.005 95 / .76)}.tile-grid div:last-child{border-right:none}.tile-grid span,.tile-order-head span,.tile-field span{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.7px;color:var(--ink-muted)}.tile-grid strong{font-size:14px;color:var(--ink)}.tile-order{display:grid;gap:14px;margin-top:24px;border:.5px solid var(--rule);border-radius:10px;background:oklch(0.985 0.006 105 / .8);padding:16px}.tile-order-head{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tile-order-head div{display:grid;gap:4px;border:.5px solid var(--rule);border-radius:8px;background:oklch(0.996 0.003 100 / .8);padding:12px}.tile-order-head strong{font-size:22px;color:var(--ink)}.tile-menu{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.tile-menu button{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;text-align:left;border:.5px solid var(--rule);border-radius:8px;background:var(--receipt);min-height:54px;padding:10px 12px;color:var(--ink);cursor:pointer}.tile-menu button.selected{border-color:oklch(0.45 0.12 145);box-shadow:inset 0 0 0 1px oklch(0.45 0.12 145 / .35);background:oklch(0.95 0.032 145)}.tile-menu span{font-size:14px;font-weight:850}.tile-menu strong{font-size:13px;color:var(--verified)}.tile-field{display:grid;gap:7px}.tile-field input,.tile-field textarea{width:100%;border:.5px solid var(--rule);border-radius:8px;background:oklch(0.996 0.003 100);color:var(--ink);font:inherit;font-size:15px;padding:11px 12px;outline:none}.tile-field textarea{min-height:78px;resize:vertical}.tile-alert{border-radius:8px;padding:10px 12px!important;margin:0!important;font-size:13px!important;line-height:1.45!important}.tile-alert.error{border:.5px solid oklch(0.62 0.16 28 / .35);background:oklch(0.96 0.035 32);color:oklch(0.36 0.11 28)}.tile-alert.success{border:.5px solid oklch(0.54 0.12 145 / .32);background:oklch(0.95 0.032 145);color:var(--verified)}.tile-submit{min-height:48px;border:none;border-radius:10px;background:var(--verified);color:var(--panel-text);font-weight:950;font-size:14px;cursor:pointer;box-shadow:0 10px 28px rgba(0,96,48,.16)}.tile-submit:disabled{cursor:wait;opacity:.72}.tile-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.tile-actions a{min-height:42px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;padding:0 14px;font-size:13px;font-weight:900;text-decoration:none}.tile-actions a:first-child{border:.5px solid var(--rule);background:var(--receipt);color:var(--ink)}.tile-actions a:last-child{border:.5px solid var(--rule);background:oklch(0.992 0.004 100 / .75);color:var(--ink)}@media(max-width:760px){.tile-header{align-items:flex-start}.tile-grid,.tile-order-head,.tile-menu{grid-template-columns:1fr}.tile-grid div{border-right:none;border-bottom:.5px solid var(--rule)}.tile-grid div:last-child{border-bottom:none}}
`;
