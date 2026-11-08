import { WalletSummary } from "@/components/wallet-summary";
import { VirtualCard } from "@/components/virtual-card";
import { SimulationBadge } from "@/components/simulation-badge";
import { TransactionList } from "@/components/transaction-list";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userContext = await requireUser();
  if (!userContext) {
    redirect("/sign-in");
  }

  const { user, wallet, card } = userContext;

  const rawTransactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Your simulated Cleva payment assistant
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SimulationBadge className="text-[0.65rem]" />
        </div>
      </div>

      <WalletSummary balanceKobo={wallet.availableBalanceKobo} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-1">
          <VirtualCard card={card} />
        </div>
        <div className="lg:col-span-1">
          <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              Quick Pay
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Tell Cleva what you want to pay for and get a quote instantly.
            </p>
            <Link
              href="/pay"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors text-center block"
            >
              Start a payment
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Recent Transactions
          </h2>
          <Link
            href="/transactions"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all
          </Link>
        </div>
        <TransactionList transactions={transactions} />
      </div>
    </div>
  );
}
