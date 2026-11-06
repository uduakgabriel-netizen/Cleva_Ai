import { prisma } from "../lib/db";
import { POST as paymentIntentsPost } from "../app/api/payment-intents/route";
import { GET as paymentIntentGet } from "../app/api/payment-intents/[id]/route";
import { reconcile } from "./reconcile";
import { NextRequest } from "next/server";

async function main() {
  console.log("==========================================");
  console.log("RUNNING STAGE B5 ACCEPTANCE TESTS");
  console.log("==========================================\n");

  // Ensure demo user exists
  const demoUser = await prisma.user.findFirst({
    where: { email: "demo@cleva.ai" },
    include: { wallet: true, cards: true },
  });

  if (!demoUser || !demoUser.clerkUserId) {
    throw new Error("Demo user with clerkUserId not found in database. Seed first.");
  }

  // Create or find a second user for multi-tenant isolation test
  const otherClerkId = "user_other_tenant_test";
  const otherEmail = "other@cleva.ai";
  let otherUser = await prisma.user.findUnique({ where: { clerkUserId: otherClerkId } });
  if (!otherUser) {
    otherUser = await prisma.user.create({
      data: {
        clerkUserId: otherClerkId,
        email: otherEmail,
        name: "Other User",
        wallet: {
          create: {
            currency: "NGN",
            availableBalanceKobo: 5_000_000,
          },
        },
        cards: {
          create: {
            provider: "MOCK_CLEVA",
            currency: "USD",
            status: "ACTIVE",
            maskedPan: "5399 •••• •••• 9999",
            balanceCents: 0,
          },
        },
      },
    });
  }

  // Helper to craft request
  const makePostReq = (body: unknown, clerkId?: string) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clerkId) {
      headers["x-cleva-test-session-clerk-id"] = clerkId;
    }
    return new NextRequest("http://localhost:3000/api/payment-intents", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  };

  const makeGetReq = (id: string, clerkId?: string) => {
    const headers: Record<string, string> = {};
    if (clerkId) {
      headers["x-cleva-test-session-clerk-id"] = clerkId;
    }
    return new NextRequest(`http://localhost:3000/api/payment-intents/${id}`, {
      method: "GET",
      headers,
    });
  };

  // 1. POST without session -> 401
  console.log("[Test 1] POST without session -> expect 401");
  const noAuthReq = makePostReq({ inputText: "Pay for Gemini Advanced" });
  const noAuthRes = await paymentIntentsPost(noAuthReq);
  console.log("Status:", noAuthRes.status);
  if (noAuthRes.status !== 401) throw new Error(`Expected 401, got ${noAuthRes.status}`);

  // 2. POST with empty body -> 400 VALIDATION
  console.log("\n[Test 2] POST with empty body -> expect 400 VALIDATION");
  const emptyReq = makePostReq({}, demoUser.clerkUserId);
  const emptyRes = await paymentIntentsPost(emptyReq);
  const emptyJson = await emptyRes.json();
  console.log("Status:", emptyRes.status, "Error:", emptyJson.error);
  if (emptyRes.status !== 400 || emptyJson.error !== "VALIDATION") {
    throw new Error(`Expected 400 VALIDATION, got ${emptyRes.status} ${JSON.stringify(emptyJson)}`);
  }

  // 3. POST with unknown text -> 422 MERCHANT_UNSUPPORTED, no intent created
  console.log("\n[Test 3] POST with unknown text -> expect 422 MERCHANT_UNSUPPORTED");
  const initialIntentCount = await prisma.paymentIntent.count();
  const unknownReq = makePostReq({ inputText: "Pay for Netflix Subscription" }, demoUser.clerkUserId);
  const unknownRes = await paymentIntentsPost(unknownReq);
  const unknownJson = await unknownRes.json();
  console.log("Status:", unknownRes.status, "Response:", unknownJson);
  if (unknownRes.status !== 422 || unknownJson.error !== "MERCHANT_UNSUPPORTED") {
    throw new Error(`Expected 422 MERCHANT_UNSUPPORTED, got ${unknownRes.status}`);
  }
  const afterUnknownCount = await prisma.paymentIntent.count();
  if (afterUnknownCount !== initialIntentCount) {
    throw new Error(`Intent was created on unsupported merchant!`);
  }

  // 4. POST with 'Pay for Gemini Advanced'
  console.log("\n[Test 4] POST with 'Pay for Gemini Advanced' -> expect 200, Gemini Advanced intent");
  const geminiReq = makePostReq({ inputText: "Pay for Gemini Advanced" }, demoUser.clerkUserId);
  const geminiRes = await paymentIntentsPost(geminiReq);
  const geminiJson = await geminiRes.json();
  console.log("Gemini POST Response:", JSON.stringify(geminiJson, null, 2));

  if (geminiRes.status !== 200) throw new Error(`Expected 200, got ${geminiRes.status}`);
  if (geminiJson.intent.status !== "AWAITING_APPROVAL") throw new Error("Status != AWAITING_APPROVAL");
  if (geminiJson.intent.merchant !== "Gemini") throw new Error(`Merchant != Gemini (got ${geminiJson.intent.merchant})`);
  if (geminiJson.intent.plan !== "Gemini Advanced") throw new Error(`Plan != Gemini Advanced (got ${geminiJson.intent.plan})`);
  if (geminiJson.intent.display.totalNgn !== "₦32,484") throw new Error(`Total != ₦32,484 (got ${geminiJson.intent.display.totalNgn})`);
  if (!geminiJson.simulation || !geminiJson.simulation.includes("Simulation only")) {
    throw new Error("Missing simulation label");
  }

  const geminiIntentId = geminiJson.intent.id;

  // 5. POST with valid Gemini URL -> expect same result
  console.log("\n[Test 5] POST with valid Gemini URL -> expect 200");
  const geminiUrlReq = makePostReq({ url: "https://gemini.google.com/advanced" }, demoUser.clerkUserId);
  const geminiUrlRes = await paymentIntentsPost(geminiUrlReq);
  const geminiUrlJson = await geminiUrlRes.json();
  console.log("Gemini URL Response merchant:", geminiUrlJson.intent.merchant, "plan:", geminiUrlJson.intent.plan);
  if (geminiUrlJson.intent.merchant !== "Gemini" || geminiUrlJson.intent.display.totalNgn !== "₦32,484") {
    throw new Error("URL intent resolution mismatch");
  }

  // 6. GET /api/payment-intents/:id with valid session -> full intent
  console.log("\n[Test 6] GET /api/payment-intents/:id with valid session -> full intent");
  const getReq = makeGetReq(geminiIntentId, demoUser.clerkUserId);
  const getRes = await paymentIntentGet(getReq, { params: Promise.resolve({ id: geminiIntentId }) });
  const getJson = await getRes.json();
  console.log("GET Response ID:", getJson.intent.id, "Quote total:", getJson.intent.quote.totalNgnKobo);
  if (getRes.status !== 200 || getJson.intent.id !== geminiIntentId) {
    throw new Error(`GET failed or ID mismatch`);
  }

  // 7. GET with another user's intent id -> 404 INTENT_NOT_FOUND
  console.log("\n[Test 7] GET with another user's session -> expect 404 INTENT_NOT_FOUND");
  const otherGetReq = makeGetReq(geminiIntentId, otherClerkId);
  const otherGetRes = await paymentIntentGet(otherGetReq, { params: Promise.resolve({ id: geminiIntentId }) });
  const otherGetJson = await otherGetRes.json();
  console.log("Status:", otherGetRes.status, "Error:", otherGetJson.error);
  if (otherGetRes.status !== 404 || otherGetJson.error !== "INTENT_NOT_FOUND") {
    throw new Error(`Expected 404 INTENT_NOT_FOUND, got ${otherGetRes.status}`);
  }

  // 8. Run 10 POSTs and verify reconciliation: zero balance mutation
  console.log("\n[Test 8] Running 10 POSTs to prove zero balance mutation...");
  for (let i = 0; i < 10; i++) {
    const r = makePostReq({ inputText: "Pay for Gemini Advanced" }, demoUser.clerkUserId);
    const res = await paymentIntentsPost(r);
    if (res.status !== 200) throw new Error(`POST ${i} failed`);
  }

  console.log("Running reconciliation script...");
  const rec = await reconcile();
  console.log("Reconciliation output:", rec);

  if (rec.walletBalanceKobo !== 10_000_000) {
    throw new Error(`Wallet balance mutated! Expected 10,000,000, got ${rec.walletBalanceKobo}`);
  }
  if (rec.cardBalanceCents !== 0) {
    throw new Error(`Card balance mutated! Expected 0, got ${rec.cardBalanceCents}`);
  }
  if (rec.ledgerCount !== 0) {
    throw new Error(`Ledger entries created! Expected 0, got ${rec.ledgerCount}`);
  }

  console.log("\n>>> ALL STAGE B5 ACCEPTANCE TESTS PASSED SUCCESSFULLY! <<<\n");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
