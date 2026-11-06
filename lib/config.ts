export const SIMULATION_LABEL = "Simulation only — no real payment was made";

export const DEMO_FX_RATE = Number(process.env.DEMO_FX_RATE || 1600);
export const DEMO_FEE_KOBO = Number(process.env.DEMO_FEE_KOBO || 50000); // ₦500 = 50,000 kobo
export const QUOTE_TTL_MINUTES = 10;
export const QUOTE_TTL_MS = QUOTE_TTL_MINUTES * 60 * 1000;

export const DEMO = {
  fxRateNgnPerUsd: DEMO_FX_RATE,
  feeNgnKobo: DEMO_FEE_KOBO,
  quoteTtlMs: QUOTE_TTL_MS,
} as const;

export const SEED_WALLET_BALANCE_KOBO = 10_000_000; // ₦100,000 = 10,000,000 kobo
export const SEED_CARD_BALANCE_CENTS = 0;
export const SEED_CARD_MASKED_PAN = "5399 •••• •••• 4242";
export const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL || "demo@cleva.ai";

export const CATALOGUE = [
  {
    slug: "gemini",
    name: "Gemini Advanced",
    usdAmountCents: 1999,
    interval: "MONTHLY" as const,
    supported: true,
  },
  {
    slug: "chatgpt",
    name: "ChatGPT Plus",
    usdAmountCents: 2000,
    interval: "MONTHLY" as const,
    supported: true,
  },
  {
    slug: "canva",
    name: "Canva Pro",
    usdAmountCents: 1500,
    interval: "MONTHLY" as const,
    supported: true,
  },
  {
    slug: "github",
    name: "GitHub Copilot Individual",
    usdAmountCents: 1000,
    interval: "MONTHLY" as const,
    supported: true,
  },
  {
    slug: "coursera",
    name: "Coursera Plus",
    usdAmountCents: 5900,
    interval: "MONTHLY" as const,
    supported: true,
  },
] as const;
