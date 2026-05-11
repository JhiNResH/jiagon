import { createHash } from "node:crypto";
import {
  address,
  createSolanaRpc,
  signature as solanaSignature,
  type Address,
  type Signature,
  type TokenBalance,
} from "@solana/kit";
import { encodeURL, findReference, validateTransfer } from "@solana/pay";
import bs58 from "bs58";
import { solanaTestnetConfigFromEnv } from "@/lib/solanaNetwork";
import type { MerchantProfile } from "@/lib/merchantCatalog";
import type { MerchantOrder } from "@/server/merchantOrderStore";

const SOLANA_PAY_SIGNATURE_SCAN_LIMIT = 20;

type SolanaPayVerificationSetup =
  | {
      ok: true;
      cluster: string;
      rpcUrl: string;
      recipient: string;
      splToken: string;
    }
  | {
      ok: false;
      status: 422 | 503;
      error: string;
      missing?: string[];
    };

export function solanaPayRecipient() {
  return (process.env.JIAGON_SOLANA_PAY_RECIPIENT || process.env.NEXT_PUBLIC_JIAGON_SOLANA_PAY_RECIPIENT || "").trim();
}

export function solanaPaySplToken() {
  return (process.env.JIAGON_SOLANA_PAY_SPL_TOKEN || process.env.NEXT_PUBLIC_JIAGON_SOLANA_PAY_SPL_TOKEN || "").trim();
}

export function solanaPayNativeSolAmount() {
  const configured = (process.env.JIAGON_SOLANA_PAY_SOL_AMOUNT || process.env.NEXT_PUBLIC_JIAGON_SOLANA_PAY_SOL_AMOUNT || "0.001").trim();
  return /^\d+(\.\d+)?$/.test(configured) ? configured : "0.001";
}

export function solanaPayReference(orderId: string) {
  return bs58.encode(createHash("sha256").update(`jiagon-solana-pay:${orderId}`).digest());
}

export function solanaPayMemo(orderId: string) {
  return `jiagon:${orderId}`;
}

export function solanaPayVerificationSetupFromEnv(): SolanaPayVerificationSetup {
  const recipient = solanaPayRecipient();
  if (!recipient) {
    return {
      ok: false,
      status: 503,
      error: "JIAGON_SOLANA_PAY_RECIPIENT is required before Jiagon can verify Solana Pay order payments.",
      missing: ["JIAGON_SOLANA_PAY_RECIPIENT"],
    };
  }

  const splToken = solanaPaySplToken();
  if (!splToken) {
    return {
      ok: false,
      status: 422,
      error: "Exact USD-denominated receipt proof requires JIAGON_SOLANA_PAY_SPL_TOKEN. Nominal devnet SOL transfers can create payment intents, but Jiagon will not issue a USD receipt from SOL-only payment proof.",
      missing: ["JIAGON_SOLANA_PAY_SPL_TOKEN"],
    };
  }

  try {
    const { cluster, rpcUrl } = solanaTestnetConfigFromEnv();
    address(recipient);
    address(splToken);
    return { ok: true, cluster, rpcUrl, recipient, splToken };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: error instanceof Error ? error.message : "Solana Pay testnet configuration is invalid.",
    };
  }
}

export function solanaPayVerificationReadiness() {
  const setup = solanaPayVerificationSetupFromEnv();
  return {
    configured: setup.ok,
    enabled: setup.ok,
    missing: setup.ok ? [] : setup.missing || [],
    error: setup.ok ? null : setup.error,
  };
}

export function buildSolanaPayIntent(input: {
  merchant: MerchantProfile;
  orderId: string;
  pickupCode: string;
  amountUsd: string;
}) {
  const recipient = solanaPayRecipient();
  if (!recipient) return null;

  const { cluster } = solanaTestnetConfigFromEnv();
  const splToken = solanaPaySplToken();
  const amount = splToken ? input.amountUsd : solanaPayNativeSolAmount();
  const memo = solanaPayMemo(input.orderId);
  const reference = solanaPayReference(input.orderId);
  const url = encodeURL({
    recipient: address(recipient),
    amount: Number(amount),
    reference: address(reference),
    label: input.merchant.name,
    message: `Jiagon Order Pass ${input.pickupCode}`,
    memo,
    ...(splToken ? { splToken: address(splToken) } : {}),
  });

  return {
    mode: "crypto_pay",
    status: "payment_request_created",
    provider: "solana_pay",
    rail: "solana",
    recipient,
    amountUsd: input.amountUsd,
    amount,
    network: `solana-${cluster}`,
    currency: splToken ? "devnet SPL token" : "devnet SOL",
    splToken: splToken || null,
    url: url.toString(),
    memo,
    reference,
    verifyUrl: `/api/agent/orders/${encodeURIComponent(input.orderId)}/verify-solana-pay`,
    note: splToken
      ? "This is a devnet SPL token Solana Pay request. Once the transaction confirms, Jiagon can verify the reference and upgrade the order into a claimable receipt."
      : "This is a nominal devnet SOL Solana Pay request for the demo. Configure JIAGON_SOLANA_PAY_SPL_TOKEN before using Solana Pay as exact USD-denominated receipt proof.",
  };
}

function signatureCandidates(input: {
  foundSignature: Signature | null;
  providedSignature?: string | null;
  recentSignatures: readonly { signature: Signature; err: unknown | null }[];
}) {
  const candidates: Signature[] = [];
  const seen = new Set<string>();
  const add = (value: Signature | string | null | undefined) => {
    if (!value) return;
    const normalized = String(value);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    try {
      candidates.push(typeof value === "string" ? solanaSignature(value) : value);
    } catch {
      // Ignore malformed client-supplied signatures; reference scanning still decides verification.
    }
  };

  add(input.providedSignature);
  add(input.foundSignature);
  for (const entry of input.recentSignatures) {
    if (!entry.err) add(entry.signature);
  }
  return candidates;
}

function baseUnitsFromDecimal(amount: string, decimals: number) {
  const normalized = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Invalid decimal amount.");
  const [whole, fractional = ""] = normalized.split(".");
  const paddedFractional = fractional.padEnd(decimals, "0").slice(0, decimals);
  if (fractional.length > decimals && /[1-9]/.test(fractional.slice(decimals))) {
    throw new Error("Amount has more precision than the SPL token supports.");
  }
  return BigInt(whole || "0") * (BigInt(10) ** BigInt(decimals)) + BigInt(paddedFractional || "0");
}

function tokenBalanceAmount(balance: TokenBalance | undefined) {
  return balance ? BigInt(balance.uiTokenAmount.amount) : BigInt(0);
}

function exactSplTokenDeltaMatches(input: {
  meta: {
    preTokenBalances?: readonly TokenBalance[];
    postTokenBalances?: readonly TokenBalance[];
  } | null;
  recipient: Address;
  splToken: Address;
  amountUsd: string;
}) {
  const postBalance = input.meta?.postTokenBalances?.find(
    (balance) => balance.owner === input.recipient && balance.mint === input.splToken,
  );
  if (!postBalance) return false;

  const preBalance = input.meta?.preTokenBalances?.find(
    (balance) => balance.accountIndex === postBalance.accountIndex && balance.mint === input.splToken,
  );
  const delta = tokenBalanceAmount(postBalance) - tokenBalanceAmount(preBalance);
  return delta === baseUnitsFromDecimal(input.amountUsd, postBalance.uiTokenAmount.decimals);
}

export async function verifySolanaPayOrderPayment(input: {
  order: MerchantOrder;
  signature?: string | null;
}) {
  const setup = solanaPayVerificationSetupFromEnv();
  if (!setup.ok) return { ok: false as const, setup };

  const rpc = createSolanaRpc(setup.rpcUrl);
  const recipient = address(setup.recipient);
  const splToken = address(setup.splToken);
  const reference = address(solanaPayReference(input.order.id));
  const memo = solanaPayMemo(input.order.id);
  const amount = Number(input.order.subtotalUsd);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false as const,
      status: 422 as const,
      error: "Merchant order subtotal is not a valid Solana Pay amount.",
    };
  }

  let foundSignature: Signature | null = null;
  try {
    foundSignature = (await findReference(rpc, reference, { commitment: "confirmed" })).signature;
  } catch {
    // A provided signature can still be validated below; otherwise the response is a clear not-found.
  }

  let recentSignatures: readonly { signature: Signature; err: unknown | null }[] = [];
  try {
    recentSignatures = await rpc
      .getSignaturesForAddress(reference, { commitment: "confirmed", limit: SOLANA_PAY_SIGNATURE_SCAN_LIMIT })
      .send();
  } catch (error) {
    return {
      ok: false as const,
      status: 503 as const,
      error: error instanceof Error ? error.message : "Solana RPC reference lookup failed.",
      paymentProof: {
        provider: "solana_pay",
        network: `solana-${setup.cluster}`,
        reference,
        memo,
        recipient,
        splToken,
        expectedAmountUsd: input.order.subtotalUsd,
      },
    };
  }
  const candidates = signatureCandidates({
    foundSignature,
    providedSignature: input.signature,
    recentSignatures,
  });

  if (candidates.length === 0) {
    return {
      ok: false as const,
      status: 404 as const,
      error: "No confirmed Solana Pay transaction was found for this order reference.",
      paymentProof: {
        provider: "solana_pay",
        network: `solana-${setup.cluster}`,
        reference,
        memo,
        recipient,
        splToken,
        expectedAmountUsd: input.order.subtotalUsd,
      },
    };
  }

  const validationErrors: string[] = [];
  for (const candidate of candidates) {
    try {
      const transaction = await validateTransfer(
        rpc,
        candidate,
        {
          recipient,
          amount,
          splToken,
          reference,
          memo,
        },
        { commitment: "confirmed" },
      );
      if (!exactSplTokenDeltaMatches({ meta: transaction.meta, recipient, splToken, amountUsd: input.order.subtotalUsd })) {
        throw new Error("Solana Pay SPL token amount does not exactly match the order subtotal.");
      }

      return {
        ok: true as const,
        paymentProof: {
          provider: "solana_pay",
          status: "solana_pay_verified_paid",
          network: `solana-${setup.cluster}`,
          signature: candidate,
          reference,
          memo,
          recipient,
          splToken,
          expectedAmountUsd: input.order.subtotalUsd,
          blockTime: transaction.blockTime === null ? null : Number(transaction.blockTime),
          slot: String(transaction.slot),
        },
      };
    } catch (error) {
      validationErrors.push(error instanceof Error ? error.message : "Solana Pay transaction validation failed.");
    }
  }

  return {
    ok: false as const,
    status: 422 as const,
    error: "A Solana transaction referenced this order, but it did not match the exact recipient, SPL token, memo, and USD order total.",
    validationErrors: validationErrors.slice(0, 3),
    paymentProof: {
      provider: "solana_pay",
      network: `solana-${setup.cluster}`,
      reference,
      memo,
      recipient,
      splToken,
      expectedAmountUsd: input.order.subtotalUsd,
    },
  };
}
