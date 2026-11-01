import { parseLocaleNumber } from "@/lib/math/parse-number";

import type { AnswerUnit, PlacementQuestion } from "./questions";

/** Converts a parsed learner answer into the question's unit. */
export function toUnit(value: number, kind: string, unit: AnswerUnit): number {
  if (unit === "percentPoints") return kind === "percent" ? value * 100 : value;
  return value; // "fraction": 20% already parses to 0.2; "number": as typed
}

export type QuestionResult = { id: string; level: number; correct: boolean };

export function gradeAnswer(q: PlacementQuestion, raw: string | undefined): QuestionResult {
  const parsed = parseLocaleNumber(raw ?? "");
  const correct =
    parsed.ok && Math.abs(toUnit(parsed.value, parsed.kind, q.unit) - q.expected) <= q.tolerance;
  return { id: q.id, level: q.level, correct };
}

/**
 * Suggested starting level. Walk up from level 1 while the learner got at least one of
 * that level's two questions right; the last such level is the suggestion. All eight
 * right suggests level 5 (Quant Trader). Nothing right still suggests level 1.
 */
export function suggestLevel(results: readonly QuestionResult[]): 1 | 2 | 3 | 4 | 5 {
  if (results.length > 0 && results.every((r) => r.correct)) return 5;
  let level: 1 | 2 | 3 | 4 = 1;
  for (const l of [1, 2, 3, 4] as const) {
    if (results.some((r) => r.level === l && r.correct)) level = l;
    else break;
  }
  return level;
}

export function gradePlacement(
  questions: readonly PlacementQuestion[],
  answers: Record<string, string>,
) {
  const results = questions.map((q) => gradeAnswer(q, answers[q.id]));
  return { results, suggested: suggestLevel(results) };
}
