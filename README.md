# Jiagon

Personal agent commerce rail for real-world purchases.

Jiagon lets personal agents order from real-world merchants, prepare external
wallet payment approval, track merchant fulfillment, and turn verified receipts
into credit memory. The first MVP starts with Raposa Coffee and ends with future
purpose-bound dining deposits.

Live app: [jiagon.vercel.app](https://jiagon.vercel.app)

## Why

Real-world purchases are still hard for AI agents to complete and remember.
Jiagon adds a commerce and proof layer without asking a merchant to replace its
POS:

- the personal agent created an order intent;
- the agent or user approved an external wallet payment request;
- the merchant fulfilled the order;
- Jiagon issued a verified receipt;
- the receipt can become a Solana Bubblegum cNFT;
- future agents can use the receipt as credit memory for purpose-bound deposits.

The product is not trying to replace Square, Toast, or a full POS. Jiagon is the
agent-callable commerce rail plus receipt-credit memory layer that sits beside
normal merchant operations.

## Product Flow

```txt
Personal agent receives intent
-> Agent calls /api/agent/orders
-> Agent/user approves external wallet payment request
-> Merchant queue receives order
-> Merchant fulfills
-> Jiagon issues verified receipt
-> NFC / pickup-code claim binds receipt to passport identity
-> Bubblegum receipt cNFT is minted or prepared
-> Receipt becomes credit memory
-> Future agent can request purpose-bound dining deposit credit
```

Primary app surfaces:

- **Agent API**: personal agent commerce intake at `/api/agent/orders`.
- **Tile**: NFC pickup station and manual fallback, e.g. `/tile/raposa-coffee`.
- **Merchant**: agent order queue, fulfillment, receipt issuing, demo readiness,
  pilot metrics, and credit memo.
- **Passport**: verified purchase memory for future agents.
- **Credit**: purpose-bound dining deposit policy and draw/repay demo surface.
- **Mobile**: Android receipt passport with Privy Expo auth, Solana Mobile
  Wallet Adapter, and Bubblegum mint wiring.

## Current MVP

- Web app: Next.js App Router.
- Mobile app: Expo Android under `apps/mobile`.
- Auth: Privy on web and Privy Expo on mobile.
- Order entry: personal agent API first, with Telegram bot and `/tile/{merchant}` as pilot terminals.
- Pilot merchant: Raposa Coffee.
- Receipt pickup: static NFC station plus pickup code.
- Receipt credential: Solana Bubblegum cNFT when Bubblegum env is configured;
  otherwise the API returns `prepared`.
- Credit state: receipt-memory-backed, purpose-bound credit preview and devnet draw
  surfaces.
- Persistence: Postgres when `DATABASE_URL` is configured; local demo memory
  fallback for development.
- Private receipt state: `/api/account/state` behind Privy token verification.

Status labels matter:

- `issued`: merchant has created a claimable receipt.
- `claimed`: receipt was bound to a passport identity.
- `prepared`: Bubblegum credential payload/hash is ready, but no Solana
  transaction was confirmed.
- `minted`: a real Solana Bubblegum receipt cNFT was minted.

## Proof Model

Jiagon separates facts from claims so agents can reason safely.

| Layer | MVP proof | Caveat |
| --- | --- | --- |
| Order intent | Agent, Telegram, or tile order | Intent alone is not a receipt |
| Payment request | Solana Pay / Helio external wallet approval | Payment intent is not fulfillment proof until verified |
| Merchant completion | Staff marks fulfilled | Manual merchant attestation in the MVP |
| Passport claim | Privy-authenticated claim | Identity binding is separate from payment |
| Receipt credential | Solana Bubblegum cNFT or prepared payload | Live mint requires Bubblegum tree and minter env |
| Credit memory | Receipt-indexed credit preview | Stronger payment proof can raise confidence later |

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
GET /.well-known/ai-plugin.json
GET /api/agent
GET /openapi.json
```

Personal agent setup:

```txt
1. Give the agent this OpenAPI URL: https://jiagon.vercel.app/openapi.json
2. Tell it to call createAgentMerchantOrder when the user asks to order coffee,
   food, or a supported merchant item.
3. The user can speak naturally. The agent sends that text as userIntent.
4. The agent returns only the pickup code, ETA, payment approval URL, and claim
   instructions.
```

Example natural-language agent instruction:

```txt
You are my personal commerce agent. When I ask you to order coffee from Raposa,
call Jiagon's createAgentMerchantOrder action. Preserve my natural-language
request as userIntent, enforce my maxSpendUsd policy, prefer crypto_pay, and
show me the pickup code plus payment approval step. Do not say a receipt exists
until the merchant has fulfilled the order and Jiagon returns a claim URL.
```

CLI natural-language demo:

```bash
pnpm agent "Order one iced latte at Raposa Coffee under 10 dollars with Solana Pay"
```

The CLI calls the same agent order API and prints the fields needed for the live
demo: `order.pickupCode`, `payment.url`, `urls.nfcStation`, and
`urls.pairPhoneForNfcClaim`.

Create a merchant order from a personal agent:

```txt
POST /api/agent/orders
```

The request can be as loose as "I want a coffee" or structured with menu items.
The response returns the agent's commerce handoff: pickup result, order pass,
pickup code, pickup estimate, merchant dispatch status, receipt-memory path, and
optional external Solana wallet payment request. Supported demo payment modes
are `crypto_pay` and `pay_at_counter`. Legacy `helio_pay` and `solana_pay`
aliases are accepted as `crypto_pay`.

Browser demo:

```txt
GET /agent-order
```

Use this page to simulate a personal agent call, then open the returned external
wallet approval request. Jiagon prefers Helio Solana checkout when
`HELIO_PAYLINK_ID` is configured, with official Solana Pay transfer URLs as the
fallback.

Recommendation from Jiagon's proof graph:

```txt
GET /api/agent/recommendations?query=coffee%20irvine&limit=3
```

Rerank a candidate set from Google Places, Maps, or another place graph:

```txt
POST /api/agent/rerank
```

Direct agent-readable trust and proof checks:

```txt
GET /api/agent/merchants/raposa-coffee/trust
GET /api/agent/proofs/{receiptHash}
GET /api/agent/credit-eligibility?owner={solanaOwner}
```

The intended agent pattern:

```txt
1. Use Google Places or another place graph for broad coverage.
2. Send candidates to Jiagon rerank.
3. Check merchant trust and receipt proof when the agent needs a stronger
   reason to recommend or unlock a review.
4. Check purpose-bound credit eligibility from the user's Solana wallet.
5. Preserve proof-level caveats in the response.
```

Public review feed:

```txt
GET /api/receipts/reviews?limit=20
```

Private receipt passport data is not returned by public agent APIs.

Payment-backed receipt adapter:

```txt
POST /api/webhooks/moonpay
POST /api/webhooks/shopify/orders-paid
```

MoonPay Commerce sends `Authorization: Bearer <sharedToken>` and an
`X-Signature` HMAC over the raw request body. Jiagon accepts successful Pay Link
or Deposit payment events that include a Jiagon `orderId` in custom JSON, then
issues a claimable receipt with `paymentProvider: moonpay_commerce`.

Shopify sends `X-Shopify-Hmac-Sha256` over the raw body. Jiagon accepts
`orders/paid` events, maps Shopify order data into a claimable receipt, and
attaches the receipt to an existing Jiagon order when the cart includes
`jiagon_order_id`.

Shopify agent order tool:

```txt
GET /api/agent/shopify/products?query=beanie
POST /api/agent/shopify/orders
```

The order endpoint lets an agent search Shopify products, enforce a max-spend
policy, create a Jiagon order pass, create a Shopify cart, and attach
`jiagon_order_id` to the cart so the paid-order webhook can issue the receipt.

## Demo Flow

```txt
User tells personal agent: get me a coffee under $10
-> agent calls /api/agent/orders
-> Jiagon selects Raposa, creates the order, and prepares external wallet approval
-> Jiagon returns pickup location, pickup code, ETA, and optional Solana payment request
-> merchant Telegram group or /merchant receives the order
-> agent/user approves payment if configured, otherwise counter payment is fallback
-> merchant fulfills
-> Jiagon issues a verified receipt claim token
-> agent/user taps NFC station
-> pickup code resolves the fulfilled order
-> Jiagon opens /claim/{token}
-> receipt is bound to passport identity
-> Passport shows verified purchase memory
-> mobile app can connect Solana wallet with MWA
-> Bubblegum receipt cNFT is minted or prepared
-> future agent can use receipt memory for purpose-bound dining deposits
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
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
```

Optional merchant, Telegram, Solana, and persistence config:

```bash
DATABASE_URL=postgres://user:password@host:5432/database
DATABASE_SSL=true
JIAGON_MERCHANT_ISSUER_KEY=use-a-random-demo-merchant-key
JIAGON_MERCHANT_RECEIPT_SIGNING_SECRET=use-a-random-receipt-signing-secret
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_MERCHANT_GROUP_CHAT_ID=your-staff-group-chat-id
HELIO_PAYLINK_ID=your-dev-helio-paylink-id
HELIO_NETWORK=test
MOONPAY_COMMERCE_WEBHOOK_SHARED_TOKEN=use-a-random-shared-webhook-token
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your-storefront-access-token
SHOPIFY_WEBHOOK_SECRET=your-shopify-webhook-secret
SOLANA_BUBBLEGUM_TREE=your-devnet-tree
SOLANA_BUBBLEGUM_MINTER_SECRET_KEY=never-commit-real-private-keys
```

Jiagon is testnet-only for the current demo. Server routes reject mainnet
cluster values and obvious mainnet RPC URLs.

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

## API Surface

- `POST /api/agent/orders`: lets a personal agent create a Raposa order pass,
  enforce a max-spend policy, return pickup timing, and optionally prepare an
  external Solana wallet payment request.
- `POST /api/merchant/orders`: creates an agentic merchant order.
- `GET /api/merchant/orders`: returns the merchant order queue.
- `POST /api/merchant/orders/{id}/complete`: marks an order fulfilled and
  issues a claimable verified receipt.
- `GET /api/merchant/orders/claim`: resolves a pickup code to a claim URL.
- `POST /api/telegram/webhook`: Telegram order and merchant action webhook.
- `POST /api/webhooks/moonpay`: MoonPay Commerce webhook adapter. It verifies
  `Authorization: Bearer <sharedToken>` and `X-Signature`, then turns successful
  payment events containing a Jiagon `orderId` into payment-backed receipts.
- `GET /api/agent/shopify/products`: lets an agent search Shopify Storefront
  products and variants.
- `POST /api/agent/shopify/orders`: lets an agent create a Jiagon order pass and
  Shopify checkout cart with `jiagon_order_id` attributes.
- `POST /api/webhooks/shopify/orders-paid`: verifies Shopify HMAC and turns
  paid Shopify orders into claimable Jiagon receipts.
- `GET /api/merchant/receipts/{token}`: reads a public claimable receipt.
- `POST /api/merchant/receipts/{token}/claim`: Privy-authenticated receipt
  claim.
- `POST /api/solana/merchant-receipts/mint`: mints or prepares a Solana
  Bubblegum merchant receipt credential.
- `GET /api/receipts/reviews`: returns persisted published receipt reviews.
- `POST /api/solayer/proofs`: uploads a Solana wallet-attested offchain proof
  adapter for future underwriting signals.
- `GET /api/agent/recommendations`: returns Jiagon-native recommendations.
- `POST /api/agent/rerank`: boosts external place candidates with Jiagon proof.
- `GET /api/agent/merchants/{merchantId}/trust`: returns aggregate
  receipt-backed merchant trust for agents.
- `GET /api/agent/proofs/{receiptHash}`: returns a public receipt proof by
  receipt hash.
- `GET /api/agent/credit-eligibility?owner={solanaOwner}`: returns
  purpose-bound dining credit eligibility from minted receipt credentials.
- `GET /api/account/state`: private account state; requires a Privy bearer token.

Mint routes return `status: "minted"` only after the API broadcasts and
confirms a transaction. If required chain env is missing, they return
`status: "prepared"` and never claim that an onchain receipt exists.

## Development Workflow

For proof, credential, auth, or minting changes:

- use a scoped `codex/*` branch;
- run `pnpm build`;
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
