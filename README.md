# Jiagon

Agentic POS and onchain receipt passport for real-world purchases.

Jiagon turns a merchant-completed order into a customer-claimed receipt that can
be minted as a Solana receipt credential and used for purpose-bound credit. The
current MVP starts with a coffee-shop flow: customers order through Telegram,
pay normally at the counter, staff taps `Paid + Done`, and the customer taps NFC
to claim the receipt into a Jiagon Passport.

Live app: [jiagon.vercel.app](https://jiagon.vercel.app)

## Why

Real-world purchases are still hard for crypto apps and AI agents to verify.
Jiagon adds a proof layer without asking a merchant to replace its POS:

- the customer or agent created an order intent;
- the merchant marked the order paid and fulfilled;
- the customer claimed the receipt with Privy;
- the receipt can become a Solana Bubblegum cNFT;
- credit only unlocks when the receipt credential and server-side credit index
  say it is eligible.

The product is not trying to replace Square, Toast, or a full POS. Jiagon is the
receipt passport and credit layer that can sit beside a normal counter-payment
flow.

## Product Flow

```txt
Telegram or tile order
-> Merchant queue
-> Staff taps Paid + Done
-> Jiagon issues a claimable receipt
-> Customer taps NFC / enters pickup code
-> Customer claims with Privy
-> Receipt appears in Passport
-> Bubblegum receipt cNFT is minted or prepared
-> Credit preview updates
```

Primary app surfaces:

- **Tile**: customer order and NFC pickup station, e.g. `/tile/raposa-coffee`.
- **Merchant**: order queue, `Paid + Done`, receipt issuing, demo readiness,
  pilot metrics, and credit memo.
- **Passport**: customer receipt wallet for claimed merchant receipts.
- **Credit**: purpose-bound credit status and draw/repay demo surface.
- **Mobile**: Android receipt passport with Privy Expo auth, Solana Mobile
  Wallet Adapter, and Bubblegum mint wiring.

## Current MVP

- Web app: Next.js App Router.
- Mobile app: Expo Android under `apps/mobile`.
- Auth: Privy on web and Privy Expo on mobile.
- Order entry: Telegram bot and `/tile/{merchant}`.
- Pilot merchant: Raposa Coffee.
- Receipt pickup: static NFC station plus pickup code.
- Receipt credential: Solana Bubblegum cNFT when Bubblegum env is configured;
  otherwise the API returns `prepared`.
- Credit state: receipt-backed, purpose-bound credit preview and devnet draw
  surfaces.
- Persistence: Postgres when `DATABASE_URL` is configured; local demo memory
  fallback for development.
- Private receipt state: `/api/account/state` behind Privy token verification.

Status labels matter:

- `issued`: merchant has created a claimable receipt.
- `claimed`: customer claimed the receipt with Privy.
- `prepared`: Bubblegum credential payload/hash is ready, but no Solana
  transaction was confirmed.
- `minted`: a real Solana Bubblegum receipt cNFT was minted.

## Proof Model

Jiagon separates facts from claims so agents can reason safely.

| Layer | MVP proof | Caveat |
| --- | --- | --- |
| Order intent | Telegram or tile order | Intent alone is not a receipt |
| Merchant completion | Staff taps `Paid + Done` | Manual merchant attestation in the MVP |
| Customer claim | Privy-authenticated claim | Customer account binding depends on Privy |
| Receipt credential | Solana Bubblegum cNFT or prepared payload | Live mint requires Bubblegum tree and minter env |
| Credit | Receipt-indexed credit preview | Stronger payment proof can raise confidence later |

Jiagon preserves a proof ladder:

```txt
L0 order_intent_only
L1 merchant_accepted
L2 merchant_completed
L3 customer_claimed
L4 payment_backed
L5 payment_fulfillment_claim
```

Early coffee pilots can use L2/L3. Credit scoring should weight L4/L5 higher
when Stripe, card, USDC, or zkTLS-backed payment proof is added.

## Agent API

Discovery:

```txt
GET /.well-known/jiagon-agent.json
GET /api/agent
GET /openapi.json
```

Recommendation from Jiagon's proof graph:

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
3. Boost candidates with verified receipts, credit repayment, and useful taste
   signals.
4. Preserve proof-level caveats in the response.
```

Public review feed:

```txt
GET /api/receipts/reviews?limit=20
```

Private receipt passport data is not returned by public agent APIs.

## Demo Flow

```txt
Customer opens Telegram bot
-> chooses a coffee item
-> gets a pickup code
-> merchant Telegram group or /merchant receives the order
-> customer pays normally at the counter
-> staff taps Paid + Done
-> Jiagon issues a receipt claim token
-> customer taps NFC station
-> customer enters pickup code
-> Jiagon opens /claim/{token}
-> customer claims with Privy
-> Passport shows the receipt
-> mobile app can connect Solana wallet with MWA
-> Bubblegum receipt cNFT is minted or prepared
```

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
JIAGON_APP_ORIGIN=http://localhost:3000
```

Optional merchant, Telegram, Solana, and persistence config:

```bash
DATABASE_URL=postgres://user:password@host:5432/database
DATABASE_SSL=true
JIAGON_MERCHANT_ISSUER_KEY=use-a-random-demo-merchant-key
JIAGON_MERCHANT_RECEIPT_SIGNING_SECRET=use-a-random-receipt-signing-secret
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_MERCHANT_GROUP_CHAT_ID=your-staff-group-chat-id
SOLANA_BUBBLEGUM_TREE=your-devnet-tree
SOLANA_BUBBLEGUM_MINTER_SECRET_KEY=never-commit-real-private-keys
```

Run the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the mobile app:

```bash
export EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id
export EXPO_PUBLIC_PRIVY_CLIENT_ID=your-privy-mobile-client-id
export EXPO_PUBLIC_JIAGON_API_BASE_URL=http://localhost:3000
pnpm --filter @jiagon/mobile start
```

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
- `POST /api/merchant/orders`: creates an agentic merchant order.
- `GET /api/merchant/orders`: returns the merchant order queue.
- `POST /api/merchant/orders/{id}/complete`: marks an order `Paid + Done`
  and issues a claimable receipt.
- `GET /api/merchant/orders/claim`: resolves a pickup code to a claim URL.
- `POST /api/telegram/webhook`: Telegram order and merchant action webhook.
- `GET /api/merchant/receipts/{token}`: reads a public claimable receipt.
- `POST /api/merchant/receipts/{token}/claim`: Privy-authenticated receipt
  claim.
- `POST /api/solana/merchant-receipts/mint`: mints or prepares a Solana
  Bubblegum merchant receipt credential.
- `POST /api/receipts/publish`: app-facing publish endpoint.
- `POST /api/receipts/mint`: verifies an OP spend and prepares or mints a BNB
  legacy receipt credential.
- `GET /api/receipts/reviews`: returns persisted published receipt reviews.
- `GET /api/agent/recommendations`: returns Jiagon-native recommendations.
- `POST /api/agent/rerank`: boosts external place candidates with Jiagon proof.
- `GET /api/account/state`: private account state; requires a Privy bearer token.

Mint routes return `status: "minted"` only after the API broadcasts and
confirms a transaction. If required chain env is missing, they return
`status: "prepared"` and never claim that an onchain receipt exists.

## Legacy Adapters

The older ether.fi Cash and BNB testnet paths remain useful as proof-source and
credential experiments, but they are no longer the primary public pitch. The
current product direction is Solana-first: merchant-issued receipts, Bubblegum
cNFTs, receipt passport, and purpose-bound credit.

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

- Run one live coffee-shop pilot with Telegram order intake and NFC receipt
  claim.
- Live devnet Bubblegum mint smoke test from mobile.
- Add payment proof upgrade: Stripe, card, USDC, or zkTLS adapter.
- Improve merchant onboarding from manual demo config to self-serve setup.
- Add stronger credit underwriting and repayment history.
