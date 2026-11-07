import { SimulationBadge } from "./simulation-badge";

type QuoteCardProps = {
  usd: string;
  convertedNgn: string;
  feeNgn: string;
  totalNgn: string;
  fxRate: string;
  expiresAt: string;
  walletAvailable: string;
  sufficientBalance: boolean;
  onConfirm: () => void;
  loading?: boolean;
};

export function PaymentQuoteCard({
  usd,
  convertedNgn,
  feeNgn,
  totalNgn,
  fxRate,
  expiresAt,
  walletAvailable,
  sufficientBalance,
  onConfirm,
  loading = false,
}: QuoteCardProps) {
  return (
    <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Quote &amp; Review</h2>
        <SimulationBadge className="text-[0.65rem]" />
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Subscription price</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{usd}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">FX conversion ({fxRate})</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{convertedNgn}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Service fee</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{feeNgn}</span>
        </div>
        <div className="border-t pt-3 flex justify-between items-center">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">Total payable</span>
          <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{totalNgn}</span>
        </div>
      </div>

      <div className="rounded-lg border bg-amber-50 p-4 mb-6">
        <p className="text-xs text-amber-800 mb-2">
          <span className="font-bold">Quote valid until:</span>{" "}
          {new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="text-xs text-amber-700">
          Illustrative demo FX rate and flat service fee. Catalogue price is a demo reference value,
          not a live merchant price.
        </p>
      </div>

      <div className="rounded-lg border p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Available wallet balance</span>
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{walletAvailable}</span>
        </div>
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

      <button
        onClick={onConfirm}
        disabled={loading || !sufficientBalance}
        className={[
          "w-full py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          !sufficientBalance
            ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            : "bg-blue-600 hover:bg-blue-700 text-white",
        ].join(" ")}
      >
        {loading ? "Confirming payment..." : `Confirm payment — ${totalNgn}`}
      </button>
    </div>
  );
}
