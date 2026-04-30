import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const OPTIMISM_RPC_URLS = (
  process.env.OPTIMISM_RPC_URL ||
  "https://optimism-rpc.publicnode.com,https://optimism.drpc.org,https://mainnet.optimism.io"
)
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const CASH_EVENT_EMITTER = "0x380b2e96799405be6e3d965f4044099891881acb";
const SPEND_TOPIC = "0x89d3571a498b5d3d68599f5f00c3016f9604aafa7701c52c1b04109cd909a798";
const RECENT_LOOKBACK_BLOCKS = 50_000;
const FULL_LOOKBACK_BLOCKS = 1_000_000;
const LOG_CHUNK_SIZE = 9_000;
const LOG_BATCH_SIZE = 8;
const DEFAULT_LIMIT = 50;
const RPC_TIMEOUT_MS = 6_000;

export const runtime = "nodejs";

type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    code: number;
    message: string;
  };
};

type RpcLog = {
  address: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  topics: string[];
  data: string;
};

type RpcBlock = {
  number: string;
  timestamp: string;
};

type RpcReceipt = {
  blockNumber?: string;
  logs: RpcLog[];
};

type RpcPayload = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
};

const isAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);
const isTxHash = (value: string) => /^0x[a-fA-F0-9]{64}$/.test(value);

const toTopicAddress = (address: string) =>
  `0x000000000000000000000000${address.slice(2).toLowerCase()}`;

const toHexBlock = (block: number) => `0x${block.toString(16)}`;

const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`;

const chunkRanges = (fromBlock: number, toBlock: number) => {
  const ranges: Array<{ from: number; to: number }> = [];

  for (let from = fromBlock; from <= toBlock; from += LOG_CHUNK_SIZE) {
    ranges.push({ from, to: Math.min(toBlock, from + LOG_CHUNK_SIZE - 1) });
  }

  return ranges;
};

const dataWords = (data: string) => {
  const hex = data.startsWith("0x") ? data.slice(2) : data;
  const words: string[] = [];

  for (let i = 0; i < hex.length; i += 64) {
    words.push(`0x${hex.slice(i, i + 64)}`);
  }

  return words;
};

const parseWord = (word?: string) => BigInt(word || "0x0");

const wordToAddress = (word?: string) => {
  if (!word || word.length < 42) return undefined;
  return `0x${word.slice(-40)}`;
};

const spendAmountAtomic = (log: RpcLog) => {
  const [amount] = dataWords(log.data);
  return parseWord(amount);
};

const spendDedupKey = (log: RpcLog) =>
  `${log.transactionHash.toLowerCase()}:${log.logIndex.toLowerCase()}`;

const dedupeSpendLogs = (logs: RpcLog[]) => {
  const groups = new Map<string, RpcLog[]>();

  for (const log of logs) {
    const key = spendDedupKey(log);
    const group = groups.get(key);
    if (group) {
      group.push(log);
    } else {
      groups.set(key, [log]);
    }
  }

  const dedupedLogs = Array.from(groups.values()).map((group) => group[0]);

  return dedupedLogs.sort((a, b) => {
    const blockDiff = Number.parseInt(b.blockNumber, 16) - Number.parseInt(a.blockNumber, 16);
    if (blockDiff !== 0) return blockDiff;
    return Number.parseInt(b.logIndex, 16) - Number.parseInt(a.logIndex, 16);
  });
};

const getSafeFromSpendReceipt = (receipt: RpcReceipt) => {
  const spendLog = receipt.logs.find(
    (log) =>
      log.address.toLowerCase() === CASH_EVENT_EMITTER &&
      log.topics[0]?.toLowerCase() === SPEND_TOPIC &&
      log.topics[1],
  );

  return wordToAddress(spendLog?.topics[1])?.toLowerCase();
};

const formatUnits = (value: bigint, decimals: number) => {
  const base = BigInt(10) ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;

  if (fraction === BigInt(0)) return whole.toString();

  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fractionText}`;
};

const formatUsd = (value: bigint) =>
  Number(formatUnits(value, 6)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

async function postJson<T>(rpcUrl: string, body: RpcPayload | RpcPayload[]): Promise<T> {
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
      continue;
    }
  }

  throw new Error(lastError);
}

async function rpcBatch<T>(calls: Array<{ method: string; params: unknown[] }>): Promise<T[]> {
  if (calls.length === 0) return [];

  let lastError = "Optimism RPC failed";

  for (const rpcUrl of OPTIMISM_RPC_URLS) {
    try {
      const payload = await postJson<Array<JsonRpcResponse<T> & { id: number }>>(
        rpcUrl,
        calls.map((call, index) => ({
          jsonrpc: "2.0",
          id: index + 1,
          method: call.method,
          params: call.params,
        })),
      );
      const sorted = payload.sort((a, b) => a.id - b.id);
      const failed = sorted.find((item) => item.error);

      if (failed?.error) {
        lastError = failed.error.message;
        continue;
      }

      return sorted.map((item) => item.result as T);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Optimism RPC request timed out";
      continue;
    }
  }

  throw new Error(lastError);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedSafe = searchParams.get("safe")?.trim().toLowerCase();
  const tx = searchParams.get("tx")?.trim().toLowerCase();

  if (requestedSafe && !isAddress(requestedSafe)) {
    return Response.json({ error: "Valid ether.fi Cash safe address is required." }, { status: 400 });
  }

  if (tx && !isTxHash(tx)) {
    return Response.json({ error: "Valid OP spend transaction hash is required." }, { status: 400 });
  }

  if (!requestedSafe && !tx) {
    return Response.json({ error: "Provide an ether.fi Cash spend tx or safe address." }, { status: 400 });
  }

  try {
    let safe = requestedSafe;
    let sourceTxBlock: number | undefined;
    let sourceReceipt: RpcReceipt | undefined;

    if (!safe && tx) {
      sourceReceipt = await rpcCall<RpcReceipt>("eth_getTransactionReceipt", [tx]);
      safe = getSafeFromSpendReceipt(sourceReceipt);
      sourceTxBlock = sourceReceipt.blockNumber ? Number.parseInt(sourceReceipt.blockNumber, 16) : undefined;
    }

    if (!safe) {
      return Response.json(
        { error: "That transaction does not contain an ether.fi Cash Spend event." },
        { status: 404 },
      );
    }

    const latestBlockHex = await rpcCall<string>("eth_blockNumber", []);
    const latestBlock = Number.parseInt(latestBlockHex, 16);
    const requestedScope = searchParams.get("scope");
    const scope = requestedScope === "full" ? "full" : requestedScope === "source" ? "source" : "recent";
    const defaultLookback = scope === "full" ? FULL_LOOKBACK_BLOCKS : RECENT_LOOKBACK_BLOCKS;
    const requestedLookback = searchParams.has("lookbackBlocks")
      ? Number(searchParams.get("lookbackBlocks"))
      : Number.NaN;
    const lookbackBlocks = Number.isFinite(requestedLookback)
      ? Math.min(FULL_LOOKBACK_BLOCKS, Math.max(1, Math.floor(requestedLookback)))
      : defaultLookback;
    const requestedFrom = searchParams.has("fromBlock") ? Number(searchParams.get("fromBlock")) : Number.NaN;
    const requestedTo = searchParams.has("toBlock") ? Number(searchParams.get("toBlock")) : Number.NaN;
    const toBlock = Number.isFinite(requestedTo)
      ? Math.min(latestBlock, Math.max(0, Math.floor(requestedTo)))
      : latestBlock;
    const defaultFromBlock = Math.max(0, toBlock - lookbackBlocks);
    const fromBlock = Number.isFinite(requestedFrom)
      ? Math.max(0, Math.floor(requestedFrom))
      : sourceTxBlock
        ? Math.min(defaultFromBlock, sourceTxBlock)
        : defaultFromBlock;
    const requestedLimit = searchParams.has("limit") ? Number(searchParams.get("limit")) : Number.NaN;
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
      : DEFAULT_LIMIT;

    const logs: RpcLog[] = [];
    const safeTopic = toTopicAddress(safe);

    if (scope === "source" && tx) {
      const receipt = sourceReceipt || await rpcCall<RpcReceipt>("eth_getTransactionReceipt", [tx]);
      const sourceLogs = receipt.logs.filter(
        (log) =>
          log.address.toLowerCase() === CASH_EVENT_EMITTER &&
          log.topics[0]?.toLowerCase() === SPEND_TOPIC &&
          log.topics[1]?.toLowerCase() === safeTopic,
      );
      logs.push(...sourceLogs);
    }

    const ranges = chunkRanges(fromBlock, toBlock);

    if (scope !== "source") {
      for (let index = 0; index < ranges.length; index += LOG_BATCH_SIZE) {
        const batch = ranges.slice(index, index + LOG_BATCH_SIZE);
        const chunks = await Promise.all(
          batch.map((range) =>
            rpcCall<RpcLog[]>("eth_getLogs", [
              {
                address: CASH_EVENT_EMITTER,
                fromBlock: toHexBlock(range.from),
                toBlock: toHexBlock(range.to),
                topics: [SPEND_TOPIC, safeTopic],
              },
            ]),
          ),
        );

        logs.push(...chunks.flat());
      }
    }

    const sortedLogs = logs.sort((a, b) => {
      const blockDiff = Number.parseInt(b.blockNumber, 16) - Number.parseInt(a.blockNumber, 16);
      if (blockDiff !== 0) return blockDiff;
      return Number.parseInt(b.logIndex, 16) - Number.parseInt(a.logIndex, 16);
    });
    // Source and range scans can overlap. Collapse only exact log identities so
    // same-amount Spend events in one transaction remain separate underwriting inputs.
    const paymentLogs = dedupeSpendLogs(sortedLogs);

    const visibleLogs = paymentLogs.slice(0, limit);
    const blockNumbers = [...new Set(visibleLogs.map((log) => log.blockNumber))];
    const blocks = await rpcBatch<RpcBlock>(
      blockNumbers.map((blockNumber) => ({
        method: "eth_getBlockByNumber",
        params: [blockNumber, false],
      })),
    );
    const timestampByBlock = new Map(
      blocks.map((block) => [block.number.toLowerCase(), Number.parseInt(block.timestamp, 16)]),
    );
    const totalSpendAtomic = paymentLogs.reduce((total, log) => {
      return total + spendAmountAtomic(log);
    }, BigInt(0));
    const rawTotalSpendAtomic = sortedLogs.reduce((total, log) => {
      return total + spendAmountAtomic(log);
    }, BigInt(0));

    const receipts = visibleLogs.map((log) => {
      const words = dataWords(log.data);
      const amountAtomic = parseWord(words[0]);
      const cashbackToken = wordToAddress(words[1]);
      const cashbackAtomic = parseWord(words[2]);
      const blockNumber = Number.parseInt(log.blockNumber, 16);
      const timestamp = timestampByBlock.get(log.blockNumber.toLowerCase());

      return {
        id: `${log.transactionHash}-${log.logIndex}`,
        provider: "ether.fi Cash",
        chain: "Optimism",
        safe,
        source: CASH_EVENT_EMITTER,
        proof: "OP Spend event",
        txHash: log.transactionHash,
        txShort: shortHash(log.transactionHash),
        blockNumber,
        logIndex: Number.parseInt(log.logIndex, 16),
        timestamp,
        amountUsd: formatUsd(amountAtomic),
        amountAtomic: amountAtomic.toString(),
        cashbackToken,
        cashbackAmount: cashbackAtomic.toString(),
        indexedAccount: wordToAddress(log.topics[1]),
        indexedWallet: wordToAddress(log.topics[2]),
      };
    });

    return Response.json({
      safe,
      sourceTx: tx,
      sourceTxBlock,
      chain: "optimism",
      emitter: CASH_EVENT_EMITTER,
      eventTopic: SPEND_TOPIC,
      scope,
      lookbackBlocks,
      fromBlock,
      toBlock,
      count: paymentLogs.length,
      rawEventCount: sortedLogs.length,
      returned: receipts.length,
      totalSpendUsd: formatUsd(totalSpendAtomic),
      rawTotalSpendUsd: formatUsd(rawTotalSpendAtomic),
      dedupeStrategy: "transactionHash+amountAtomic only when mirrored safe/card indexes conflict",
      receipts,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to scan Optimism spend events." },
      { status: 502 },
    );
  }
}
