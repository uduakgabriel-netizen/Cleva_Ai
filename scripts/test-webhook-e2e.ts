import { Webhook } from "svix";
import { prisma } from "../lib/db";

// Standard 32-byte base64 svix secret
const TEST_WEBHOOK_SECRET = "whsec_mfy9qCWbsAwEagEum52uOmZEduv4Ink2";

async function runE2E() {
  console.log("==========================================");
  console.log("CLERK WEBHOOK FIRST DELIVERY & REPLAY TEST");
  console.log("==========================================");

  const clerkUserId = "user_ada_lovelace_001";
  const email = "ada@cleva.ai";

  // Clean up if previous run left user
  const existing = await prisma.user.findUnique({ where: { clerkUserId } });
  if (existing) {
    await prisma.virtualCard.deleteMany({ where: { userId: existing.id } });
    await prisma.wallet.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const userCountBefore = await prisma.user.count();
  const walletCountBefore = await prisma.wallet.count();
  const cardCountBefore = await prisma.virtualCard.count();

  console.log(`Initial DB State:`);
  console.log(`- Users: ${userCountBefore}`);
  console.log(`- Wallets: ${walletCountBefore}`);
  console.log(`- Cards: ${cardCountBefore}`);

  const payload = JSON.stringify({
    type: "user.created",
    data: {
      id: clerkUserId,
      email_addresses: [
        {
          id: "idn_ada_1",
          email_address: email,
        },
      ],
      first_name: "Ada",
      last_name: "Lovelace",
    },
  });

  const wh = new Webhook(TEST_WEBHOOK_SECRET);
  const svixId = "msg_test_ada_" + Date.now();
  const timestampDate = new Date();
  const svixTimestamp = Math.floor(timestampDate.getTime() / 1000).toString();
  const svixSignature = wh.sign(svixId, timestampDate, payload);

  const headers = {
    "Content-Type": "application/json",
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  };

  // Delivery 1
  console.log("\n--- Sending First Delivery ---");
  const res1 = await fetch("http://localhost:3005/api/webhooks/clerk", {
    method: "POST",
    headers,
    body: payload,
  });

  const text1 = await res1.text();
  console.log("Delivery 1 response status:", res1.status, "body:", text1);
  let json1;
  try {
    json1 = JSON.parse(text1);
  } catch (e) {
    throw new Error(`Failed to parse json: ${text1}`);
  }

  if (res1.status !== 200) {
    throw new Error(`Delivery 1 failed with status ${res1.status}`);
  }

  const userCountAfter1 = await prisma.user.count();
  const walletCountAfter1 = await prisma.wallet.count();
  const cardCountAfter1 = await prisma.virtualCard.count();

  console.log(`Row counts after Delivery 1:`);
  console.log(`- Users: ${userCountAfter1} (+${userCountAfter1 - userCountBefore})`);
  console.log(`- Wallets: ${walletCountAfter1} (+${walletCountAfter1 - walletCountBefore})`);
  console.log(`- Cards: ${cardCountAfter1} (+${cardCountAfter1 - cardCountBefore})`);

  const createdUser = await prisma.user.findUnique({
    where: { clerkUserId },
    include: { wallet: true, cards: true },
  });

  if (!createdUser || !createdUser.wallet || createdUser.cards.length !== 1) {
    throw new Error("Created user failed database integrity check");
  }

  console.log(`Created User Verified:`);
  console.log(`- Email: ${createdUser.email}`);
  console.log(`- Name: ${createdUser.name}`);
  console.log(`- Wallet Balance: ${createdUser.wallet.availableBalanceKobo} kobo (₦100,000)`);
  console.log(`- Card Balance: ${createdUser.cards[0].balanceCents} cents ($0)`);
  console.log(`- Card Masked PAN: ${createdUser.cards[0].maskedPan}`);
  console.log(`- Card Status: ${createdUser.cards[0].status}`);

  // Delivery 2 (Replay)
  console.log("\n--- Sending Re-delivery (Replay) ---");
  const res2 = await fetch("http://localhost:3005/api/webhooks/clerk", {
    method: "POST",
    headers,
    body: payload,
  });

  const text2 = await res2.text();
  console.log("Delivery 2 response status:", res2.status, "body:", text2);
  let json2;
  try {
    json2 = JSON.parse(text2);
  } catch (e) {
    throw new Error(`Failed to parse json on replay: ${text2}`);
  }

  if (res2.status !== 200) {
    throw new Error(`Delivery 2 failed with status ${res2.status}`);
  }

  const userCountAfter2 = await prisma.user.count();
  const walletCountAfter2 = await prisma.wallet.count();
  const cardCountAfter2 = await prisma.virtualCard.count();

  console.log(`Row counts after Delivery 2 (Replay):`);
  console.log(`- Users: ${userCountAfter2} (diff: ${userCountAfter2 - userCountAfter1})`);
  console.log(`- Wallets: ${walletCountAfter2} (diff: ${walletCountAfter2 - walletCountAfter1})`);
  console.log(`- Cards: ${cardCountAfter2} (diff: ${cardCountAfter2 - cardCountAfter1})`);

  if (
    userCountAfter2 !== userCountAfter1 ||
    walletCountAfter2 !== walletCountAfter1 ||
    cardCountAfter2 !== cardCountAfter1
  ) {
    throw new Error("IDEMPOTENCY FAILED: Duplicate rows created on webhook replay!");
  }

  console.log("\nZero duplicate rows created on replay. IDEMPOTENCY CONFIRMED!");
}

runE2E()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
