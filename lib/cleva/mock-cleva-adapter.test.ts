import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "../db";
import { cleva } from "./index";
import { AppError } from "../errors";

describe("Stage B7 — MockClevaAdapter & Ledger (T1 - T11)", () => {
  let testUserId: string;
  let testIntentId: string;

  beforeEach(async () => {
    // Create an isolated test user with exact seed configuration
    const user = await prisma.user.create({
      data: {
        clerkUserId: `clerk_test_b7_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        email: `b7_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@cleva.ai`,
        name: "B7 Test User",
        wallet: {
          create: {
            currency: "NGN",
            availableBalanceKobo: 10_000_000,
          },
        },
        cards: {
          create: {
            provider: "MOCK_CLEVA",
            currency: "USD",
            status: "ACTIVE",
            maskedPan: "5399 •••• •••• 4242",
            balanceCents: 0,
          },
        },
      },
    });
    testUserId = user.id;

    const intent = await prisma.paymentIntent.create({
      data: {
        userId: user.id,
        confidence: 1.0,
        status: "AWAITING_APPROVAL",
      },
    });
    testIntentId = intent.id;
  });

  afterEach(async () => {
    // Clean up test user completely to keep DB clean for reconciliation
    if (testUserId) {
      await prisma.ledgerEntry.deleteMany({ where: { userId: testUserId } });
      await prisma.paymentIntent.deleteMany({ where: { userId: testUserId } });
      await prisma.virtualCard.deleteMany({ where: { userId: testUserId } });
      await prisma.wallet.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    }
  });

  // T1 — getWallet returns correct snapshot for seeded demo user
  it("T1: getWallet returns correct snapshot for seeded demo user (availableBalanceKobo === 10_000_000)", async () => {
    const demoUser = await prisma.user.findFirst({
      where: { email: "demo@cleva.ai" },
    });
    expect(demoUser).toBeDefined();

    const wallet = await cleva.getWallet(demoUser!.id);
    expect(wallet.userId).toBe(demoUser!.id);
    expect(wallet.currency).toBe("NGN");
    expect(wallet.availableBalanceKobo).toBe(10_000_000);
    expect(wallet.updatedAt).toBeInstanceOf(Date);
  });

  // T2 — getWallet on missing user throws WALLET_NOT_FOUND
  it("T2: getWallet on missing user throws WALLET_NOT_FOUND", async () => {
    await expect(cleva.getWallet("non_existent_user_id")).rejects.toThrowError(
      expect.objectContaining({ code: "WALLET_NOT_FOUND" })
    );
  });

  // T3 — getVirtualCard returns maskedPan "5399 •••• •••• 4242", status ACTIVE, balance 0
  it('T3: getVirtualCard returns maskedPan "5399 •••• •••• 4242", status ACTIVE, balance 0', async () => {
    const card = await cleva.getVirtualCard(testUserId);
    expect(card.userId).toBe(testUserId);
    expect(card.maskedPan).toBe("5399 •••• •••• 4242");
    expect(card.status).toBe("ACTIVE");
    expect(card.balanceCents).toBe(0);
    expect(card.currency).toBe("USD");
  });

  // T4 — debitWalletNgn happy path
  it("T4: debitWalletNgn happy path debits wallet and writes 1 negative LedgerEntry", async () => {
    const amountKobo = 3_248_400;

    const result = await prisma.$transaction(async (tx) => {
      return await cleva.debitWalletNgn(tx, {
        userId: testUserId,
        amountKobo,
        reference: "REF-T4-DEBIT",
        intentId: testIntentId,
      });
    });

    expect(result.balanceAfterKobo).toBe(6_751_600);

    const wallet = await cleva.getWallet(testUserId);
    expect(wallet.availableBalanceKobo).toBe(6_751_600);

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { userId: testUserId },
    });

    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries[0].account).toBe("WALLET");
    expect(ledgerEntries[0].type).toBe("WALLET_DEBIT_FX");
    expect(ledgerEntries[0].amount).toBe(-3_248_400);
    expect(ledgerEntries[0].balanceAfter).toBe(6_751_600);
  });

  // T5 — debitWalletNgn insufficient balance
  it("T5: debitWalletNgn with insufficient balance throws INSUFFICIENT_BALANCE and leaves balance unchanged with 0 ledger rows", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        return await cleva.debitWalletNgn(tx, {
          userId: testUserId,
          amountKobo: 20_000_000, // exceeds 10_000_000
          reference: "REF-T5-FAIL",
          intentId: testIntentId,
        });
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "INSUFFICIENT_BALANCE" }));

    const wallet = await cleva.getWallet(testUserId);
    expect(wallet.availableBalanceKobo).toBe(10_000_000);

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { userId: testUserId },
    });
    expect(ledgerEntries).toHaveLength(0);
  });

  // T6 — fundCard happy path
  it("T6: fundCard happy path increments card balance and writes 1 positive LedgerEntry", async () => {
    const funding = await prisma.$transaction(async (tx) => {
      return await cleva.fundCard(tx, {
        userId: testUserId,
        amountUsdCents: 1999,
        reference: "REF-T6-FUND",
        intentId: testIntentId,
      });
    });

    expect(funding.amountUsdCents).toBe(1999);
    expect(funding.cardBalanceCents).toBe(1999);

    const card = await cleva.getVirtualCard(testUserId);
    expect(card.balanceCents).toBe(1999);

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { userId: testUserId },
    });
    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries[0].account).toBe("CARD");
    expect(ledgerEntries[0].type).toBe("CARD_FUND");
    expect(ledgerEntries[0].amount).toBe(1999);
    expect(ledgerEntries[0].balanceAfter).toBe(1999);
  });

  // T7 — fundCard on FROZEN card throws CARD_FROZEN
  it("T7: fundCard on FROZEN card throws CARD_FROZEN and makes zero mutations", async () => {
    await prisma.virtualCard.updateMany({
      where: { userId: testUserId },
      data: { status: "FROZEN" },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        return await cleva.fundCard(tx, {
          userId: testUserId,
          amountUsdCents: 1999,
          reference: "REF-T7-FROZEN",
          intentId: testIntentId,
        });
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "CARD_FROZEN" }));

    const card = await cleva.getVirtualCard(testUserId);
    expect(card.balanceCents).toBe(0);

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { userId: testUserId },
    });
    expect(ledgerEntries).toHaveLength(0);
  });

  // T8 — reverseCardFunding
  it("T8: reverseCardFunding decrements card balance and writes 1 negative LedgerEntry", async () => {
    // First fund
    await prisma.$transaction(async (tx) => {
      return await cleva.fundCard(tx, {
        userId: testUserId,
        amountUsdCents: 1999,
        reference: "REF-T8-FUND",
        intentId: testIntentId,
      });
    });

    // Then reverse
    await prisma.$transaction(async (tx) => {
      return await cleva.reverseCardFunding(tx, {
        userId: testUserId,
        amountUsdCents: 1999,
        reference: "REF-T8-REV",
        intentId: testIntentId,
      });
    });

    const card = await cleva.getVirtualCard(testUserId);
    expect(card.balanceCents).toBe(0);

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { userId: testUserId },
      orderBy: { createdAt: "asc" },
    });

    expect(ledgerEntries).toHaveLength(2);
    expect(ledgerEntries[1].account).toBe("CARD");
    expect(ledgerEntries[1].type).toBe("CARD_FUND_REVERSAL");
    expect(ledgerEntries[1].amount).toBe(-1999);
    expect(ledgerEntries[1].balanceAfter).toBe(0);
  });

  // T9 — refundWalletNgn
  it("T9: refundWalletNgn increments wallet balance and writes 1 positive LedgerEntry", async () => {
    // First debit
    await prisma.$transaction(async (tx) => {
      return await cleva.debitWalletNgn(tx, {
        userId: testUserId,
        amountKobo: 3_248_400,
        reference: "REF-T9-DEBIT",
        intentId: testIntentId,
      });
    });

    // Then refund
    await prisma.$transaction(async (tx) => {
      return await cleva.refundWalletNgn(tx, {
        userId: testUserId,
        amountKobo: 3_248_400,
        reference: "REF-T9-REF",
        intentId: testIntentId,
      });
    });

    const wallet = await cleva.getWallet(testUserId);
    expect(wallet.availableBalanceKobo).toBe(10_000_000);

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { userId: testUserId },
      orderBy: { createdAt: "asc" },
    });

    expect(ledgerEntries).toHaveLength(2);
    expect(ledgerEntries[1].account).toBe("WALLET");
    expect(ledgerEntries[1].type).toBe("WALLET_REFUND");
    expect(ledgerEntries[1].amount).toBe(3_248_400);
    expect(ledgerEntries[1].balanceAfter).toBe(10_000_000);
  });

  // T10 — FULL RECONCILIATION TEST (the important one)
  it("T10: Full reconciliation test across complete cycle (net zero, exactly 4 ledger rows)", async () => {
    // 1. Record start
    const startWallet = await cleva.getWallet(testUserId);
    const startCard = await cleva.getVirtualCard(testUserId);
    expect(startWallet.availableBalanceKobo).toBe(10_000_000);
    expect(startCard.balanceCents).toBe(0);

    // 2-5. Run full debit -> fund -> reverse -> refund cycle
    await prisma.$transaction(async (tx) => {
      await cleva.debitWalletNgn(tx, {
        userId: testUserId,
        amountKobo: 3_248_400,
        reference: "REF-T10-DEBIT",
        intentId: testIntentId,
      });

      await cleva.fundCard(tx, {
        userId: testUserId,
        amountUsdCents: 1999,
        reference: "REF-T10-FUND",
        intentId: testIntentId,
      });

      await cleva.reverseCardFunding(tx, {
        userId: testUserId,
        amountUsdCents: 1999,
        reference: "REF-T10-REV",
        intentId: testIntentId,
      });

      await cleva.refundWalletNgn(tx, {
        userId: testUserId,
        amountKobo: 3_248_400,
        reference: "REF-T10-REF",
        intentId: testIntentId,
      });
    }, { timeout: 30_000, maxWait: 10_000 });

    // 6. Assert wallet net zero
    const finalWallet = await cleva.getWallet(testUserId);
    expect(finalWallet.availableBalanceKobo).toBe(10_000_000);

    // 7. Assert card net zero
    const finalCard = await cleva.getVirtualCard(testUserId);
    expect(finalCard.balanceCents).toBe(0);

    // 8. Assert ledger has EXACTLY 4 new rows
    const entries = await prisma.ledgerEntry.findMany({
      where: { userId: testUserId },
      orderBy: { createdAt: "asc" },
    });
    expect(entries).toHaveLength(4);

    // 9. Assert sum(wallet ledger amounts) === 0
    const walletSum = entries
      .filter((e) => e.account === "WALLET")
      .reduce((sum, e) => sum + e.amount, 0);
    expect(walletSum).toBe(0);

    // 10. Assert sum(card ledger amounts) === 0
    const cardSum = entries
      .filter((e) => e.account === "CARD")
      .reduce((sum, e) => sum + e.amount, 0);
    expect(cardSum).toBe(0);

    console.log("T10 Reconciliation Numbers:", {
      finalWalletBalance: finalWallet.availableBalanceKobo,
      finalCardBalance: finalCard.balanceCents,
      ledgerEntriesCount: entries.length,
      walletLedgerSum: walletSum,
      cardLedgerSum: cardSum,
    });
  });

  // T11 — Atomicity proof (the fail-rollback test)
  it("T11: Atomicity proof (failure inside transaction rolls back debit and leaves 0 ledger rows)", async () => {
    let transactionFailed = false;

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Inside tx: debitWalletNgn(3_248_400)
        await cleva.debitWalletNgn(tx, {
          userId: testUserId,
          amountKobo: 3_248_400,
          reference: "REF-T11-CRASH",
          intentId: testIntentId,
        });

        // 2. Inside tx: throw intentional simulated crash
        throw new Error("simulated crash inside transaction");
      }, { timeout: 30_000, maxWait: 10_000 });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "simulated crash inside transaction") {
        transactionFailed = true;
      }
    }

    expect(transactionFailed).toBe(true);

    // 4. After: wallet === 10_000_000, ledger count === 0
    const wallet = await cleva.getWallet(testUserId);
    expect(wallet.availableBalanceKobo).toBe(10_000_000);

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { userId: testUserId },
    });
    expect(ledgerEntries).toHaveLength(0);

    console.log("T11 Rollback Proof:", {
      walletAfterRollback: wallet.availableBalanceKobo,
      ledgerCountAfterRollback: ledgerEntries.length,
      atomicityGuaranteed: true,
    });
  });
});
