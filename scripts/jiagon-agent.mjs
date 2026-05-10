#!/usr/bin/env node

const intent = process.argv.slice(2).join(" ").trim();

if (!intent) {
  console.error('Usage: pnpm agent "Order one iced latte at Raposa Coffee under $10 with Solana Pay"');
  process.exit(1);
}

const origin = process.env.JIAGON_AGENT_ORIGIN || "https://jiagon.vercel.app";

function inferPaymentMode(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes("counter") || normalized.includes("cash") || normalized.includes("現場")) {
    return "pay_at_counter";
  }
  if (normalized.includes("solana")) return "solana_pay";
  return "crypto_pay";
}

function inferMaxSpendUsd(text) {
  const usd = text.match(/\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:usd|usdc|dollars?|美金)/i);
  if (usd) return Number.parseFloat(usd[1]).toFixed(2);

  const under = text.match(/(?:under|below|less than|以內|低於|不要超過)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i);
  if (under) return Number.parseFloat(under[1]).toFixed(2);

  return "10.00";
}

function inferMerchantId(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes("raposa")) return "raposa-coffee";
  return "raposa-coffee";
}

async function main() {
  const body = {
    agentId: process.env.JIAGON_AGENT_ID || "jhinresh-cli-agent",
    userIntent: intent,
    merchantId: inferMerchantId(intent),
    maxSpendUsd: inferMaxSpendUsd(intent),
    paymentMode: inferPaymentMode(intent),
    customerLabel: process.env.JIAGON_AGENT_CUSTOMER || "Jerry",
  };

  const response = await fetch(`${origin}/api/agent/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok) {
    console.error("Jiagon agent order failed");
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  const pickupCode = payload?.order?.pickupCode || "";
  const paymentUrl = payload?.payment?.url || "";
  const nfcStation = payload?.urls?.nfcStation || "";
  const pairPhoneForNfcClaim = payload?.urls?.pairPhoneForNfcClaim || "";

  console.log("Jiagon Agent");
  console.log("");
  console.log(`Intent: ${intent}`);
  console.log(`Status: ${payload.status || "unknown"}`);
  console.log(`Merchant: ${payload?.merchant?.name || "unknown"}`);
  console.log(`Total: $${payload?.order?.subtotalUsd || "0.00"}`);
  console.log(`Pickup code: ${pickupCode}`);
  console.log(`ETA: ${payload?.pickup?.label || "unknown"}`);
  console.log("");
  console.log("Required demo fields");
  console.log(`order.pickupCode=${pickupCode}`);
  console.log(`payment.url=${paymentUrl}`);
  console.log(`urls.nfcStation=${nfcStation}`);
  console.log(`urls.pairPhoneForNfcClaim=${pairPhoneForNfcClaim}`);
  console.log("");
  console.log("Next");
  for (const instruction of payload.customerInstructions || []) {
    console.log(`- ${instruction}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
