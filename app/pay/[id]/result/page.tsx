import Link from "next/link";

import { PaymentStatus } from "@/components/payment-status";

export const dynamic = "force-dynamic";

type ResultPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ResultPage({ params }: ResultPageProps) {
  const { id } = await params;

  const res = await fetch(`/api/payment-intents/${id}`, { cache: "no-store" });
  if (!res.ok) {
    return (
      <div className="max-w-md mx-auto py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-bold text-red-900">Unable to load result</h2>
          <p className="text-sm text-red-700 mt-2">Transaction not found</p>
        </div>
      </div>
    );
  }

  const json = await res.json();
  const tx = json.intent.transaction;

  if (!tx) {
    return (
      <div className="max-w-md mx-auto py-10 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
        <p className="mt-4 text-zinc-500 dark:text-zinc-400">Processing payment…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Payment Result</h1>
        <a
          href="/dashboard"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to dashboard
        </a>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {tx.status === "SUCCEEDED" ? "Payment Successful" : "Payment Declined"}
          </h2>
          <span
            className={`px-3 py-1 rounded-full font-semibold ${
              tx.status === "SUCCEEDED"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {tx.status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Receipt ID
            </p>
            <p className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
              {tx.receiptId}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
              Authorization code
            </p>
            <p className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
              {tx.authorizationCode ?? "—"}
            </p>
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Amount</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              ${(tx.usdAmountCents / 100).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Total charged</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              ₦{(tx.totalNgnKobo / 100).toLocaleString()}
            </span>
          </div>
          {tx.declineReason && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Reason</span>
              <span className="text-sm text-red-600 dark:text-red-400">{tx.declineReason}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Link
            href={`/transactions/${tx.id}`}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors text-center"
          >
            View details
          </Link>
          <Link
            href="/dashboard"
            className="flex-1 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium py-3 rounded-lg transition-colors text-center"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
