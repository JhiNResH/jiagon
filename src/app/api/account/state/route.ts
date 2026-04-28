import { bearerTokenFromRequest, verifyPrivyAccessToken } from "@/server/privyAuth";
import { getPrivateAccountState, savePrivateAccountState } from "@/server/receiptStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  try {
    const claims = await verifiedClaims(request);
    const result = await getPrivateAccountState(claims.userId);

    if (result.configured && result.error) {
      return Response.json({ error: result.error, configured: true }, { status: 503 });
    }

    return Response.json({
      configured: result.configured,
      state: result.state,
      updatedAt: result.updatedAt || null,
    });
  } catch (error) {
    return authError(error);
  }
}

export async function PUT(request: Request) {
  let claims: Awaited<ReturnType<typeof verifiedClaims>>;
  let body: {
    wallet?: string | null;
    userLabel?: string | null;
    ifUnmodifiedSince?: string | null;
    state?: unknown;
  };

  try {
    claims = await verifiedClaims(request);
  } catch (error) {
    return authError(error);
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 1_000_000) {
      return Response.json({ error: "Private account state payload is too large." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await savePrivateAccountState({
      privyUserId: claims.userId,
      sessionId: claims.sessionId,
      wallet: typeof body.wallet === "string" ? body.wallet : null,
      userLabel: typeof body.userLabel === "string" ? body.userLabel : null,
      ifUnmodifiedSince: typeof body.ifUnmodifiedSince === "string" ? body.ifUnmodifiedSince : null,
      state: body.state,
    });

    if (result.configured && result.error) {
      const status = result.error.includes("changed on another device") ? 409 : 503;
      return Response.json({ error: result.error, configured: true, state: result.state, updatedAt: result.updatedAt || null }, { status });
    }

    return Response.json({
      configured: result.configured,
      state: result.state,
      updatedAt: result.updatedAt || null,
    });
  } catch (error) {
    return authError(error);
  }
}
