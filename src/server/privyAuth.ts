import { webcrypto } from "node:crypto";

export type PrivyAuthClaims = {
  appId: string;
  userId: string;
  issuer: string;
  issuedAt: number;
  expiration: number;
  sessionId: string;
};

const textEncoder = new TextEncoder();

function base64UrlToBuffer(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function parseJsonSegment(segment: string) {
  return JSON.parse(base64UrlToBuffer(segment).toString("utf8")) as Record<string, unknown>;
}

function verificationKeyPem() {
  return (process.env.PRIVY_VERIFICATION_KEY || process.env.PRIVY_JWT_VERIFICATION_KEY || "")
    .trim()
    .replace(/\\n/g, "\n");
}

function spkiBodyFromPem(pem: string) {
  return pem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s+/g, "");
}

async function importVerificationKey(pem: string) {
  const subtle = globalThis.crypto?.subtle || webcrypto.subtle;
  return subtle.importKey(
    "spki",
    base64UrlToBuffer(spkiBodyFromPem(pem).replace(/\+/g, "-").replace(/\//g, "_")),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}

export function bearerTokenFromRequest(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function verifyPrivyAccessToken(token: string): Promise<PrivyAuthClaims> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const pem = verificationKeyPem();

  if (!appId) {
    throw new Error("Privy app id is not configured.");
  }

  if (!pem) {
    throw new Error("Privy verification key is not configured.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid Privy access token.");
  }

  const header = parseJsonSegment(encodedHeader);
  if (header.alg !== "ES256") {
    throw new Error("Unsupported Privy access token algorithm.");
  }

  const payload = parseJsonSegment(encodedPayload);
  const now = Math.floor(Date.now() / 1000);

  if (payload.iss !== "privy.io") {
    throw new Error("Invalid Privy token issuer.");
  }

  if (payload.aud !== appId) {
    throw new Error("Invalid Privy token audience.");
  }

  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new Error("Privy access token expired.");
  }

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Privy access token is missing user id.");
  }

  const key = await importVerificationKey(pem);
  const subtle = globalThis.crypto?.subtle || webcrypto.subtle;
  const verified = await subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    base64UrlToBuffer(encodedSignature),
    textEncoder.encode(`${encodedHeader}.${encodedPayload}`),
  );

  if (!verified) {
    throw new Error("Invalid Privy access token signature.");
  }

  return {
    appId,
    userId: payload.sub,
    issuer: "privy.io",
    issuedAt: typeof payload.iat === "number" ? payload.iat : 0,
    expiration: payload.exp,
    sessionId: typeof payload.sid === "string" ? payload.sid : "",
  };
}
