import { ConfirmButton } from "@/components/confirm-button";

export const dynamic = "force-dynamic";

type QuotePageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuotePage({ params }: QuotePageProps) {
  const { id } = await params;

  const res = await fetch(`/api/payment-intents/${id}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json();
    return (
      <div className="max-w-md mx-auto py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-bold text-red-900">Unable to load quote</h2>
          <p className="text-sm text-red-700 mt-2">{err.message ?? "Unknown error"}</p>
        </div>
      </div>
    );
  }

  const data = await res.json();
  const { intent } = data;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Review &amp; Confirm</h1>
        <a
          href="/dashboard"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to dashboard
        </a>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Merchant
          </p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {intent.merchant}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Plan
          </p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {intent.plan} ({intent.interval})
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Price
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {intent.display.usd}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              FX rate
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {intent.display.fxRate}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Conversion
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {intent.display.convertedNgn}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Fee
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {intent.display.feeNgn}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Total
            </p>
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {intent.display.totalNgn}
            </p>
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            Available balance: {intent.display.walletAvailable}
          </p>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${
                intent.sufficientBalance
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  intent.sufficientBalance ? "bg-green-600 dark:bg-green-500" : "bg-red-600 dark:bg-red-500"
                }`}
              />
              {intent.sufficientBalance ? "Sufficient balance" : "Insufficient balance"}
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
        quoteId={intent.quoteId}
        sufficientBalance={intent.sufficientBalance}
        totalNgn={intent.display.totalNgn}
      />
    </div>
  );
}
