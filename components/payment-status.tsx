export function PaymentStatus({ currentStep }: { currentStep: string }) {
  return (
    <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Payment Processing</h2>
        <span className="px-2 py-0.5 rounded text-[0.65rem] font-medium border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 animate-pulse">
          Processing…
        </span>
      </div>
      <div className="space-y-3">
        {[
          { label: "Validating quote", desc: "Checking quote expiry and merchant" },
          { label: "Checking wallet", desc: "Verifying NGN balance" },
          { label: "Funding virtual card", desc: "Just-in-time USD card top-up" },
          { label: "Authorizing payment", desc: "Mock merchant charge" },
        ].map((s, i) => {
          const active = s.label.toLowerCase().includes(currentStep);
          return (
            <div key={s.label} className="flex items-center gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                active ? "bg-blue-600 border-blue-600 text-white animate-ping" : "border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-500"
              }`}>
                {i + 1}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${active ? "text-blue-700 dark:text-blue-400" : "text-zinc-600 dark:text-zinc-400"}`}>
                  {s.label}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
                  {active ? "In progress…" : s.desc}
                </p>
              </div>
              {i < 3 && <div className="w-px h-4 mx-2 bg-zinc-200 dark:bg-zinc-700" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
