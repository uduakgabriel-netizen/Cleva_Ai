import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "../db";
import {
  SEED_WALLET_BALANCE_KOBO,
  SEED_CARD_BALANCE_CENTS,
  SEED_CARD_MASKED_PAN,
} from "../config";
import type { User, Wallet, VirtualCard } from "@prisma/client";

export interface AuthenticatedContext {
  user: User;
  wallet: Wallet;
  card: VirtualCard;
}

/**
 * requireUser() is the ONLY place the app learns who the user is.
 * Every API route calls it first.
 * Never read body.userId, searchParams.userId, or headers["x-user-id"].
 *
 * Returns { user, wallet, card } from the DB, or null if unauthenticated.
 * Automatically provisions the user, wallet, and card on-demand if missing.
 *
 * Clerk has been removed. In non-production the session is resolved from the
 * internal `x-cleva-test-session-clerk-id` header, falling back to the seeded
 * demo user so the app runs without any external auth provider.
 */
export async function requireUser(req?: NextRequest): Promise<AuthenticatedContext | null> {
  let userId: string | null = null;

  // Simulated authenticated session via internal test header (non-production).
  if (!userId && process.env.NODE_ENV !== "production") {
    if (req) {
      userId = req.headers.get("x-cleva-test-session-clerk-id");
    } else {
      try {
        const headerList = await headers();
        userId = headerList.get("x-cleva-test-session-clerk-id");
      } catch {
        // outside headers context
      }
    }
  }

  // Non-production fallback to the seeded demo user so dev works out of the box.
  if (!userId && process.env.NODE_ENV !== "production") {
    userId = "user_demo_seed_clerk_id";
  }

  if (!userId) {
    return null;
  }

  let user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      wallet: true,
      cards: {
        orderBy: { updatedAt: "asc" },
      },
    },
  });

  if (!user || !user.wallet || !user.cards || user.cards.length === 0) {
    const primaryEmail = `${userId}@placeholder.cleva.ai`;

    user = await prisma.$transaction(async (tx) => {
      let u = await tx.user.findUnique({
        where: { clerkUserId: userId },
      });

      if (!u) {
        const existingByEmail = await tx.user.findUnique({
          where: { email: primaryEmail },
        });

        if (existingByEmail) {
          u = await tx.user.update({
            where: { id: existingByEmail.id },
            data: {
              clerkUserId: userId,
              name: existingByEmail.name || "Demo User",
            },
          });
        } else {
          u = await tx.user.create({
            data: {
              clerkUserId: userId,
              email: primaryEmail,
              name: "Demo User",
              demoOutcome: "SUCCESS",
            },
          });
        }
      }

      let wallet = await tx.wallet.findUnique({
        where: { userId: u.id },
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: u.id,
            currency: "NGN",
            availableBalanceKobo: SEED_WALLET_BALANCE_KOBO,
          },
        });
      }

      let card = await tx.virtualCard.findFirst({
        where: { userId: u.id },
      });

      if (!card) {
        card = await tx.virtualCard.create({
          data: {
            userId: u.id,
            provider: "MOCK_CLEVA",
            currency: "USD",
            status: "ACTIVE",
            maskedPan: SEED_CARD_MASKED_PAN,
            balanceCents: SEED_CARD_BALANCE_CENTS,
          },
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: u.id },
        include: {
          wallet: true,
          cards: {
            orderBy: { updatedAt: "asc" },
          },
        },
      });
    });
  }

  if (!user || !user.wallet || !user.cards || user.cards.length === 0) {
    return null;
  }

  return {
    user,
    wallet: user.wallet,
    card: user.cards[0],
  };
}
