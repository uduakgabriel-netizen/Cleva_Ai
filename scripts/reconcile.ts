import { PrismaClient } from "@prisma/client";
import { SEED_WALLET_BALANCE_KOBO, SEED_CARD_BALANCE_CENTS } from "../lib/config";

const prisma = new PrismaClient();

async function reconcile() {
  console.log("Running ledger reconciliation...");

  const users = await prisma.user.findMany({
    include: {
      wallet: true,
      cards: true,
      ledgerEntries: true,
    },
  });

  if (users.length === 0) {
    throw new Error("Reconciliation failed: No users found in database.");
  }

  let totalLedgerRows = 0;

  for (const user of users) {
    console.log(`Checking user: ${user.email} (ID: ${user.id})`);

    if (!user.wallet) {
      throw new Error(`Reconciliation failed: User ${user.id} has no wallet.`);
    }

    const primaryCard = user.cards[0];
    if (!primaryCard) {
      throw new Error(`Reconciliation failed: User ${user.id} has no virtual card.`);
    }

    const walletEntries = user.ledgerEntries.filter((e) => e.account === "WALLET");
    const cardEntries = user.ledgerEntries.filter((e) => e.account === "CARD");

    const sumWalletLedger = walletEntries.reduce((sum, e) => sum + e.amount, 0);
    const sumCardLedger = cardEntries.reduce((sum, e) => sum + e.amount, 0);

    const expectedWalletBalance = SEED_WALLET_BALANCE_KOBO + sumWalletLedger;
    const expectedCardBalance = SEED_CARD_BALANCE_CENTS + sumCardLedger;

    totalLedgerRows += user.ledgerEntries.length;

    console.log(`  - Wallet Balance: ${user.wallet.availableBalanceKobo} kobo (Expected: ${expectedWalletBalance} kobo, Ledger sum: ${sumWalletLedger})`);
    console.log(`  - Card Balance: ${primaryCard.balanceCents} cents (Expected: ${expectedCardBalance} cents, Ledger sum: ${sumCardLedger})`);
    console.log(`  - User Ledger Entries: ${user.ledgerEntries.length}`);

    if (user.wallet.availableBalanceKobo !== expectedWalletBalance) {
      throw new Error(
        `Reconciliation mismatch on WALLET for user ${user.id}: actual ${user.wallet.availableBalanceKobo} !== expected ${expectedWalletBalance}`
      );
    }

    if (primaryCard.balanceCents !== expectedCardBalance) {
      throw new Error(
        `Reconciliation mismatch on CARD for user ${user.id}: actual ${primaryCard.balanceCents} !== expected ${expectedCardBalance}`
      );
    }
  }

  console.log("==========================================");
  console.log("RECONCILIATION PASSED");
  console.log(`Users checked: ${users.length}`);
  console.log(`Total ledger rows: ${totalLedgerRows}`);
  console.log("All wallet and card balances match the ledger sum exactly.");
  console.log("==========================================");
}

reconcile()
  .catch((e) => {
    console.error("RECONCILIATION ERROR:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
