import { CATALOGUE, type CataloguePlan } from "./catalogue";

export type ResolveResult =
  | { supported: true; plan: CataloguePlan; method: "url" | "text" }
  | { supported: false; method: "none"; reason: "no_match" };

function extractHostname(urlString: string): string | null {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname.toLowerCase().replace(/^www\./i, "");
  } catch {
    // If protocol was omitted and string has no spaces, attempt parsing with https://
    if (!urlString.includes("://") && !urlString.includes(" ")) {
      try {
        const parsed = new URL(`https://${urlString}`);
        return parsed.hostname.toLowerCase().replace(/^www\./i, "");
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function resolveMerchant(input: {
  text?: string;
  url?: string;
}): ResolveResult {
  // 1. If input.url is provided and valid:
  if (input.url && typeof input.url === "string") {
    const hostname = extractHostname(input.url);
    if (hostname) {
      for (const plan of CATALOGUE) {
        const matches = plan.hosts.some(
          (host) => hostname === host || hostname.endsWith("." + host)
        );
        if (matches) {
          return { supported: true, method: "url", plan };
        }
      }
    }
    // No match: fall through to text matching
  }

  // 2. If input.text is non-empty:
  if (input.text && typeof input.text === "string") {
    const trimmed = input.text.trim();
    if (trimmed.length > 0) {
      const lowerText = trimmed.toLowerCase();
      let bestMatch: { plan: CataloguePlan; aliasLength: number } | null = null;

      for (const plan of CATALOGUE) {
        for (const alias of plan.aliases) {
          if (lowerText.includes(alias)) {
            // Longest-alias match wins
            if (!bestMatch || alias.length > bestMatch.aliasLength) {
              bestMatch = { plan, aliasLength: alias.length };
            }
          }
        }
      }

      if (bestMatch) {
        return { supported: true, method: "text", plan: bestMatch.plan };
      }
    }
  }

  // 3. Nothing matched
  return { supported: false, method: "none", reason: "no_match" };
}
