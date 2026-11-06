export type ParsedIntent = {
  merchantSlug: string | null;
  planId: string | null;
  interval: "MONTHLY" | "YEARLY" | "ONE_TIME" | null;
  confidence: number; // 0..1
  missingFields: string[]; // subset of ["merchant","plan","interval"]
  reasoning: string; // one sentence, max 200 chars
  rawMerchant: string | null; // exactly what the user said
};

export interface IntentParser {
  parse(input: { text?: string; url?: string }): Promise<ParsedIntent>;
}

export { getIntentParser } from "./get-parser";
