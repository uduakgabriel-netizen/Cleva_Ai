import { describe, it, expect } from "vitest";
import { resolveMerchant } from "./resolve";

describe("lib/merchants/resolve.ts — Deterministic Merchant Resolver", () => {
  describe("Text matches (Eval Cases 1 - 7)", () => {
    it('1. "Pay for Gemini Advanced" -> supported, gemini, text', () => {
      const res = resolveMerchant({ text: "Pay for Gemini Advanced" });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.merchantSlug).toBe("gemini");
        expect(res.plan.planName).toBe("Gemini Advanced");
        expect(res.method).toBe("text");
      }
    });

    it('2. "I want ChatGPT plus" -> supported, chatgpt, text', () => {
      const res = resolveMerchant({ text: "I want ChatGPT plus" });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.merchantSlug).toBe("chatgpt");
        expect(res.plan.planName).toBe("ChatGPT Plus");
        expect(res.method).toBe("text");
      }
    });

    it('3. "canva pro please" -> supported, canva, text', () => {
      const res = resolveMerchant({ text: "canva pro please" });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.merchantSlug).toBe("canva");
        expect(res.plan.planName).toBe("Canva Pro");
        expect(res.method).toBe("text");
      }
    });

    it('4. "github copilot" -> supported, github, text', () => {
      const res = resolveMerchant({ text: "github copilot" });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.merchantSlug).toBe("github");
        expect(res.plan.planName).toBe("GitHub Copilot Individual");
        expect(res.method).toBe("text");
      }
    });

    it('5. "coursera plus" -> supported, coursera, text', () => {
      const res = resolveMerchant({ text: "coursera plus" });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.merchantSlug).toBe("coursera");
        expect(res.plan.planName).toBe("Coursera Plus");
        expect(res.method).toBe("text");
      }
    });

    it('6. "Gemini" -> supported, gemini, text', () => {
      const res = resolveMerchant({ text: "Gemini" });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.merchantSlug).toBe("gemini");
        expect(res.method).toBe("text");
      }
    });

    it('7. "openai" -> supported, chatgpt, text', () => {
      const res = resolveMerchant({ text: "openai" });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.merchantSlug).toBe("chatgpt");
        expect(res.method).toBe("text");
      }
    });
  });

  describe("URL matches (Eval Cases 8 - 11)", () => {
    it('8. url:"https://gemini.google.com/advanced" -> supported, gemini, url', () => {
      const res = resolveMerchant({ url: "https://gemini.google.com/advanced" });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.merchantSlug).toBe("gemini");
        expect(res.method).toBe("url");
      }
    });

    it('9. url:"https://one.google.com/abc" -> supported, gemini, url', () => {
      const res = resolveMerchant({ url: "https://one.google.com/abc" });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.merchantSlug).toBe("gemini");
        expect(res.method).toBe("url");
      }
    });

    it('10. url:"https://github.com/features/copilot" -> supported, github, url', () => {
      const res = resolveMerchant({ url: "https://github.com/features/copilot" });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.merchantSlug).toBe("github");
        expect(res.method).toBe("url");
      }
    });

    it('11. url:"https://chatgpt.com/" -> supported, chatgpt, url', () => {
      const res = resolveMerchant({ url: "https://chatgpt.com/" });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.merchantSlug).toBe("chatgpt");
        expect(res.method).toBe("url");
      }
    });
  });

  describe("Unsupported matches (Eval Cases 12 - 15)", () => {
    it('12. "pay for netflix" -> unsupported', () => {
      const res = resolveMerchant({ text: "pay for netflix" });
      expect(res.supported).toBe(false);
      expect(res.method).toBe("none");
      if (!res.supported) {
        expect(res.reason).toBe("no_match");
      }
    });

    it('13. url:"https://unknownsite.com/checkout" -> unsupported', () => {
      const res = resolveMerchant({ url: "https://unknownsite.com/checkout" });
      expect(res.supported).toBe(false);
      expect(res.method).toBe("none");
      if (!res.supported) {
        expect(res.reason).toBe("no_match");
      }
    });

    it('14. "" -> unsupported', () => {
      const res = resolveMerchant({ text: "" });
      expect(res.supported).toBe(false);
      expect(res.method).toBe("none");
      if (!res.supported) {
        expect(res.reason).toBe("no_match");
      }
    });

    it('15. "gemini.google.com.evil.com" as url host -> unsupported (subdomain attack rejected)', () => {
      const res1 = resolveMerchant({ url: "https://gemini.google.com.evil.com/pay" });
      expect(res1.supported).toBe(false);
      expect(res1.method).toBe("none");

      const res2 = resolveMerchant({ url: "gemini.google.com.evil.com" });
      expect(res2.supported).toBe(false);
      expect(res2.method).toBe("none");
    });
  });

  describe("Edge cases & longest-alias preference", () => {
    it('Longest-alias preference: "gemini advanced" beats "gemini" in text', () => {
      const res = resolveMerchant({ text: "pay for gemini advanced today" });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.planName).toBe("Gemini Advanced");
        expect(res.plan.merchantSlug).toBe("gemini");
      }
    });

    it("Hostname notgoogle.com does NOT match google.com", () => {
      const res = resolveMerchant({ url: "https://notgoogle.com" });
      expect(res.supported).toBe(false);
    });

    it("Both inputs undefined", () => {
      const res = resolveMerchant({});
      expect(res.supported).toBe(false);
    });

    it("Whitespace only text", () => {
      const res = resolveMerchant({ text: "    \t\n  " });
      expect(res.supported).toBe(false);
    });

    it("Invalid URL falls through to valid text", () => {
      const res = resolveMerchant({
        url: "http://[invalid-url",
        text: "canva pro",
      });
      expect(res.supported).toBe(true);
      if (res.supported) {
        expect(res.plan.merchantSlug).toBe("canva");
        expect(res.method).toBe("text");
      }
    });
  });
});
