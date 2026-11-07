import { TransactionList } from "@/components/transaction-list";

export const dynamic = "force-dynamic";

async function getTransactions() {
  const res = await fetch("/api/transactions?limit=20", { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  return json.transactions;
}

export default async function TransactionsPage() {
  const transactions = await getTransactions();

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Transactions</h1>
        <a
          href="/dashboard"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to dashboard
        </a>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <TransactionList transactions={transactions} />
      </div>
    </div>
  );
}
