import { resolveMerchant } from "../merchants/resolve";
import type { IntentParser, ParsedIntent } from "./parser";

export class DeterministicParser implements IntentParser {
  async parse(input: { text?: string; url?: string }): Promise<ParsedIntent> {
    const res = resolveMerchant({ text: input.text, url: input.url });
    if (res.supported) {
      return {
        merchantSlug: res.plan.merchantSlug,
        planId: res.plan.planId,
        interval: res.plan.interval,
        confidence: 0.9,
        missingFields: [],
        reasoning: `Matched by ${res.method}`,
        rawMerchant: input.text ?? input.url ?? null,
      };
    }

    return {
      merchantSlug: null,
      planId: null,
      interval: null,
      confidence: 0.1,
      missingFields: ["merchant"],
      reasoning: "No catalogue match",
      rawMerchant: input.text ?? input.url ?? null,
    };
  }
}
