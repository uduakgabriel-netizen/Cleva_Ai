# Cleva AI

## The AI payment assistant for cross-border subscriptions

**Pitch deck | Product demo stage**

> Cleva currently runs as a simulation: no real payment is made. Prices, FX, wallets,
> cards, and merchant authorization are demo implementations.

---

## 1. The problem

### Paying for global digital services from Nigeria is still unnecessarily hard

- Users must discover the right plan, understand a foreign-currency price, convert it
  into naira, and find a reliable way to pay.
- The final naira cost is often unclear until late in the checkout journey.
- Failed or declined attempts create uncertainty: did the wallet debit, was the card
  funded, and will the money come back?
- Existing payment flows are designed around forms and merchant-by-merchant setup,
  not the way people naturally ask for a subscription.

**The opportunity:** make “pay for [service]” a simple, reviewable, auditable action.

---

## 2. The product

### Tell Cleva what you want to pay for. Review the total. Confirm.

Cleva turns a natural-language request or merchant URL into a payment flow:

1. **Understand intent** — identify the supported merchant and plan.
2. **Resolve the catalogue** — use an authoritative plan and price.
3. **Build a transparent quote** — show USD price, FX conversion, fee, and total NGN.
4. **Get explicit approval** — compare the quote with the available wallet balance.
5. **Execute the payment flow** — debit the NGN wallet, fund a USD virtual card just
   in time, and authorize the merchant charge.
6. **Close the loop** — return a receipt, status, authorization code, and transaction history.

---

## 3. The user experience

### From a sentence to a confirmed payment

**Input**

> “Pay for Gemini Advanced”

**Review**

- Gemini Advanced — `$19.99/month`
- FX conversion — demo rate of `₦1,600/$1`
- Service fee — `₦500`
- Total payable — `₦32,484`
- Wallet balance — visible before confirmation
- Quote — valid for 10 minutes

**Outcome**

- Success or decline is clearly shown.
- A receipt ID and authorization code are available.
- The transaction appears in the dashboard and history.

---

## 4. Why the product is trustworthy

### AI interprets; the backend decides

Cleva deliberately separates conversational convenience from financial authority:

- The AI schema contains **no price or amount field**.
- Prices and plan details come from the backend catalogue.
- Merchant and plan matches are independently re-validated before an intent is created.
- Unsupported merchants are rejected instead of guessed.
- User-supplied prices are ignored in favor of catalogue values.
- If the hosted AI parser fails, Cleva falls back to deterministic parsing.

**Design principle:** natural language can suggest intent, but it cannot change the money.

---

## 5. Payment infrastructure in the demo

### A controlled flow that models the hard parts

**NGN wallet** → **FX quote** → **USD virtual card** → **merchant authorization**

The orchestrator models:

- Wallet debit in NGN
- Just-in-time card funding in USD
- Merchant authorization
- Card-funding reversal and wallet refund on decline
- Quote expiry and insufficient-balance checks
- Serializable transactions for consistency
- Idempotency keys to prevent duplicate confirmation
- Ledger entries for wallet and card movements

This gives the team a credible foundation to connect future production providers
without changing the user-facing payment model.

---

## 6. Initial wedge

### Cross-border digital subscriptions

The current catalogue demonstrates five high-frequency use cases:

| Merchant | Plan | Demo reference price |
|---|---|---:|
| Gemini | Gemini Advanced | $19.99/month |
| ChatGPT | ChatGPT Plus | $20.00/month |
| Canva | Canva Pro | $15.00/month |
| GitHub | Copilot Individual | $10.00/month |
| Coursera | Coursera Plus | $59.00/month |

These are illustrative demo prices, not live merchant pricing.

**Expansion path:** broaden the catalogue, then support additional recurring digital
services and other cross-border payment categories.

---

## 7. What exists today

### A complete, demonstrable product loop

- Authenticated user experience
- Dashboard with NGN wallet and virtual card
- Natural-language or URL-based payment request
- Deterministic parser with optional Gemma parser and fallback
- Catalogue-backed merchant resolution
- Transparent quote and balance sufficiency check
- Simulated success, decline, and insufficient-funds outcomes
- Receipt and transaction history
- API routes for intents, quotes, confirmation, wallet, transactions, catalogue,
  health, and webhooks
- Automated tests around parsing, pricing, orchestration, and endpoint behavior

**Current status:** product demo / simulation, not production payments.

---

## 8. Business model hypothesis

### Monetize the moment of successful cross-border payment

Potential revenue streams to validate:

1. **Transparent service fee** per successful payment
2. **FX margin** with clear user disclosure
3. **Subscription or membership tier** for frequent users
4. **B2B/API access** for platforms serving African users
5. **Merchant or affiliate partnerships** for digital services

The current implementation demonstrates a flat service-fee line item, but does not
claim live pricing, revenue, unit economics, or merchant partnerships.

---

## 9. Why Cleva can win

### Trust at the intersection of AI and money

- **Conversation-first:** less friction than merchant-specific forms.
- **Price integrity:** catalogue authority prevents AI-generated amounts.
- **Full transparency:** users see conversion, fee, total, expiry, and balance.
- **Operational correctness:** idempotency, ledgering, reversals, and refunds are
  modeled as first-class behaviors.
- **Provider-ready architecture:** Cleva is separated behind adapters and a payment
  orchestrator.
- **Focused wedge:** start with a small, understandable set of recurring services.

---

## 10. Roadmap

### From simulation to trusted production rails

**Phase 1 — Prove demand**

- Test the top subscription use cases with Nigerian users.
- Measure intent-to-confirm conversion, quote abandonment, and decline recovery.
- Validate fee sensitivity and repeat-payment behavior.

**Phase 2 — Productionize payments**

- Connect regulated wallet, FX, card issuing, and merchant-processing providers.
- Replace demo catalogue values with verified pricing and availability.
- Add reconciliation, dispute handling, monitoring, and operational controls.

**Phase 3 — Scale the platform**

- Recurring-payment management and renewal reminders
- More merchants, currencies, and African corridors
- Merchant discovery and payment orchestration APIs
- Risk, limits, and fraud controls based on real transaction data

---

## 11. The ask

### Help us turn a working payment experience into trusted infrastructure

We are seeking support to:

- Validate the wedge with real users
- Secure production payment and FX partnerships
- Complete compliance, risk, and reconciliation design
- Expand the supported merchant catalogue
- Turn the simulation into a reliable cross-border payments product

**Cleva AI:** the shortest path from “I need this subscription” to a transparent,
confirmed payment.

---

## Appendix: demo guardrails

- The app displays “Simulation only — no real payment was made.”
- Catalogue prices are explicitly labeled illustrative demo reference values.
- FX rate, fee, wallet, card, and processor behavior are configurable demo values.
- Any external presentation should preserve these labels until production integrations
  and pricing sources are in place.
