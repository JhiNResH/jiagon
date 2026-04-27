import { createHash, timingSafeEqual } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { persistReceiptReview } from "@/server/receiptStore";
import { createPublicClient, createWalletClient, http, parseEventLogs, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

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
const DEFAULT_BNB_TESTNET_ADMIN = "0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9";
const BNB_TESTNET_EXPLORER_URL = "https://testnet.bscscan.com";
const RPC_TIMEOUT_MS = 6_000;

const RECEIPT_REGISTRY_ABI = [
  {
    type: "function",
    name: "credentialIdBySourceReceiptHash",
    stateMutability: "view",
    inputs: [{ name: "sourceReceiptHash", type: "bytes32" }],
    outputs: [{ name: "credentialId", type: "uint256" }],
  },
  {
    type: "function",
    name: "isMinter",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "enabled", type: "bool" }],
  },
  {
    type: "function",
    name: "getCredential",
    stateMutability: "view",
    inputs: [{ name: "credentialId", type: "uint256" }],
    outputs: [
      {
        name: "credential",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "sourceReceiptHash", type: "bytes32" },
          { name: "dataHash", type: "bytes32" },
          { name: "storageUri", type: "string" },
          { name: "proofLevel", type: "uint8" },
          { name: "issuedAt", type: "uint64" },
          { name: "issuer", type: "address" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "mintCredential",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiptOwner", type: "address" },
      { name: "sourceReceiptHash", type: "bytes32" },
      { name: "dataHash", type: "bytes32" },
      { name: "storageUri", type: "string" },
      { name: "proofLevel", type: "uint8" },
    ],
    outputs: [{ name: "credentialId", type: "uint256" }],
  },
  {
    type: "event",
    name: "ReceiptCredentialMinted",
    inputs: [
      { name: "credentialId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "sourceReceiptHash", type: "bytes32", indexed: true },
      { name: "dataHash", type: "bytes32", indexed: false },
      { name: "storageUri", type: "string", indexed: false },
      { name: "proofLevel", type: "uint8", indexed: false },
      { name: "issuer", type: "address", indexed: false },
    ],
  },
] as const;

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

function configuredAddress(value: string | undefined) {
  const address = (value || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address) || /^0x0{40}$/.test(address)) return null;
  return address;
}

function configuredPrivateKey(value: string | undefined) {
  const privateKey = (value || "").trim();
  if (/^0x[a-fA-F0-9]{64}$/.test(privateKey)) return privateKey as Hex;
  if (/^[a-fA-F0-9]{64}$/.test(privateKey)) return `0x${privateKey}` as Hex;
  return null;
}

function configuredSecret(value: string | undefined) {
  const secret = (value || "").trim();
  return secret.length >= 32 ? secret : null;
}

function safeTokenEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function requestMintToken(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return (request.headers.get("x-jiagon-mint-token") || bearer || "").trim();
}

function bnbRpcUrl() {
  return process.env.BNB_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
}

async function readExistingCredential({
  publicClient,
  registryAddress,
  sourceHash,
  minter,
}: {
  publicClient: ReturnType<typeof createPublicClient>;
  registryAddress: Address;
  sourceHash: Hex;
  minter: Address;
}) {
  const credentialId = await publicClient.readContract({
    address: registryAddress,
    abi: RECEIPT_REGISTRY_ABI,
    functionName: "credentialIdBySourceReceiptHash",
    args: [sourceHash],
  });

  if (credentialId === BigInt(0)) return null;

  const credential = await publicClient.readContract({
    address: registryAddress,
    abi: RECEIPT_REGISTRY_ABI,
    functionName: "getCredential",
    args: [credentialId],
  });

  return {
    status: "already-minted" as const,
    credentialId: credentialId.toString(),
    credentialTx: null,
    explorerUrl: `${BNB_TESTNET_EXPLORER_URL}/address/${registryAddress}`,
    minter,
    onchain: {
      owner: credential.owner,
      sourceReceiptHash: credential.sourceReceiptHash,
      dataHash: credential.dataHash,
      storageUri: credential.storageUri,
      proofLevel: Number(credential.proofLevel),
      issuedAt: credential.issuedAt.toString(),
      issuer: credential.issuer,
    },
  };
}

async function mintReceiptCredential({
  receiptOwner,
  sourceHash,
  dataHash,
  storageUri,
  proofLevel,
  registryAddress,
  minterPrivateKey,
}: {
  receiptOwner: Address;
  sourceHash: Hex;
  dataHash: Hex;
  storageUri: string;
  proofLevel: number;
  registryAddress: Address;
  minterPrivateKey: Hex;
}) {
  const account = privateKeyToAccount(minterPrivateKey);
  const transport = http(bnbRpcUrl());
  const publicClient = createPublicClient({ chain: bscTestnet, transport });
  const walletClient = createWalletClient({ account, chain: bscTestnet, transport });

  const chainId = await publicClient.getChainId();
  if (chainId !== BNB_TESTNET_CHAIN_ID) {
    throw new Error(`BNB RPC is connected to chain ${chainId}, expected ${BNB_TESTNET_CHAIN_ID}.`);
  }

  const registryCode = await publicClient.getCode({ address: registryAddress });
  if (!registryCode || registryCode === "0x") {
    throw new Error("BNB receipt registry address has no deployed contract code.");
  }

  const isMinter = await publicClient.readContract({
    address: registryAddress,
    abi: RECEIPT_REGISTRY_ABI,
    functionName: "isMinter",
    args: [account.address],
  });

  if (!isMinter) {
    throw new Error("Configured BNB minter is not authorized by the receipt registry.");
  }

  const existingCredential = await readExistingCredential({ publicClient, registryAddress, sourceHash, minter: account.address });
  if (existingCredential) return existingCredential;

  let txHash: Hex;
  try {
    txHash = await walletClient.writeContract({
      address: registryAddress,
      abi: RECEIPT_REGISTRY_ABI,
      functionName: "mintCredential",
      args: [receiptOwner, sourceHash, dataHash, storageUri, proofLevel],
    });
  } catch (error) {
    const racedCredential = await readExistingCredential({ publicClient, registryAddress, sourceHash, minter: account.address });
    if (racedCredential) return racedCredential;
    throw error;
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    const racedCredential = await readExistingCredential({ publicClient, registryAddress, sourceHash, minter: account.address });
    if (racedCredential) return racedCredential;
    throw new Error("BNB receipt mint transaction reverted.");
  }

  const mintedEvents = parseEventLogs({
    abi: RECEIPT_REGISTRY_ABI,
    eventName: "ReceiptCredentialMinted",
    logs: receipt.logs,
  });
  const mintedEvent = mintedEvents.find(
    (event) => event.address.toLowerCase() === registryAddress.toLowerCase() && event.args.sourceReceiptHash === sourceHash,
  );

  if (!mintedEvent) {
    throw new Error("BNB mint transaction succeeded but no receipt credential event was found.");
  }

  return {
    status: "minted" as const,
    credentialId: mintedEvent.args.credentialId.toString(),
    credentialTx: txHash,
    explorerUrl: `${BNB_TESTNET_EXPLORER_URL}/tx/${txHash}`,
    minter: account.address,
    onchain: {
      owner: mintedEvent.args.owner,
      sourceReceiptHash: mintedEvent.args.sourceReceiptHash,
      dataHash: mintedEvent.args.dataHash,
      storageUri: mintedEvent.args.storageUri,
      proofLevel: Number(mintedEvent.args.proofLevel),
      issuedAt: null,
      issuer: mintedEvent.args.issuer,
    },
  };
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
    const preparedCredentialId = `bnb-testnet-ready-${hash(`${sourceHash}:${dataHash}:${owner}`).slice(0, 12)}`;
    const storageUri = `greenfield-testnet://jiagon/receipts/${preparedCredentialId}.json`;
    const registryAddress = configuredAddress(process.env.BNB_RECEIPT_CONTRACT_ADDRESS);
    const configuredRegistryAdmin = configuredAddress(process.env.BNB_TESTNET_ADMIN);
    const defaultRegistryAdmin = configuredAddress(DEFAULT_BNB_TESTNET_ADMIN);
    const minterPrivateKey = configuredPrivateKey(process.env.BNB_MINTER_PRIVATE_KEY);
    const mintApiToken = configuredSecret(process.env.JIAGON_MINT_API_TOKEN);
    const submittedMintToken = requestMintToken(request);
    const mintAuthorized = Boolean(
      mintApiToken && submittedMintToken && safeTokenEqual(submittedMintToken, mintApiToken),
    );

    if (process.env.BNB_MINTER_PRIVATE_KEY && !minterPrivateKey) {
      return Response.json({ error: "Configured BNB minter private key is invalid." }, { status: 500 });
    }
    if (process.env.JIAGON_MINT_API_TOKEN && !mintApiToken) {
      return Response.json({ error: "Configured Jiagon mint API token is invalid." }, { status: 500 });
    }
    if (submittedMintToken && !mintAuthorized) {
      return Response.json({ error: "Invalid Jiagon mint authorization token." }, { status: 403 });
    }

    const registry = {
      address: registryAddress,
      admin: configuredRegistryAdmin,
      adminConfigured: Boolean(configuredRegistryAdmin),
      defaultAdmin: defaultRegistryAdmin,
      configured: Boolean(registryAddress),
      minterConfigured: Boolean(minterPrivateKey),
      mintAuthConfigured: Boolean(mintApiToken),
    };

    const proof = {
      payment: "A",
      merchant: "C",
      ownership: "event-safe-derived",
      sourceChain: "optimism",
      sourceTx,
      logIndex: verifiedSpend.logIndex,
    };

    const persistAndRespond = async (payload: Record<string, unknown>) => {
      const persistence = await persistReceiptReview({
        receiptId: body.receipt?.id || preparedCredentialId,
        reviewId: body.review?.id || `review-${hash(`${sourceHash}:${dataHash}`).slice(0, 12)}`,
        status: String(payload.status || "prepared"),
        mode: typeof payload.mode === "string" ? payload.mode : null,
        sourceChain: "optimism",
        sourceTx,
        sourceBlock: verifiedSpend.blockNumber || body.receipt?.block || body.receipt?.blockNumber || null,
        logIndex: verifiedSpend.logIndex,
        ownerSafe: owner,
        wallet: verifiedSpend.wallet,
        merchant,
        branch,
        rating,
        tags: body.review?.tags || [],
        reviewText: body.review?.text || "",
        amount: body.receipt?.amount || (body.receipt?.amountUsd ? `$${body.receipt.amountUsd}` : null),
        token: body.receipt?.token || "OP USDC",
        proofLevel: "C",
        sourceReceiptHash: sourceHash,
        dataHash: String(payload.dataHash || dataHash),
        requestedDataHash: typeof payload.requestedDataHash === "string" ? payload.requestedDataHash : dataHash,
        dataMatchesRequest:
          typeof payload.dataMatchesRequest === "boolean"
            ? payload.dataMatchesRequest
            : payload.status === "prepared"
              ? true
              : null,
        storageUri: String(payload.storageUri || storageUri),
        requestedStorageUri: typeof payload.requestedStorageUri === "string" ? payload.requestedStorageUri : storageUri,
        credentialChain: "bnb-testnet",
        chainId: BNB_TESTNET_CHAIN_ID,
        credentialId: String(payload.credentialId || preparedCredentialId),
        credentialTx: typeof payload.credentialTx === "string" ? payload.credentialTx : null,
        explorerUrl: typeof payload.explorerUrl === "string" ? payload.explorerUrl : null,
        registryAddress,
        minter: typeof payload.minter === "string" ? payload.minter : null,
        payload: {
          ...payload,
          dataObject,
        },
      });

      return Response.json({
        ...payload,
        persistence,
      });
    };

    if (registryAddress && minterPrivateKey && mintAuthorized) {
      const mint = await mintReceiptCredential({
        receiptOwner: owner as Address,
        sourceHash: sourceHash as Hex,
        dataHash: dataHash as Hex,
        storageUri,
        proofLevel: 3,
        registryAddress: registryAddress as Address,
        minterPrivateKey,
      });

      return persistAndRespond({
        status: "minted",
        network: "BNB Smart Chain testnet",
        chainId: BNB_TESTNET_CHAIN_ID,
        credentialChain: "bnb-testnet",
        registry,
        credentialId: mint.credentialId,
        preparedCredentialId,
        credentialTx: mint.credentialTx,
        explorerUrl: mint.explorerUrl,
        storageLayer: "greenfield-testnet",
        storageUri: mint.onchain.storageUri,
        requestedStorageUri: storageUri,
        sourceReceiptHash: sourceHash,
        dataHash: mint.onchain.dataHash,
        requestedDataHash: dataHash,
        dataMatchesRequest: mint.onchain.dataHash.toLowerCase() === dataHash.toLowerCase(),
        mintedAt: mint.onchain.issuedAt ? new Date(Number(mint.onchain.issuedAt) * 1000).toISOString() : new Date().toISOString(),
        proofLevel: "C",
        proof,
        mode: mint.status === "already-minted" ? "already-minted" : "minted",
        minter: mint.minter,
        onchain: mint.onchain,
        note:
          mint.status === "already-minted"
            ? "OP spend verified. A BNB testnet receipt credential already exists for this source receipt."
            : "OP spend verified and BNB testnet receipt credential minted.",
      });
    }

    return persistAndRespond({
      status: "prepared",
      network: "BNB Smart Chain testnet",
      chainId: BNB_TESTNET_CHAIN_ID,
      credentialChain: "bnb-testnet",
      registry,
      credentialId: preparedCredentialId,
      credentialTx: null,
      explorerUrl: null,
      storageLayer: "greenfield-testnet",
      storageUri,
      sourceReceiptHash: sourceHash,
      dataHash,
      preparedAt: new Date().toISOString(),
      proofLevel: "C",
      proof,
      mode: "prepare-only",
      note:
        registryAddress && minterPrivateKey && mintApiToken
          ? "OP spend verified. BNB testnet mint is configured, but this request is prepare-only because mint authorization was not provided."
          : registryAddress
            ? "OP spend verified. BNB testnet registry is configured, but this API remains prepare-only until a minter key and mint authorization token are configured."
            : "OP spend verified. BNB testnet transaction is not broadcast until a registry contract, minter key, and mint authorization token are configured.",
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify ether.fi Cash spend event or mint BNB receipt credential.",
      },
      { status: 502 },
    );
  }
}
