export function VirtualCard({ card }: { card: { provider: string; currency: string; status: string; maskedPan: string; balanceCents: number } }) {
  const usd = card.balanceCents / 100;
  return (
    <div className="rounded-2xl border bg-gradient-to-tr from-blue-600 to-indigo-600 p-6 text-white shadow-md relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-20">
        <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <div className="relative z-10 flex justify-between items-start mb-8">
        <div>
          <span className="text-xs opacity-75 uppercase tracking-widest">
            {card.provider}
          </span>
          <h3 className="text-xl font-semibold mt-1">Cleva Virtual Card</h3>
        </div>
        <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
          V
        </span>
      </div>
      <div className="space-y-4 relative z-10">
        <div>
          <p className="text-xs opacity-75 uppercase tracking-widest">Card Number</p>
          <p className="text-lg font-mono">{card.maskedPan}</p>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs opacity-75 uppercase tracking-widest">Balance</p>
            <p className="text-xl font-bold">${usd.toFixed(2)}</p>
          </div>
          <span className={`px-2 py-0.5 rounded text-[0.65rem] font-medium border ${
            card.status === "ACTIVE"
              ? "border-green-300 text-green-300 bg-green-300/20"
              : "border-amber-300 text-amber-300 bg-amber-300/20"
          }`}>
            {card.status}
          </span>
        </div>
      </div>
    </div>
  );
}
