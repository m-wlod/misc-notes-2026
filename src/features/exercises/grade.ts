import { equivalent, ExprError, parseExpr } from "@/lib/math/expr";
import { parseLocaleNumber } from "@/lib/math/parse-number";

import type { Exercise } from "./schema";

/**
 * Server-side grading, one rule per type. Pure: the server action loads the exercise,
 * picks the variant and calls this. Scores are 0–1; "partial" is anything in between.
 */

export type Submission =
  | { kind: "text"; value: string } // numeric, estimation, symbolic
  | { kind: "number"; value: number } // interactive (slider)
  | { kind: "choice"; value: string }
  | { kind: "multi"; values: string[] }
  | { kind: "order"; values: string[] };

export type Result = "correct" | "partial" | "wrong";
export type Grade =
  | { ok: true; score: number; result: Result }
  | { ok: false; reason: "unreadable" | "wrong-kind" | "not-gradable" };

/** The params and answer of one version of an exercise (0 = the base version). */
export function variantOf(ex: Exercise, index: number) {
  if (!("variants" in ex) || index <= 0 || index > ex.variants.length) {
    return { params: ex.params, answer: "answer" in ex ? ex.answer : undefined, index: 0 };
  }
  const v = ex.variants[index - 1];
  return { params: { ...ex.params, ...v?.params }, answer: v?.answer, index };
}

export function variantCount(ex: Exercise): number {
  return "variants" in ex ? ex.variants.length + 1 : 1;
}

const resultOf = (score: number): Result =>
  score >= 1 ? "correct" : score > 0 ? "partial" : "wrong";
const done = (score: number): Grade => {
  const s = Math.min(1, Math.max(0, score));
  return { ok: true, score: s, result: resultOf(s) };
};

export function grade(ex: Exercise, variant: number, sub: Submission): Grade {
  const { answer } = variantOf(ex, variant);
  switch (ex.type) {
    case "numeric":
    case "interactive": {
      const value = readNumber(sub);
      if (value === null)
        return { ok: false, reason: sub.kind === "text" ? "unreadable" : "wrong-kind" };
      return done(Math.abs(value - Number(answer)) <= ex.tolerance ? 1 : 0);
    }
    case "estimation": {
      // Fermi scoring: full marks within tolerance, then 1 − |log10(x / answer)| (an
      // order of magnitude off scores 0). Sign must match.
      const value = readNumber(sub);
      if (value === null)
        return { ok: false, reason: sub.kind === "text" ? "unreadable" : "wrong-kind" };
      const target = Number(answer);
      if (Math.abs(value - target) <= ex.tolerance) return done(1);
      if (value === 0 || Math.sign(value) !== Math.sign(target)) return done(0);
      return done(Math.round((1 - Math.abs(Math.log10(value / target))) * 100) / 100);
    }
    case "symbolic": {
      if (sub.kind !== "text") return { ok: false, reason: "wrong-kind" };
      try {
        return done(equivalent(parseExpr(sub.value), parseExpr(String(answer))) ? 1 : 0);
      } catch (e) {
        if (e instanceof ExprError) return { ok: false, reason: "unreadable" };
        throw e;
      }
    }
    case "choice":
      if (sub.kind !== "choice") return { ok: false, reason: "wrong-kind" };
      return done(sub.value === ex.answer ? 1 : 0);
    case "multi": {
      if (sub.kind !== "multi") return { ok: false, reason: "wrong-kind" };
      const right = new Set(ex.answer);
      const picked = new Set(sub.values);
      const hits = [...picked].filter((v) => right.has(v)).length;
      const misses = picked.size - hits;
      return done((hits - misses) / right.size);
    }
    case "ordering": {
      if (sub.kind !== "order") return { ok: false, reason: "wrong-kind" };
      if (sub.values.length !== ex.answer.length) return { ok: false, reason: "unreadable" };
      // Share of neighbouring pairs in the right relative order.
      const rank = new Map(ex.answer.map((id, i) => [id, i]));
      let good = 0;
      for (let i = 0; i < sub.values.length - 1; i++) {
        const a = rank.get(sub.values[i] ?? "");
        const b = rank.get(sub.values[i + 1] ?? "");
        if (a !== undefined && b !== undefined && a < b) good++;
      }
      return done(good / (sub.values.length - 1));
    }
    case "code":
    case "open":
    case "brainteaser":
      // Code runs in the Lab sandbox (Phase 12); open answers are AI-graded (Phase 10).
      return { ok: false, reason: "not-gradable" };
  }
}

function readNumber(sub: Submission): number | null {
  if (sub.kind === "number") return Number.isFinite(sub.value) ? sub.value : null;
  if (sub.kind !== "text") return null;
  const parsed = parseLocaleNumber(sub.value);
  return parsed.ok ? parsed.value : null;
}
