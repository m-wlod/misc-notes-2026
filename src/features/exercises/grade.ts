import { formulaAnswer, paramsFor } from "@/features/grading/random";
import {
  closeEnough,
  estimationScore,
  multiScore,
  orderingScore,
  readNumber,
  symbolicMatch,
} from "@/features/grading/rules";
import { evaluate, parseExpr } from "@/lib/math/expr";

import type { Exercise } from "./schema";

/**
 * Server-side grading (Phase 8, rules from src/features/grading since Phase 9). Pure: the
 * server action loads the exercise, picks the version and calls this. Scores are 0–1.
 *
 * A "version" is one number: for exercises with hand-written `variants` it is the index
 * (0 = base); for exercises with `random` params it is the seed. The server always
 * regenerates params and answer from it, so a client can't forge anything.
 */

export type Submission =
  | { kind: "text"; value: string } // numeric, estimation, symbolic
  | { kind: "number"; value: number } // interactive (slider)
  | { kind: "choice"; value: string }
  | { kind: "multi"; values: string[] }
  | { kind: "order"; values: string[] }
  /**
   * Code run in the browser (Phase 13): how many hidden tests passed, and the number
   * `answerExpr` gave on the learner's code, which the server checks against `answer`.
   */
  | { kind: "code"; passed: number; total: number; value: number | null };

export type Result = "correct" | "partial" | "wrong";
export type Grade =
  | { ok: true; score: number; result: Result; /** index into `mistakes` */ mistake?: number }
  | { ok: false; reason: "unreadable" | "wrong-kind" | "not-gradable" | "percent-not-allowed" };

type Params = Record<string, number | string | boolean>;

const numericParams = (p: Params) =>
  Object.fromEntries(
    Object.entries(p).filter((e): e is [string, number] => typeof e[1] === "number"),
  );

/** The params and answer of one version of an exercise. */
export function variantOf(ex: Exercise, version: number) {
  if ("random" in ex && ex.random) {
    const seed = version >>> 0;
    const params = { ...ex.params, ...paramsFor(ex.random, seed) };
    return { params, answer: formulaAnswer(ex.random.formula, numericParams(params)), index: seed };
  }
  if (!("variants" in ex) || version <= 0 || version > ex.variants.length) {
    return { params: ex.params, answer: "answer" in ex ? ex.answer : undefined, index: 0 };
  }
  const v = ex.variants[version - 1];
  return { params: { ...ex.params, ...v?.params }, answer: v?.answer, index: version };
}

/** Number of hand-written versions; 0 means unlimited (random params). */
export function variantCount(ex: Exercise): number {
  if ("random" in ex && ex.random) return 0;
  return "variants" in ex ? ex.variants.length + 1 : 1;
}

const resultOf = (score: number): Result =>
  score >= 1 ? "correct" : score > 0 ? "partial" : "wrong";
const done = (score: number, mistake?: number): Grade => {
  const s = Math.min(1, Math.max(0, score));
  return mistake === undefined
    ? { ok: true, score: s, result: resultOf(s) }
    : { ok: true, score: s, result: resultOf(s), mistake };
};

/** Which listed mistake (if any) a wrong numeric answer matches. */
function numericMistake(
  ex: Exercise,
  values: readonly number[],
  params: Params,
): number | undefined {
  if (!("mistakes" in ex) || !("tolerance" in ex)) return undefined;
  const vars = numericParams(params);
  const i = ex.mistakes.findIndex((m) => {
    let target: number;
    try {
      target = typeof m.answer === "number" ? m.answer : evaluate(parseExpr(m.answer), vars);
    } catch {
      return false;
    }
    return values.some((v) => closeEnough(v, target, ex.tolerance, ex.relTolerance));
  });
  return i === -1 ? undefined : i;
}

export function grade(ex: Exercise, version: number, sub: Submission): Grade {
  const { answer, params } = variantOf(ex, version);
  switch (ex.type) {
    case "numeric":
    case "interactive":
    case "estimation": {
      let values: number[];
      if (sub.kind === "number") values = [sub.value];
      else if (sub.kind === "text") {
        const read = readNumber(sub.value, ex.unit);
        if (typeof read === "string") return { ok: false, reason: read };
        values = read;
      } else return { ok: false, reason: "wrong-kind" };
      const target = Number(answer);
      const score =
        ex.type === "estimation"
          ? Math.max(
              ...values.map((v) =>
                closeEnough(v, target, ex.tolerance, ex.relTolerance)
                  ? 1
                  : estimationScore(v, target),
              ),
            )
          : values.some((v) => closeEnough(v, target, ex.tolerance, ex.relTolerance))
            ? 1
            : 0;
      return done(score, score < 1 ? numericMistake(ex, values, params) : undefined);
    }
    case "symbolic": {
      if (sub.kind !== "text") return { ok: false, reason: "wrong-kind" };
      const fixed = numericParams(params);
      const match = symbolicMatch(sub.value, String(answer), fixed);
      if (match === "unreadable") return { ok: false, reason: "unreadable" };
      if (match) return done(1);
      const i = ex.mistakes.findIndex(
        (m) => symbolicMatch(sub.value, String(m.answer), fixed) === true,
      );
      return done(0, i === -1 ? undefined : i);
    }
    case "choice":
      if (sub.kind !== "choice") return { ok: false, reason: "wrong-kind" };
      return done(sub.value === ex.answer ? 1 : 0);
    case "multi":
      if (sub.kind !== "multi") return { ok: false, reason: "wrong-kind" };
      return done(multiScore(sub.values, ex.answer));
    case "ordering":
      if (sub.kind !== "order") return { ok: false, reason: "wrong-kind" };
      if (sub.values.length !== ex.answer.length) return { ok: false, reason: "unreadable" };
      return done(orderingScore(sub.values, ex.answer));
    case "code":
      return gradeCode(ex, sub);
    case "open":
    case "brainteaser":
      // Open answers are AI-graded (Phase 10).
      return { ok: false, reason: "not-gradable" };
  }
}

/**
 * Code exercises: "correct" needs every hidden test passed in the browser **and** the
 * number from `answerExpr` matching the stored answer, which the browser never sees.
 * Test results alone could be forged; matching the number takes solving the problem.
 * A typed number alone ("submit only the answer") is graded like a numeric exercise.
 */
function gradeCode(ex: Extract<Exercise, { type: "code" }>, sub: Submission): Grade {
  const matches = (v: number) =>
    ex.answer !== undefined && closeEnough(v, ex.answer, ex.tolerance, ex.relTolerance);
  if (sub.kind === "text") {
    if (ex.answer === undefined) return { ok: false, reason: "not-gradable" };
    const read = readNumber(sub.value, "number");
    if (typeof read === "string") return { ok: false, reason: read };
    return done(read.some(matches) ? 1 : 0);
  }
  if (sub.kind !== "code") return { ok: false, reason: "wrong-kind" };
  if (sub.total !== ex.tests.length || sub.passed > sub.total) {
    return { ok: false, reason: "unreadable" };
  }
  const valueOk = ex.answer === undefined || (sub.value !== null && matches(sub.value));
  if (sub.passed === sub.total && valueOk) return done(1);
  // Partial credit for passed tests, never full without the server's own check.
  return done((sub.passed / sub.total) * 0.5);
}
