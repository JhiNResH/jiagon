# Jiagon Product-Ready Receipt Passport Spec

> Created: 2026-05-11
> Status: implementation spec
> Scope: product completeness for Colosseum Frontier submission

## Goal

Make Jiagon feel like a coherent product, not a collection of hackathon demo pages.

Current product frame:

```text
Jiagon = Receipt Passport + API layer
verified commerce receipts -> agent-readable trust -> purpose-bound dining credit
```

The app should lead with verified receipts, passport ownership, agent-readable proof, and purpose-bound credit eligibility. Agent ordering, Telegram, NFC, Shopify checkout creation, and merchant dashboards are adapters. They should not be the primary product story.

## Winning Criteria

This pass should improve:

- impactful product submission
- startup potential
- pre-seed / accelerator fit
- viable business model
- strong live demo without claiming unfinished lending or POS replacement

## Product Boundary

Jiagon is:

- user-owned receipt passport
- claimable verified receipt layer
- Bubblegum receipt credential surface
- agent-readable proof / trust / rerank API
- purpose-bound credit eligibility layer
- adapter layer for merchant dashboard, Shopify paid orders, MoonPay Commerce, NFC/QR, Telegram, and future POS systems

Jiagon is not:

- a full POS
- a Shopify or MoonPay replacement
- a generic shopping agent
- an agent shopping proxy
- a Yelp clone
- a live unrestricted lending protocol

## Primary Product Flow

The product should make this path obvious:

```text
paid or merchant-verified commerce event
-> claimable Jiagon receipt
-> user claims receipt into Passport
-> receipt is prepared or minted as Bubblegum cNFT
-> agent API can read proof / trust / credit eligibility
-> purpose-bound dining credit eligibility updates
```

## UX Requirements

### Home

Home must introduce Jiagon as a receipt passport and API layer.

Required messaging:

```text
Verified receipts for AI agents.
Receipt Passport + Agent Trust API + Purpose-bound Credit.
```

Home should present the product as:

- receipt passport
- trust/proof API
- purpose-bound credit
- proof-source adapters

Home must not lead with:

- "your agent can buy from real merchants"
- "personal agent commerce rail"
- "agent order demo"

Allowed secondary language:

> Agent ordering is one adapter that can create receipt memory, but Jiagon's core product is the verified receipt layer.

Primary navigation order:

```text
Passport
Trust API
Credit
Claim
Merchant Demo
Adapters
```

`/agent-order` may remain available, but it must be positioned as an optional adapter.

### Passport

`/passport` must feel like the main product.

It should show:

- receipt passport summary
- verified receipt count
- prepared / minted credential status
- proof level labels
- unlocked credit eligibility
- links to claim, trust API, and credit
- a clear empty state when there are no local claimed receipts

It may read locally cached receipts from `localStorage` if authenticated backend account state is not available.

It should not be only a static marketing page.

### Claim

`/claim/{token}` already handles the core flow. It should remain consistent with the new framing:

- claim receipt into Passport
- prepare or mint Bubblegum credential
- show whether credit eligibility is unlocked
- return user to Passport or Credit

### Trust API

`/trust-api` must demonstrate the AI-agent value clearly.

It should show:

```text
public rating / generic place data = weak signal
Jiagon verified receipts = stronger signal
agent decision = trust / boost / unlock review / check credit eligibility
```

The page should make the API surface obvious:

- `/api/agent/merchants/{merchantId}/trust`
- `/api/agent/proofs/{receiptHash}`
- `/api/agent/credit-eligibility?owner=...`
- `/api/agent/rerank`

It should not center `/api/agent/orders`.

### Credit

`/credit` should present credit as eligibility and policy first.

It should show:

- verified receipt memory
- eligible / not eligible state
- allowed purpose: dining deposit
- bounded recipient
- bounded amount
- proof weighting: L4/L5 stronger than L2/L3

It must not imply unrestricted cash loans or complete production lending.

### Merchant / Adapter Surfaces

`/merchant`, `/agent-order`, Telegram, NFC, Shopify, and MoonPay should be described as adapters.

They can remain in the app, but should not dominate home, passport, or API copy.

## API / Discovery Requirements

`src/lib/agentDiscovery.ts` should prioritize:

1. proof API
2. merchant trust API
3. credit eligibility API
4. rerank / recommendation API
5. adapter APIs

Ordering APIs should be documented as optional adapter paths, not the core capability.

## Documentation Requirements

README must match the new product frame:

```text
Jiagon is a Solana receipt passport and API layer for AI-agent commerce memory.
```

README should include:

- product boundary
- primary product flow
- business model
- proof model
- Colosseum Frontier positioning
- adapter list
- honest status of Bubblegum mint and credit eligibility

`docs/agentic-pos-spec.md` must be marked as future roadmap / historical context, not current main product.

## Business Model Copy

Product copy should make the business plausible:

- merchants pay for verified receipt passport / review unlock / agent visibility
- agents or partner apps pay for proof, trust, rerank, and credit eligibility API
- credit partners or Jiagon later earn from purpose-bound credit origination / servicing
- Shopify, MoonPay, and POS adapters become distribution channels

## Acceptance Checklist

- [ ] Home leads with Receipt Passport + API, not agent ordering.
- [ ] Primary nav prioritizes Passport, Trust API, Credit, Claim, Merchant Demo, Adapters.
- [ ] Passport is a usable dashboard, including an empty state and cached claimed receipts.
- [ ] Trust API page explains fakeable ratings vs verified receipts and shows core API endpoints.
- [ ] Credit page presents eligibility and policy, not open borrowing.
- [ ] Agent discovery/OpenAPI prioritizes proof/trust/credit over ordering.
- [ ] README and docs match the product boundary.
- [ ] Agent ordering remains accessible but clearly secondary.
- [ ] No copy claims arbitrary Shopify/MoonPay monitoring without merchant integration.
- [ ] No copy claims production unrestricted lending.

## Out Of Scope

- Building a new standalone demo-only receipt simulator page.
- Removing adapter APIs.
- Production underwriting model.
- Real production credit draw/repay.
- Full Shopify app install flow.
- Full MoonPay partner onboarding.
- Full POS replacement.
