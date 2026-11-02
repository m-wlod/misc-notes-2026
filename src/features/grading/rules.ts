import { equivalent, ExprError, parseExpr } from "@/lib/math/expr";
import { parseLocaleNumber } from "@/lib/math/parse-number";

/**
 * The grading rules, one pure function per kind of answer (Phase 9). No exercise
 * loading here: callers pass the expected answer and settings. Scores are 0–1.
 */

export type Unit = "fraction" | "percent" | "number";
export type ReadFailure = "unreadable" | "percent-not-allowed";

/**
 * Read a typed number under a unit convention:
 * - fraction (default): "25%" = "0,25" = "1/4" → 0.25
 * - percent: the answer is in percent; "25", "25%" and "0,25" all read as 25
 * - number: a "%" sign is refused (the answer is not a share)
 * Returns every value the input may mean (percent mode accepts both readings).
 */
export function readNumber(raw: string, unit: Unit = "fraction"): number[] | ReadFailure {
  const parsed = parseLocaleNumber(raw);
  if (!parsed.ok) return "unreadable";
  if (unit === "number" && parsed.kind === "percent") return "percent-not-allowed";
  if (unit === "percent") {
    // parseLocaleNumber reads "25%" as 0.25; in percent mode that means 25.
    if (parsed.kind === "percent") return [parsed.value * 100];
    return [parsed.value, parsed.value * 100];
  }
  return [parsed.value];
}

/** Within an absolute tolerance, or a relative one when given. */
export function closeEnough(value: number, answer: number, tol: number, relTol?: number): boolean {
  const diff = Math.abs(value - answer);
  if (diff <= tol) return true;
  return relTol !== undefined && diff <= relTol * Math.abs(answer);
}

/**
 * Fermi estimation by order-of-magnitude bands: within 2× scores 1, within 10× scores
 * 0.5, anything further (or of the wrong sign) 0.
 */
export function estimationScore(value: number, answer: number): number {
  if (answer === 0) return value === 0 ? 1 : 0;
  if (value === 0 || Math.sign(value) !== Math.sign(answer)) return 0;
  const ratio = Math.max(value / answer, answer / value);
  if (ratio <= 2) return 1;
  if (ratio <= 10) return 0.5;
  return 0;
}

/**
 * Ordering, Kendall-tau style: the share of all item pairs placed in the right relative
 * order (1 = perfect, 0 = fully reversed). Items missing from the answer count as wrong.
 */
export function orderingScore(given: readonly string[], answer: readonly string[]): number {
  const rank = new Map(answer.map((id, i) => [id, i]));
  if (given.length !== answer.length || given.some((id) => !rank.has(id))) return 0;
  if (new Set(given).size !== given.length) return 0;
  let concordant = 0;
  let pairs = 0;
  for (let i = 0; i < given.length; i++) {
    for (let j = i + 1; j < given.length; j++) {
      pairs++;
      if ((rank.get(given[i] ?? "") ?? 0) < (rank.get(given[j] ?? "") ?? 0)) concordant++;
    }
  }
  return pairs === 0 ? 1 : concordant / pairs;
}

/** Multi-select: (right picks − wrong picks) / all right options, never below 0. */
export function multiScore(picked: readonly string[], answer: readonly string[]): number {
  const right = new Set(answer);
  const chosen = new Set(picked);
  const hits = [...chosen].filter((v) => right.has(v)).length;
  return Math.max(0, (hits - (chosen.size - hits)) / right.size);
}

/** Symbolic: the same function of the free variables, with params held fixed. */
export function symbolicMatch(
  given: string,
  answer: string,
  params: Readonly<Record<string, number>> = {},
): boolean | "unreadable" {
  try {
    return equivalent(parseExpr(given), parseExpr(answer), { fixed: params });
  } catch (e) {
    if (e instanceof ExprError) return "unreadable";
    throw e;
  }
}
