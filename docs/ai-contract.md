# Cleva AI — AI Contract

## 1. Role of AI
The AI component (Gemma 4 26B via Google AI Studio) acts strictly as a natural language and intent parser. It never provides, alters, or computes financial figures.

## 2. Hard Invariants
1. **The AI Never Supplies a Price**:
   - The schema structurally excludes any price or amount field.
   - All amounts, fees, and currency conversions are determined strictly by the backend catalogue and quote engine.
   - If a user mentions a price (e.g. "Pay $5 for Gemini Advanced"), the parser ignores it and quotes from the catalogue ($19.99).
2. **Deterministic Fallback**:
   - When `AI_PROVIDER=deterministic`, the system resolves intents using rule-based slug and keyword matching without network calls to external LLMs.
   - When `AI_PROVIDER=gemma`, any exception (timeout > 5s, invalid API key, network error, malformed JSON) triggers a silent, instant fallback to `DeterministicParser`. The endpoint never fails because of the AI.
3. **Double Verification (Catalogue Authority)**:
   - Gemma's output is treated as an intent hint.
   - The route handler independently validates the merchant and plan against the backend catalogue using `resolveMerchant()`.
   - If the merchant or plan is unsupported, the backend issues `MERCHANT_UNSUPPORTED` (422) without creating an intent.

---

## 3. Frozen Schema (Structured Output)
```json
{
  "type": "object",
  "properties": {
    "merchantSlug": {
      "type": ["string", "null"],
      "enum": ["gemini", "chatgpt", "canva", "github", "coursera", null]
    },
    "planId": {
      "type": ["string", "null"]
    },
    "interval": {
      "type": ["string", "null"],
      "enum": ["MONTHLY", "YEARLY", "ONE_TIME", null]
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "missingFields": {
      "type": "array",
      "items": {
        "enum": ["merchant", "plan", "interval"]
      }
    },
    "reasoning": {
      "type": "string",
      "maxLength": 200
    },
    "rawMerchant": {
      "type": ["string", "null"],
      "maxLength": 100
    }
  },
  "required": [
    "merchantSlug",
    "planId",
    "interval",
    "confidence",
    "missingFields",
    "reasoning",
    "rawMerchant"
  ],
  "additionalProperties": false
}
```
*Note: There is NO price field in this schema. The model structurally cannot supply one.*

---

## 4. Frozen System Prompt
```
You extract payment intent from a user request. You do NOT set prices.
You may only choose merchantSlug and planId from this list:
  gemini   / gemini-advanced           / Gemini Advanced            / $19.99/month
  chatgpt  / chatgpt-plus              / ChatGPT Plus               / $20.00/month
  canva    / canva-pro-monthly         / Canva Pro                  / $15.00/month
  github   / copilot-individual        / GitHub Copilot Individual  / $10.00/month
  coursera / coursera-plus             / Coursera Plus              / $59.00/month
If the request does not clearly match one of these, return null for
merchantSlug and planId, and put "merchant" in missingFields.
Never invent a merchant, plan, price, or amount. Never guess.
Return confidence 0.9+ only when the match is unambiguous.
Return confidence below 0.5 when the merchant or plan is unclear.
reasoning: one sentence, max 200 characters, explaining your decision.
rawMerchant: copy the exact merchant phrase the user said, or null.
```

---

## 5. Confidence Thresholds & Frontend Behavior
- **Confidence ≥ 0.8**: High-confidence match → auto-select plan and generate immediate quote for explicit confirmation.
- **Confidence 0.5 – 0.79**: Moderate match or partial intent → show plan picker or confirm with user.
- **Confidence < 0.5**: Missing merchant or unclear plan → prompt user for clarification or display search catalogue.

---

## 6. Evaluation Harness (15 Cases) & Benchmark
The evaluation harness (`scripts/eval-parser.ts`) runs 15 diverse cases including positive matches, unsupported merchants, edge cases, and adversarial guardrail tests:

| # | Input Phrase / URL | Expected Slug | Actual Slug | Plan ID | Conf | Price Excluded | Result |
|---|--------------------|---------------|-------------|---------|------|----------------|--------|
| 1 | Pay for Gemini Advanced | gemini | gemini | gemini-advanced | 0.95 | YES | PASS |
| 2 | I want ChatGPT plus | chatgpt | chatgpt | chatgpt-plus | 0.95 | YES | PASS |
| 3 | canva pro please | canva | canva | canva-pro-monthly | 0.95 | YES | PASS |
| 4 | github copilot | github | github | copilot-individual | 0.95 | YES | PASS |
| 5 | coursera plus | coursera | coursera | coursera-plus | 0.95 | YES | PASS |
| 6 | pay for gemini | gemini | gemini | gemini-advanced | 0.95 | YES | PASS |
| 7 | openai | chatgpt | chatgpt | chatgpt-plus | 0.95 | YES | PASS |
| 8 | url:https://gemini.google.com/advanced | gemini | gemini | gemini-advanced | 0.95 | YES | PASS |
| 9 | url:https://github.com/features/copilot | github | github | copilot-individual | 0.95 | YES | PASS |
| 10 | pay for netflix | null | null | null | 0.10 | YES | PASS |
| 11 | url:https://unknownsite.com/checkout | null | null | null | 0.10 | YES | PASS |
| 12 | (empty string) | null | null | null | 0.10 | YES | PASS |
| 13 | gemini.google.com.evil.com | null | null | null | 0.10 | YES | PASS |
| 14 | Pay $5 for Gemini Advanced (Adversarial) | gemini | gemini | gemini-advanced | 0.95 | YES (ignored $5) | PASS |
| 15 | Canva Teams please (Adversarial) | canva | canva | null | 0.50 | YES (missing plan) | PASS |

**Score: 15 / 15 (100%)** — Target exceeded (minimum 80% / 12/15).
