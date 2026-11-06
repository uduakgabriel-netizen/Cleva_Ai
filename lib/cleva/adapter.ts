import type { Prisma } from "@prisma/client";

export type WalletSnapshot = {
  userId: string;
  currency: "NGN";
  availableBalanceKobo: number;
  updatedAt: Date;
};

export type CardSnapshot = {
  userId: string;
  currency: "USD";
  status: "ACTIVE" | "FROZEN";
  maskedPan: string;
  balanceCents: number;
};

export type FundingResult = {
  amountUsdCents: number;
  cardBalanceCents: number;
  reference: string;
};

export type AuthorizationResult = {
  authorized: boolean;
  authorizationCode?: string;
  declineReason?: string;
};

export interface ClevaAdapter {
  getWallet(userId: string): Promise<WalletSnapshot>;
  getVirtualCard(userId: string): Promise<CardSnapshot>;

  debitWalletNgn(
    tx: Prisma.TransactionClient,
    i: {
      userId: string;
      amountKobo: number;
      reference: string;
      intentId: string;
    }
  ): Promise<{ balanceAfterKobo: number }>;

  fundCard(
    tx: Prisma.TransactionClient,
    i: {
      userId: string;
      amountUsdCents: number;
      reference: string;
      intentId: string;
    }
  ): Promise<FundingResult>;

  reverseCardFunding(
    tx: Prisma.TransactionClient,
    i: {
      userId: string;
      amountUsdCents: number;
      reference: string;
      intentId: string;
    }
  ): Promise<void>;

  refundWalletNgn(
    tx: Prisma.TransactionClient,
    i: {
      userId: string;
      amountKobo: number;
      reference: string;
      intentId: string;
    }
  ): Promise<void>;
}
