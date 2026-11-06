import { DeterministicParser } from "./deterministic-parser";
import { GemmaParser } from "./gemma-parser";
import { FallbackParser } from "./fallback-parser";
import type { IntentParser } from "./parser";

export function getIntentParser(): IntentParser {
  if (process.env.AI_PROVIDER !== "gemma") {
    return new DeterministicParser();
  }
  return new FallbackParser(new GemmaParser(), new DeterministicParser());
}
