import { recordMerchantPilotEvent } from "@/server/merchantOrderStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PilotEventRateLimitEntry = {
  count: number;
  resetAt: number;
};

type PilotEventRouteGlobal = typeof globalThis & {
  jiagonPilotEventRateLimit?: Map<string, PilotEventRateLimitEntry>;
};

const PILOT_EVENT_RATE_LIMIT_WINDOW_MS = 60_000;
const PILOT_EVENT_RATE_LIMIT_DEFAULT_MAX = 120;

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 160) : fallback;
}

function eventName(value: unknown) {
  return value === "qr_opened" || value === "order_started" || value === "review_submitted" ? value : null;
}

function pilotEventRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || "local";
}

function pilotEventRateLimitMax() {
  const configured = Number.parseInt(process.env.JIAGON_PILOT_EVENT_RATE_LIMIT || "", 10);
  return Number.isFinite(configured) && configured >= 0 ? configured : PILOT_EVENT_RATE_LIMIT_DEFAULT_MAX;
}

function checkPilotEventRateLimit(request: Request) {
  const max = pilotEventRateLimitMax();
  if (max === 0) return { ok: true as const };

  const now = Date.now();
  const key = pilotEventRateLimitKey(request);
  const globalStore = globalThis as PilotEventRouteGlobal;
  const store = globalStore.jiagonPilotEventRateLimit || new Map<string, PilotEventRateLimitEntry>();
  globalStore.jiagonPilotEventRateLimit = store;

  for (const [storedKey, storedEntry] of store) {
    if (storedEntry.resetAt <= now) {
      store.delete(storedKey);
    }
  }

  const existing = store.get(key);
  const entry = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + PILOT_EVENT_RATE_LIMIT_WINDOW_MS };
  entry.count += 1;
  store.set(key, entry);

  if (entry.count <= max) return { ok: true as const };
  return {
    ok: false as const,
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Pilot event requires JSON." }, { status: 415 });
  }

  const rateLimit = checkPilotEventRateLimit(request);
  if (!rateLimit.ok) {
    return Response.json(
      {
        error: "Too many pilot event requests. Please retry shortly.",
        retryAfterSeconds: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: {
          "retry-after": String(rateLimit.retryAfter),
        },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 10_000) {
      return Response.json({ error: "Pilot event payload is too large." }, { status: 413 });
    }
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ error: "JSON body must be an object." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const merchantId = cleanText(body.merchantId);
  const name = eventName(body.eventName);
  if (!merchantId) {
    return Response.json({ error: "merchantId is required." }, { status: 400 });
  }
  if (!name) {
    return Response.json({ error: "eventName must be qr_opened, order_started, or review_submitted." }, { status: 400 });
  }

  const result = await recordMerchantPilotEvent({
    merchantId,
    eventName: name,
    source: cleanText(body.source),
  });

  return Response.json({
    product: "Jiagon merchant pilot event",
    mode: result.configured ? "database" : "local-demo-memory",
    configured: result.configured,
    recorded: result.recorded,
    error: result.error,
  }, { status: result.recorded ? 201 : 503 });
}
