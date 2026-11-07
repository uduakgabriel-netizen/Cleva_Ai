import Link from "next/link";

export function TransactionList({ transactions }: { transactions: Array<{ id: string; status: string; receiptId: string; usdAmountCents: number; totalNgnKobo: number; merchantName: string; planName: string; createdAt: string }> }) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-8 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">No transactions yet</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          Complete a payment to see history here
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b bg-zinc-50 dark:bg-zinc-800">
            <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">Receipt</th>
            <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">Merchant / Plan</th>
            <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300 text-right">Amount</th>
            <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300 text-right">Status</th>
            <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/transactions/${tx.id}`}
                  className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {tx.receiptId}
                </Link>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{tx.merchantName}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{tx.planName}</p>
              </td>
              <td className="px-4 py-3 text-right">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  ${(tx.usdAmountCents / 100).toFixed(2)} / ₦{(tx.totalNgnKobo / 100).toLocaleString()}
                </p>
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                    tx.status === "SUCCEEDED"
                      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                      : tx.status === "DECLINED"
                        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {tx.status === "SUCCEEDED" ? "✓" : tx.status === "DECLINED" ? "✗" : "…"}
                  {tx.status}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                {new Date(tx.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
