import { describe, it, expect } from "vitest";
import { buildQuote } from "./quote";
import { formatNgn } from "../money";

describe("lib/pricing/quote.ts — Quote Engine", () => {
  it("Case 1: $19.99 (Gemini Advanced)", () => {
    const input = 1999;
    const quote = buildQuote(input);

    expect(quote.usdAmountCents).toBe(1999);
    expect(quote.convertedNgnKobo).toBe(3_198_400); // 1999 * 1600
    expect(quote.feeNgnKobo).toBe(50_000);
    expect(quote.totalNgnKobo).toBe(3_248_400); // 3_198_400 + 50_000
    expect(quote.fxRateNgnPerUsd).toBe(1600);

    expect(quote.assumptions).toContain("₦1600");
    expect(quote.assumptions).toContain("₦500");
    expect(quote.assumptions).toContain("not a live merchant price");

    // Hand-verified formatted output
    expect(formatNgn(quote.totalNgnKobo)).toBe("₦32,484.00");
  });

  it("Case 2: $20.00 (ChatGPT Plus)", () => {
    const quote = buildQuote(2000);
    expect(quote.convertedNgnKobo).toBe(3_200_000);
    expect(quote.totalNgnKobo).toBe(3_250_000);
    expect(formatNgn(quote.totalNgnKobo)).toBe("₦32,500.00");
  });

  it("Case 3: $59.00 (Coursera Plus)", () => {
    const quote = buildQuote(5900);
    expect(quote.convertedNgnKobo).toBe(9_440_000);
    expect(quote.totalNgnKobo).toBe(9_490_000);
    expect(formatNgn(quote.totalNgnKobo)).toBe("₦94,900.00");
  });

  it("Case 4: $0.01 (minimum)", () => {
    const quote = buildQuote(1);
    expect(quote.convertedNgnKobo).toBe(1_600);
    expect(quote.totalNgnKobo).toBe(51_600);
  });

  it("Case 5: Expiry (10 minutes after now)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const quote = buildQuote(1000, now);
    expect(quote.expiresAt).toEqual(new Date("2026-01-01T00:10:00Z"));
  });

  describe("Case 6: Invalid inputs throw", () => {
    it("throws on 0 cents", () => {
      expect(() => buildQuote(0)).toThrow("usdAmountCents must be positive");
    });

    it("throws on negative cents (-100)", () => {
      expect(() => buildQuote(-100)).toThrow("usdAmountCents must be positive");
    });

    it("throws on float (19.99)", () => {
      expect(() => buildQuote(19.99)).toThrow("usdAmountCents must be positive");
    });

    it("throws on NaN", () => {
      expect(() => buildQuote(NaN)).toThrow("usdAmountCents must be positive");
    });

    it("throws on Infinity", () => {
      expect(() => buildQuote(Infinity)).toThrow("usdAmountCents must be positive");
    });
  });

  describe("Case 7: Overflow guard", () => {
    it('throws "exceeds supported range" on 2,000,000 cents', () => {
      // 2,000,000 * 1600 = 3,200,000,000 > 2,147,483,647 (Postgres Int Max)
      expect(() => buildQuote(2_000_000)).toThrow("Quote exceeds supported range");
    });
  });

  it("Step 4 verification helper: formatNgn(3_248_400) === '₦32,484.00'", () => {
    expect(formatNgn(3_248_400)).toBe("₦32,484.00");
  });
});
