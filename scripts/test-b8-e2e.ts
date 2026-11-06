import { prisma } from "../lib/db";
import { POST as paymentIntentsPost } from "../app/api/payment-intents/route";
import { POST as confirmPost } from "../app/api/payment-intents/[id]/confirm/route";
import { reconcile } from "./reconcile";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

async function main() {
  console.log("==========================================================================================");
  console.log("STAGE B8: REAL END-TO-END ROUND TRIP (INTENT -> CONFIRM -> RECONCILE)");
  console.log("==========================================================================================\n");

  const demoUser = await prisma.user.findFirst({
    where: { email: "demo@cleva.ai" },
    include: { wallet: true, cards: true },
  });

  if (!demoUser || !demoUser.clerkUserId) {
    throw new Error("Demo user not found");
  }

  // 1. POST /api/payment-intents
  console.log("[Step 1] Creating Payment Intent for Gemini Advanced...");
  const createReq = new NextRequest("http://localhost:3000/api/payment-intents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cleva-test-session-clerk-id": demoUser.clerkUserId,
    },
    body: JSON.stringify({ inputText: "Pay for Gemini Advanced" }),
  });

  const createRes = await paymentIntentsPost(createReq);
  const createJson = await createRes.json();
  console.log("Payment Intent Created:", {
    intentId: createJson.intent.id,
    quoteId: createJson.intent.quoteId,
    totalNgn: createJson.intent.display.totalNgn,
  });

  const intentId = createJson.intent.id;
  const quoteId = createJson.intent.quoteId;
  const idempotencyKey = randomUUID();

  // 2. POST /api/payment-intents/:id/confirm
  console.log(`\n[Step 2] Confirming Payment Intent with Idempotency Key: ${idempotencyKey}...`);
  const confirmReq = new NextRequest(`http://localhost:3000/api/payment-intents/${intentId}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cleva-test-session-clerk-id": demoUser.clerkUserId,
    },
    body: JSON.stringify({ quoteId, idempotencyKey }),
  });

  const confirmRes = await confirmPost(confirmReq, { params: Promise.resolve({ id: intentId }) });
  const confirmJson = await confirmRes.json();
  console.log("Confirm Response Status:", confirmRes.status);
  console.log("Confirm Response JSON:\n", JSON.stringify(confirmJson, null, 2));

  if (confirmRes.status !== 200) {
    throw new Error(`Confirm failed with status ${confirmRes.status}`);
  }

  // 3. Reconcile
  console.log("\n[Step 3] Running reconciliation after real round-trip...");
  const rec = await reconcile();
  console.log("Reconciliation Result:", rec);

  console.log("\n>>> STAGE B8 E2E ROUND-TRIP COMPLETED SUCCESSFULLY! <<<\n");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
