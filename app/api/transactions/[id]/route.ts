import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { SIMULATION_LABEL } from "@/lib/config";
import { formatDisplayNgn, formatUsd } from "@/lib/money";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const userContext = await requireUser(req);
  if (!userContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const transaction = await prisma.transaction.findFirst({
    where: {
      id,
      userId: userContext.user.id,
    },
    include: {
      intent: {
        include: {
          merchant: true,
        },
      },
      quote: true,
    },
  });

  if (!transaction) {
    return NextResponse.json(
      { error: "TRANSACTION_NOT_FOUND", message: "Transaction not found" },
      { status: 404 }
    );
  }

  const q = transaction.quote;
  const merchantName = transaction.intent?.merchant?.name ?? "Unknown";
  const merchantSlug = transaction.intent?.merchant?.slug ?? "unknown";
  const planName = transaction.intent?.planName ?? "Unknown";
  const interval = transaction.intent?.interval ?? "MONTHLY";

  const display = {
    usd: formatUsd(transaction.usdAmountCents),
    convertedNgn: q ? formatDisplayNgn(q.convertedNgnKobo) : formatDisplayNgn(transaction.totalNgnKobo),
    feeNgn: q ? formatDisplayNgn(q.feeNgnKobo) : "₦500",
    totalNgn: formatDisplayNgn(transaction.totalNgnKobo),
    fxRate: q ? `₦${q.fxRateNgnPerUsd.toLocaleString("en-US")} / $1` : "₦1,600 / $1",
  };

  return NextResponse.json(
    {
      simulation: SIMULATION_LABEL,
      transaction: {
        id: transaction.id,
        status: transaction.status,
        receiptId: transaction.receiptId,
        authorizationCode: transaction.authorizationCode,
        declineReason: transaction.declineReason,
        usdAmountCents: transaction.usdAmountCents,
        totalNgnKobo: transaction.totalNgnKobo,
        merchant: {
          name: merchantName,
          slug: merchantSlug,
        },
        plan: {
          name: planName,
          interval,
        },
        quote: q
          ? {
              usdAmountCents: q.usdAmountCents,
              fxRateNgnPerUsd: q.fxRateNgnPerUsd,
              convertedNgnKobo: q.convertedNgnKobo,
              feeNgnKobo: q.feeNgnKobo,
              totalNgnKobo: q.totalNgnKobo,
              assumptions: q.assumptions,
            }
          : null,
        createdAt: transaction.createdAt.toISOString(),
        display,
      },
    },
    { status: 200 }
  );
}
