import { auth, currentUser } from "@clerk/nextjs/server";
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
 */
export async function requireUser(req?: NextRequest): Promise<AuthenticatedContext | null> {
  let clerkUserId: string | null = null;

  try {
    const session = await auth();
    clerkUserId = session.userId;
  } catch {
    // Outside active Clerk context or in test scripts
  }

  // In non-production testing, allow simulated authenticated session via internal test header
  if (!clerkUserId && process.env.NODE_ENV !== "production") {
    if (req) {
      clerkUserId = req.headers.get("x-cleva-test-session-clerk-id");
    } else {
      try {
        const headerList = await headers();
        clerkUserId = headerList.get("x-cleva-test-session-clerk-id");
      } catch {
        // outside headers context
      }
    }
  }

  if (!clerkUserId) {
    return null;
  }

  let user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      wallet: true,
      cards: {
        orderBy: { updatedAt: "asc" },
      },
    },
  });

  if (!user || !user.wallet || !user.cards || user.cards.length === 0) {
    try {
      const clerkUser = await currentUser().catch(() => null);
      const primaryEmail =
        clerkUser?.emailAddresses?.[0]?.emailAddress ||
        `${clerkUserId}@placeholder.cleva.ai`;
      const name =
        [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
        "User";

      user = await prisma.$transaction(async (tx) => {
        let u = await tx.user.findUnique({
          where: { clerkUserId },
        });

        if (!u) {
          const existingByEmail = await tx.user.findUnique({
            where: { email: primaryEmail },
          });

          if (existingByEmail) {
            u = await tx.user.update({
              where: { id: existingByEmail.id },
              data: {
                clerkUserId,
                name: existingByEmail.name || name,
              },
            });
          } else {
            u = await tx.user.create({
              data: {
                clerkUserId,
                email: primaryEmail,
                name,
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
    } catch (err) {
      console.error("Auto-provisioning user failed:", err);
      return null;
    }
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
