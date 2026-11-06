# Cleva AI — AI Contract

## 1. Role of AI
The AI component (Gemma 4 26B via Google AI Studio) acts strictly as a natural language and intent parser.

## 2. Hard Invariants
1. **The AI Never Supplies a Price**:
   - The AI must NEVER extract, invent, estimate, or output a price.
   - All amounts, fees, and currency conversions are determined strictly by the backend catalogue and quote engine.
2. **Deterministic Fallback**:
   - When `AI_PROVIDER=deterministic`, the system resolves intents using rule-based slug and keyword matching without network calls to external LLMs.
3. **Structured Intent Extraction**:
   The AI parses user input (natural text or URL) into:
   - `merchantSlug`: String matching supported merchants or null
   - `confidence`: Float between 0.0 and 1.0
   - `rawPlan`: Plan name or interval detected if any
4. **Catalogue Authority**:
   - If the merchant slug is unsupported, the backend issues `MERCHANT_UNSUPPORTED` (422).
   - If confidence is below threshold, the backend requests clarification.
