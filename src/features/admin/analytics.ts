import { z } from "zod";

/**
 * Exercise analytics (Phase 18b): the shape `admin_exercise_analytics` returns, and the
 * ready-to-paste `mistakes[]` entry for a common wrong answer. Writing content stays a
 * human step: the panel only shows the snippet.
 */
const answer = z.record(z.string(), z.unknown());

export const analyticsSchema = z.object({
  attempts: z.number().int(),
  users: z.number().int(),
  success_rate: z.number().nullable(),
  median_time_ms: z.number().nullable(),
  mean_hints: z.number().nullable(),
  wrong: z.array(z.object({ answer, count: z.number().int() })),
});
export type Analytics = z.infer<typeof analyticsSchema>;

export function parseAnalytics(data: unknown): Analytics | null {
  const parsed = analyticsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** A stored answer as a person would read it. */
export function answerText(a: Record<string, unknown>): string {
  if (typeof a.value === "string" || typeof a.value === "number") return String(a.value);
  if (Array.isArray(a.values)) return a.values.map(String).join(", ");
  return JSON.stringify(a);
}

/**
 * The value a `mistakes[]` entry matches, or null when that answer kind has no
 * mistakes list (only numeric-style exercises have one).
 */
export function mistakeValue(a: Record<string, unknown>): number | string | null {
  if (a.kind === "number" && typeof a.value === "number") return a.value;
  if (a.kind !== "text" || typeof a.value !== "string") return null;
  const v = a.value.trim();
  if (v === "") return null;
  const n = Number(v.replace(",", "."));
  return /^-?\d+(?:[.,]\d+)?$/.test(v) && Number.isFinite(n) ? n : v;
}

const yamlString = (s: string) => `"${s.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

/** YAML for one `mistakes[]` item; the feedback is left for the author to write. */
export function mistakeSnippet(value: number | string): string {
  const shown = typeof value === "number" ? String(value) : yamlString(value);
  return [
    "mistakes:",
    `  - answer: ${shown}`,
    "    feedback:",
    '      pl: "TODO: dlaczego to błąd i co poprawić"',
    '      en: "TODO: why this is wrong and what to fix"',
  ].join("\n");
}
