/**
 * Money utilities adhering to HARD RULE 1:
 * Money is stored and computed as INTEGER MINOR UNITS only (kobo for NGN, cents for USD). Zero floats. Zero decimals.
 */

export function koboToNgn(kobo: number): number {
  return kobo / 100;
}

export function ngnToKobo(ngn: number): number {
  return Math.round(ngn * 100);
}

export function centsToUsd(cents: number): number {
  return cents / 100;
}

export function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

export function formatNgn(kobo: number): string {
  const ngn = kobo / 100;
  return `₦${ngn.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatUsd(cents: number): string {
  const usd = cents / 100;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
