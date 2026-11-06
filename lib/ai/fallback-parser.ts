import type { IntentParser, ParsedIntent } from "./parser";

export class FallbackParser implements IntentParser {
  constructor(
    private readonly primary: IntentParser,
    private readonly secondary: IntentParser
  ) {}

  async parse(input: { text?: string; url?: string }): Promise<ParsedIntent> {
    try {
      return await this.primary.parse(input);
    } catch (err) {
      console.warn(
        "Primary parser (Gemma) failed, falling back to DeterministicParser:",
        err instanceof Error ? err.message : String(err)
      );
      return await this.secondary.parse(input);
    }
  }
}
