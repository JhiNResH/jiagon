# Jiagon

Jiagon is a verified local review data layer for agents. The MVP starts with
ether.fi Cash card spends: users prove a real payment happened, attach a review,
and produce a receipt credential that can be consumed by recommendation agents.

The current product verifies ether.fi Cash Optimism spend events, mints or
prepares BNB testnet receipt credentials, and can persist published receipt
reviews to Postgres when `DATABASE_URL` is configured.

## Current Status

- Web app: Next.js App Router.
- Auth: Privy.
- Payment proof source: ether.fi Cash `Spend` events on Optimism.
- Credential chain: BNB Smart Chain testnet.
- Receipt registry: `0xd2162803d5C893d1D8Ce317B674625beC4Ad18E5`.
- Registry admin / initial minter: `0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9`.
- Server minter: configurable with `BNB_MINTER_PRIVATE_KEY`.
- Mint authorization: protected by `JIAGON_MINT_API_TOKEN`.
- App mint endpoint: `/api/receipts/publish` can mint with the server token for local-only demos when `JIAGON_APP_MINT_ENABLED=true`.
- API mode: real BNB testnet mint when registry, minter key, and mint token are configured; otherwise `prepare-only`.
- Review persistence: optional Postgres via `DATABASE_URL`; minting still works when persistence is not configured.

## User Flow

1. User signs in with Privy.
2. User submits an ether.fi Cash Optimism transaction hash.
3. Jiagon verifies the transaction contains an ether.fi Cash `Spend` event.
4. Jiagon derives the user's ether.fi Cash safe / wallet from the event.
5. User adds merchant, branch, rating, tags, structured visit signals, and review text.
6. Jiagon prepares a receipt credential with:
   - `sourceReceiptHash`
   - `dataHash`
   - `storageUri`
   - proof level metadata
   - BNB testnet registry metadata
7. The prepared credential can power review feeds and agent recommendation APIs.
8. If the server minter is authorized, Jiagon broadcasts the credential mint to BNB testnet.
9. If `DATABASE_URL` is configured, Jiagon stores the published receipt review for feed and agent APIs.

## Proof Model

Jiagon separates payment proof, merchant claim, and review content.

- Payment proof: verified from Optimism RPC against ether.fi Cash spend logs.
- Merchant proof: user claim for MVP; currently not independently verified.
- Review proof: tied to a verified payment receipt.
- Review attributes: user-provided structured context such as visit type,
  occasion, value rating, would-return intent, and best-for tags.
- Onchain registry: stores hashes and storage pointers, not raw receipt metadata.

Current prepare-only credentials should be treated as proof level `C` unless
ownership and merchant binding are strengthened server-side.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Create local environment config:

```bash
cp env.example .env.local
```

Set at least:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
# Required for server-side private account state sync.
# PRIVY_VERIFICATION_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
BNB_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
BNB_TESTNET_ADMIN=0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9
BNB_RECEIPT_CONTRACT_ADDRESS=0xd2162803d5C893d1D8Ce317B674625beC4Ad18E5
# BNB_MINTER_PRIVATE_KEY=never-commit-real-private-keys
# JIAGON_MINT_API_TOKEN=use-a-random-32-plus-character-server-token
# JIAGON_APP_MINT_ENABLED=true
# DATABASE_URL=postgres://user:password@host:5432/database
# DATABASE_SSL=true
```

Run the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

Run the web build:

```bash
pnpm build
```

Run contract tests:

```bash
forge test -vvv
```

Dry-run the BNB testnet deploy script:

```bash
BNB_TESTNET_ADMIN=0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9 \
forge script script/DeployReceiptCredentialRegistry.s.sol:DeployReceiptCredentialRegistry \
  --rpc-url https://data-seed-prebsc-1-s1.bnbchain.org:8545
```

## BNB Testnet Registry

Deployment docs live in [`docs/deploy/bnb-testnet.md`](docs/deploy/bnb-testnet.md).

The deployed testnet registry has been verified locally with:

```bash
cast call 0xd2162803d5C893d1D8Ce317B674625beC4Ad18E5 \
  "owner()(address)" \
  --rpc-url https://data-seed-prebsc-1-s1.bnbchain.org:8545

cast call 0xd2162803d5C893d1D8Ce317B674625beC4Ad18E5 \
  "isMinter(address)(bool)" \
  0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9 \
  --rpc-url https://data-seed-prebsc-1-s1.bnbchain.org:8545
```

Expected results:

- `owner()` returns `0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9`.
- `isMinter(admin)` returns `true`.

## API Surface

- `POST /api/etherfi/spends`: scans or returns ether.fi Cash spend candidates.
- `POST /api/receipts/mint`: verifies an OP spend and prepares a BNB receipt credential.
- `POST /api/receipts/publish`: app-facing endpoint that uses the server mint token without exposing it to the browser.
- `GET /api/receipts/reviews`: returns persisted published receipt reviews.
- `GET /api/agent/recommendations`: returns recommendation-oriented review data.

Agent recommendations expose both human review text and machine-readable
`agentSignals`. The API also includes a `proofBoundary` so agents can separate
verified facts from user claims:

- verified: payment happened on Optimism through an ether.fi Cash Spend event;
- user-claimed: merchant / branch identity and review attributes;
- minted: BNB testnet credential hash points to the submitted data object;
- not yet solved: official card API merchant binding and production ownership checks.

`/api/receipts/mint` returns `status: "minted"` only after the API broadcasts
and confirms a BNB testnet transaction. A real mint requires a server minter key
and a matching `x-jiagon-mint-token` or `Authorization: Bearer ...` token. If
the registry address, minter key, or mint authorization is missing, it falls back
to `status: "prepared"` and `mode: "prepare-only"`.

The web app posts reviews to `/api/receipts/publish`, which injects
`JIAGON_MINT_API_TOKEN` server-side. By default this endpoint only works on
localhost when `JIAGON_APP_MINT_ENABLED=true`. Keep it disabled for hosted
demos and public production until rate limiting and stronger receipt ownership
binding are added.

When `DATABASE_URL` is configured, `/api/receipts/mint` also upserts the
published review and public credential metadata. If no database is configured,
the API includes `persistence.configured: false` and the frontend keeps the
local receipt view in browser storage.

Private receipt inbox state is stored separately through `/api/account/state`.
That endpoint requires a Privy bearer token and `PRIVY_VERIFICATION_KEY`; without
the verification key it refuses reads and writes instead of treating a
client-supplied wallet address as a private-data security boundary.

## Development Workflow

For contract, proof, credential, auth, or minting changes:

- use a scoped `codex/*` branch;
- run `pnpm build`;
- run `forge test -vvv`;
- run Solidity audit review for contract changes;
- request independent local code review, usually from another agent;
- open a PR;
- optionally trigger CodeRabbit with `@coderabbitai full review` when the GitHub App is installed;
- squash merge only after explicit approval.

## Next Milestones

- Replace temporary mint token gating with Privy server verification and safe ownership binding.
- Add stronger safe ownership binding before trusted production minting.
- Move raw review JSON from temporary payload storage to Greenfield objects.
- Harden user-scoped receipt inbox persistence with richer account recovery and migration tooling.
- Reduce manual tx submission by adding safer account-linked spend discovery.
