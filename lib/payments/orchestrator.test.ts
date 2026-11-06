import { describe, it, expect } from "vitest";
import { prisma } from "../db";
import { confirmPaymentIntent } from "./orchestrator";
import { buildQuote } from "../pricing/quote";
import { AppError } from "../errors";
import { reconcile } from "../../scripts/reconcile";

// Test fixture helper to set up isolated test environment
async function createTestFixture(options?: {
  demoOutcome?: string;
  walletBalanceKobo?: number;
  expiredQuote?: boolean;
}) {
  const demoOutcome = options?.demoOutcome ?? "SUCCESS";
  const walletBalanceKobo = options?.walletBalanceKobo ?? 10_000_000;
  const expiredQuote = options?.expiredQuote ?? false;

  const randomSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 1. Merchant
  const merchant = await prisma.merchant.upsert({
    where: { slug: "gemini" },
    update: {},
    create: {
      slug: "gemini",
      name: "Gemini",
      supported: true,
    },
  });

  // 2. User
  const user = await prisma.user.create({
    data: {
      clerkUserId: `clerk_b8_${randomSuffix}`,
      email: `b8_${randomSuffix}@cleva.ai`,
      name: "B8 Test User",
      demoOutcome,
      wallet: {
        create: {
          currency: "NGN",
          availableBalanceKobo: walletBalanceKobo,
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

  // 3. PaymentIntent
  const intent = await prisma.paymentIntent.create({
    data: {
      userId: user.id,
      merchantId: merchant.id,
      inputText: "Pay for Gemini Advanced",
      planId: "gemini-advanced",
      planName: "Gemini Advanced",
      interval: "MONTHLY",
      confidence: 0.95,
      parsedBy: "deterministic",
      status: "AWAITING_APPROVAL",
    },
  });

  // 4. Quote
  const quoteData = buildQuote(1999);
  const expiresAt = expiredQuote
    ? new Date(Date.now() - 60_000) // 1 min in past
    : quoteData.expiresAt;

  const quote = await prisma.quote.create({
    data: {
      intentId: intent.id,
      usdAmountCents: quoteData.usdAmountCents,
      fxRateNgnPerUsd: quoteData.fxRateNgnPerUsd,
      convertedNgnKobo: quoteData.convertedNgnKobo,
      feeNgnKobo: quoteData.feeNgnKobo,
      totalNgnKobo: quoteData.totalNgnKobo,
      assumptions: quoteData.assumptions,
      expiresAt,
    },
  });

  const cleanup = async () => {
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.ledgerEntry.deleteMany({ where: { userId: user.id } });
    await prisma.quote.deleteMany({ where: { intentId: intent.id } });
    await prisma.paymentIntent.deleteMany({ where: { userId: user.id } });
    await prisma.virtualCard.deleteMany({ where: { userId: user.id } });
    await prisma.wallet.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  };

  return { user, merchant, intent, quote, cleanup };
}

describe("Stage B8 — Payment Orchestrator & Confirm (H1 - H3, D1 - D6, R1 - R2)", () => {
  // H1 — Happy path (SUCCESS forced)
  it("H1: Happy path produces SUCCEEDED transaction, 3 ledger rows, wallet debited, card 0", async () => {
    const fixture = await createTestFixture({ demoOutcome: "SUCCESS" });
    try {
      const idempotencyKey = `K1_${Date.now()}`;
      const result = await confirmPaymentIntent({
        userId: fixture.user.id,
        intentId: fixture.intent.id,
        quoteId: fixture.quote.id,
        idempotencyKey,
      });

      expect(result.idempotentReplay).toBe(false);
      expect(result.transaction.status).toBe("SUCCEEDED");
      expect(result.transaction.receiptId).toMatch(/^CLV-/);
      expect(result.transaction.authorizationCode).toMatch(/^MOCK-/);

      const wallet = await prisma.wallet.findUnique({ where: { userId: fixture.user.id } });
      const card = await prisma.virtualCard.findFirst({ where: { userId: fixture.user.id } });
      const updatedIntent = await prisma.paymentIntent.findUnique({ where: { id: fixture.intent.id } });

      expect(wallet!.availableBalanceKobo).toBe(6_751_600); // 10,000,000 - 3,248,400
      expect(card!.balanceCents).toBe(0);
      expect(updatedIntent!.status).toBe("SUCCEEDED");

      const ledger = await prisma.ledgerEntry.findMany({
        where: { userId: fixture.user.id },
        orderBy: { createdAt: "asc" },
      });

      expect(ledger).toHaveLength(3);
      expect(ledger[0].type).toBe("WALLET_DEBIT_FX");
      expect(ledger[0].amount).toBe(-3_248_400);
      expect(ledger[0].balanceAfter).toBe(6_751_600);

      expect(ledger[1].type).toBe("CARD_FUND");
      expect(ledger[1].amount).toBe(1999);
      expect(ledger[1].balanceAfter).toBe(1999);

      expect(ledger[2].type).toBe("CARD_AUTH");
      expect(ledger[2].amount).toBe(-1999);
      expect(ledger[2].balanceAfter).toBe(0);

      const sumWallet = ledger.filter((l) => l.account === "WALLET").reduce((s, l) => s + l.amount, 0);
      const sumCard = ledger.filter((l) => l.account === "CARD").reduce((s, l) => s + l.amount, 0);

      expect(sumWallet).toBe(-3_248_400);
      expect(sumCard).toBe(0);

      console.log("H1 Ledger Rows:", ledger.map((l) => ({ type: l.type, amount: l.amount, balanceAfter: l.balanceAfter })));
    } finally {
      await fixture.cleanup();
    }
  });

  // H2 — Double-click idempotency
  it("H2: Double-click idempotency returns same receipt, exactly 3 ledger rows, zero second mutation", async () => {
    const fixture = await createTestFixture({ demoOutcome: "SUCCESS" });
    try {
      const idempotencyKey = `K2_DOUBLE_${Date.now()}`;

      const res1 = await confirmPaymentIntent({
        userId: fixture.user.id,
        intentId: fixture.intent.id,
        quoteId: fixture.quote.id,
        idempotencyKey,
      });

      const res2 = await confirmPaymentIntent({
        userId: fixture.user.id,
        intentId: fixture.intent.id,
        quoteId: fixture.quote.id,
        idempotencyKey,
      });

      expect(res1.idempotentReplay).toBe(false);
      expect(res2.idempotentReplay).toBe(true);

      expect(res1.transaction.id).toBe(res2.transaction.id);
      expect(res1.transaction.receiptId).toBe(res2.transaction.receiptId);

      const wallet = await prisma.wallet.findUnique({ where: { userId: fixture.user.id } });
      expect(wallet!.availableBalanceKobo).toBe(6_751_600);

      const ledger = await prisma.ledgerEntry.findMany({ where: { userId: fixture.user.id } });
      expect(ledger).toHaveLength(3); // Not 6

      const intent = await prisma.paymentIntent.findUnique({ where: { id: fixture.intent.id } });
      expect(intent!.status).toBe("SUCCEEDED");
    } finally {
      await fixture.cleanup();
    }
  });

  // H3 — Concurrent confirms (race condition test)
  it("H3: Concurrent confirms: exactly one succeeds, one rejected with INTENT_NOT_CONFIRMABLE, single debit", async () => {
    const fixture = await createTestFixture({ demoOutcome: "SUCCESS" });
    try {
      const key1 = `K3_CONC1_${Date.now()}`;
      const key2 = `K3_CONC2_${Date.now()}`;

      const results = await Promise.allSettled([
        confirmPaymentIntent({
          userId: fixture.user.id,
          intentId: fixture.intent.id,
          quoteId: fixture.quote.id,
          idempotencyKey: key1,
        }),
        confirmPaymentIntent({
          userId: fixture.user.id,
          intentId: fixture.intent.id,
          quoteId: fixture.quote.id,
          idempotencyKey: key2,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectedReason).toBeInstanceOf(AppError);
      expect((rejectedReason as AppError).code).toBe("INTENT_NOT_CONFIRMABLE");

      const wallet = await prisma.wallet.findUnique({ where: { userId: fixture.user.id } });
      expect(wallet!.availableBalanceKobo).toBe(6_751_600);

      const transactions = await prisma.transaction.findMany({ where: { intentId: fixture.intent.id } });
      expect(transactions).toHaveLength(1);
    } finally {
      await fixture.cleanup();
    }
  });

  // D1 — Forced DECLINE (the reversal test)
  it("D1: Forced decline reverses card funding and refunds wallet (net zero, 4 ledger rows)", async () => {
    const fixture = await createTestFixture({ demoOutcome: "DECLINE" });
    try {
      const idempotencyKey = `K_DEC_${Date.now()}`;
      const result = await confirmPaymentIntent({
        userId: fixture.user.id,
        intentId: fixture.intent.id,
        quoteId: fixture.quote.id,
        idempotencyKey,
      });

      expect(result.transaction.status).toBe("DECLINED");
      expect(result.transaction.declineReason).toBe("DEMO_FORCED_DECLINE");
      expect(result.transaction.authorizationCode).toBeNull();

      const intent = await prisma.paymentIntent.findUnique({ where: { id: fixture.intent.id } });
      expect(intent!.status).toBe("FAILED");

      const wallet = await prisma.wallet.findUnique({ where: { userId: fixture.user.id } });
      const card = await prisma.virtualCard.findFirst({ where: { userId: fixture.user.id } });

      expect(wallet!.availableBalanceKobo).toBe(10_000_000); // Fully refunded
      expect(card!.balanceCents).toBe(0);

      const ledger = await prisma.ledgerEntry.findMany({
        where: { userId: fixture.user.id },
        orderBy: { createdAt: "asc" },
      });

      expect(ledger).toHaveLength(4);
      expect(ledger[0].type).toBe("WALLET_DEBIT_FX");
      expect(ledger[0].amount).toBe(-3_248_400);
      expect(ledger[0].balanceAfter).toBe(6_751_600);

      expect(ledger[1].type).toBe("CARD_FUND");
      expect(ledger[1].amount).toBe(1999);
      expect(ledger[1].balanceAfter).toBe(1999);

      expect(ledger[2].type).toBe("CARD_FUND_REVERSAL");
      expect(ledger[2].amount).toBe(-1999);
      expect(ledger[2].balanceAfter).toBe(0);

      expect(ledger[3].type).toBe("WALLET_REFUND");
      expect(ledger[3].amount).toBe(3_248_400);
      expect(ledger[3].balanceAfter).toBe(10_000_000);

      const sumWallet = ledger.filter((l) => l.account === "WALLET").reduce((s, l) => s + l.amount, 0);
      const sumCard = ledger.filter((l) => l.account === "CARD").reduce((s, l) => s + l.amount, 0);

      expect(sumWallet).toBe(0);
      expect(sumCard).toBe(0);

      console.log("D1 Decline Ledger Rows:", ledger.map((l) => ({ type: l.type, amount: l.amount, balanceAfter: l.balanceAfter })));
    } finally {
      await fixture.cleanup();
    }
  });

  // D2 — Insufficient balance
  it("D2: Insufficient balance marks intent FAILED post-transaction, leaves balance unchanged and 0 ledger rows", async () => {
    // Wallet reduced to ₦100 (10,000 kobo)
    const fixture = await createTestFixture({ walletBalanceKobo: 10_000 });
    try {
      const idempotencyKey = `K_INSUFF_${Date.now()}`;
      await expect(
        confirmPaymentIntent({
          userId: fixture.user.id,
          intentId: fixture.intent.id,
          quoteId: fixture.quote.id,
          idempotencyKey,
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "INSUFFICIENT_BALANCE" }));

      const intent = await prisma.paymentIntent.findUnique({ where: { id: fixture.intent.id } });
      expect(intent!.status).toBe("FAILED");

      const wallet = await prisma.wallet.findUnique({ where: { userId: fixture.user.id } });
      expect(wallet!.availableBalanceKobo).toBe(10_000);

      const card = await prisma.virtualCard.findFirst({ where: { userId: fixture.user.id } });
      expect(card!.balanceCents).toBe(0);

      const ledger = await prisma.ledgerEntry.findMany({ where: { userId: fixture.user.id } });
      expect(ledger).toHaveLength(0);

      const transactions = await prisma.transaction.findMany({ where: { intentId: fixture.intent.id } });
      expect(transactions).toHaveLength(0);
    } finally {
      await fixture.cleanup();
    }
  });

  // D3 — Expired quote
  it("D3: Expired quote throws QUOTE_EXPIRED, leaves intent AWAITING_APPROVAL and makes zero mutations", async () => {
    const fixture = await createTestFixture({ expiredQuote: true });
    try {
      const idempotencyKey = `K_EXP_${Date.now()}`;
      await expect(
        confirmPaymentIntent({
          userId: fixture.user.id,
          intentId: fixture.intent.id,
          quoteId: fixture.quote.id,
          idempotencyKey,
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "QUOTE_EXPIRED" }));

      const intent = await prisma.paymentIntent.findUnique({ where: { id: fixture.intent.id } });
      expect(intent!.status).toBe("AWAITING_APPROVAL");

      const ledger = await prisma.ledgerEntry.findMany({ where: { userId: fixture.user.id } });
      expect(ledger).toHaveLength(0);
    } finally {
      await fixture.cleanup();
    }
  });

  // D4 — Quote mismatch
  it("D4: Quote mismatch throws QUOTE_MISMATCH, leaves intent AWAITING_APPROVAL and makes zero mutations", async () => {
    const fixture = await createTestFixture();
    try {
      await expect(
        confirmPaymentIntent({
          userId: fixture.user.id,
          intentId: fixture.intent.id,
          quoteId: "wrong-quote-id",
          idempotencyKey: `K_MISMATCH_${Date.now()}`,
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "QUOTE_MISMATCH" }));

      const intent = await prisma.paymentIntent.findUnique({ where: { id: fixture.intent.id } });
      expect(intent!.status).toBe("AWAITING_APPROVAL");

      const ledger = await prisma.ledgerEntry.findMany({ where: { userId: fixture.user.id } });
      expect(ledger).toHaveLength(0);
    } finally {
      await fixture.cleanup();
    }
  });

  // D5 — Already-processed intent
  it("D5: Already-processed intent throws INTENT_NOT_CONFIRMABLE and makes zero mutations", async () => {
    const fixture = await createTestFixture();
    try {
      await prisma.paymentIntent.update({
        where: { id: fixture.intent.id },
        data: { status: "SUCCEEDED" },
      });

      await expect(
        confirmPaymentIntent({
          userId: fixture.user.id,
          intentId: fixture.intent.id,
          quoteId: fixture.quote.id,
          idempotencyKey: `K_ALREADY_${Date.now()}`,
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "INTENT_NOT_CONFIRMABLE" }));

      const ledger = await prisma.ledgerEntry.findMany({ where: { userId: fixture.user.id } });
      expect(ledger).toHaveLength(0);
    } finally {
      await fixture.cleanup();
    }
  });

  // D6 — Cross-user intent
  it("D6: Cross-user intent access throws INTENT_NOT_FOUND and makes zero mutations", async () => {
    const fixtureA = await createTestFixture();
    const fixtureB = await createTestFixture();
    try {
      await expect(
        confirmPaymentIntent({
          userId: fixtureB.user.id, // User B trying to confirm User A's intent
          intentId: fixtureA.intent.id,
          quoteId: fixtureA.quote.id,
          idempotencyKey: `K_CROSS_${Date.now()}`,
        })
      ).rejects.toThrowError(expect.objectContaining({ code: "INTENT_NOT_FOUND" }));

      const ledgerA = await prisma.ledgerEntry.findMany({ where: { userId: fixtureA.user.id } });
      const ledgerB = await prisma.ledgerEntry.findMany({ where: { userId: fixtureB.user.id } });
      expect(ledgerA).toHaveLength(0);
      expect(ledgerB).toHaveLength(0);
    } finally {
      await fixtureA.cleanup();
      await fixtureB.cleanup();
    }
  });

  // R1 — Reconciliation after H1 (success)
  it("R1: Ledger reconciliation passes cleanly after H1 success", async () => {
    const fixture = await createTestFixture({ demoOutcome: "SUCCESS" });
    try {
      await confirmPaymentIntent({
        userId: fixture.user.id,
        intentId: fixture.intent.id,
        quoteId: fixture.quote.id,
        idempotencyKey: `K_R1_${Date.now()}`,
      });

      const rec = await reconcile();
      expect(rec.ledgerCount).toBeGreaterThanOrEqual(3);
    } finally {
      await fixture.cleanup();
    }
  });

  // R2 — Reconciliation after D1 (decline)
  it("R2: Ledger reconciliation passes cleanly after D1 decline (net zero roundtrip)", async () => {
    const fixture = await createTestFixture({ demoOutcome: "DECLINE" });
    try {
      await confirmPaymentIntent({
        userId: fixture.user.id,
        intentId: fixture.intent.id,
        quoteId: fixture.quote.id,
        idempotencyKey: `K_R2_${Date.now()}`,
      });

      const rec = await reconcile();
      expect(rec.ledgerCount).toBeGreaterThanOrEqual(4);
    } finally {
      await fixture.cleanup();
    }
  });
});
