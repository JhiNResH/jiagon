import { createHash } from "node:crypto";
import { Pool } from "pg";

export type ReceiptPersistenceResult =
  | {
      configured: false;
      persisted: false;
      reason: string;
    }
  | {
      configured: true;
      persisted: true;
      receiptId: string;
      reviewId: string;
    }
  | {
      configured: true;
      persisted: false;
      error: string;
      reason?: string;
    }
  | {
      configured: boolean;
      persisted: false;
      reason: string;
    };

export type ReceiptReviewRecord = {
  receiptId: string;
  reviewId: string;
  status: string;
  mode?: string | null;
  sourceChain: string;
  sourceTx: string;
  sourceBlock?: number | null;
  logIndex: number;
  ownerSafe?: string | null;
  wallet?: string | null;
  merchant: string;
  branch: string;
  rating: number;
  tags: string[];
  reviewAttributes?: Record<string, unknown>;
  reviewText: string;
  amount?: string | null;
  token?: string | null;
  proofLevel: string;
  sourceReceiptHash: string;
  dataHash: string;
  requestedDataHash?: string | null;
  dataMatchesRequest?: boolean | null;
  storageUri: string;
  requestedStorageUri?: string | null;
  credentialChain: string;
  chainId: number;
  credentialId: string;
  credentialTx?: string | null;
  explorerUrl?: string | null;
  registryAddress?: string | null;
  minter?: string | null;
  payload: unknown;
};

export type PublicReceiptReview = {
  receiptId: string;
  reviewId: string;
  status: string;
  mode: string | null;
  sourceChain: string;
  logIndex: number;
  merchant: string;
  branch: string;
  rating: number;
  tags: string[];
  reviewAttributes: Record<string, unknown>;
  reviewText: string;
  token: string | null;
  proofLevel: string;
  publicProofId: string;
  dataHash: string;
  dataMatchesRequest: boolean | null;
  storageUri: string;
  credentialChain: string;
  chainId: number;
  credentialId: string;
  credentialTx: string | null;
  explorerUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentMerchantSignal = {
  id: string;
  name: string;
  branch: string;
  category: string;
  verifiedVisits: number;
  verifiedWallets: number;
  averageRating: number;
  totalVerifiedSpendUsd: string | null;
  lastVerifiedVisit: string;
  latestReview: string;
  latestAttributes: Record<string, unknown>;
};

type ReceiptStoreGlobal = typeof globalThis & {
  jiagonReceiptPool?: Pool;
  jiagonReceiptSchemaReady?: Promise<void>;
};

function databaseUrl() {
  return (process.env.DATABASE_URL || "").trim();
}

function publicProofId(sourceReceiptHash: string) {
  return createHash("sha256").update(sourceReceiptHash).digest("hex").slice(0, 16);
}

function getPool() {
  const url = databaseUrl();
  if (!url) return null;

  const globalStore = globalThis as ReceiptStoreGlobal;
  if (!globalStore.jiagonReceiptPool) {
    const wantsSsl = process.env.DATABASE_SSL === "true" || url.includes("sslmode=require");
    globalStore.jiagonReceiptPool = new Pool({
      connectionString: url,
      max: 5,
      ssl: wantsSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  return globalStore.jiagonReceiptPool;
}

async function ensureSchema(pool: Pool) {
  const globalStore = globalThis as ReceiptStoreGlobal;
  if (!globalStore.jiagonReceiptSchemaReady) {
    globalStore.jiagonReceiptSchemaReady = pool.query(`
      create table if not exists jiagon_receipt_reviews (
        id bigserial primary key,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        receipt_id text not null,
        review_id text not null,
        status text not null,
        mode text,
        source_chain text not null default 'optimism',
        source_tx text not null,
        source_block integer,
        log_index integer not null,
        owner_safe text,
        wallet text,
        merchant text not null,
        branch text not null,
        rating integer not null check (rating between 1 and 5),
        tags jsonb not null default '[]'::jsonb,
        review_attributes jsonb not null default '{}'::jsonb,
        review_text text not null default '',
        amount text,
        token text,
        proof_level text not null,
        source_receipt_hash text not null unique,
        data_hash text not null,
        requested_data_hash text,
        data_matches_request boolean,
        storage_uri text not null,
        requested_storage_uri text,
        credential_chain text not null,
        chain_id integer not null,
        credential_id text not null,
        credential_tx text,
        explorer_url text,
        registry_address text,
        minter text,
        payload jsonb not null
      );

      alter table jiagon_receipt_reviews
        add column if not exists review_attributes jsonb not null default '{}'::jsonb;
    `).then(() => undefined);
  }

  return globalStore.jiagonReceiptSchemaReady;
}

export async function persistReceiptReview(record: ReceiptReviewRecord): Promise<ReceiptPersistenceResult> {
  if (record.status !== "minted") {
    return {
      configured: Boolean(databaseUrl()),
      persisted: false,
      reason: "Only minted BNB receipt credentials are persisted for agent data.",
    };
  }

  if (record.dataMatchesRequest === false) {
    return {
      configured: Boolean(databaseUrl()),
      persisted: false,
      reason: "Onchain credential data differs from the submitted review; review was not persisted.",
    };
  }

  const pool = getPool();
  if (!pool) {
    return {
      configured: false,
      persisted: false,
      reason: "DATABASE_URL is not configured.",
    };
  }

  try {
    await ensureSchema(pool);

    await pool.query(
      `
        insert into jiagon_receipt_reviews (
          receipt_id,
          review_id,
          status,
          mode,
          source_chain,
          source_tx,
          source_block,
          log_index,
          owner_safe,
          wallet,
          merchant,
          branch,
          rating,
          tags,
          review_attributes,
          review_text,
          amount,
          token,
          proof_level,
          source_receipt_hash,
          data_hash,
          requested_data_hash,
          data_matches_request,
          storage_uri,
          requested_storage_uri,
          credential_chain,
          chain_id,
          credential_id,
          credential_tx,
          explorer_url,
          registry_address,
          minter,
          payload
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14::jsonb,
          $15::jsonb, $16, $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33::jsonb
        )
        on conflict (source_receipt_hash) do update set
          updated_at = now(),
          receipt_id = excluded.receipt_id,
          review_id = excluded.review_id,
          status = excluded.status,
          mode = excluded.mode,
          source_block = excluded.source_block,
          owner_safe = excluded.owner_safe,
          wallet = excluded.wallet,
          merchant = excluded.merchant,
          branch = excluded.branch,
          rating = excluded.rating,
          tags = excluded.tags,
          review_attributes = excluded.review_attributes,
          review_text = excluded.review_text,
          amount = excluded.amount,
          token = excluded.token,
          proof_level = excluded.proof_level,
          data_hash = excluded.data_hash,
          requested_data_hash = excluded.requested_data_hash,
          data_matches_request = excluded.data_matches_request,
          storage_uri = excluded.storage_uri,
          requested_storage_uri = excluded.requested_storage_uri,
          credential_chain = excluded.credential_chain,
          chain_id = excluded.chain_id,
          credential_id = excluded.credential_id,
          credential_tx = excluded.credential_tx,
          explorer_url = excluded.explorer_url,
          registry_address = excluded.registry_address,
          minter = excluded.minter,
          payload = excluded.payload
      `,
      [
        record.receiptId,
        record.reviewId,
        record.status,
        record.mode || null,
        record.sourceChain,
        record.sourceTx,
        record.sourceBlock || null,
        record.logIndex,
        record.ownerSafe || null,
        record.wallet || null,
        record.merchant,
        record.branch,
        record.rating,
        JSON.stringify(record.tags || []),
        JSON.stringify(record.reviewAttributes || {}),
        record.reviewText || "",
        record.amount || null,
        record.token || null,
        record.proofLevel,
        record.sourceReceiptHash,
        record.dataHash,
        record.requestedDataHash || null,
        typeof record.dataMatchesRequest === "boolean" ? record.dataMatchesRequest : null,
        record.storageUri,
        record.requestedStorageUri || null,
        record.credentialChain,
        record.chainId,
        record.credentialId,
        record.credentialTx || null,
        record.explorerUrl || null,
        record.registryAddress || null,
        record.minter || null,
        JSON.stringify(record.payload),
      ],
    );

    return {
      configured: true,
      persisted: true,
      receiptId: record.receiptId,
      reviewId: record.reviewId,
    };
  } catch {
    return {
      configured: true,
      persisted: false,
      error: "Receipt persistence failed.",
    };
  }
}

export async function listReceiptReviews(limit = 50): Promise<{
  configured: boolean;
  reviews: PublicReceiptReview[];
  error?: string;
}> {
  const pool = getPool();
  if (!pool) return { configured: false, reviews: [] };

  try {
    await ensureSchema(pool);
    const cappedLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    const result = await pool.query(
      `
        select
          receipt_id,
          review_id,
          status,
          mode,
          source_chain,
          log_index,
          merchant,
          branch,
          rating,
          tags,
          review_attributes,
          review_text,
          token,
          proof_level,
          source_receipt_hash,
          data_hash,
          data_matches_request,
          storage_uri,
          credential_chain,
          chain_id,
          credential_id,
          credential_tx,
          explorer_url,
          created_at,
          updated_at
        from jiagon_receipt_reviews
        where status = 'minted' and data_matches_request is true
        order by created_at desc
        limit $1
      `,
      [cappedLimit],
    );

    return {
      configured: true,
      reviews: result.rows.map((row) => ({
        receiptId: row.receipt_id,
        reviewId: row.review_id,
        status: row.status,
        mode: row.mode,
        sourceChain: row.source_chain,
        logIndex: row.log_index,
        merchant: row.merchant,
        branch: row.branch,
        rating: row.rating,
        tags: Array.isArray(row.tags) ? row.tags : [],
        reviewAttributes: row.review_attributes && typeof row.review_attributes === "object" ? row.review_attributes : {},
        reviewText: row.review_text,
        token: row.token,
        proofLevel: row.proof_level,
        publicProofId: publicProofId(row.source_receipt_hash),
        dataHash: row.data_hash,
        dataMatchesRequest: row.data_matches_request,
        storageUri: row.storage_uri,
        credentialChain: row.credential_chain,
        chainId: row.chain_id,
        credentialId: row.credential_id,
        credentialTx: row.credential_tx,
        explorerUrl: row.explorer_url,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      })),
    };
  } catch {
    return {
      configured: true,
      reviews: [],
      error: "Receipt review query failed.",
    };
  }
}

export async function listAgentMerchantSignals(limit = 25): Promise<{
  configured: boolean;
  merchants: AgentMerchantSignal[];
  error?: string;
}> {
  const pool = getPool();
  if (!pool) return { configured: false, merchants: [] };

  try {
    await ensureSchema(pool);
    const cappedLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
    const result = await pool.query(
      `
        select
          merchant,
          branch,
          count(distinct source_receipt_hash)::integer as verified_visits,
          count(distinct coalesce(owner_safe, wallet))::integer as verified_wallets,
          round(avg(rating)::numeric, 1)::float as average_rating,
          max(created_at) as last_verified_visit,
          (array_agg(review_text order by created_at desc))[1] as latest_review,
          (array_agg(review_attributes order by created_at desc))[1] as latest_attributes
        from jiagon_receipt_reviews
        where status = 'minted' and data_matches_request is true
        group by merchant, branch
        order by max(created_at) desc
        limit $1
      `,
      [cappedLimit],
    );

    return {
      configured: true,
      merchants: result.rows.map((row) => {
        const key = `${row.merchant.toLowerCase()}::${row.branch.toLowerCase()}`;
        return {
          id: key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          name: row.merchant,
          branch: row.branch,
          category: "Local",
          verifiedVisits: row.verified_visits,
          verifiedWallets: row.verified_wallets,
          averageRating: row.average_rating,
          totalVerifiedSpendUsd: null,
          lastVerifiedVisit: row.last_verified_visit.toISOString().slice(0, 10),
          latestReview: row.latest_review || "",
          latestAttributes: row.latest_attributes && typeof row.latest_attributes === "object" ? row.latest_attributes : {},
        };
      }),
    };
  } catch {
    return {
      configured: true,
      merchants: [],
      error: "Agent merchant signal query failed.",
    };
  }
}
