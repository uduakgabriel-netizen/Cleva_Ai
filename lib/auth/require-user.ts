import { auth } from "@clerk/nextjs/server";
import { prisma } from "../db";
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
 * Returns { user, wallet, card } from the DB, or null if unauthenticated or pending provisioning.
 */
export async function requireUser(): Promise<AuthenticatedContext | null> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      wallet: true,
      cards: {
        orderBy: { updatedAt: "asc" },
      },
    },
  });

  if (!user || !user.wallet || !user.cards || user.cards.length === 0) {
    // User row does not exist yet (e.g. webhook race) or wallet/card provisioning is pending
    return null;
  }

  return {
    user,
    wallet: user.wallet,
    card: user.cards[0],
  };
}
