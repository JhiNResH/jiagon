# Jiagon Agentic POS Spec

## Product Shape

Jiagon Agentic POS is the order-intake layer for real-world commerce. Jiagon remains the receipt passport and credit layer.

```text
Telegram agentic order entry
-> merchant order queue
-> merchant fulfillment
-> NFC / QR receipt claim
-> Jiagon receipt passport
-> onchain receipt credential
-> credit passport update
-> purpose-bound credit
```

The goal is not to replace Square, Toast, or a full POS. The MVP proves that an agent-mediated order can become a merchant-issued, customer-claimed receipt that feeds Jiagon reputation and credit.

## Product Boundary

In scope:

- Customer order intent from Telegram.
- Merchant-facing order queue.
- Merchant completion creates a claimable receipt.
- NFC/QR receipt claim after fulfillment.
- Claimed receipt can be minted and used for credit unlock.

Out of scope for the first pass:

- Real payment processing.
- Inventory management.
- Tax, tips, refunds, tables, kitchen display, printer integrations.
- Payment settlement inside Telegram.

## Proof Ladder

Jiagon should preserve proof levels:

```text
L0 order_intent_only          customer or agent requested an order
L1 merchant_accepted          merchant accepted the order
L2 merchant_completed         merchant marked fulfilled
L3 customer_claimed           customer claimed by NFC / QR with Privy
L4 payment_backed             Stripe / card / USDC payment verified
L5 payment_fulfillment_claim  payment + fulfillment + customer claim
```

Early event pilots can use L2/L3. Credit scoring should weight L4/L5 higher when payment proof is available.

## MVP Sequence

### PR 1: Order Intake Core

- Add `POST /api/merchant/orders`.
- Add `GET /api/merchant/orders?merchantId=...` for queue consumers.
- Add durable merchant order store with database persistence and local memory fallback.
- Update `/tile/{merchant}` into a customer order page.
- Store source as `tile` now; later `telegram` can use the same API.

### PR 2: Merchant Queue

- Show pending orders inside `/merchant`.
- Add status actions: accept, complete, cancel.

### PR 3: Complete Order -> Claimable Receipt

- Add `POST /api/merchant/orders/{id}/complete`.
- Completion calls existing merchant receipt issuer.
- Merchant dashboard receives a claim URL and locally generated QR code.
- NFC is the receipt pickup surface: the physical card/sticker points customers to the current claim flow at the counter, while QR/claim link remains the per-receipt fallback because each completed order has a unique claim token.

### PR 4: Telegram Entry

- Add `POST /api/telegram/webhook` for Telegram bot command integration.
- Telegram creates the same order payload as `/tile/{merchant}`.
- Bot returns order status and tells the customer to claim the receipt by NFC/QR after pickup.

### PR 5: Credit Connection Polish

- Passport shows order source and proof level.
- Credit page distinguishes order-intent, merchant-completed, customer-claimed, and payment-backed receipts.

## Demo Flow

```text
User opens Telegram bot
-> /menu raposa-coffee
-> /order raposa-coffee espresso 1
-> merchant dashboard sees pending order
-> merchant completes order
-> Jiagon issues claimable receipt
-> user taps NFC receipt card or scans QR at pickup
-> user claims receipt with Privy
-> Passport shows merchant receipt
-> Bubblegum receipt cNFT can be minted
-> Credit unlock / draw / repay flow works
```

Telegram is the order surface. NFC is the physical receipt-claim surface. The backend primitive is order intent plus merchant-issued receipt.
