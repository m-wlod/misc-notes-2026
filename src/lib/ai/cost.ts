/**
 * Cost of one grading from the API's usage numbers (Phase 10). USD per million tokens,
 * Anthropic first-party rates. Unknown models are priced as Opus 5.5 so the budget
 * kill-switch errs on the safe side.
 */
type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

const OPUS_5_5: Price = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
const PRICES: Record<string, Price> = {
  "claude-opus-5-5": OPUS_5_5,
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null | undefined;
  cache_creation_input_tokens?: number | null | undefined;
};

export function costOf(model: string, usage: Usage): number {
  const p = PRICES[model] ?? OPUS_5_5;
  const usd =
    (usage.input_tokens * p.input +
      usage.output_tokens * p.output +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}
