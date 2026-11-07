"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ConfirmButtonProps = {
  intentId: string;
  quoteId: string;
  sufficientBalance: boolean;
  totalNgn: string;
};

export function ConfirmButton({ intentId, quoteId, sufficientBalance, totalNgn }: ConfirmButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/payment-intents/${intentId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
          idempotencyKey: `confirm-${intentId}-${Date.now()}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Confirmation failed");
      }
      router.push(`/pay/${intentId}/result`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setConfirming(false);
    }
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm">
        {error}
      </div>
    );
  }

  return (
    <button
      onClick={handleConfirm}
      disabled={confirming || !sufficientBalance}
      className={[
        "w-full py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        !sufficientBalance
          ? "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          : "bg-blue-600 hover:bg-blue-700 text-white",
      ].join(" ")}
    >
      {confirming ? "Confirming payment…" : `Confirm payment — ${totalNgn}`}
    </button>
  );
}
