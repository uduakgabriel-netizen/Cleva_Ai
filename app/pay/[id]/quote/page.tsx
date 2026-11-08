import { ConfirmButton } from "@/components/confirm-button";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { formatDisplayNgn } from "@/lib/money";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type QuotePageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuotePage({ params }: QuotePageProps) {
  const userContext = await requireUser();
  if (!userContext) {
    redirect("/sign-in");
  }

  const { id } = await params;

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

  if (!intent || !intent.quote) {
    return (
      <div className="max-w-md mx-auto py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-bold text-red-900">Unable to load quote</h2>
          <p className="text-sm text-red-700 mt-2">Payment intent or quote not found</p>
        </div>
      </div>
    );
  }

  const quote = intent.quote;
  const walletAvailable = userContext.wallet.availableBalanceKobo;
  const sufficientBalance = walletAvailable >= quote.totalNgnKobo;

  const display = {
    usd: `$${(quote.usdAmountCents / 100).toFixed(2)}`,
    convertedNgn: formatDisplayNgn(quote.convertedNgnKobo),
    feeNgn: formatDisplayNgn(quote.feeNgnKobo),
    totalNgn: formatDisplayNgn(quote.totalNgnKobo),
    fxRate: `₦${quote.fxRateNgnPerUsd.toLocaleString("en-US")} / $1`,
    expiresAt: quote.expiresAt.toISOString(),
    walletAvailable: formatDisplayNgn(walletAvailable),
  };

  const merchantName = intent.merchant?.name ?? intent.rawMerchant ?? "Merchant";

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Review &amp; Confirm</h1>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Merchant
          </p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {merchantName}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Plan
          </p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {intent.planName || "Custom"} {intent.interval ? `(${intent.interval})` : ""}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Price
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {display.usd}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              FX rate
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {display.fxRate}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Conversion
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {display.convertedNgn}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Fee
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {display.feeNgn}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Total
            </p>
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {display.totalNgn}
            </p>
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            Available balance: {display.walletAvailable}
          </p>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${
                sufficientBalance
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  sufficientBalance ? "bg-green-600 dark:bg-green-500" : "bg-red-600 dark:bg-red-500"
                }`}
              />
              {sufficientBalance ? "Sufficient balance" : "Insufficient balance"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 mt-0.5" />
          <p className="text-xs text-amber-800">
            <strong>Simulation only —</strong> no real payment will be made. This is a demo with mock
            wallets, cards, and FX.
          </p>
        </div>
      </div>

      <ConfirmButton
        intentId={intent.id}
        quoteId={quote.id}
        sufficientBalance={sufficientBalance}
        totalNgn={display.totalNgn}
      />
    </div>
  );
}
