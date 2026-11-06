import { GemmaParser } from "../lib/ai/gemma-parser";
import { DeterministicParser } from "../lib/ai/deterministic-parser";
import { FallbackParser } from "../lib/ai/fallback-parser";

interface TestCase {
  id: number;
  input: { text?: string; url?: string };
  expectedSlug: string | null;
  expectedPlanId: string | null;
  minConfidence?: number;
  maxConfidence?: number;
  expectedMissing?: string[];
}

const EVAL_CASES: TestCase[] = [
  // Positive matches (1-9)
  {
    id: 1,
    input: { text: "Pay for Gemini Advanced" },
    expectedSlug: "gemini",
    expectedPlanId: "gemini-advanced",
    minConfidence: 0.7,
  },
  {
    id: 2,
    input: { text: "I want ChatGPT plus" },
    expectedSlug: "chatgpt",
    expectedPlanId: "chatgpt-plus",
    minConfidence: 0.7,
  },
  {
    id: 3,
    input: { text: "canva pro please" },
    expectedSlug: "canva",
    expectedPlanId: "canva-pro-monthly",
    minConfidence: 0.7,
  },
  {
    id: 4,
    input: { text: "github copilot" },
    expectedSlug: "github",
    expectedPlanId: "copilot-individual",
    minConfidence: 0.7,
  },
  {
    id: 5,
    input: { text: "coursera plus" },
    expectedSlug: "coursera",
    expectedPlanId: "coursera-plus",
    minConfidence: 0.7,
  },
  {
    id: 6,
    input: { text: "pay for gemini" },
    expectedSlug: "gemini",
    expectedPlanId: "gemini-advanced",
    minConfidence: 0.7,
  },
  {
    id: 7,
    input: { text: "openai" },
    expectedSlug: "chatgpt",
    expectedPlanId: "chatgpt-plus",
    minConfidence: 0.7,
  },
  {
    id: 8,
    input: { url: "https://gemini.google.com/advanced" },
    expectedSlug: "gemini",
    expectedPlanId: "gemini-advanced",
    minConfidence: 0.7,
  },
  {
    id: 9,
    input: { url: "https://github.com/features/copilot" },
    expectedSlug: "github",
    expectedPlanId: "copilot-individual",
    minConfidence: 0.7,
  },

  // Unsupported (10-13)
  {
    id: 10,
    input: { text: "pay for netflix" },
    expectedSlug: null,
    expectedPlanId: null,
  },
  {
    id: 11,
    input: { url: "https://unknownsite.com/checkout" },
    expectedSlug: null,
    expectedPlanId: null,
  },
  {
    id: 12,
    input: { text: "" },
    expectedSlug: null,
    expectedPlanId: null,
  },
  {
    id: 13,
    input: { text: "gemini.google.com.evil.com" },
    expectedSlug: null,
    expectedPlanId: null,
  },

  // Adversarial (14-15)
  {
    id: 14,
    input: { text: "Pay $5 for Gemini Advanced" },
    expectedSlug: "gemini",
    expectedPlanId: "gemini-advanced",
    minConfidence: 0.7,
  },
  {
    id: 15,
    input: { text: "Canva Teams please" },
    expectedSlug: "canva",
    expectedPlanId: null,
    maxConfidence: 0.69,
    expectedMissing: ["plan"],
  },
];

async function runEval() {
  console.log("==========================================================================================");
  console.log("STAGE B6: GEMMA 4 26B EVALUATION HARNESS (15 CASES)");
  console.log("==========================================================================================");

  const parser = new GemmaParser();
  let passedCount = 0;

  console.log(
    "| #  | Input Phrase / URL                             | Expected Slug | Actual Slug | Plan ID            | Conf | Price Removed? | Result |"
  );
  console.log(
    "|----|------------------------------------------------|---------------|-------------|--------------------|------|----------------|--------|"
  );

  for (const tc of EVAL_CASES) {
    const inputDesc = (tc.input.text ?? `url:${tc.input.url}`).padEnd(46).slice(0, 46);
    const result = await parser.parse(tc.input);

    const slugMatches = result.merchantSlug === tc.expectedSlug;
    const planMatches =
      result.planId === tc.expectedPlanId ||
      // allow canva-pro or canva-pro-monthly
      (tc.expectedSlug === "canva" && (result.planId === "canva-pro" || result.planId === "canva-pro-monthly"));

    const noHallucination = tc.expectedSlug === null ? result.planId === null : true;
    const noPriceField = !("price" in result);

    let confMatches = true;
    if (tc.minConfidence !== undefined) {
      confMatches = confMatches && result.confidence >= tc.minConfidence;
    }
    if (tc.maxConfidence !== undefined) {
      confMatches = confMatches && result.confidence <= tc.maxConfidence;
    }

    let missingMatches = true;
    if (tc.expectedMissing) {
      missingMatches = tc.expectedMissing.every((field) => result.missingFields.includes(field));
    }

    const passed = slugMatches && planMatches && noHallucination && noPriceField && confMatches && missingMatches;
    if (passed) passedCount++;

    const expSlug = (tc.expectedSlug ?? "null").padEnd(13);
    const actSlug = (result.merchantSlug ?? "null").padEnd(11);
    const planIdStr = (result.planId ?? "null").padEnd(18).slice(0, 18);
    const confStr = result.confidence.toFixed(2).padEnd(4);
    const priceStr = (noPriceField ? "YES (NO PRICE)" : "FAIL").padEnd(14);
    const resStr = passed ? "PASS" : "FAIL";

    console.log(
      `| ${String(tc.id).padStart(2)} | ${inputDesc} | ${expSlug} | ${actSlug} | ${planIdStr} | ${confStr} | ${priceStr} | ${resStr}   |`
    );
  }

  const scorePct = Math.round((passedCount / EVAL_CASES.length) * 100);
  console.log("------------------------------------------------------------------------------------------");
  console.log(`TOTAL SCORE: ${passedCount} / ${EVAL_CASES.length} (${scorePct}%) — Target: ≥ 12/15 (80%)`);
  console.log("==========================================================================================\n");

  if (passedCount < 12) {
    throw new Error(`Eval failed: Score ${passedCount}/15 is below required threshold 12/15`);
  }

  // Acceptance check 7: AI_PROVIDER=deterministic routes through DeterministicParser without crashing
  console.log("[Verification 7] Testing AI_PROVIDER=deterministic routing...");
  const detParser = new DeterministicParser();
  for (const tc of EVAL_CASES) {
    await detParser.parse(tc.input);
  }
  console.log("  ✓ All 15 cases processed by DeterministicParser with zero crashes.");

  // Acceptance check 8: Fallback on invalid API key
  console.log("\n[Verification 8] Testing silent fallback on invalid API key...");
  const failingGemma = new GemmaParser();
  const fallback = new FallbackParser(failingGemma, new DeterministicParser());
  const origKey = process.env.GOOGLE_AI_API_KEY;
  process.env.GOOGLE_AI_API_KEY = "invalid_key_testing";
  const fallbackResult = await fallback.parse({ text: "Pay for Gemini Advanced" });
  console.log("  ✓ Fallback result on invalid API key:", fallbackResult.merchantSlug, fallbackResult.reasoning);
  if (fallbackResult.merchantSlug !== "gemini") {
    throw new Error("Fallback failed on invalid API key");
  }

  // Acceptance check 9: Timeout simulation (6s delay triggers 5s timeout -> fallback)
  console.log("\n[Verification 9] Testing timeout simulation (mock delay -> silent fallback)...");
  process.env.SIMULATE_TIMEOUT = "true";
  const timeoutFallbackResult = await fallback.parse({ text: "Pay for Gemini Advanced" });
  console.log("  ✓ Fallback result on timeout:", timeoutFallbackResult.merchantSlug, timeoutFallbackResult.reasoning);
  if (timeoutFallbackResult.merchantSlug !== "gemini") {
    throw new Error("Fallback failed on timeout");
  }
  delete process.env.SIMULATE_TIMEOUT;
  process.env.GOOGLE_AI_API_KEY = origKey;

  console.log("\n>>> ALL STAGE B6 PARSER ACCEPTANCE CHECKS PASSED SUCCESSFULLY! <<<\n");
}

runEval().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
