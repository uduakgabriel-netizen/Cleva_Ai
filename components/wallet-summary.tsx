export function WalletSummary({ balanceKobo }: { balanceKobo: number }) {
  const ngn = balanceKobo / 100;
  return (
    <div className="rounded-2xl border bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            NGN Wallet
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            ₦{ngn.toLocaleString("en-US")}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Available balance &bull; Simulated
          </p>
        </div>
      </div>
    </div>
  );
}
