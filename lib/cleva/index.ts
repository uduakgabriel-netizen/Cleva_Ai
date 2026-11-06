import { MockClevaAdapter } from "./mock-cleva-adapter";
import type { ClevaAdapter } from "./adapter";

export const cleva: ClevaAdapter = new MockClevaAdapter();
export * from "./adapter";
