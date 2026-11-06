import { prisma } from "../lib/db";
import { POST as clerkWebhookHandler } from "../app/api/webhooks/clerk/route";
import { GET as healthHandler } from "../app/api/health/route";
import { GET as authMeHandler } from "../app/api/auth/me/route";
import { NextRequest } from "next/server";

async function runB2Tests() {
  console.log("==========================================");
  console.log("RUNNING STAGE B2 AUTH & WEBHOOK TESTS");
  console.log("==========================================");

  // 1. Test GET /api/health without auth
  console.log("\n[Test 1] Testing GET /api/health...");
  const healthRes = await healthHandler();
  const healthJson = await healthRes.json();
  console.log("Health response status:", healthRes.status, healthJson);
  if (healthRes.status !== 200 || !healthJson.ok) {
    throw new Error("Health check failed");
  }

  // 2. Test GET /api/auth/me without session (must return 401)
  console.log("\n[Test 2] Testing GET /api/auth/me without session...");
  const authMeRes = await authMeHandler();
  const authMeJson = await authMeRes.json();
  console.log("Auth me status:", authMeRes.status, authMeJson);
  if (authMeRes.status !== 401) {
    throw new Error(`Expected 401 without session, got ${authMeRes.status}`);
  }

  // 3. Test Clerk Webhook first delivery
  const freshClerkId = "user_fresh_test_999";
  const freshEmail = "freshuser@cleva.ai";

  // Clean up if previous run left test user
  const preExisting = await prisma.user.findUnique({ where: { clerkUserId: freshClerkId } });
  if (preExisting) {
    await prisma.virtualCard.deleteMany({ where: { userId: preExisting.id } });
    await prisma.wallet.deleteMany({ where: { userId: preExisting.id } });
    await prisma.user.delete({ where: { id: preExisting.id } });
  }

  const initialUserCount = await prisma.user.count();
  const initialWalletCount = await prisma.wallet.count();
  const initialCardCount = await prisma.virtualCard.count();

  console.log(`\n[Test 3] Webhook First Delivery for ${freshEmail}...`);
  const webhookPayload = {
    type: "user.created",
    data: {
      id: freshClerkId,
      email_addresses: [
        {
          id: "idn_123",
          email_address: freshEmail,
        },
      ],
      first_name: "Fresh",
      last_name: "Tester",
    },
  };

  const req1 = new NextRequest("http://localhost:3000/api/webhooks/clerk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookPayload),
  });

  const res1 = await clerkWebhookHandler(req1);
  const json1 = await res1.json();
  console.log("First delivery response:", res1.status, json1);

  const afterFirstUsers = await prisma.user.count();
  const afterFirstWallets = await prisma.wallet.count();
  const afterFirstCards = await prisma.virtualCard.count();

  console.log(`Row counts after first delivery: Users: ${afterFirstUsers} (+${afterFirstUsers - initialUserCount}), Wallets: ${afterFirstWallets} (+${afterFirstWallets - initialWalletCount}), Cards: ${afterFirstCards} (+${afterFirstCards - initialCardCount})`);

  if (
    afterFirstUsers !== initialUserCount + 1 ||
    afterFirstWallets !== initialWalletCount + 1 ||
    afterFirstCards !== initialCardCount + 1
  ) {
    throw new Error("First delivery failed to create exactly 1 user, 1 wallet, 1 card");
  }

  // Verify created values
  const freshUser = await prisma.user.findUnique({
    where: { clerkUserId: freshClerkId },
    include: { wallet: true, cards: true },
  });
  if (!freshUser || !freshUser.wallet || freshUser.cards.length !== 1) {
    throw new Error("Fresh user relation integrity failed");
  }

  console.log(`Created user wallet balance: ${freshUser.wallet.availableBalanceKobo} kobo (Expected: 10000000)`);
  console.log(`Created user card balance: ${freshUser.cards[0].balanceCents} cents (Expected: 0)`);
  console.log(`Created user card status: ${freshUser.cards[0].status} (Expected: ACTIVE)`);

  if (freshUser.wallet.availableBalanceKobo !== 10_000_000 || freshUser.cards[0].balanceCents !== 0) {
    throw new Error("Wallet or card balance mismatch on signup");
  }

  // 4. Test Webhook Re-delivery (Idempotency)
  console.log("\n[Test 4] Webhook Re-delivery (Replay test)...");
  const req2 = new NextRequest("http://localhost:3000/api/webhooks/clerk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookPayload),
  });

  const res2 = await clerkWebhookHandler(req2);
  const json2 = await res2.json();
  console.log("Re-delivery response:", res2.status, json2);

  const afterReplayUsers = await prisma.user.count();
  const afterReplayWallets = await prisma.wallet.count();
  const afterReplayCards = await prisma.virtualCard.count();

  console.log(`Row counts after replay: Users: ${afterReplayUsers}, Wallets: ${afterReplayWallets}, Cards: ${afterReplayCards}`);

  if (
    afterReplayUsers !== afterFirstUsers ||
    afterReplayWallets !== afterFirstWallets ||
    afterReplayCards !== afterFirstCards
  ) {
    throw new Error("Re-delivery failed: Duplicate rows were created!");
  }
  console.log("Re-delivery created ZERO duplicate rows. Idempotency verified!");

  console.log("\n==========================================");
  console.log("ALL STAGE B2 AUTH & WEBHOOK TESTS PASSED!");
  console.log("==========================================");
}

runB2Tests()
  .catch((err) => {
    console.error("B2 Test Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
