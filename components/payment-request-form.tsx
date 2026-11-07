"use client";

import { useState } from "react";

type FormData = {
  inputText: string;
  url: string;
};

export function PaymentRequestForm({ onSubmit }: { onSubmit: (data: FormData) => Promise<void> }) {
  const [form, setForm] = useState<FormData>({ inputText: "", url: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const examples = [
    "Pay for Gemini Advanced",
    "I want ChatGPT plus",
    "canva pro please",
    "github copilot",
    "coursera plus",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit({ ...form });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          What do you want to pay for?
        </label>
        <textarea
          value={form.inputText}
          onChange={(e) => setForm({ ...form, inputText: e.target.value })}
          placeholder="e.g. Pay for Gemini Advanced"
          rows={3}
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Type a subscription name or paste a merchant URL
        </p>
      </div>

      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Or paste a URL
        </label>
        <input
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="https://gemini.google.com/advanced"
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
          disabled={loading}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading || (!form.inputText.trim() && !form.url.trim())}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
        >
          {loading ? "Preparing quote…" : "Get Quote"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Try these:</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => setForm({ ...form, inputText: ex })}
              disabled={loading}
              className="text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
