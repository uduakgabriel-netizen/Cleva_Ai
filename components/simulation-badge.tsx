export function SimulationBadge({ className }: { className?: string }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
        className,
      ].join(" ")}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
      Simulation only — no real payment was made
    </span>
  );
}
