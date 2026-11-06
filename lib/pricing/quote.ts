import { DEMO } from "../config";

export type QuoteBreakdown = {
  usdAmountCents: number; // input echoed
  fxRateNgnPerUsd: number; // from config
  convertedNgnKobo: number; // usdAmountCents × fxRateNgnPerUsd
  feeNgnKobo: number; // from config
  totalNgnKobo: number; // converted + fee
  assumptions: string; // human-readable string
  expiresAt: Date; // now + quoteTtlMs
};

const POSTGRES_INT_MAX = 2_147_483_647;

export function buildQuote(
  usdAmountCents: number,
  now: Date = new Date(),
  config = DEMO
): QuoteBreakdown {
  const { fxRateNgnPerUsd, feeNgnKobo, quoteTtlMs } = config;

  // Defensive validation against bad env or runtime config
  if (
    typeof fxRateNgnPerUsd !== "number" ||
    !Number.isInteger(fxRateNgnPerUsd) ||
    fxRateNgnPerUsd <= 0
  ) {
    throw new Error("fxRateNgnPerUsd must be a positive integer");
  }

  if (
    typeof feeNgnKobo !== "number" ||
    !Number.isInteger(feeNgnKobo) ||
    feeNgnKobo <= 0
  ) {
    throw new Error("feeNgnKobo must be a positive integer");
  }

  // Input guards
  if (
    typeof usdAmountCents !== "number" ||
    !Number.isFinite(usdAmountCents) ||
    !Number.isInteger(usdAmountCents) ||
    usdAmountCents <= 0
  ) {
    throw new Error("usdAmountCents must be positive");
  }

  // Integer math only - zero float arithmetic
  const convertedNgnKobo = usdAmountCents * fxRateNgnPerUsd;
  const totalNgnKobo = convertedNgnKobo + feeNgnKobo;

  // Postgres 32-bit signed integer overflow guard
  if (totalNgnKobo > POSTGRES_INT_MAX || convertedNgnKobo > POSTGRES_INT_MAX) {
    throw new Error("Quote exceeds supported range");
  }

  const expiresAt = new Date(now.getTime() + quoteTtlMs);

  const assumptions = `Illustrative demo FX rate ₦${fxRateNgnPerUsd}/$1 and flat ₦${
    feeNgnKobo / 100
  } service fee. Quote valid ${Math.round(
    quoteTtlMs / 60000
  )} minutes. Catalogue price is a demo reference value, not a live merchant price.`;

  return {
    usdAmountCents,
    fxRateNgnPerUsd,
    convertedNgnKobo,
    feeNgnKobo,
    totalNgnKobo,
    assumptions,
    expiresAt,
  };
}
