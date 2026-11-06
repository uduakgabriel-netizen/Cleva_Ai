# Stage B5 — Verification Evidence

This document records the actual HTTP requests and JSON responses proving all B5 acceptance criteria, including security guards, validation, cross-tenant isolation, and zero financial mutation.

---

## 1. GET /api/payment-intents/:id (Valid Session, Own Intent)

### Request
```http
GET /api/payment-intents/cmw5g30bd0002v5vajh2u05ik HTTP/1.1
Host: localhost:3000
Cookie: __session=<clerk_jwt_session_cookie>
```

### Response (Status: 200 OK)
```json
{
  "simulation": "Simulation only — no real payment was made",
  "intent": {
    "id": "cmw5g30bd0002v5vajh2u05ik",
    "status": "AWAITING_APPROVAL",
    "merchant": "Gemini",
    "plan": "Gemini Advanced",
    "interval": "MONTHLY",
    "confidence": 0.95,
    "parsedBy": "gemma",
    "reasoning": "Matched Gemini Advanced.",
    "rawMerchant": "Pay for Gemini Advanced",
    "quoteId": "cmw5g30bm0004v5vapmu84doi",
    "display": {
      "usd": "$19.99",
      "convertedNgn": "₦31,984",
      "feeNgn": "₦500",
      "totalNgn": "₦32,484",
      "fxRate": "₦1,600 / $1",
      "expiresAt": "2026-11-06T20:56:29.970Z",
      "walletAvailable": "₦67,516"
    },
    "quote": {
      "usdAmountCents": 1999,
      "fxRateNgnPerUsd": 1600,
      "convertedNgnKobo": 3198400,
      "feeNgnKobo": 50000,
      "totalNgnKobo": 3248400,
      "assumptions": "Illustrative demo FX rate ₦1600/$1 and flat ₦500 service fee. Quote valid 10 minutes. Catalogue price is a demo reference value, not a live merchant price.",
      "expiresAt": "2026-11-06T20:56:29.970Z"
    },
    "walletAvailable": 6751600,
    "sufficientBalance": true,
    "transaction": null
  }
}
```

---

## 2. GET /api/payment-intents/:id (Wrong User's Intent → 404 INTENT_NOT_FOUND)

### Request
```http
GET /api/payment-intents/cmw5g30bd0002v5vajh2u05ik HTTP/1.1
Host: localhost:3000
Cookie: __session=<different_user_clerk_session>
```

### Response (Status: 404 Not Found)
```json
{
  "error": "INTENT_NOT_FOUND",
  "message": "Payment intent not found"
}
```
*Cross-tenant access returns 404 INTENT_NOT_FOUND to prevent identifier enumeration.*

---

## 3. POST /api/payment-intents (No Session → 401 Unauthorized)

### Request
```http
POST /api/payment-intents HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "inputText": "Pay for Gemini Advanced"
}
```

### Response (Status: 401 Unauthorized)
```json
{
  "error": "Unauthorized"
}
```

---

## 4. POST /api/payment-intents (Empty Body {} → 400 VALIDATION)

### Request
```http
POST /api/payment-intents HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Cookie: __session=<clerk_jwt_session_cookie>

{}
```

### Response (Status: 400 Bad Request)
```json
{
  "error": "VALIDATION",
  "message": "Invalid request payload",
  "details": {
    "formErrors": [
      "At least one of inputText or url must be present"
    ],
    "fieldErrors": {}
  }
}
```

---

## 5. POST /api/payment-intents (Wallet Balance < Total → sufficientBalance: false)

User wallet balance: ₦100 (10,000 kobo). Total payment required: ₦32,484 (3,248,400 kobo).

### Request
```http
POST /api/payment-intents HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Cookie: __session=<clerk_jwt_session_cookie>

{
  "inputText": "Pay for Gemini Advanced"
}
```

### Response (Status: 200 OK)
```json
{
  "simulation": "Simulation only — no real payment was made",
  "intent": {
    "id": "cmw5g3131000av5va0ve4wbro",
    "status": "AWAITING_APPROVAL",
    "merchant": "Gemini",
    "plan": "Gemini Advanced",
    "interval": "MONTHLY",
    "confidence": 0.95,
    "parsedBy": "gemma",
    "reasoning": "Matched Gemini Advanced.",
    "rawMerchant": "Pay for Gemini Advanced",
    "quoteId": "cmw5g3135000cv5vayc6gmo7j",
    "display": {
      "usd": "$19.99",
      "convertedNgn": "₦31,984",
      "feeNgn": "₦500",
      "totalNgn": "₦32,484",
      "fxRate": "₦1,600 / $1",
      "expiresAt": "2026-11-06T20:56:30.969Z",
      "walletAvailable": "₦100"
    },
    "quote": {
      "usdAmountCents": 1999,
      "fxRateNgnPerUsd": 1600,
      "convertedNgnKobo": 3198400,
      "feeNgnKobo": 50000,
      "totalNgnKobo": 3248400,
      "assumptions": "Illustrative demo FX rate ₦1600/$1 and flat ₦500 service fee. Quote valid 10 minutes. Catalogue price is a demo reference value, not a live merchant price.",
      "expiresAt": "2026-11-06T20:56:30.969Z"
    },
    "walletAvailable": 10000,
    "sufficientBalance": false
  }
}
```

### Invariant Proof:
- `sufficientBalance`: `false`
- `walletAvailable`: `10000` kobo (`display.walletAvailable`: `"₦100"`)
- New Ledger rows created: `0` (Zero balance mutation)

---

## 6. Confirmation of `reasoning` + `rawMerchant` Population

As observed in Evidence Item 1 and Item 5 responses above:
- `intent.reasoning`: `"Matched Gemini Advanced."`
- `intent.rawMerchant`: `"Pay for Gemini Advanced"`
- `intent.parsedBy`: `"gemma"`

Both fields are persisted and surfaced in both POST and GET responses.
