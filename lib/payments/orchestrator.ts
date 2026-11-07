import { prisma } from "../db";
import { cleva } from "../cleva";
import { mockProcessor, type ForcedOutcome } from "../merchants/mock-processor";
import { AppError } from "../errors";
import { Prisma, type Transaction } from "@prisma/client";

export async function confirmPaymentIntent(input: {
  userId: string;
  intentId: string;
  quoteId: string;
  idempotencyKey: string;
}): Promise<{
  transaction: Transaction;
  idempotentReplay: boolean;
}> {
  // ── 1. IDEMPOTENCY PRE-CHECK (outside the transaction) ──
  const existing = await prisma.transaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });

  if (existing) {
    if (existing.userId !== input.userId) {
      throw new AppError("INTENT_NOT_FOUND");
    }
    return { transaction: existing, idempotentReplay: true };
  }

  // ── 2. MAIN TRANSACTION (Serializable) ──
  try {
    return await prisma.$transaction(
      async (tx) => {
        // 2a. Load intent scoped to user
        const intent = await tx.paymentIntent.findFirst({
          where: { id: input.intentId, userId: input.userId },
          include: { quote: true, merchant: true, user: true },
        });

        if (!intent) throw new AppError("INTENT_NOT_FOUND");
        if (!intent.quote) throw new AppError("INTENT_NOT_FOUND");
        if (intent.quote.id !== input.quoteId) throw new AppError("QUOTE_MISMATCH");
        if (intent.status !== "AWAITING_APPROVAL") throw new AppError("INTENT_NOT_CONFIRMABLE");
        if (intent.quote.expiresAt <= new Date()) throw new AppError("QUOTE_EXPIRED");

        // 2b. Determine forced outcome
        // User.demoOutcome is: "SUCCESS" | "DECLINE" | "INSUFFICIENT_FUNDS"
        if (intent.user.demoOutcome === "INSUFFICIENT_FUNDS") {
          throw new AppError("INSUFFICIENT_BALANCE");
        }

        const forced: ForcedOutcome =
          intent.user.demoOutcome === "DECLINE" ? "DECLINE" : "SUCCESS";

        // 2c. Mark intent PROCESSING (inside tx — rolled back if anything fails)
        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: { status: "PROCESSING" },
        });

        const q = intent.quote;
        const refPrefix = intent.id;

        // 2d. Debit wallet (FX leg)
        await cleva.debitWalletNgn(tx, {
          userId: input.userId,
          amountKobo: q.totalNgnKobo,
          reference: `FX-${refPrefix}`,
          intentId: intent.id,
        });

        // 2e. Fund card just-in-time
        await cleva.fundCard(tx, {
          userId: input.userId,
          amountUsdCents: q.usdAmountCents,
          reference: `FUND-${refPrefix}`,
          intentId: intent.id,
        });

        // 2f. Authorize
        const auth = await mockProcessor.authorizeCardPayment(tx, {
          userId: input.userId,
          amountUsdCents: q.usdAmountCents,
          merchantSlug: intent.merchant?.slug ?? "unknown",
          reference: `AUTH-${refPrefix}`,
          forcedOutcome: forced,
          intentId: intent.id,
        });

        // 2g. If declined: reverse funding + refund wallet (STILL INSIDE TX)
        if (!auth.authorized) {
          await cleva.reverseCardFunding(tx, {
            userId: input.userId,
            amountUsdCents: q.usdAmountCents,
            reference: `REV-${refPrefix}`,
            intentId: intent.id,
          });
          await cleva.refundWalletNgn(tx, {
            userId: input.userId,
            amountKobo: q.totalNgnKobo,
            reference: `REF-${refPrefix}`,
            intentId: intent.id,
          });
        }

        // 2h. Write the transaction record
        const receiptId = `CLV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const transaction = await tx.transaction.create({
          data: {
            userId: input.userId,
            intentId: intent.id,
            quoteId: q.id,
            status: auth.authorized ? "SUCCEEDED" : "DECLINED",
            usdAmountCents: q.usdAmountCents,
            totalNgnKobo: q.totalNgnKobo,
            authorizationCode: auth.authorizationCode ?? null,
            declineReason: auth.declineReason ?? null,
            receiptId,
            idempotencyKey: input.idempotencyKey,
          },
        });

        // 2i. Update intent final status
        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: { status: auth.authorized ? "SUCCEEDED" : "FAILED" },
        });

        return { transaction, idempotentReplay: false };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30_000,
      }
    );
  } catch (error: unknown) {
    // ── 3. INSUFFICIENT_BALANCE POST-HANDLING ──
    if (error instanceof AppError && error.code === "INSUFFICIENT_BALANCE") {
      await prisma.paymentIntent.update({
        where: { id: input.intentId },
        data: { status: "FAILED" },
      });
      throw error;
    }

    // Map Prisma serialization conflict or unique constraint on concurrent confirm
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "P2034" || error.code === "P2002")
    ) {
      throw new AppError("INTENT_NOT_CONFIRMABLE");
    }

    throw error;
  }
}
