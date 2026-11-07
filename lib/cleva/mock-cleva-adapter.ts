import { prisma } from "../db";
import { AppError } from "../errors";
import type { Prisma } from "@prisma/client";
import type {
  ClevaAdapter,
  WalletSnapshot,
  CardSnapshot,
  FundingResult,
} from "./adapter";

export class MockClevaAdapter implements ClevaAdapter {
  async getWallet(userId: string): Promise<WalletSnapshot> {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new AppError("WALLET_NOT_FOUND");
    }

    return {
      userId: wallet.userId,
      currency: "NGN",
      availableBalanceKobo: wallet.availableBalanceKobo,
      updatedAt: wallet.updatedAt,
    };
  }

  async getVirtualCard(userId: string): Promise<CardSnapshot> {
    const card = await prisma.virtualCard.findFirst({
      where: { userId },
      orderBy: { updatedAt: "asc" },
    });

    if (!card) {
      throw new AppError("CARD_NOT_FOUND");
    }

    return {
      userId: card.userId,
      currency: "USD",
      status: card.status as "ACTIVE" | "FROZEN",
      maskedPan: card.maskedPan,
      balanceCents: card.balanceCents,
    };
  }

  async debitWalletNgn(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      amountKobo: number;
      reference: string;
      intentId: string;
    }
  ): Promise<{ balanceAfterKobo: number }> {
    const { userId, amountKobo, reference, intentId } = input;

    if (
      typeof amountKobo !== "number" ||
      !Number.isInteger(amountKobo) ||
      amountKobo <= 0
    ) {
      throw new Error("amountKobo must be a positive integer");
    }

    const wallet = await tx.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new AppError("WALLET_NOT_FOUND");
    }

    if (wallet.availableBalanceKobo < amountKobo) {
      throw new AppError("INSUFFICIENT_BALANCE");
    }

    const updated = await tx.wallet.update({
      where: { userId },
      data: {
        availableBalanceKobo: {
          decrement: amountKobo,
        },
      },
    });

    await tx.ledgerEntry.create({
      data: {
        userId,
        intentId: intentId ?? null,
        account: "WALLET",
        type: "WALLET_DEBIT_FX",
        currency: "NGN",
        amount: -amountKobo,
        balanceAfter: updated.availableBalanceKobo,
        reference,
      },
    });

    return { balanceAfterKobo: updated.availableBalanceKobo };
  }

  async fundCard(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      amountUsdCents: number;
      reference: string;
      intentId: string;
    }
  ): Promise<FundingResult> {
    const { userId, amountUsdCents, reference, intentId } = input;

    if (
      typeof amountUsdCents !== "number" ||
      !Number.isInteger(amountUsdCents) ||
      amountUsdCents <= 0
    ) {
      throw new Error("amountUsdCents must be a positive integer");
    }

    const card = await tx.virtualCard.findFirst({
      where: { userId },
      orderBy: { updatedAt: "asc" },
    });

    if (!card) {
      throw new AppError("CARD_NOT_FOUND");
    }

    if (card.status !== "ACTIVE") {
      throw new AppError("CARD_FROZEN");
    }

    const updated = await tx.virtualCard.update({
      where: { id: card.id },
      data: {
        balanceCents: {
          increment: amountUsdCents,
        },
      },
    });

    await tx.ledgerEntry.create({
      data: {
        userId,
        intentId: intentId ?? null,
        account: "CARD",
        type: "CARD_FUND",
        currency: "USD",
        amount: amountUsdCents,
        balanceAfter: updated.balanceCents,
        reference,
      },
    });

    return {
      amountUsdCents,
      cardBalanceCents: updated.balanceCents,
      reference,
    };
  }

  async reverseCardFunding(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      amountUsdCents: number;
      reference: string;
      intentId: string;
    }
  ): Promise<void> {
    const { userId, amountUsdCents, reference, intentId } = input;

    if (
      typeof amountUsdCents !== "number" ||
      !Number.isInteger(amountUsdCents) ||
      amountUsdCents <= 0
    ) {
      throw new Error("amountUsdCents must be a positive integer");
    }

    const card = await tx.virtualCard.findFirst({
      where: { userId },
      orderBy: { updatedAt: "asc" },
    });

    if (!card) {
      throw new AppError("CARD_NOT_FOUND");
    }

    const updated = await tx.virtualCard.update({
      where: { id: card.id },
      data: {
        balanceCents: {
          decrement: amountUsdCents,
        },
      },
    });

    await tx.ledgerEntry.create({
      data: {
        userId,
        intentId: intentId ?? null,
        account: "CARD",
        type: "CARD_FUND_REVERSAL",
        currency: "USD",
        amount: -amountUsdCents,
        balanceAfter: updated.balanceCents,
        reference,
      },
    });
  }

  async refundWalletNgn(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      amountKobo: number;
      reference: string;
      intentId: string;
    }
  ): Promise<void> {
    const { userId, amountKobo, reference, intentId } = input;

    if (
      typeof amountKobo !== "number" ||
      !Number.isInteger(amountKobo) ||
      amountKobo <= 0
    ) {
      throw new Error("amountKobo must be a positive integer");
    }

    const wallet = await tx.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new AppError("WALLET_NOT_FOUND");
    }

    const updated = await tx.wallet.update({
      where: { userId },
      data: {
        availableBalanceKobo: {
          increment: amountKobo,
        },
      },
    });

    await tx.ledgerEntry.create({
      data: {
        userId,
        intentId: intentId ?? null,
        account: "WALLET",
        type: "WALLET_REFUND",
        currency: "NGN",
        amount: amountKobo,
        balanceAfter: updated.availableBalanceKobo,
        reference,
      },
    });
  }
}
