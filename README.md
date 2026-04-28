# Jiagon

Receipt-backed local reviews for AI agents.

Jiagon turns verified crypto-card payments into privacy-preserving receipt
credentials and public taste signals. The MVP starts with ether.fi Cash:
users import an Optimism spend transaction, claim the merchant, publish a
review, and mint or prepare a BNB testnet receipt credential that agents can
use for recommendations.

Live app: [jiagon.vercel.app](https://jiagon.vercel.app)

## Why

Restaurant and local-service recommendations are moving into AI agents, but the
data those agents read is still easy to game. Jiagon adds a proof layer:

- the payment happened;
- the review is tied to that payment;
- the merchant claim is clearly labeled as user-claimed until stronger merchant
  metadata is integrated;
- private receipt history stays private unless the user publishes a review.

The product is not trying to replace Google Maps or Places. Those systems can
provide the candidate set; Jiagon can rerank or annotate candidates with
receipt-backed proof.

## Product Flow

```txt
Crypto-card spend tx
-> Jiagon verifies payment evidence
-> Private receipt appears in Receipts
-> User claims merchant and writes review
-> Receipt credential is prepared or minted
-> Published Taste becomes available to people and agents
```

Primary app surfaces:

- **Taste**: public receipt-backed reviews, search, and agent API preview.
- **Receipts**: private receipt inbox, ether.fi spend import, claim, review,
  publish.
- **Profile**: account, privacy, proof, and credential status.

## Current MVP

- Web app: Next.js App Router.
- Auth: Privy.
- First card adapter: ether.fi Cash.
- Payment proof source: ether.fi Cash `Spend` events on Optimism.
- Credential chain: BNB Smart Chain testnet.
- Receipt registry: `0xd2162803d5C893d1D8Ce317B674625beC4Ad18E5`.
- Published review storage: Postgres when `DATABASE_URL` is configured.
- Private receipt state: `/api/account/state` behind Privy token verification.

Status labels matter:

- `prepared`: OP spend was verified and credential payload/hash was prepared,
  but no BNB transaction was broadcast.
- `minted`: a real BNB testnet transaction was broadcast and confirmed.
- `already-minted`: the registry already has a credential for the same source
  receipt identity.

## Proof Model

Jiagon separates facts from claims so agents can reason safely.

| Layer | MVP proof | Caveat |
| --- | --- | --- |
| Payment | Optimism ether.fi Cash `Spend` event | Requires a supported card adapter |
| Receipt credential | BNB testnet registry hash + storage pointer | Raw receipt metadata is not stored onchain |
| Merchant | User claim | Needs official card API / receipt upload for stronger binding |
| Review | Published after verified payment | Subjective user content |

The current source receipt identity is:

```txt
source chain + provider + tx hash + log/event identity
```

This avoids treating a transaction hash alone as the receipt when a transaction
emits multiple spend events.

## Agent API

Discovery:

```txt
GET /.well-known/jiagon-agent.json
GET /api/agent
GET /openapi.json
```

Recommendation from Jiagon's own published Taste graph:

```txt
GET /api/agent/recommendations?query=coffee%20irvine&limit=3
```

Rerank a candidate set from Google Places, Maps, or another place graph:

```txt
POST /api/agent/rerank
```

The intended agent pattern:

```txt
1. Use Google Places or another place graph for broad coverage.
2. Send candidates to Jiagon rerank.
3. Boost candidates with receipt-backed payment proof and useful taste signals.
4. Preserve caveats: payment proof is stronger than merchant identity in the MVP.
```

Public review feed:

```txt
GET /api/receipts/reviews?limit=20
```

Private receipt inbox data is not returned by public agent APIs.

## Local Development

Install dependencies:

```bash
pnpm install
```

Create local environment config:

```bash
cp env.example .env.local
```

Minimum app config:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_VERIFICATION_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
BNB_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
BNB_RECEIPT_CONTRACT_ADDRESS=0xd2162803d5C893d1D8Ce317B674625beC4Ad18E5
```

Optional mint/persistence config:

```bash
BNB_MINTER_PRIVATE_KEY=never-commit-real-private-keys
JIAGON_MINT_API_TOKEN=use-a-random-32-plus-character-server-token
JIAGON_APP_MINT_ENABLED=true
DATABASE_URL=postgres://user:password@host:5432/database
DATABASE_SSL=true
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

BNB testnet deployment notes live in
[`docs/deploy/bnb-testnet.md`](docs/deploy/bnb-testnet.md).

## API Surface

- `GET /api/etherfi/spends`: scans ether.fi Cash spend candidates by tx or safe.
- `POST /api/receipts/publish`: app-facing publish endpoint.
- `POST /api/receipts/mint`: verifies an OP spend and prepares or mints a BNB
  receipt credential.
- `GET /api/receipts/reviews`: returns persisted published receipt reviews.
- `GET /api/agent/recommendations`: returns Jiagon-native recommendations.
- `POST /api/agent/rerank`: boosts external place candidates with Jiagon proof.
- `GET /api/account/state`: private account state; requires a Privy bearer token.

`/api/receipts/mint` returns `status: "minted"` only after the API broadcasts
and confirms a BNB testnet transaction. If the registry address, minter key, or
mint authorization is missing, it returns `status: "prepared"` and
`mode: "prepare-only"`.

## Development Workflow

For contract, proof, credential, auth, or minting changes:

- use a scoped `codex/*` branch;
- run `pnpm build`;
- run `forge test -vvv` for contract changes;
- run Solidity audit review for contract changes;
- request independent local code review for security-sensitive changes;
- open a PR;
- squash merge after approval.

## Roadmap

- Add official card/provider APIs to reduce manual tx submission.
- Strengthen merchant binding beyond user claims.
- Move receipt data objects to BNB Greenfield.
- Add more card adapters across EVM and Solana.
- Improve agent discovery, candidate reranking, and proof-level explanations.
