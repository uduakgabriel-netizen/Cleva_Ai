import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
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
