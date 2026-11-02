import type { AiGrade } from "./grade-schema";

/**
 * Deterministic checks after the model (Phase 10). Whatever the answer text talked the
 * model into, the score can't exceed what the rubric items it marked support:
 * - items that don't exist are dropped, duplicates keep the first;
 * - missing items count as missed;
 * - the score is capped at round(4 × (met + ½·partially) / items), so 0 when nothing is met;
 * - the verdict follows the final score.
 */
export function applyGuards(grade: AiGrade, rubricLength: number): AiGrade {
  const seen = new Set<number>();
  const items = grade.rubricItems.filter((item) => {
    if (item.index >= rubricLength || seen.has(item.index)) return false;
    seen.add(item.index);
    return true;
  });
  for (let i = 0; i < rubricLength; i++) {
    if (!seen.has(i)) items.push({ index: i, status: "missed", reason: "" });
  }
  items.sort((a, b) => a.index - b.index);

  const credit = items.reduce(
    (sum, i) => sum + (i.status === "met" ? 1 : i.status === "partially" ? 0.5 : 0),
    0,
  );
  const cap = rubricLength === 0 ? 0 : Math.round((4 * credit) / rubricLength);
  const score = Math.max(0, Math.min(grade.score, cap));
  return {
    ...grade,
    rubricItems: items,
    score,
    verdict: score >= 4 ? "correct" : score > 0 ? "partial" : "wrong",
  };
}
