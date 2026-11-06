import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { SIMULATION_LABEL } from "@/lib/config";
import { formatDisplayNgn } from "@/lib/money";

function formatLedgerAmount(amount: number, currency: string): string {
  const sign = amount < 0 ? "-" : amount > 0 ? "+" : "";
  const abs = Math.abs(amount);
  if (currency === "NGN") {
    return `${sign}${formatDisplayNgn(abs)}`;
  }
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

function formatLedgerBalance(balance: number, currency: string): string {
  if (currency === "NGN") {
    return formatDisplayNgn(balance);
  }
  return `$${(balance / 100).toFixed(2)}`;
}

export async function GET(req: NextRequest) {
  const userContext = await requireUser(req);
  if (!userContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user, wallet } = userContext;

  const recentLedger = await prisma.ledgerEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    {
      simulation: SIMULATION_LABEL,
      wallet: {
        currency: "NGN",
        availableBalanceKobo: wallet.availableBalanceKobo,
        display: formatDisplayNgn(wallet.availableBalanceKobo),
        updatedAt: wallet.updatedAt.toISOString(),
      },
      recentLedger: recentLedger.map((entry) => ({
        id: entry.id,
        account: entry.account,
        type: entry.type,
        currency: entry.currency,
        amount: entry.amount,
        balanceAfter: entry.balanceAfter,
        reference: entry.reference,
        intentId: entry.intentId,
        createdAt: entry.createdAt.toISOString(),
        display: {
          amount: formatLedgerAmount(entry.amount, entry.currency),
          balanceAfter: formatLedgerBalance(entry.balanceAfter, entry.currency),
        },
      })),
    },
    { status: 200 }
  );
}
