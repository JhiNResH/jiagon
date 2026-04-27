import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

export const runtime = "nodejs";

type MintReceiptRequest = {
  owner?: string;
  receipt?: {
    id?: string;
    provider?: string;
    txFull?: string;
    txHash?: string;
    block?: number;
    blockNumber?: number;
    logIndex?: number;
    amount?: string;
    amountUsd?: string;
    token?: string;
    safe?: string;
  };
  review?: {
    id?: string;
    merchant?: string;
    branch?: string;
    rating?: number;
    tags?: string[];
    text?: string;
  };
};

type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    code: number;
    message: string;
  };
};

type RpcLog = {
  address: string;
  logIndex: string;
  topics: string[];
};

type RpcReceipt = {
  blockNumber?: string;
  logs: RpcLog[];
};

const OPTIMISM_RPC_URLS = (
  process.env.OPTIMISM_RPC_URL ||
  "https://optimism-rpc.publicnode.com,https://optimism.drpc.org,https://mainnet.optimism.io"
)
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const CASH_EVENT_EMITTER = "0x380b2e96799405be6e3d965f4044099891881acb";
const SPEND_TOPIC = "0x89d3571a498b5d3d68599f5f00c3016f9604aafa7701c52c1b04109cd909a798";
const BNB_TESTNET_CHAIN_ID = 97;
const RPC_TIMEOUT_MS = 6_000;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, stable(nested)])
  );
}

function assertValidTx(tx: unknown): tx is string {
  return typeof tx === "string" && /^0x[a-fA-F0-9]{64}$/.test(tx);
}

function sourceReceiptHash(sourceTx: string, logIndex: number) {
  return `0x${hash(`optimism:etherfi-cash:${sourceTx.toLowerCase()}:${logIndex}`)}`;
}

function wordToAddress(word?: string) {
  if (!word || word.length < 42) return undefined;
  return `0x${word.slice(-40)}`.toLowerCase();
}

async function postJson<T>(rpcUrl: string, body: unknown): Promise<T> {
  const url = new URL(rpcUrl);
  const transport = url.protocol === "http:" ? httpRequest : httpsRequest;
  const bodyText = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = transport(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(bodyText),
        },
        timeout: RPC_TIMEOUT_MS,
      },
      (res) => {
        let responseText = "";

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseText += chunk;
        });
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Optimism RPC returned ${res.statusCode || "unknown status"}`));
            return;
          }

          try {
            resolve(JSON.parse(responseText) as T);
          } catch {
            reject(new Error("Optimism RPC returned invalid JSON"));
          }
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("Optimism RPC request timed out"));
    });
    req.on("error", reject);
    req.write(bodyText);
    req.end();
  });
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  let lastError = "Optimism RPC failed";

  for (const rpcUrl of OPTIMISM_RPC_URLS) {
    try {
      const payload = await postJson<JsonRpcResponse<T>>(rpcUrl, { jsonrpc: "2.0", id: 1, method, params });

      if (payload.error) {
        lastError = payload.error.message;
        continue;
      }

      return payload.result as T;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Optimism RPC request timed out";
    }
  }

  throw new Error(lastError);
}

async function verifyEtherfiSpend(sourceTx: string, expectedLogIndex?: number) {
  const receipt = await rpcCall<RpcReceipt>("eth_getTransactionReceipt", [sourceTx]);
  const spendLogs = receipt.logs.filter(
    (log) => log.address.toLowerCase() === CASH_EVENT_EMITTER && log.topics[0]?.toLowerCase() === SPEND_TOPIC,
  );

  if (spendLogs.length === 0) {
    throw new Error("That transaction does not contain an ether.fi Cash Spend event.");
  }

  const spendLog =
    typeof expectedLogIndex === "number"
      ? spendLogs.find((log) => Number.parseInt(log.logIndex, 16) === expectedLogIndex)
      : spendLogs[0];

  if (!spendLog) {
    throw new Error("The submitted log index is not an ether.fi Cash Spend event in that transaction.");
  }

  return {
    blockNumber: receipt.blockNumber ? Number.parseInt(receipt.blockNumber, 16) : undefined,
    logIndex: Number.parseInt(spendLog.logIndex, 16),
    safe: wordToAddress(spendLog.topics[1]),
    wallet: wordToAddress(spendLog.topics[2]),
  };
}

export async function POST(request: Request) {
  let body: MintReceiptRequest;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourceTx = body.receipt?.txFull || body.receipt?.txHash;
  const merchant = body.review?.merchant?.trim();
  const branch = body.review?.branch?.trim();
  const rating = Number(body.review?.rating || 0);

  if (!assertValidTx(sourceTx)) {
    return Response.json({ error: "A valid ether.fi Cash Optimism source transaction is required." }, { status: 400 });
  }

  if (!merchant || merchant.length < 3 || !branch || branch.length < 2 || rating < 1 || rating > 5) {
    return Response.json({ error: "Merchant, branch, and rating are required before preparing a receipt credential." }, { status: 400 });
  }

  try {
    const verifiedSpend = await verifyEtherfiSpend(sourceTx, body.receipt?.logIndex);
    const owner = verifiedSpend.safe;

    if (!owner) {
      return Response.json({ error: "Unable to derive ether.fi Cash safe from Spend event." }, { status: 502 });
    }

    if (body.receipt?.safe && body.receipt.safe.toLowerCase() !== owner) {
      return Response.json({ error: "Submitted safe does not match the onchain Spend event." }, { status: 400 });
    }

    const sourceHash = sourceReceiptHash(sourceTx, verifiedSpend.logIndex);
    const dataObject = stable({
      version: "jiagon.receipt.v0",
      source: {
        provider: body.receipt?.provider || "ether.fi Cash",
        sourceChain: "optimism",
        sourceTx,
        sourceBlock: verifiedSpend.blockNumber || body.receipt?.block || body.receipt?.blockNumber,
        logIndex: verifiedSpend.logIndex,
        sourceReceiptHash: sourceHash,
        paymentProof: "A",
        amount: body.receipt?.amount || (body.receipt?.amountUsd ? `$${body.receipt.amountUsd}` : undefined),
        token: body.receipt?.token || "OP USDC",
        safe: owner,
        wallet: verifiedSpend.wallet,
      },
      merchantClaim: {
        merchant,
        branch,
        proof: "C",
      },
      review: {
        id: body.review?.id,
        rating,
        tags: body.review?.tags || [],
        text: body.review?.text || "",
      },
      owner,
    });

    const canonicalData = JSON.stringify(dataObject);
    const dataHash = `0x${hash(canonicalData)}`;
    const credentialId = `bnb-testnet-ready-${hash(`${sourceHash}:${dataHash}:${owner}`).slice(0, 12)}`;
    const storageUri = `greenfield-testnet://jiagon/receipts/${credentialId}.json`;

    return Response.json({
      status: "prepared",
      network: "BNB Smart Chain testnet",
      chainId: BNB_TESTNET_CHAIN_ID,
      credentialChain: "bnb-testnet",
      credentialId,
      credentialTx: null,
      explorerUrl: null,
      storageLayer: "greenfield-testnet",
      storageUri,
      sourceReceiptHash: sourceHash,
      dataHash,
      preparedAt: new Date().toISOString(),
      proofLevel: "C",
      proof: {
        payment: "A",
        merchant: "C",
        ownership: "event-safe-derived",
        sourceChain: "optimism",
        sourceTx,
        logIndex: verifiedSpend.logIndex,
      },
      mode: "prepare-only",
      note: "OP spend verified. BNB testnet transaction is not broadcast until a registry contract and minter key are configured.",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to verify ether.fi Cash spend event." },
      { status: 502 },
    );
  }
}
