// Illustrative demo prices only. Never present as live merchant prices.

export type BillingInterval = "MONTHLY" | "YEARLY" | "ONE_TIME";

export type CataloguePlan = {
  readonly merchantSlug: string;
  readonly merchantName: string;
  readonly planId: string;
  readonly planName: string;
  readonly usdAmountCents: number;
  readonly interval: BillingInterval;
  readonly aliases: readonly string[]; // lowercase, used for text matching
  readonly hosts: readonly string[]; // lowercase, used for URL matching
};

export const CATALOGUE: readonly CataloguePlan[] = [
  {
    merchantSlug: "gemini",
    merchantName: "Gemini Advanced",
    planId: "gemini-advanced",
    planName: "Gemini Advanced",
    usdAmountCents: 1999,
    interval: "MONTHLY",
    aliases: [
      "gemini",
      "gemini advanced",
      "google gemini",
      "google one ai premium",
    ],
    hosts: ["gemini.google.com", "one.google.com"],
  },
  {
    merchantSlug: "chatgpt",
    merchantName: "ChatGPT Plus",
    planId: "chatgpt-plus",
    planName: "ChatGPT Plus",
    usdAmountCents: 2000,
    interval: "MONTHLY",
    aliases: ["chatgpt", "chat gpt", "chatgpt plus", "openai"],
    hosts: ["chat.openai.com", "chatgpt.com"],
  },
  {
    merchantSlug: "canva",
    merchantName: "Canva Pro",
    planId: "canva-pro",
    planName: "Canva Pro",
    usdAmountCents: 1500,
    interval: "MONTHLY",
    aliases: ["canva", "canva pro"],
    hosts: ["canva.com"],
  },
  {
    merchantSlug: "github",
    merchantName: "GitHub Copilot Individual",
    planId: "copilot-individual",
    planName: "GitHub Copilot Individual",
    usdAmountCents: 1000,
    interval: "MONTHLY",
    aliases: ["github", "copilot", "github copilot"],
    hosts: ["github.com"],
  },
  {
    merchantSlug: "coursera",
    merchantName: "Coursera Plus",
    planId: "coursera-plus",
    planName: "Coursera Plus",
    usdAmountCents: 5900,
    interval: "MONTHLY",
    aliases: ["coursera", "coursera plus"],
    hosts: ["coursera.org"],
  },
] as const;
