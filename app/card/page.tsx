import { WalletSummary } from "@/components/wallet-summary";
import { VirtualCard } from "@/components/virtual-card";
import { SimulationBadge } from "@/components/simulation-badge";
import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CardPage() {
  const userContext = await requireUser();
  if (!userContext) {
    redirect("/sign-in");
  }

  const { wallet, card } = userContext;

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Card & Wallet</h1>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <WalletSummary balanceKobo={wallet.availableBalanceKobo} />
        </div>
        <div className="flex-1">
          <VirtualCard card={card} />
        </div>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Simulation Notice</h2>
          <SimulationBadge className="text-[0.65rem]" />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          All wallet balances, card details, FX rates, and payment outcomes on this page are simulated
          for hackathon demonstration purposes. No real money, cards, or merchant transactions are
          involved.
        </p>
      </div>
    </div>
  );
}
