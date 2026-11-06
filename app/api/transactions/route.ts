import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { SIMULATION_LABEL } from "@/lib/config";
import { formatDisplayNgn, formatUsd } from "@/lib/money";

export async function GET(req: NextRequest) {
  const userContext = await requireUser(req);
  if (!userContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawLimit = Number(searchParams.get("limit") || 20);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 50);
  const cursor = searchParams.get("cursor") || undefined;

  const items = await prisma.transaction.findMany({
    where: { userId: userContext.user.id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      intent: {
        include: {
          merchant: true,
        },
      },
    },
  });

  let nextCursor: string | null = null;
  let transactionsToReturn = items;

  if (items.length > limit) {
    nextCursor = items[limit].id;
    transactionsToReturn = items.slice(0, limit);
  }

  return NextResponse.json(
    {
      simulation: SIMULATION_LABEL,
      transactions: transactionsToReturn.map((tx) => ({
        id: tx.id,
        status: tx.status,
        receiptId: tx.receiptId,
        usdAmountCents: tx.usdAmountCents,
        totalNgnKobo: tx.totalNgnKobo,
        authorizationCode: tx.authorizationCode,
        declineReason: tx.declineReason,
        merchantName: tx.intent?.merchant?.name ?? tx.intent?.planName ?? "Unknown",
        planName: tx.intent?.planName ?? "Unknown",
        createdAt: tx.createdAt.toISOString(),
        display: {
          usd: formatUsd(tx.usdAmountCents),
          totalNgn: formatDisplayNgn(tx.totalNgnKobo),
        },
      })),
      nextCursor,
    },
    { status: 200 }
  );
}
