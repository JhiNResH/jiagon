import { bearerTokenFromRequest, verifyPrivyAccessToken } from "@/server/privyAuth";
import { claimMerchantIssuedReceipt, publicMerchantReceipt, savePrivateAccountState } from "@/server/receiptStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to verify Privy access token.";
  const status = message.includes("not configured") ? 503 : 401;
  return Response.json({ error: message }, { status });
}

async function verifiedClaims(request: Request) {
  const token = bearerTokenFromRequest(request);
  if (!token) throw new Error("Privy bearer token is required.");
  return verifyPrivyAccessToken(token);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 160) : null;
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!token || token.length < 12) {
    return Response.json({ error: "Invalid receipt claim token." }, { status: 400 });
  }

  let claims: Awaited<ReturnType<typeof verifiedClaims>>;
  try {
    claims = await verifiedClaims(request);
  } catch (error) {
    return authError(error);
  }

  let body: Record<string, unknown> = {};
  try {
    const rawBody = await request.text();
    if (rawBody) {
      if (rawBody.length > 25_000) {
        return Response.json({ error: "Claim payload is too large." }, { status: 413 });
      }
      body = JSON.parse(rawBody);
    }
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await claimMerchantIssuedReceipt({
    claimToken: token,
    privyUserId: claims.userId,
  });

  const recoverableAlreadyClaimed =
    !result.claimed && result.error.includes("already") && result.receipt?.claimedBy === claims.userId;

  if (!result.claimed && !recoverableAlreadyClaimed) {
    const status = result.error.includes("not found") ? 404 : result.error.includes("already") ? 409 : 503;
    return Response.json(
      {
        error: result.error,
        configured: result.configured,
        receipt: result.receipt ? publicMerchantReceipt(result.receipt) : null,
      },
      { status },
    );
  }

  const claimedReceipt = result.receipt;
  if (!claimedReceipt) {
    return Response.json({ error: "Merchant receipt claim failed.", configured: result.configured }, { status: 503 });
  }

  const publicReceipt = publicMerchantReceipt(claimedReceipt);
  const accountState = await savePrivateAccountState({
    privyUserId: claims.userId,
    sessionId: claims.sessionId,
    wallet: cleanText(body.wallet),
    userLabel: cleanText(body.userLabel),
    state: {
      merchantReceipts: [
        {
          ...publicReceipt,
          source: "merchant-issued",
          claimedBy: claims.userId,
          claimedAt: claimedReceipt.claimedAt,
          mintStatus: "ready",
          creditImpact: {
            eligible: false,
            unlockedCreditUsd: 25,
            reason: "Merchant-issued receipt must be minted as a Bubblegum cNFT before credit unlock.",
          },
        },
      ],
    },
  });

  if (accountState.configured && accountState.error) {
    return Response.json({ error: accountState.error, receipt: publicReceipt }, { status: 503 });
  }

  return Response.json({
    product: "Jiagon merchant-issued receipt claim",
    configured: result.configured,
    receipt: publicReceipt,
    accountState: {
      configured: accountState.configured,
      updatedAt: accountState.updatedAt || null,
    },
  });
}
