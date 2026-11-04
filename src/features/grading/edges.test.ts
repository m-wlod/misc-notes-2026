import { describe, expect, it } from "vitest";

import { grade } from "@/features/exercises/grade";
import type { Exercise } from "@/features/exercises/schema";

import { calibrate, flags, median, MIN_ATTEMPTS } from "./calibrate";
import { paramsFor, seedFor } from "./random";
import { symbolicMatch } from "./rules";

/**
 * Edge cases of the graders and calibration (Phase 20 coverage pass): the paths the
 * sample-based tests in engine.test.ts and grading.test.ts don't reach.
 */
const numeric = {
  id: "t-num",
  type: "numeric",
  level: 1,
  topics: ["t"],
  lessonIds: [],
  status: "draft",
  sample: true,
  prompt: { pl: "p" },
  params: { k: 200, r: 5 },
  answer: 210,
  tolerance: 0.005,
  unit: "number",
  mistakes: [
    { answer: "missing_var * 2", feedback: { pl: "x" } },
    { answer: "k * r / 100", feedback: { pl: "growth only" } },
    { answer: 42, feedback: { pl: "a number" } },
  ],
  hints: [],
  variants: [],
} as unknown as Exercise;

const text = (value: string) => ({ kind: "text" as const, value });

describe("grade: edges", () => {
  it("matches mistakes written as expressions or numbers; a broken one is skipped", () => {
    expect(grade(numeric, 0, text("10"))).toMatchObject({ result: "wrong", mistake: 1 });
    expect(grade(numeric, 0, text("42"))).toMatchObject({ result: "wrong", mistake: 2 });
    expect(grade(numeric, 0, text("7"))).toEqual({ ok: true, score: 0, result: "wrong" });
  });

  it("numeric takes a slider number but no other kind", () => {
    expect(grade(numeric, 0, { kind: "number", value: 210 })).toMatchObject({ result: "correct" });
    expect(grade(numeric, 0, { kind: "choice", value: "a" })).toEqual({
      ok: false,
      reason: "wrong-kind",
    });
  });

  it("symbolic: wrong kind, unreadable input and a listed mistake", () => {
    const symbolic = {
      ...numeric,
      type: "symbolic",
      answer: "2*x",
      mistakes: [{ answer: "x^2", feedback: { pl: "m" } }],
    } as unknown as Exercise;
    expect(grade(symbolic, 0, { kind: "number", value: 1 })).toEqual({
      ok: false,
      reason: "wrong-kind",
    });
    expect(grade(symbolic, 0, text("2*(x"))).toEqual({ ok: false, reason: "unreadable" });
    expect(grade(symbolic, 0, text("x*x"))).toMatchObject({ result: "wrong", mistake: 0 });
    expect(grade(symbolic, 0, text("x+1"))).toEqual({ ok: true, score: 0, result: "wrong" });
    expect(grade(symbolic, 0, text("x+x"))).toMatchObject({ result: "correct" });
  });

  it("multi and ordering refuse other kinds; ordering checks the length", () => {
    const multi = { ...numeric, type: "multi", answer: ["a", "b"] } as unknown as Exercise;
    expect(grade(multi, 0, text("a"))).toEqual({ ok: false, reason: "wrong-kind" });
    const ordering = { ...numeric, type: "ordering", answer: ["a", "b"] } as unknown as Exercise;
    expect(grade(ordering, 0, text("a"))).toEqual({ ok: false, reason: "wrong-kind" });
    expect(grade(ordering, 0, { kind: "order", values: ["a"] })).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });

  it("open and brainteaser answers are left to the AI grader", () => {
    for (const type of ["open", "brainteaser"]) {
      const e = { ...numeric, type } as unknown as Exercise;
      expect(grade(e, 0, text("anything"))).toEqual({ ok: false, reason: "not-gradable" });
    }
  });

  it("symbolicMatch reports unreadable input and rethrows anything else", () => {
    expect(symbolicMatch("(", "x")).toBe("unreadable");
    expect(symbolicMatch("x", "x")).toBe(true);
  });
});

describe("random params", () => {
  it("are stable per seed and stay inside their spec", () => {
    const spec = {
      params: { a: { min: 1, max: 2, step: 0.5 }, b: { choices: [3, 4] }, c: { min: 0, max: 5 } },
      formula: "a + b + c",
    };
    for (let seed = 0; seed < 50; seed++) {
      const p = paramsFor(spec, seed);
      expect(p).toEqual(paramsFor(spec, seed));
      expect([1, 1.5, 2]).toContain(p.a);
      expect([3, 4]).toContain(p.b);
      expect(Number.isInteger(p.c) && (p.c ?? -1) >= 0 && (p.c ?? 9) <= 5).toBe(true);
    }
    expect(seedFor("u", "e", 0)).not.toBe(seedFor("u", "e", 1));
  });
});

describe("calibration", () => {
  it("median of odd, even and empty lists", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(3); // (2 + 3) / 2 rounded
  });

  it("success rate counts full scores only; times may be missing", () => {
    const rows = [
      { exerciseId: "b", score: 1, timeMs: 1000 },
      { exerciseId: "b", score: 0.5, timeMs: null },
      { exerciseId: "a", score: 0, timeMs: null },
    ];
    expect(calibrate(rows)).toEqual([
      { exerciseId: "a", attempts: 1, successRate: 0, medianTimeMs: null },
      { exerciseId: "b", attempts: 2, successRate: 0.5, medianTimeMs: 1000 },
    ]);
  });

  it("flags too easy and too hard with enough attempts, never unknown levels", () => {
    const stat = (exerciseId: string, successRate: number, attempts = MIN_ATTEMPTS) => ({
      exerciseId,
      attempts,
      successRate,
      medianTimeMs: null,
    });
    const levels: Record<string, number> = { easy: 5, hard: 1, fine: 3, few: 5 };
    const out = flags(
      [stat("easy", 0.9), stat("hard", 0.2), stat("fine", 0.6), stat("few", 0.99, 5), stat("x", 1)],
      (id) => levels[id],
    );
    expect(out.map((f) => [f.exerciseId, f.verdict])).toEqual([
      ["easy", "too-easy"],
      ["hard", "too-hard"],
    ]);
  });
});
