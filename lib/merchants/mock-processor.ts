import type { Prisma } from "@prisma/client";
import { AppError } from "../errors";

export type ForcedOutcome = "SUCCESS" | "DECLINE";

export type AuthorizationResult = {
  authorized: boolean;
  authorizationCode?: string;
  declineReason?: string;
};

export const mockProcessor = {
  async authorizeCardPayment(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      amountUsdCents: number;
      merchantSlug: string;
      reference: string;
      forcedOutcome: ForcedOutcome;
      intentId?: string;
    }
  ): Promise<AuthorizationResult> {
    // 1. Load card; missing → CARD_NOT_FOUND
    const card = await tx.virtualCard.findFirst({
      where: { userId: input.userId },
      orderBy: { updatedAt: "asc" },
    });

    if (!card) {
      throw new AppError("CARD_NOT_FOUND");
    }

    // 2. If status !== ACTIVE → CARD_FROZEN
    if (card.status !== "ACTIVE") {
      throw new AppError("CARD_FROZEN");
    }

    // 3. If forcedOutcome === "DECLINE":
    //    return { authorized: false, declineReason: "DEMO_FORCED_DECLINE" }
    //    NO ledger entry — declined auths don't debit
    if (input.forcedOutcome === "DECLINE") {
      return { authorized: false, declineReason: "DEMO_FORCED_DECLINE" };
    }

    // 4. If card.balanceCents < amountUsdCents:
    if (card.balanceCents < input.amountUsdCents) {
      return { authorized: false, declineReason: "INSUFFICIENT_CARD_BALANCE" };
    }

    // 5. Otherwise (happy auth):
    //    Update card: { balanceCents: { decrement: amountUsdCents } }
    //    Write LedgerEntry: account "CARD", type "CARD_AUTH", currency "USD",
    //    amount -amountUsdCents, balanceAfter updated, reference
    const updated = await tx.virtualCard.update({
      where: { id: card.id },
      data: {
        balanceCents: {
          decrement: input.amountUsdCents,
        },
      },
    });

    const intent = input.intentId
      ? await tx.paymentIntent.findUnique({
          where: { id: input.intentId },
          select: { id: true },
        })
      : null;

    await tx.ledgerEntry.create({
      data: {
        userId: input.userId,
        intentId: intent?.id ?? null,
        account: "CARD",
        type: "CARD_AUTH",
        currency: "USD",
        amount: -input.amountUsdCents,
        balanceAfter: updated.balanceCents,
        reference: input.reference,
      },
    });

    return {
      authorized: true,
      authorizationCode: `MOCK-${input.reference.slice(-8).toUpperCase()}`,
    };
  },
};
