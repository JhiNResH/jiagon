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
- API mode: real BNB testnet mint when registry, minter key, and mint token are configured; otherwise `prepare-only`.
- Review persistence: optional Postgres via `DATABASE_URL`; minting still works when persistence is not configured.

## User Flow

1. User signs in with Privy.
2. User submits an ether.fi Cash Optimism transaction hash.
3. Jiagon verifies the transaction contains an ether.fi Cash `Spend` event.
4. Jiagon derives the user's ether.fi Cash safe / wallet from the event.
5. User adds merchant, branch, rating, tags, and review text.
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
BNB_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
BNB_TESTNET_ADMIN=0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9
BNB_RECEIPT_CONTRACT_ADDRESS=0xd2162803d5C893d1D8Ce317B674625beC4Ad18E5
# BNB_MINTER_PRIVATE_KEY=never-commit-real-private-keys
# JIAGON_MINT_API_TOKEN=use-a-random-32-plus-character-server-token
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
- `GET /api/receipts/reviews`: returns persisted published receipt reviews.
- `GET /api/agent/recommendations`: returns recommendation-oriented review data.

`/api/receipts/mint` returns `status: "minted"` only after the API broadcasts
and confirms a BNB testnet transaction. A real mint requires a server minter key
and a matching `x-jiagon-mint-token` or `Authorization: Bearer ...` token. If
the registry address, minter key, or mint authorization is missing, it falls back
to `status: "prepared"` and `mode: "prepare-only"`.

When `DATABASE_URL` is configured, `/api/receipts/mint` also upserts the
published review and public credential metadata. If no database is configured,
the API includes `persistence.configured: false` and the frontend keeps the
local receipt view in browser storage.

## Development Workflow

For contract, proof, credential, auth, or minting changes:

- use a scoped `codex/*` branch;
- run `pnpm build`;
- run `forge test -vvv`;
- run Solidity audit review for contract changes;
- request independent code review;
- open a PR;
- squash merge only after explicit approval.

## Next Milestones

- Replace temporary mint token gating with Privy server verification and safe ownership binding.
- Add Privy server verification and safe ownership binding before trusted production minting.
- Move raw review JSON from temporary payload storage to Greenfield objects.
- Build user-scoped receipt inbox persistence.
- Reduce manual tx submission by adding safer account-linked spend discovery.
