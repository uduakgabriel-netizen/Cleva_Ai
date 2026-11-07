import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[0.75rem] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
          Simulation only — no real payment was made
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-50">
          Cleva AI
        </h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
          Tell Cleva what you want to pay for. Review the total. Confirm. Cleva handles the payment
          flow — simulated wallet, virtual card, FX, and authorization.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            Open Demo Dashboard
          </Link>
          <Link
            href="/pay"
            className="px-6 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Start a Payment
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Gemini Advanced</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">$19.99/month</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">₦32,484 total (demo FX + fee)</p>
          </div>
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">ChatGPT Plus</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">$20.00/month</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">₦32,500 total (demo FX + fee)</p>
          </div>
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Canva Pro</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">$15.00/month</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">₦24,500 total (demo FX + fee)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
