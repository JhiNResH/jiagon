import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";

export type MerchantOrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitAmountCents: number;
};

export type MerchantOrderStatus = "pending" | "accepted" | "completed" | "cancelled";

export type MerchantOrder = {
  id: string;
  merchantId: string;
  merchantName: string;
  location: string | null;
  customerLabel: string | null;
  source: "tile" | "telegram" | "web";
  status: MerchantOrderStatus;
  items: MerchantOrderItem[];
  subtotalCents: number;
  subtotalUsd: string;
  notes: string | null;
  proofLevel: "order_intent_only";
  createdAt: string;
  updatedAt: string;
};

export type MerchantOrderCreateInput = {
  merchantId: string;
  merchantName: string;
  location?: string | null;
  customerLabel?: string | null;
  source?: "tile" | "telegram" | "web" | null;
  items: MerchantOrderItem[];
  notes?: string | null;
};

type MerchantOrderGlobal = typeof globalThis & {
  jiagonMerchantOrderPool?: Pool;
  jiagonMerchantOrderSchemaReady?: Promise<void>;
  jiagonMerchantOrderMemory?: Map<string, MerchantOrder>;
};

function databaseUrl() {
  return (process.env.DATABASE_URL || "").trim();
}

function getPool() {
  const url = databaseUrl();
  if (!url) return null;

  const globalStore = globalThis as MerchantOrderGlobal;
  if (!globalStore.jiagonMerchantOrderPool) {
    const wantsSsl = process.env.DATABASE_SSL === "true" || url.includes("sslmode=require");
    globalStore.jiagonMerchantOrderPool = new Pool({
      connectionString: url,
      max: 5,
      ssl: wantsSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  return globalStore.jiagonMerchantOrderPool;
}

async function ensureMerchantOrderSchema(pool: Pool) {
  const globalStore = globalThis as MerchantOrderGlobal;
  if (!globalStore.jiagonMerchantOrderSchemaReady) {
    globalStore.jiagonMerchantOrderSchemaReady = pool.query(`
      create table if not exists jiagon_merchant_orders (
        id text primary key,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        merchant_id text not null,
        merchant_name text not null,
        location text,
        customer_label text,
        source text not null,
        status text not null,
        items jsonb not null,
        subtotal_cents integer not null check (subtotal_cents > 0),
        subtotal_usd text not null,
        notes text,
        proof_level text not null,
        payload jsonb not null
      );

      create index if not exists jiagon_merchant_orders_merchant_status_idx
        on jiagon_merchant_orders (merchant_id, status, created_at desc);
    `)
      .then(() => undefined)
      .catch((error) => {
        globalStore.jiagonMerchantOrderSchemaReady = undefined;
        throw error;
      });
  }

  return globalStore.jiagonMerchantOrderSchemaReady;
}

function merchantOrderMemory() {
  const globalStore = globalThis as MerchantOrderGlobal;
  if (!globalStore.jiagonMerchantOrderMemory) {
    globalStore.jiagonMerchantOrderMemory = new Map();
  }
  return globalStore.jiagonMerchantOrderMemory;
}

function orderId(merchantId: string, items: MerchantOrderItem[]) {
  const seed = `${merchantId}:${JSON.stringify(items)}:${Date.now()}:${randomBytes(8).toString("hex")}`;
  return `ord-${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`;
}

function formatUsd(cents: number) {
  return (cents / 100).toFixed(2);
}

function mapMerchantOrderRow(row: Record<string, unknown>): MerchantOrder {
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
  const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    id: String(row.id),
    merchantId: String(row.merchant_id),
    merchantName: String(row.merchant_name),
    location: typeof row.location === "string" ? row.location : null,
    customerLabel: typeof row.customer_label === "string" ? row.customer_label : null,
    source: row.source === "telegram" || row.source === "web" ? row.source : "tile",
    status: row.status === "accepted" || row.status === "completed" || row.status === "cancelled" ? row.status : "pending",
    items: items as MerchantOrderItem[],
    subtotalCents: Number(row.subtotal_cents),
    subtotalUsd: String(row.subtotal_usd),
    notes: typeof row.notes === "string" ? row.notes : null,
    proofLevel: "order_intent_only",
    createdAt,
    updatedAt,
  };
}

export function publicMerchantOrder(order: MerchantOrder) {
  return {
    id: order.id,
    merchantId: order.merchantId,
    merchantName: order.merchantName,
    location: order.location,
    customerLabel: order.customerLabel,
    source: order.source,
    status: order.status,
    items: order.items,
    subtotalCents: order.subtotalCents,
    subtotalUsd: order.subtotalUsd,
    notes: order.notes,
    proofLevel: order.proofLevel,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function createMerchantOrder(input: MerchantOrderCreateInput): Promise<{
  configured: boolean;
  persisted: boolean;
  order: MerchantOrder;
  error?: string;
}> {
  const subtotalCents = input.items.reduce((total, item) => total + item.unitAmountCents * item.quantity, 0);
  const now = new Date().toISOString();
  const order: MerchantOrder = {
    id: orderId(input.merchantId, input.items),
    merchantId: input.merchantId,
    merchantName: input.merchantName,
    location: input.location?.trim() || null,
    customerLabel: input.customerLabel?.trim() || null,
    source: input.source || "tile",
    status: "pending",
    items: input.items,
    subtotalCents,
    subtotalUsd: formatUsd(subtotalCents),
    notes: input.notes?.trim() || null,
    proofLevel: "order_intent_only",
    createdAt: now,
    updatedAt: now,
  };

  const pool = getPool();
  if (!pool) {
    merchantOrderMemory().set(order.id, order);
    return { configured: false, persisted: false, order };
  }

  try {
    await ensureMerchantOrderSchema(pool);
    await pool.query(
      `
        insert into jiagon_merchant_orders (
          id,
          merchant_id,
          merchant_name,
          location,
          customer_label,
          source,
          status,
          items,
          subtotal_cents,
          subtotal_usd,
          notes,
          proof_level,
          payload
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13::jsonb)
      `,
      [
        order.id,
        order.merchantId,
        order.merchantName,
        order.location,
        order.customerLabel,
        order.source,
        order.status,
        JSON.stringify(order.items),
        order.subtotalCents,
        order.subtotalUsd,
        order.notes,
        order.proofLevel,
        JSON.stringify(order),
      ],
    );
    return { configured: true, persisted: true, order };
  } catch {
    return { configured: true, persisted: false, order, error: "Merchant order persistence failed." };
  }
}

export async function listMerchantOrders(input: {
  merchantId?: string | null;
  status?: MerchantOrderStatus | null;
  limit?: number;
}): Promise<{
  configured: boolean;
  orders: MerchantOrder[];
  error?: string;
}> {
  const limit = Math.min(Math.max(input.limit || 25, 1), 100);
  const memoryOrders = () => Array.from(merchantOrderMemory().values())
    .filter((order) => !input.merchantId || order.merchantId === input.merchantId)
    .filter((order) => !input.status || order.status === input.status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  const pool = getPool();
  if (!pool) {
    return { configured: false, orders: memoryOrders() };
  }

  try {
    await ensureMerchantOrderSchema(pool);
    const clauses = [];
    const values: unknown[] = [];
    if (input.merchantId) {
      values.push(input.merchantId);
      clauses.push(`merchant_id = $${values.length}`);
    }
    if (input.status) {
      values.push(input.status);
      clauses.push(`status = $${values.length}`);
    }
    values.push(limit);
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const result = await pool.query(
      `
        select
          id,
          merchant_id,
          merchant_name,
          location,
          customer_label,
          source,
          status,
          items,
          subtotal_cents,
          subtotal_usd,
          notes,
          proof_level,
          created_at,
          updated_at
        from jiagon_merchant_orders
        ${where}
        order by created_at desc
        limit $${values.length}
      `,
      values,
    );

    return { configured: true, orders: result.rows.map(mapMerchantOrderRow) };
  } catch {
    return { configured: true, orders: [], error: "Merchant order query failed." };
  }
}
