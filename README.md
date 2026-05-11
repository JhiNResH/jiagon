# Jiagon

Jiagon is a Solana receipt passport and API layer for AI-agent commerce memory.

Jiagon turns AI-agent purchase activity into verified receipt memory: a merchant
fulfills an order, the user claims the receipt into a passport, and the receipt
can become a Solana Bubblegum credential for future agent reasoning and
purpose-bound credit experiments.

Live app: [jiagon.vercel.app](https://jiagon.vercel.app)

## Product Boundary

Jiagon is not a POS replacement, payment processor, or production lending
platform. It sits beside merchant operations and records receipt proof that
agents can read later.

In scope for the current product:

- agent-readable receipt passport and proof APIs;
- merchant-issued, claimable receipts;
- NFC / pickup-code receipt claim flow;
- optional Bubblegum receipt credential minting on Solana devnet;
- optional adapters for ordering, checkout creation, payment-backed receipts,
  and offchain proof uploads.

Out of scope for the current product:

- arbitrary Shopify, MoonPay, or merchant monitoring without merchant
  integration;
- production unrestricted lending or open-ended cash borrowing;
- inventory, tax, tips, refunds, kitchen display, printers, tables, or a full
  POS workflow;
- mainnet receipt minting in the default demo.

## Primary Product Flow

```txt
AI agent or merchant creates purchase context
-> Merchant queue receives order
-> Merchant fulfills the order or payment adapter confirms a paid order
-> Jiagon issues verified receipt
-> NFC / pickup-code claim binds receipt to passport identity
-> Bubblegum receipt credential is minted or prepared
-> Receipt becomes Solana-readable commerce memory
-> Future agent can check trust, proof, or purpose-bound credit eligibility
```

Primary app surfaces:

- **Passport**: verified purchase memory for future agents.
- **Trust API**: agent-readable merchant trust, receipt proof, review, and
  credit-eligibility endpoints.
- **Merchant**: order queue, fulfillment, receipt issuing, demo readiness, pilot
  metrics, and credit memo.
- **Tile**: NFC pickup station and manual fallback, e.g. `/tile/raposa-coffee`.
- **Credit**: purpose-bound dining deposit eligibility and devnet route
  readiness, with current product caveats.
- **Mobile**: Android receipt passport with Privy Expo auth, Solana Mobile
  Wallet Adapter, and Bubblegum mint wiring.

Optional adapter paths:

- **Agent ordering**: `/api/agent/orders` can create a Raposa order pass and
  prepare an external wallet approval request.
- **Shopify checkout creation**: Shopify product search and cart creation can
  attach `jiagon_order_id` so a paid-order webhook can issue a receipt.
- **MoonPay Commerce webhook**: merchant-configured payment events can create
  payment-backed claimable receipts.
- **Solayer/offchain proof upload**: wallet-attested proof signals can be added
  for future underwriting experiments.

## Two-Agent Handoff

Jiagon can connect an Order Agent and a Take-Order Agent without splitting the
product into another repo or becoming a POS.

```txt
Personal Order Agent
-> captures user intent, policy, max spend, and payment preference
-> calls a Jiagon adapter such as /api/agent/orders or /api/agent/shopify/orders
-> Merchant Take-Order Agent receives the order pass, checkout, or payment event
-> merchant fulfillment or verified payment issues a claimable Jiagon receipt
-> user claims the receipt into Passport
-> proof, trust, rerank, and credit APIs read the receipt memory later
```

The durable Jiagon object is the receipt passport entry. The Order Agent and
Take-Order Agent are adapter roles that create or confirm commerce events; they
do not replace merchant checkout, payments, inventory, tax, refunds, or staff
operations.

## Current MVP

- Web app: Next.js App Router.
- Mobile app: Expo Android under `apps/mobile`.
- Auth: Privy on web and Privy Expo on mobile.
- Order entry: optional agent-ordering adapter, with Telegram bot and
  `/tile/{merchant}` as pilot terminals.
- Pilot merchant: Raposa Coffee.
- Receipt pickup: static NFC station plus pickup code.
- Receipt credential: Solana Bubblegum cNFT when Bubblegum env is configured;
  otherwise the API returns `prepared`.
- Credit state: receipt-memory-backed, purpose-bound credit eligibility and
  devnet draw-route readiness preview.
- Persistence: Postgres when `DATABASE_URL` is configured; local demo memory
  fallback for development.
- Private receipt state: `/api/account/state` behind Privy token verification.

Status labels matter:

- `issued`: merchant has created a claimable receipt.
- `claimed`: receipt was bound to a passport identity.
- `prepared`: Bubblegum credential payload/hash is ready, but no Solana
  transaction was confirmed.
- `minted`: a real Solana Bubblegum receipt cNFT was minted.

## Business Model

Jiagon can charge for the API layer around receipt memory rather than trying to
own the merchant POS:

- merchant pilot setup and monthly receipt-passport tooling;
- per-receipt API usage for agent-readable trust and proof checks;
- adapter fees for merchant-approved payment, checkout, and proof integrations;
- future underwriting or credit-decision tooling for purpose-bound commerce
  partners, after stronger payment proof and repayment history exist.

## Proof Model

Jiagon separates facts from claims so agents can reason safely.

| Layer | MVP proof | Caveat |
| --- | --- | --- |
| Order intent | Agent, Telegram, or tile order | Intent alone is not a receipt |
| Payment request | Solana Pay / Helio external wallet approval | Solana Pay devnet SPL transfers can be verified; Helio still needs webhook proof |
| Merchant completion | Staff marks fulfilled | Manual merchant attestation in the MVP |
| Passport claim | Privy-authenticated claim | Identity binding is separate from payment |
| Receipt credential | Solana Bubblegum cNFT or prepared payload | Live mint requires Bubblegum tree and minter env |
| Credit memory | Receipt-indexed eligibility preview | Not production unrestricted lending |

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

## Colosseum Frontier Positioning

For Colosseum Frontier, Jiagon is best framed as receipt memory infrastructure
for AI-agent commerce on Solana: agents can ask for trust, proof, and eligibility
from a user's verified purchase history instead of relying on screenshots or
unstructured chat memory. The Frontier wedge is the receipt passport and API
layer; ordering and checkout adapters are demo paths that feed the passport.

## Agent-Readable APIs

Discovery:

```txt
GET /.well-known/jiagon-agent.json
GET /.well-known/ai-plugin.json
GET /api/agent
GET /openapi.json
```

Optional agent ordering setup:

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

Create a merchant order through the optional agent-ordering adapter:

```txt
POST /api/agent/orders
```

The request can be as loose as "I want a coffee" or structured with menu items.
This is an adapter path that creates receipt context for the passport; it is not
the core product boundary. The response returns the agent's commerce handoff:
pickup result, order pass, pickup code, pickup estimate, merchant dispatch
status, receipt-memory path, and optional external Solana wallet payment
request. Supported demo payment modes are `crypto_pay` and `pay_at_counter`.
Legacy `helio_pay` and `solana_pay` aliases are accepted as `crypto_pay`.

Browser demo:

```txt
GET /agent-order
```

Use this page to simulate a personal agent call, then open the returned external
wallet approval request. Jiagon prefers Helio Solana checkout when
`HELIO_PAYLINK_ID` is configured, with official Solana Pay transfer URLs as the
fallback.

Solana Pay receipt upgrade:

```txt
POST /api/agent/orders/{id}/verify-solana-pay
```

When `JIAGON_SOLANA_PAY_RECIPIENT`, `JIAGON_SOLANA_PAY_SPL_TOKEN`,
`JIAGON_SOLANA_PAY_VERIFY_SECRET`, `SOLANA_CLUSTER=devnet`, and the default
devnet `SOLANA_RPC_URL` are configured, order creation returns a private
`payment.verifyToken` to the creating agent/user. Send that token as
`verifyToken`, `Authorization: Bearer <token>`, or
`x-jiagon-solana-pay-verify-token` when calling the verify route. The route
checks the deterministic Solana Pay reference, recipient, SPL token, memo, and
exact order subtotal before issuing the claimable receipt. SOL-only intents
remain nominal demo payments and return a setup response instead of a USD
receipt. Custom testnet RPCs require
`JIAGON_ALLOWED_TESTNET_RPC_ORIGINS` with a comma-separated origin or full URL
match for this deployment; mainnet cluster/RPC remains blocked.

Recommendation from Jiagon's proof graph:

```txt
GET /api/agent/recommendations?query=coffee%20irvine&limit=3
```

Rerank a candidate set from Google Places, Maps, or another place graph:

```bash
curl -X POST https://jiagon.vercel.app/api/agent/rerank \
  -H "content-type: application/json" \
  -d '{
    "query": "coffee irvine",
    "candidates": [
      {
        "provider": "google",
        "name": "Raposa Coffee",
        "branch": "Irvine",
        "category": "Cafe",
        "rating": 4.6,
        "openNow": true
      }
    ]
  }'
```

Direct agent-readable trust and proof checks:

```txt
GET /api/agent/merchants/raposa-coffee/trust
GET /api/agent/proofs/{receiptHash}
GET /api/agent/credit-eligibility?owner={validSolanaOwner}
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

## Adapter List

Core receipt passport and proof APIs:

- `GET /api/agent/merchants/{merchantId}/trust`
- `GET /api/agent/proofs/{receiptHash}`
- `GET /api/agent/credit-eligibility?owner={validSolanaOwner}`
- `GET /api/receipts/reviews?limit=20`
- `GET /api/account/state`
- `POST /api/solana/merchant-receipts/mint`

Optional order and checkout adapters:

- `POST /api/agent/orders`
- `GET /api/agent/shopify/products`
- `POST /api/agent/shopify/orders`
- `POST /api/webhooks/shopify/orders-paid`
- `POST /api/webhooks/moonpay`
- `POST /api/solayer/proofs`

Payment-backed receipt adapters:

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

These adapters require merchant configuration. They are not arbitrary Shopify or
MoonPay monitoring, and they are not the core product; they are proof-source
connectors that feed the receipt passport.

Shopify checkout adapter:

```txt
GET /api/agent/shopify/products?query=beanie
POST /api/agent/shopify/orders
```

The Shopify endpoints are optional merchant-integration paths. They let an agent
search Shopify products, enforce a max-spend policy, create a Jiagon order pass,
create a Shopify cart, and attach `jiagon_order_id` to the cart so the
merchant-configured paid-order webhook can issue the receipt.

## Demo Flow

```txt
User tells personal agent: get me a coffee under $10
-> Personal Order Agent calls /api/agent/orders
-> Jiagon creates a receipt-context order pass and prepares external wallet approval
-> Jiagon returns pickup location, pickup code, ETA, and optional Solana payment request
-> Merchant Take-Order Agent receives the pass in Telegram or /merchant
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
JIAGON_SOLANA_PAY_RECIPIENT=devnet-recipient-public-key
JIAGON_SOLANA_PAY_SPL_TOKEN=devnet-usdc-or-demo-stable-token-mint
MOONPAY_COMMERCE_WEBHOOK_SHARED_TOKEN=use-a-random-shared-webhook-token
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your-storefront-access-token
SHOPIFY_WEBHOOK_SECRET=your-shopify-webhook-secret
SOLANA_BUBBLEGUM_TREE=your-devnet-tree
SOLANA_BUBBLEGUM_MINTER_SECRET_KEY=never-commit-real-private-keys
```

Jiagon is testnet-only for the current demo. Server routes reject mainnet
cluster values and mainnet RPC URLs. Custom testnet RPCs must match a
comma-separated origin or full URL in `JIAGON_ALLOWED_TESTNET_RPC_ORIGINS`;
the default devnet/testnet/localnet RPC URLs are allowed without extra config.

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

- `POST /api/agent/orders`: optional adapter that lets an agent create a Raposa
  order pass, enforce a max-spend policy, return pickup timing, and optionally
  prepare an external Solana wallet payment request. This is the Personal Order
  Agent side of the handoff, not the core proof API.
- `POST /api/merchant/orders`: optional adapter that creates a merchant order
  record for receipt issuance.
- `GET /api/merchant/orders`: returns the merchant order queue.
- `POST /api/merchant/orders/{id}/action`: Merchant Take-Order Agent action
  surface for `accept`, `preparing`, `paid_done`, `reject`, or `cancel`.
  `paid_done` issues the claimable Jiagon receipt.
- `POST /api/merchant/orders/{id}/complete`: marks an order fulfilled and
  issues a claimable verified receipt.
- `GET /api/merchant/orders/claim`: resolves a pickup code to a claim URL.
- `POST /api/telegram/webhook`: Telegram order and merchant action webhook.
- `POST /api/webhooks/moonpay`: optional MoonPay Commerce webhook adapter. It verifies
  `Authorization: Bearer <sharedToken>` and `X-Signature`, then turns successful
  merchant-configured payment events containing a Jiagon `orderId` into
  payment-backed receipts. This is a Merchant Take-Order Agent proof-source
  connector.
- `GET /api/agent/shopify/products`: optional adapter that lets an agent search
  merchant-configured Shopify Storefront products and variants.
- `POST /api/agent/shopify/orders`: optional adapter that lets an agent create a
  Jiagon order pass and Shopify checkout cart with `jiagon_order_id` attributes.
- `POST /api/webhooks/shopify/orders-paid`: optional adapter that verifies
  Shopify HMAC and turns merchant-configured paid Shopify orders into claimable
  Jiagon receipts. Shopify stays the checkout system; Jiagon stores receipt
  memory after merchant-approved payment proof.
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
- `GET /api/agent/credit-eligibility?owner={validSolanaOwner}`: returns
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
