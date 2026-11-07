"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PayPage() {
  const router = useRouter();

  const handleSubmit = async (data: { inputText: string; url: string }) => {
    try {
      const res = await fetch("/api/payment-intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create payment intent");
      }

      const json = await res.json();
      const intentId = json.intent.id;
      router.push(`/pay/${intentId}/quote`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create payment intent");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">New Payment</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Describe what you want to pay for, or paste a merchant URL.
        </p>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const inputText = formData.get("inputText") as string;
            const url = formData.get("url") as string;
            handleSubmit({ inputText, url });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              What do you want to pay for?
            </label>
            <textarea
              name="inputText"
              placeholder="e.g. Pay for Gemini Advanced"
              rows={3}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Type a subscription name or paste a merchant URL
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Or paste a URL
            </label>
            <input
              name="url"
              placeholder="https://gemini.google.com/advanced"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Get Quote
          </button>
        </form>
      </div>
    </div>
  );
}
