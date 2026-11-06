import { PrismaClient } from "@prisma/client";
import {
  DEMO_USER_EMAIL,
  SEED_WALLET_BALANCE_KOBO,
  SEED_CARD_BALANCE_CENTS,
  SEED_CARD_MASKED_PAN,
  CATALOGUE,
} from "../lib/config";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // 1. Seed or find Demo User (idempotent)
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: {
      email: DEMO_USER_EMAIL,
      name: "Demo User",
      demoOutcome: "SUCCESS",
    },
  });

  // 2. Seed Wallet (idempotent)
  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      currency: "NGN",
      availableBalanceKobo: SEED_WALLET_BALANCE_KOBO,
    },
  });

  // 3. Seed Virtual Card (idempotent)
  const existingCard = await prisma.virtualCard.findFirst({
    where: {
      userId: user.id,
      maskedPan: SEED_CARD_MASKED_PAN,
    },
  });

  if (!existingCard) {
    await prisma.virtualCard.create({
      data: {
        userId: user.id,
        provider: "MOCK_CLEVA",
        currency: "USD",
        status: "ACTIVE",
        maskedPan: SEED_CARD_MASKED_PAN,
        balanceCents: SEED_CARD_BALANCE_CENTS,
      },
    });
  }

  // 4. Seed the 5 merchants from the frozen catalogue (idempotent)
  for (const item of CATALOGUE) {
    await prisma.merchant.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        supported: item.supported,
      },
      create: {
        slug: item.slug,
        name: item.name,
        supported: item.supported,
      },
    });
  }

  const userCount = await prisma.user.count();
  const walletCount = await prisma.wallet.count();
  const cardCount = await prisma.virtualCard.count();
  const merchantCount = await prisma.merchant.count();

  console.log("Seed completed successfully:");
  console.log(`- Users: ${userCount}`);
  console.log(`- Wallets: ${walletCount}`);
  console.log(`- Virtual Cards: ${cardCount}`);
  console.log(`- Merchants: ${merchantCount}`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
