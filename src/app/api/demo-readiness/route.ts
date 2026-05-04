import { solanaBubblegumConfig } from "@/server/solanaBubblegum";
import { solanaCreditDepositConfig } from "@/server/solanaCreditDeposit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CREDIT_REQUIRED_ENV = [
  "JIAGON_CREDIT_DEVNET_DEMO_ENABLED=true",
  "SOLANA_CREDIT_VERIFIER_SECRET_KEY",
  "SOLANA_CREDIT_DEMO_OWNER_PUBLIC_KEY",
  "SOLANA_CREDIT_DEMO_OWNER_SECRET_KEY",
  "SOLANA_CREDIT_DEMO_BORROWER_TOKEN_ACCOUNT",
  "SOLANA_CREDIT_PAYMENT_MINT",
  "SOLANA_CREDIT_VAULT_TOKEN_ACCOUNT",
  "SOLANA_CREDIT_MERCHANT_ESCROW_TOKEN_ACCOUNT",
];

function configured(value: string | undefined) {
  return Boolean((value || "").trim());
}

function configuredOrigin() {
  return (
    configured(process.env.JIAGON_APP_ORIGIN) ||
    configured(process.env.NEXT_PUBLIC_APP_URL) ||
    configured(process.env.VERCEL_URL) ||
    process.env.NODE_ENV !== "production"
  );
}

function missing(names: string[]) {
  return names.filter((name) => {
    if (name.endsWith("=true")) {
      const envName = name.slice(0, -5);
      return process.env[envName] !== "true";
    }
    return !configured(process.env[name]);
  });
}

function readinessStatus(configuredValue: boolean, blockedValue = false) {
  if (blockedValue) return "blocked";
  return configuredValue ? "ready" : "missing";
}

export async function GET() {
  const bubblegum = solanaBubblegumConfig();
  const credit = solanaCreditDepositConfig();
  const telegramMissing = missing([
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_MERCHANT_GROUP_CHAT_ID",
    ...(process.env.NODE_ENV === "production" ? ["TELEGRAM_WEBHOOK_SECRET"] : []),
  ]);
  if (!configuredOrigin()) telegramMissing.push("JIAGON_APP_ORIGIN or NEXT_PUBLIC_APP_URL");

  const bubblegumMissing = missing(["SOLANA_BUBBLEGUM_TREE", "SOLANA_BUBBLEGUM_MINTER_SECRET_KEY"]);
  const creditMissing = missing(CREDIT_REQUIRED_ENV);
  const checks = [
    {
      id: "telegram",
      label: "Telegram POS",
      status: readinessStatus(telegramMissing.length === 0),
      configured: telegramMissing.length === 0,
      mode: configured(process.env.TELEGRAM_WEBHOOK_SECRET) ? "webhook-secret" : "local-or-unsealed-webhook",
      missingEnv: telegramMissing,
      detail: "Customer Telegram orders can notify the merchant group and staff can tap Paid + Done.",
    },
    {
      id: "bubblegum",
      label: "Bubblegum receipt cNFT",
      status: readinessStatus(bubblegum.mintConfigured),
      configured: bubblegum.mintConfigured,
      mode: bubblegum.mintConfigured ? "mint-enabled" : "prepare-only",
      cluster: bubblegum.cluster,
      missingEnv: bubblegumMissing,
      detail: "Claimed receipts can mint real Solana compressed NFT credentials.",
    },
    {
      id: "credit-vault",
      label: "Devnet credit vault",
      status: readinessStatus(credit.configured, !credit.enabled),
      configured: credit.configured,
      enabled: credit.enabled,
      mode: credit.configured ? "draw-repay-enabled" : "disabled-or-missing-env",
      cluster: credit.cluster,
      missingEnv: creditMissing,
      detail: "Credit page can send real devnet draw and repay transactions.",
    },
  ];

  return Response.json({
    product: "Jiagon Consensus demo readiness",
    generatedAt: new Date().toISOString(),
    overall: {
      ready: checks.every((check) => check.configured),
      readyCount: checks.filter((check) => check.configured).length,
      total: checks.length,
    },
    checks,
  });
}
