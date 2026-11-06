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

### 5.3 User Identity
- `GET /api/auth/me`
- **Auth**: Protected (session via Clerk, resolved server-side with `requireUser()`)
- **Errors**:
  - `401 Unauthorized`: Missing or invalid Clerk session.
- **Success Response (200 OK)**:
  ```json
  {
    "user": {
      "id": "cuid...",
      "email": "user@example.com",
      "name": "Demo User",
      "createdAt": "2026-11-06T12:00:00.000Z"
    }
  }
  ```
- *Security Note: Never returns `clerkUserId`, `demoOutcome`, or any internal state.*

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
      "reasoning": "Matched by text alias 'gemini advanced'",
      "rawMerchant": "Pay for Gemini Advanced",
      "quoteId": "cuid...",
      "display": {
        "usd": "$19.99",
        "convertedNgn": "₦31,984",
        "feeNgn": "₦500",
        "totalNgn": "₦32,484",
        "fxRate": "₦1,600 / $1",
        "expiresAt": "2026-11-06T20:55:00.000Z",
        "walletAvailable": "₦100,000"
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
- **Formatting & Field Rules**:
  - `parsedBy: 'gemma' | 'deterministic'`: Indicates which parser produced the intent. Frontend can surface this to users (e.g. "AI interpreted your request") or hide it (both are valid).
  - All fields in `display` are pre-formatted user-facing strings. All fields in `quote` are raw integers in minor units.
  - Decimal convention: NGN amounts are formatted with thousands separators and no decimal places when whole (e.g. "₦32,484", "₦100,000", "₦500"). USD amounts are formatted to 2 decimal places (e.g. "$19.99", "$0.00").
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

### 5.7 Read Wallet & Ledger History
- `GET /api/wallet`
- **Auth**: Protected (session via Clerk, resolved server-side with `requireUser()`)
- **Errors**:
  - `401 Unauthorized`: Missing or invalid Clerk session.
- **Success Response (200 OK)**:
  ```json
  {
    "simulation": "Simulation only — no real payment was made",
    "wallet": {
      "currency": "NGN",
      "availableBalanceKobo": 10000000,
      "display": "₦100,000",
      "updatedAt": "2026-11-06T12:00:00.000Z"
    },
    "recentLedger": [
      {
        "id": "cuid...",
        "account": "WALLET",
        "type": "WALLET_DEBIT_FX",
        "currency": "NGN",
        "amount": -3248400,
        "balanceAfter": 6751600,
        "reference": "FX-cmw5...",
        "intentId": "cmw5...",
        "createdAt": "2026-11-06T12:05:00.000Z",
        "display": {
          "amount": "-₦32,484",
          "balanceAfter": "₦67,516"
        }
      }
    ]
  }
  ```
- *Returns up to the 20 most recent ledger entries, newest first.*

### 5.8 Read Virtual Card
- `GET /api/card`
- **Auth**: Protected (session via Clerk, resolved server-side with `requireUser()`)
- **Errors**:
  - `401 Unauthorized`: Missing or invalid Clerk session.
- **Success Response (200 OK)**:
  ```json
  {
    "simulation": "Simulation only — no real payment was made",
    "card": {
      "provider": "MOCK_CLEVA",
      "currency": "USD",
      "status": "ACTIVE",
      "maskedPan": "5399 •••• •••• 4242",
      "balanceCents": 0,
      "display": "$0.00"
    }
  }
  ```
- *Security Note: Never returns full PAN, CVV, expiry date, or internal provider tokens.*

### 5.9 List User Transactions
- `GET /api/transactions`
- **Auth**: Protected (session via Clerk, resolved server-side with `requireUser()`)
- **Query Parameters**:
  - `limit`: optional integer, 1 to 50 (default: 20).
  - `cursor`: optional string ID for cursor-based pagination.
- **Errors**:
  - `401 Unauthorized`: Missing or invalid Clerk session.
- **Success Response (200 OK)**:
  ```json
  {
    "simulation": "Simulation only — no real payment was made",
    "transactions": [
      {
        "id": "cuid...",
        "status": "SUCCEEDED",
        "receiptId": "CLV-MW5FT5H0-T93I",
        "usdAmountCents": 1999,
        "totalNgnKobo": 3248400,
        "authorizationCode": "MOCK-XSSIMU92",
        "declineReason": null,
        "merchantName": "Gemini",
        "planName": "Gemini Advanced",
        "createdAt": "2026-11-06T12:05:00.000Z",
        "display": {
          "usd": "$19.99",
          "totalNgn": "₦32,484"
        }
      }
    ],
    "nextCursor": null
  }
  ```

### 5.10 Read Transaction Receipt
- `GET /api/transactions/:id`
- **Auth**: Protected (session via Clerk, resolved server-side with `requireUser()`)
- **Errors**:
  - `401 Unauthorized`: Missing or invalid Clerk session.
  - `404 TRANSACTION_NOT_FOUND`: Transaction does not exist OR belongs to another user (prevents cross-user ID enumeration).
- **Success Response (200 OK)**:
  ```json
  {
    "simulation": "Simulation only — no real payment was made",
    "transaction": {
      "id": "cuid...",
      "status": "SUCCEEDED",
      "receiptId": "CLV-MW5FT5H0-T93I",
      "authorizationCode": "MOCK-XSSIMU92",
      "declineReason": null,
      "usdAmountCents": 1999,
      "totalNgnKobo": 3248400,
      "merchant": {
        "name": "Gemini",
        "slug": "gemini"
      },
      "plan": {
        "name": "Gemini Advanced",
        "interval": "MONTHLY"
      },
      "quote": {
        "usdAmountCents": 1999,
        "fxRateNgnPerUsd": 1600,
        "convertedNgnKobo": 3198400,
        "feeNgnKobo": 50000,
        "totalNgnKobo": 3248400,
        "assumptions": "Illustrative demo FX rate ₦1600/$1 and flat ₦500 service fee. Quote valid 10 minutes."
      },
      "createdAt": "2026-11-06T12:05:00.000Z",
      "display": {
        "usd": "$19.99",
        "convertedNgn": "₦31,984",
        "feeNgn": "₦500",
        "totalNgn": "₦32,484",
        "fxRate": "₦1,600 / $1"
      }
    }
  }
  ```

### 5.11 Public Merchant Catalogue
- `GET /api/catalogue`
- **Auth**: Public (unauthenticated, accessible pre-login for plan picker)
- **Success Response (200 OK)**:
  ```json
  {
    "merchants": [
      {
        "slug": "gemini",
        "name": "Gemini",
        "plans": [
          {
            "planId": "gemini-advanced",
            "planName": "Gemini Advanced",
            "usdAmountCents": 1999,
            "interval": "MONTHLY",
            "display": {
              "usd": "$19.99",
              "billing": "$19.99 / month"
            }
          }
        ]
      }
    ],
    "simulation": "Catalogue prices are demo reference values, not live merchant prices."
  }
  ```

### 5.12 Demo Controls (Outcome Override)
- `PATCH /api/demo/controls`
- **Auth**: Protected (session via Clerk, resolved server-side with `requireUser()`)
- **Guard**: Gated by `process.env.DEMO_MODE === "true"`. Returns `404` when disabled.
- **Request Body**:
  ```json
  {
    "demoOutcome": "DECLINE"
  }
  ```
  - `demoOutcome`: `"SUCCESS"` | `"DECLINE"` | `"INSUFFICIENT_FUNDS"`.
- **Success Response (200 OK)**:
  ```json
  {
    "user": {
      "id": "cuid...",
      "demoOutcome": "DECLINE"
    }
  }
  ```
- *Allows the demo presenter to simulate authorization failures and insufficient funds without altering ledger balances.*

### 5.13 Demo Reset
- `POST /api/demo/reset`
- **Auth**: Protected (session via Clerk, resolved server-side with `requireUser()`)
- **Guard**: Gated by `process.env.DEMO_MODE === "true"`. Returns `404` when disabled.
- **Design Decision**: Option 2 (clears demo transaction, quote, intent, and ledger history for this user, then resets wallet to ₦100,000, card to $0, and demoOutcome to "SUCCESS").
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "walletDisplay": "₦100,000",
    "cardDisplay": "$0.00"
  }
  ```
- *Reconciliation is strictly guaranteed to pass after reset (wallet = 10,000,000 kobo, card = $0, ledger rows = 0).*
