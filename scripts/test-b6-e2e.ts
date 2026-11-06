import { prisma } from "../lib/db";
import { POST as paymentIntentsPost } from "../app/api/payment-intents/route";
import { getIntentParser } from "../lib/ai/parser";
import { reconcile } from "./reconcile";
import { NextRequest } from "next/server";

async function main() {
  console.log("==========================================================================================");
  console.log("STAGE B6: END-TO-END VERIFICATION WITH AI_PROVIDER=gemma");
  console.log("==========================================================================================\n");

  process.env.AI_PROVIDER = "gemma";

  const demoUser = await prisma.user.findFirst({
    where: { email: "demo@cleva.ai" },
    include: { wallet: true, cards: true },
  });

  if (!demoUser || !demoUser.clerkUserId) {
    throw new Error("Demo user not found");
  }

  const makePostReq = (body: unknown) => {
    return new NextRequest("http://localhost:3000/api/payment-intents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cleva-test-session-clerk-id": demoUser.clerkUserId!,
      },
      body: JSON.stringify(body),
    });
  };

  // 1. Happy-path POST with AI_PROVIDER=gemma
  console.log("[Test 1] Happy-path POST with 'Pay for Gemini Advanced' (AI_PROVIDER=gemma)...");
  const happyRes = await paymentIntentsPost(makePostReq({ inputText: "Pay for Gemini Advanced" }));
  const happyJson = await happyRes.json();
  console.log("Status:", happyRes.status);
  console.log("Response Body:", JSON.stringify(happyJson, null, 2));

  if (happyRes.status !== 200) throw new Error(`Expected 200, got ${happyRes.status}`);
  if (happyJson.intent.parsedBy !== "gemma") throw new Error(`Expected parsedBy=gemma, got ${happyJson.intent.parsedBy}`);
  if (happyJson.intent.display.totalNgn !== "₦32,484") throw new Error(`Expected total ₦32,484, got ${happyJson.intent.display.totalNgn}`);
  if (happyJson.intent.quote.usdAmountCents !== 1999) throw new Error("Price mismatch");

  // 2. Adversarial case 14: "Pay $5 for Gemini Advanced"
  console.log("\n[Test 2] Adversarial Case 14: 'Pay $5 for Gemini Advanced'...");
  const adv14Res = await paymentIntentsPost(makePostReq({ inputText: "Pay $5 for Gemini Advanced" }));
  const adv14Json = await adv14Res.json();
  console.log("Status:", adv14Res.status);
  console.log("Quote usdAmountCents:", adv14Json.intent.quote.usdAmountCents);
  console.log("Display total:", adv14Json.intent.display.totalNgn);

  if (adv14Res.status !== 200) throw new Error(`Expected 200, got ${adv14Res.status}`);
  if (adv14Json.intent.quote.usdAmountCents !== 1999) {
    throw new Error(`User price $5 leaked into quote! Expected 1999, got ${adv14Json.intent.quote.usdAmountCents}`);
  }
  if (adv14Json.intent.display.totalNgn !== "₦32,484") {
    throw new Error(`Total should be ₦32,484, got ${adv14Json.intent.display.totalNgn}`);
  }

  // 3. Adversarial case 15: "Canva Teams please"
  console.log("\n[Test 3] Adversarial Case 15: 'Canva Teams please' (unsupported plan in parser)...");
  const parser = getIntentParser();
  const adv15Parsed = await parser.parse({ text: "Canva Teams please" });
  console.log("Parsed merchantSlug:", adv15Parsed.merchantSlug);
  console.log("Parsed planId:", adv15Parsed.planId);
  console.log("Parsed confidence:", adv15Parsed.confidence);
  console.log("Parsed missingFields:", adv15Parsed.missingFields);

  if (adv15Parsed.merchantSlug !== "canva") {
    throw new Error(`Expected merchantSlug=canva, got ${adv15Parsed.merchantSlug}`);
  }
  if (adv15Parsed.planId !== null) {
    throw new Error(`Expected planId=null, got ${adv15Parsed.planId}`);
  }
  if (adv15Parsed.confidence >= 0.7) {
    throw new Error(`Expected confidence < 0.7, got ${adv15Parsed.confidence}`);
  }
  if (!adv15Parsed.missingFields.includes("plan")) {
    throw new Error(`Expected missingFields to include 'plan'`);
  }
  if ("price" in adv15Parsed) {
    throw new Error("Price field leaked into ParsedIntent");
  }

  // 4. Simulated API failure on route: falls back silently
  console.log("\n[Test 4] Testing silent fallback on route during simulated Google AI failure...");
  process.env.SIMULATE_API_ERROR = "true";
  const fallbackRouteRes = await paymentIntentsPost(makePostReq({ inputText: "Pay for Gemini Advanced" }));
  const fallbackRouteJson = await fallbackRouteRes.json();
  console.log("Status with simulated API failure:", fallbackRouteRes.status);
  console.log("Intent merchant:", fallbackRouteJson.intent.merchant, "Total:", fallbackRouteJson.intent.display.totalNgn);
  delete process.env.SIMULATE_API_ERROR;
  if (fallbackRouteRes.status !== 200) {
    throw new Error(`Fallback failed, endpoint returned ${fallbackRouteRes.status}`);
  }

  // 5. Run 10 POSTs and verify reconciliation: zero balance mutation
  console.log("\n[Test 5] Running 10 POSTs with AI_PROVIDER=gemma to verify zero mutations...");
  for (let i = 0; i < 10; i++) {
    const res = await paymentIntentsPost(makePostReq({ inputText: "Pay for Gemini Advanced" }));
    if (res.status !== 200) throw new Error(`POST ${i} failed`);
  }

  const rec = await reconcile();
  console.log("Reconciliation output:", rec);

  if (rec.walletBalanceKobo !== 10_000_000 || rec.cardBalanceCents !== 0 || rec.ledgerCount !== 0) {
    throw new Error("Financial balance was mutated!");
  }

  console.log("\n>>> ALL STAGE B6 E2E CHECKS PASSED SUCCESSFULLY! <<<\n");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
