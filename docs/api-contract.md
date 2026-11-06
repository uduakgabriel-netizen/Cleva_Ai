# Cleva AI — API Contract

## 1. System Overview & Invariants
Cleva AI is an AI payment assistant. The user requests to pay for a subscription (e.g., "pay for Gemini Advanced" or pastes a URL).
The flow:
`parse` → `resolve against catalogue` → `quote` → `explicit confirm` → `mock wallet debit` → `mock card fund` → `mock merchant authorize` → `receipt`.
All financial transactions are strictly simulated.

### Hard Rules
1. **Integer Minor Units Only**: Money is stored and computed as integer minor units (`kobo` for NGN, `cents` for USD). Zero floats. Zero decimals.
2. **Catalogue as Price Authority**: The AI never supplies a price. The catalogue is the sole source of truth for amounts.
3. **Server-Side Identity**: No endpoint reads `userId` from client payload, query string, or headers (`body.userId`, `searchParams.userId`, `headers["x-user-id"]`). Identity is resolved server-side from session via `requireUser()`.
4. **Strict Double-Entry Ledger**: Every balance mutation writes exactly one `LedgerEntry` with the resulting `balanceAfter`.
5. **Idempotent Confirm**: Confirmation runs in a single `SERIALIZABLE` database transaction.
6. **Atomic Reversal on Authorization Decline**: A declined merchant authorization reverses virtual card funding and refunds the wallet inside the same transaction.
7. **Secret Isolation**: Secrets (`CLERK_SECRET_KEY`, `GOOGLE_AI_API_KEY`, `DATABASE_URL`, `CLERK_WEBHOOK_SECRET`) never carry `NEXT_PUBLIC_` prefix. Only `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` may be public.
8. **Mandatory Simulation Disclaimer**: Every API response that touches simulated money includes:
   `"Simulation only — no real payment was made"`
9. **Contract-Driven Development**: Any new decision must be documented here or in `docs/ai-contract.md` prior to code implementation.

---

## 2. Frozen Status Strings
- **PaymentIntent**: `AWAITING_APPROVAL` | `PROCESSING` | `SUCCEEDED` | `FAILED` | `EXPIRED`
- **Transaction**: `SUCCEEDED` | `DECLINED`
- **VirtualCard**: `ACTIVE` | `FROZEN`
- **Interval**: `MONTHLY` | `YEARLY` | `ONE_TIME`
- **LedgerEntry Type**: `WALLET_DEBIT_FX` | `CARD_FUND` | `CARD_AUTH` | `CARD_FUND_REVERSAL` | `WALLET_REFUND`

---

## 3. Frozen Error Codes & HTTP Status
- `MERCHANT_UNSUPPORTED` (422)
- `INSUFFICIENT_BALANCE` (402)
- `CARD_FROZEN` (409)
- `QUOTE_EXPIRED` (410)
- `QUOTE_MISMATCH` (400)
- `INTENT_NOT_CONFIRMABLE` (409)
- `INTENT_NOT_FOUND` (404)
- `WALLET_NOT_FOUND` (500)
- `CARD_NOT_FOUND` (500)
- `VALIDATION` (400)

---

## 4. Fixed Catalogue & Quote Parameters
- **Gemini Advanced**: `gemini` / $19.99 (1,999 cents) / `MONTHLY`
- **ChatGPT Plus**: `chatgpt` / $20.00 (2,000 cents) / `MONTHLY`
- **Canva Pro**: `canva` / $15.00 (1,500 cents) / `MONTHLY`
- **GitHub Copilot Individual**: `github` / $10.00 (1,000 cents) / `MONTHLY`
- **Coursera Plus**: `coursera` / $59.00 (5,900 cents) / `MONTHLY`

### Quote Configuration
- FX Rate: ₦1,600 / $1 (`1600`)
- Flat Fee: ₦500 per payment (`50000` kobo)
- Quote TTL: 10 minutes (`600000` ms)
- Seed Wallet: ₦100,000 (`10000000` kobo)
- Seed Card: $0 (`0` cents), `ACTIVE`, masked PAN `5399 •••• •••• 4242`

---

## 5. Endpoints Specification

### 5.1 Health Check
- `GET /api/health`
- **Auth**: Public (unauthenticated)
- **Response (200)**:
  ```json
  {
    "ok": true,
    "time": "2026-11-06T12:00:00.000Z"
  }
  ```

### 5.2 Clerk Webhook
- `POST /api/webhooks/clerk`
- **Auth**: Svix signature verified with `CLERK_WEBHOOK_SECRET`
- **Supported Events**:
  - `user.created`: Atomically provisions `User`, `Wallet` (10,000,000 kobo), and `VirtualCard` ($0, ACTIVE) in a single database transaction. Idempotent on re-delivery.
  - `user.deleted`: Soft no-op; logs event without deleting financial audit logs.
- **Response (200)**:
  ```json
  {
    "ok": true,
    "message": "User provisioned"
  }
  ```

### 5.3 User Identity & Balance Context
- `GET /api/auth/me`
- **Auth**: Session cookie via Clerk
- **Response (200)**:
  ```json
  {
    "user": {
      "id": "cuid...",
      "email": "user@example.com",
      "name": "User",
      "demoOutcome": "SUCCESS"
    },
    "wallet": {
      "currency": "NGN",
      "availableBalanceKobo": 10000000
    },
    "card": {
      "status": "ACTIVE",
      "maskedPan": "5399 •••• •••• 4242",
      "balanceCents": 0
    }
  }
  ```
- **Response (401)**:
  ```json
  {
    "error": "Unauthorized or user provisioning pending"
  }
  ```

### 5.4 Create Payment Intent
- `POST /api/payment-intents`
- **Auth**: Protected (session via Clerk, resolved server-side with `requireUser()`)
- **Request Body**:
  ```json
  {
    "inputText": "Pay for Gemini Advanced",
    "url": "https://gemini.google.com/advanced"
  }
  ```
  - `inputText`: optional string, max 500 characters, trimmed.
  - `url`: optional valid URL string, max 500 characters, trimmed.
  - Refinement: At least one of `inputText` or `url` must be non-empty.
- **Errors**:
  - `400 VALIDATION`: Missing both inputs, invalid types, or invalid URL format.
  - `401 Unauthorized`: Missing or invalid Clerk session.
  - `422 MERCHANT_UNSUPPORTED`: Merchant or URL host not found in catalogue. No intent created.
- **Success Response (200 OK)**:
  ```json
  {
    "simulation": "Simulation only — no real payment was made",
    "intent": {
      "id": "cuid...",
      "status": "AWAITING_APPROVAL",
      "merchant": "Gemini",
      "plan": "Gemini Advanced",
      "interval": "MONTHLY",
      "confidence": 0.9,
      "parsedBy": "deterministic",
      "quoteId": "cuid...",
      "display": {
        "usd": "$19.99",
        "convertedNgn": "₦31,984",
        "feeNgn": "₦500",
        "totalNgn": "₦32,484",
        "fxRate": "₦1,600 / $1",
        "expiresAt": "2026-11-06T20:55:00.000Z"
      },
      "quote": {
        "usdAmountCents": 1999,
        "fxRateNgnPerUsd": 1600,
        "convertedNgnKobo": 3198400,
        "feeNgnKobo": 50000,
        "totalNgnKobo": 3248400,
        "assumptions": "Rate fixed 1 USD = 1,600 NGN; flat fee 500 NGN; valid 10m",
        "expiresAt": "2026-11-06T20:55:00.000Z"
      },
      "walletAvailable": 10000000,
      "sufficientBalance": true
    }
  }
  ```
- **Invariants**:
  - Does NOT move money or create Ledger entries.
  - Wallet balance and Card balance remain strictly unchanged.

### 5.5 Read Payment Intent
- `GET /api/payment-intents/:id`
- **Auth**: Protected (session via Clerk, resolved server-side with `requireUser()`)
- **Errors**:
  - `401 Unauthorized`: Missing or invalid Clerk session.
  - `404 INTENT_NOT_FOUND`: Intent does not exist OR belongs to another user.
- **Success Response (200 OK)**:
  Same structure as `POST /api/payment-intents`, with optional `transaction` field if confirmed.

### 5.6 Confirm Payment Intent
- `POST /api/payment-intents/:id/confirm`
- **Auth**: Protected (session via Clerk, resolved server-side with `requireUser()`)
- **Request Body**:
  ```json
  {
    "quoteId": "cuid...",
    "idempotencyKey": "uuid-v4-or-random-string"
  }
  ```
  - `quoteId`: string, min length 1. Must match intent's active quote.
  - `idempotencyKey`: string, 8 to 128 characters.
  - *Note: `idempotencyKey` must be generated by the client (UUID) and reused only for retries of the SAME confirm attempt. It must not be reused across different payment intents.*
- **Errors**:
  - `400 VALIDATION`: Malformed body or missing/invalid fields.
  - `400 QUOTE_MISMATCH`: `quoteId` does not match the intent's quote.
  - `401 Unauthorized`: Missing or invalid Clerk session.
  - `402 INSUFFICIENT_BALANCE`: Insufficient wallet funds to complete FX debit.
  - `404 INTENT_NOT_FOUND`: Intent does not exist OR belongs to another user.
  - `409 INTENT_NOT_CONFIRMABLE`: Intent is already processed (`SUCCEEDED`, `FAILED`, `PROCESSING`).
  - `410 QUOTE_EXPIRED`: Quote TTL (10 minutes) has expired.
- **Success Response (200 OK)**:
  ```json
  {
    "simulation": "Simulation only — no real payment was made",
    "idempotentReplay": false,
    "transaction": {
      "id": "cuid...",
      "status": "SUCCEEDED",
      "receiptId": "CLV-K18J-9A2B",
      "authorizationCode": "MOCK-K18J9A2B",
      "declineReason": null,
      "usdAmountCents": 1999,
      "totalNgnKobo": 3248400,
      "display": {
        "usd": "$19.99",
        "totalNgn": "₦32,484",
        "status": "SUCCEEDED"
      }
    }
  }
  ```
- **Invariants**:
  - Executes inside a single `SERIALIZABLE` database transaction.
  - Double-click with same `idempotencyKey` returns existing transaction with `idempotentReplay: true` and zero additional balance mutations.
  - On authorization decline, card funding is reversed and wallet is refunded inside the same transaction; net balance change is zero.
