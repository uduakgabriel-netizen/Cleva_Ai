import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { SIMULATION_LABEL } from "@/lib/config";
import { formatDisplayNgn } from "@/lib/money";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. requireUser() → 401
  const userContext = await requireUser(req);
  if (!userContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  // 2. Load intent scoped to userId → 404 INTENT_NOT_FOUND if missing OR wrong user
  const intent = await prisma.paymentIntent.findFirst({
    where: {
      id,
      userId: userContext.user.id,
    },
    include: {
      quote: true,
      merchant: true,
      transaction: true,
    },
  });

  if (!intent) {
    return NextResponse.json(
      {
        error: "INTENT_NOT_FOUND",
        message: "Payment intent not found",
      },
      { status: 404 }
    );
  }

  const quote = intent.quote;
  const walletAvailable = userContext.wallet.availableBalanceKobo;
  const sufficientBalance = quote ? walletAvailable >= quote.totalNgnKobo : false;

  const display = quote
    ? {
        usd: `$${(quote.usdAmountCents / 100).toFixed(2)}`,
        convertedNgn: formatDisplayNgn(quote.convertedNgnKobo),
        feeNgn: formatDisplayNgn(quote.feeNgnKobo),
        totalNgn: formatDisplayNgn(quote.totalNgnKobo),
        fxRate: `₦${quote.fxRateNgnPerUsd.toLocaleString("en-US")} / $1`,
        expiresAt: quote.expiresAt.toISOString(),
        walletAvailable: formatDisplayNgn(walletAvailable),
      }
    : null;

  return NextResponse.json(
    {
      simulation: SIMULATION_LABEL,
      intent: {
        id: intent.id,
        status: intent.status,
        merchant: intent.merchant?.name ?? intent.planName ?? "Unknown",
        plan: intent.planName,
        interval: intent.interval,
        confidence: intent.confidence,
        parsedBy: intent.parsedBy,
        reasoning: intent.reasoning,
        rawMerchant: intent.rawMerchant,
        quoteId: quote?.id ?? null,
        display,
        quote: quote
          ? {
              usdAmountCents: quote.usdAmountCents,
              fxRateNgnPerUsd: quote.fxRateNgnPerUsd,
              convertedNgnKobo: quote.convertedNgnKobo,
              feeNgnKobo: quote.feeNgnKobo,
              totalNgnKobo: quote.totalNgnKobo,
              assumptions: quote.assumptions,
              expiresAt: quote.expiresAt.toISOString(),
            }
          : null,
        walletAvailable,
        sufficientBalance,
        transaction: intent.transaction
          ? {
              id: intent.transaction.id,
              status: intent.transaction.status,
              receiptId: intent.transaction.receiptId,
              createdAt: intent.transaction.createdAt.toISOString(),
            }
          : null,
      },
    },
    { status: 200 }
  );
}
