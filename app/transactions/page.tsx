import { TransactionList } from "@/components/transaction-list";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const userContext = await requireUser();
  if (!userContext) {
    redirect("/sign-in");
  }

  const rawTransactions = await prisma.transaction.findMany({
    where: { userId: userContext.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      intent: {
        include: {
          merchant: true,
        },
      },
    },
  });

  const transactions = rawTransactions.map((tx) => ({
    id: tx.id,
    status: tx.status,
    receiptId: tx.receiptId,
    usdAmountCents: tx.usdAmountCents,
    totalNgnKobo: tx.totalNgnKobo,
    merchantName: tx.intent?.merchant?.name ?? tx.intent?.planName ?? "Unknown",
    planName: tx.intent?.planName ?? "Unknown",
    createdAt: tx.createdAt.toISOString(),
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Transactions</h1>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <TransactionList transactions={transactions} />
      </div>
    </div>
  );
}
