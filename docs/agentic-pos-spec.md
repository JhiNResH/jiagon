# Jiagon Agentic POS Spec

## Product Shape

Jiagon Agentic POS is the order-intake layer for real-world commerce. Jiagon remains the receipt passport and credit layer.

```text
Telegram / NFC / QR order entry
-> merchant order queue
-> merchant fulfillment
-> claimable Jiagon receipt
-> onchain receipt credential
-> credit passport update
-> purpose-bound credit
```

The goal is not to replace Square, Toast, or a full POS. The MVP proves that an agent-mediated order can become a merchant-issued, customer-claimed receipt that feeds Jiagon reputation and credit.

## Product Boundary

In scope:

- Customer order intent from Telegram-ready web/NFC entry.
- Merchant-facing order queue.
- Merchant completion creates a claimable receipt.
- Claimed receipt can be minted and used for credit unlock.

Out of scope for the first pass:

- Real payment processing.
- Inventory management.
- Tax, tips, refunds, tables, kitchen display, printer integrations.
- Full Telegram bot runtime. The API should be Telegram-ready, but the first client can be `/tile/{merchant}`.

## Proof Ladder

Jiagon should preserve proof levels:

```text
L0 order_intent_only          customer or agent requested an order
L1 merchant_accepted          merchant accepted the order
L2 merchant_completed         merchant marked fulfilled
L3 customer_claimed           customer claimed by QR / NFC / Telegram
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
- NFC stays the fixed order-entry surface. QR/claim link is the per-receipt fallback because each completed order has a unique claim token.

### PR 4: Telegram Entry

- Add Telegram webhook or bot command integration.
- Telegram creates the same order payload as `/tile/{merchant}`.
- Bot returns order status and final claim link.

### PR 5: Credit Connection Polish

- Passport shows order source and proof level.
- Credit page distinguishes order-intent, merchant-completed, customer-claimed, and payment-backed receipts.

## Demo Flow

```text
User taps NFC sticker or scans QR
-> /tile/consensus-cafe opens
-> user chooses item and submits order
-> merchant dashboard sees pending order
-> merchant completes order
-> Jiagon issues claimable receipt
-> user claims receipt with Privy
-> Passport shows merchant receipt
-> Bubblegum receipt cNFT can be minted
-> Credit unlock / draw / repay flow works
```

NFC is only the physical entrypoint. The backend primitive is order intent plus merchant-issued receipt.
