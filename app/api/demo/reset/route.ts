import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { SEED_WALLET_BALANCE_KOBO } from "@/lib/config";
import { formatDisplayNgn, formatUsd } from "@/lib/money";

export async function POST(req: NextRequest) {
  // Guard: DEMO_MODE must be true
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Demo reset endpoint disabled" },
      { status: 404 }
    );
  }

  const userContext = await requireUser(req);
  if (!userContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user } = userContext;

  // Option 2 (Design Decision): Reset by clearing demo history for this user and resetting balances to seed
  await prisma.$transaction(async (tx) => {
    await tx.transaction.deleteMany({ where: { userId: user.id } });
    await tx.ledgerEntry.deleteMany({ where: { userId: user.id } });
    await tx.quote.deleteMany({ where: { intent: { userId: user.id } } });
    await tx.paymentIntent.deleteMany({ where: { userId: user.id } });

    await tx.wallet.update({
      where: { userId: user.id },
      data: { availableBalanceKobo: SEED_WALLET_BALANCE_KOBO },
    });

    await tx.virtualCard.updateMany({
      where: { userId: user.id },
      data: { balanceCents: 0, status: "ACTIVE" },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { demoOutcome: "SUCCESS" },
    });
  });

  return NextResponse.json(
    {
      ok: true,
      walletDisplay: formatDisplayNgn(SEED_WALLET_BALANCE_KOBO),
      cardDisplay: formatUsd(0),
    },
    { status: 200 }
  );
}
