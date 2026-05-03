import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { createMerchantIssuedReceipt, publicMerchantReceipt } from "@/server/receiptStore";

export type MerchantOrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitAmountCents: number;
};

export type MerchantOrderStatus = "pending" | "accepted" | "completed" | "cancelled";
export type MerchantOrderProofLevel = "order_intent_only" | "merchant_accepted" | "merchant_completed" | "cancelled";

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
  proofLevel: MerchantOrderProofLevel;
  receiptId: string | null;
  receiptClaimUrl: string | null;
  receiptHash: string | null;
  receiptIssuedAt: string | null;
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
        receipt_id text,
        receipt_claim_url text,
        receipt_hash text,
        receipt_issued_at timestamptz,
        payload jsonb not null
      );

      alter table jiagon_merchant_orders
        add column if not exists receipt_id text,
        add column if not exists receipt_claim_url text,
        add column if not exists receipt_hash text,
        add column if not exists receipt_issued_at timestamptz;

      create index if not exists jiagon_merchant_orders_merchant_status_idx
        on jiagon_merchant_orders (merchant_id, status, created_at desc);

      create index if not exists jiagon_merchant_orders_receipt_idx
        on jiagon_merchant_orders (receipt_id)
        where receipt_id is not null;
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

function orderItemSummary(items: MerchantOrderItem[]) {
  return items.map((item) => `${item.quantity}x ${item.name}`).join(", ");
}

function orderMemo(order: MerchantOrder) {
  const customer = order.customerLabel ? ` Customer: ${order.customerLabel}.` : "";
  const notes = order.notes ? ` Notes: ${order.notes}.` : "";
  return `Agentic POS order ${order.id}: ${orderItemSummary(order.items)}.${customer}${notes}`.slice(0, 500);
}

function proofLevelForStatus(status: MerchantOrderStatus): MerchantOrderProofLevel {
  if (status === "accepted") return "merchant_accepted";
  if (status === "completed") return "merchant_completed";
  if (status === "cancelled") return "cancelled";
  return "order_intent_only";
}

function isMerchantOrderStatus(value: unknown): value is MerchantOrderStatus {
  return value === "pending" || value === "accepted" || value === "completed" || value === "cancelled";
}

function isMerchantOrderProofLevel(value: unknown): value is MerchantOrderProofLevel {
  return value === "order_intent_only" || value === "merchant_accepted" || value === "merchant_completed" || value === "cancelled";
}

function canTransitionOrderStatus(current: MerchantOrderStatus, next: MerchantOrderStatus) {
  if (current === next) return true;
  if (current === "pending") return next === "accepted" || next === "completed" || next === "cancelled";
  if (current === "accepted") return next === "completed" || next === "cancelled";
  return false;
}

function mapMerchantOrderRow(row: Record<string, unknown>): MerchantOrder {
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
  const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);
  const items = Array.isArray(row.items) ? row.items : [];
  const status = isMerchantOrderStatus(row.status) ? row.status : "pending";
  return {
    id: String(row.id),
    merchantId: String(row.merchant_id),
    merchantName: String(row.merchant_name),
    location: typeof row.location === "string" ? row.location : null,
    customerLabel: typeof row.customer_label === "string" ? row.customer_label : null,
    source: row.source === "telegram" || row.source === "web" ? row.source : "tile",
    status,
    items: items as MerchantOrderItem[],
    subtotalCents: Number(row.subtotal_cents),
    subtotalUsd: String(row.subtotal_usd),
    notes: typeof row.notes === "string" ? row.notes : null,
    proofLevel: isMerchantOrderProofLevel(row.proof_level) ? row.proof_level : proofLevelForStatus(status),
    receiptId: typeof row.receipt_id === "string" ? row.receipt_id : null,
    receiptClaimUrl: typeof row.receipt_claim_url === "string" ? row.receipt_claim_url : null,
    receiptHash: typeof row.receipt_hash === "string" ? row.receipt_hash : null,
    receiptIssuedAt: row.receipt_issued_at instanceof Date
      ? row.receipt_issued_at.toISOString()
      : typeof row.receipt_issued_at === "string"
        ? row.receipt_issued_at
        : null,
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
    receiptId: order.receiptId,
    receiptClaimUrl: order.receiptClaimUrl,
    receiptHash: order.receiptHash,
    receiptIssuedAt: order.receiptIssuedAt,
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
    proofLevel: proofLevelForStatus("pending"),
    receiptId: null,
    receiptClaimUrl: null,
    receiptHash: null,
    receiptIssuedAt: null,
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
          receipt_id,
          receipt_claim_url,
          receipt_hash,
          receipt_issued_at,
          payload
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16::timestamptz, $17::jsonb)
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
        order.receiptId,
        order.receiptClaimUrl,
        order.receiptHash,
        order.receiptIssuedAt,
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
          receipt_id,
          receipt_claim_url,
          receipt_hash,
          receipt_issued_at,
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

async function getMerchantOrderById(id: string): Promise<{
  configured: boolean;
  order: MerchantOrder | null;
  error?: string;
}> {
  const pool = getPool();
  if (!pool) {
    return { configured: false, order: merchantOrderMemory().get(id) || null };
  }

  try {
    await ensureMerchantOrderSchema(pool);
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
          receipt_id,
          receipt_claim_url,
          receipt_hash,
          receipt_issued_at,
          created_at,
          updated_at
        from jiagon_merchant_orders
        where id = $1
        limit 1
      `,
      [id],
    );
    return { configured: true, order: result.rows[0] ? mapMerchantOrderRow(result.rows[0]) : null };
  } catch {
    return { configured: true, order: null, error: "Merchant order query failed." };
  }
}

export async function updateMerchantOrderStatus(input: {
  id: string;
  nextStatus: MerchantOrderStatus;
}): Promise<{
  configured: boolean;
  updated: boolean;
  order: MerchantOrder | null;
  error?: string;
}> {
  const pool = getPool();
  const memory = merchantOrderMemory();

  if (!pool) {
    const current = memory.get(input.id);
    if (!current) {
      return { configured: false, updated: false, order: null, error: "Merchant order was not found." };
    }
    if (!canTransitionOrderStatus(current.status, input.nextStatus)) {
      return {
        configured: false,
        updated: false,
        order: current,
        error: `Cannot move order from ${current.status} to ${input.nextStatus}.`,
      };
    }
    const nextOrder: MerchantOrder = {
      ...current,
      status: input.nextStatus,
      proofLevel: proofLevelForStatus(input.nextStatus),
      updatedAt: new Date().toISOString(),
    };
    memory.set(input.id, nextOrder);
    return { configured: false, updated: true, order: nextOrder };
  }

  try {
    await ensureMerchantOrderSchema(pool);
    const currentResult = await pool.query(
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
          receipt_id,
          receipt_claim_url,
          receipt_hash,
          receipt_issued_at,
          created_at,
          updated_at
        from jiagon_merchant_orders
        where id = $1
        limit 1
      `,
      [input.id],
    );
    const currentRow = currentResult.rows[0];
    if (!currentRow) {
      return { configured: true, updated: false, order: null, error: "Merchant order was not found." };
    }

    const current = mapMerchantOrderRow(currentRow);
    if (!canTransitionOrderStatus(current.status, input.nextStatus)) {
      return {
        configured: true,
        updated: false,
        order: current,
        error: `Cannot move order from ${current.status} to ${input.nextStatus}.`,
      };
    }

    const proofLevel = proofLevelForStatus(input.nextStatus);
    const result = await pool.query(
      `
        update jiagon_merchant_orders
        set
          status = $2,
          proof_level = $3,
          updated_at = now(),
          payload = jsonb_set(jsonb_set(payload, '{status}', to_jsonb($2::text), true), '{proofLevel}', to_jsonb($3::text), true)
        where id = $1
          and status = $4
        returning
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
          receipt_id,
          receipt_claim_url,
          receipt_hash,
          receipt_issued_at,
          created_at,
          updated_at
      `,
      [input.id, input.nextStatus, proofLevel, current.status],
    );
    if (result.rowCount === 0) {
      return {
        configured: true,
        updated: false,
        order: current,
        error: "Merchant order changed before this status update could be applied. Refresh the queue and try again.",
      };
    }
    return { configured: true, updated: true, order: mapMerchantOrderRow(result.rows[0]) };
  } catch {
    return { configured: true, updated: false, order: null, error: "Merchant order status update failed." };
  }
}

export async function completeMerchantOrderWithReceipt(input: {
  id: string;
  origin: string;
  issuedBy?: string | null;
}): Promise<{
  configured: boolean;
  updated: boolean;
  receiptConfigured: boolean;
  receiptPersisted: boolean;
  order: MerchantOrder | null;
  receipt?: ReturnType<typeof publicMerchantReceipt>;
  claimToken?: string;
  error?: string;
}> {
  const currentResult = await getMerchantOrderById(input.id);
  const current = currentResult.order;
  if (!current) {
    return {
      configured: currentResult.configured,
      updated: false,
      receiptConfigured: false,
      receiptPersisted: false,
      order: null,
      error: currentResult.error || "Merchant order was not found.",
    };
  }

  if (current.receiptClaimUrl) {
    return {
      configured: currentResult.configured,
      updated: true,
      receiptConfigured: false,
      receiptPersisted: false,
      order: current,
    };
  }

  if (!canTransitionOrderStatus(current.status, "completed")) {
    return {
      configured: currentResult.configured,
      updated: false,
      receiptConfigured: false,
      receiptPersisted: false,
      order: current,
      error: `Cannot complete order from ${current.status}.`,
    };
  }

  const receiptResult = await createMerchantIssuedReceipt({
    merchantId: current.merchantId,
    merchantName: current.merchantName,
    location: current.location,
    receiptNumber: current.id,
    amountCents: current.subtotalCents,
    currency: "USD",
    category: current.items[0]?.name || "Merchant order",
    purpose: "agentic_pos_order_receipt",
    issuedBy: input.issuedBy || "Jiagon merchant dashboard",
    memo: orderMemo(current),
    origin: input.origin,
  });

  if (receiptResult.configured && !receiptResult.persisted) {
    return {
      configured: currentResult.configured,
      updated: false,
      receiptConfigured: receiptResult.configured,
      receiptPersisted: receiptResult.persisted,
      order: current,
      receipt: publicMerchantReceipt(receiptResult.receipt),
      claimToken: receiptResult.claimToken,
      error: receiptResult.error || "Merchant receipt persistence failed.",
    };
  }

  const nextOrder: MerchantOrder = {
    ...current,
    status: "completed",
    proofLevel: proofLevelForStatus("completed"),
    receiptId: receiptResult.receipt.id,
    receiptClaimUrl: receiptResult.receipt.claimUrl,
    receiptHash: receiptResult.receipt.receiptHash,
    receiptIssuedAt: receiptResult.receipt.issuedAt,
    updatedAt: new Date().toISOString(),
  };

  const pool = getPool();
  if (!pool) {
    merchantOrderMemory().set(nextOrder.id, nextOrder);
    return {
      configured: false,
      updated: true,
      receiptConfigured: receiptResult.configured,
      receiptPersisted: receiptResult.persisted,
      order: nextOrder,
      receipt: publicMerchantReceipt(receiptResult.receipt),
      claimToken: receiptResult.claimToken,
    };
  }

  try {
    await ensureMerchantOrderSchema(pool);
    const result = await pool.query(
      `
        update jiagon_merchant_orders
        set
          status = $2,
          proof_level = $3,
          receipt_id = $4,
          receipt_claim_url = $5,
          receipt_hash = $6,
          receipt_issued_at = $7::timestamptz,
          updated_at = now(),
          payload = $8::jsonb
        where id = $1
          and status = $9
          and receipt_id is null
        returning
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
          receipt_id,
          receipt_claim_url,
          receipt_hash,
          receipt_issued_at,
          created_at,
          updated_at
      `,
      [
        nextOrder.id,
        nextOrder.status,
        nextOrder.proofLevel,
        nextOrder.receiptId,
        nextOrder.receiptClaimUrl,
        nextOrder.receiptHash,
        nextOrder.receiptIssuedAt,
        JSON.stringify(nextOrder),
        current.status,
      ],
    );

    if (result.rowCount === 0) {
      return {
        configured: true,
        updated: false,
        receiptConfigured: receiptResult.configured,
        receiptPersisted: receiptResult.persisted,
        order: current,
        receipt: publicMerchantReceipt(receiptResult.receipt),
        claimToken: receiptResult.claimToken,
        error: "Merchant order changed before the receipt could be attached. Refresh the queue and try again.",
      };
    }

    return {
      configured: true,
      updated: true,
      receiptConfigured: receiptResult.configured,
      receiptPersisted: receiptResult.persisted,
      order: mapMerchantOrderRow(result.rows[0]),
      receipt: publicMerchantReceipt(receiptResult.receipt),
      claimToken: receiptResult.claimToken,
    };
  } catch {
    return {
      configured: true,
      updated: false,
      receiptConfigured: receiptResult.configured,
      receiptPersisted: receiptResult.persisted,
      order: current,
      receipt: publicMerchantReceipt(receiptResult.receipt),
      claimToken: receiptResult.claimToken,
      error: "Merchant order receipt attachment failed.",
    };
  }
}
