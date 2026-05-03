import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function submittedMerchantKey(request: Request) {
  return (
    request.headers.get("x-jiagon-merchant-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    ""
  ).trim();
}

export function authorizeMerchantDashboard(request: Request) {
  const configuredKey = (process.env.JIAGON_MERCHANT_ISSUER_KEY || "").trim();
  const demoMode = process.env.JIAGON_ALLOW_DEMO_MERCHANT_ISSUE === "true";
  if (demoMode) return null;

  if (!configuredKey) {
    return "JIAGON_MERCHANT_ISSUER_KEY is required to manage merchant orders outside local demo mode.";
  }

  if (!safeEqual(submittedMerchantKey(request), configuredKey)) {
    return "Invalid merchant issuer key.";
  }

  return null;
}
