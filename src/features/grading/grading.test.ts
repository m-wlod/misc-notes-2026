import { describe, expect, it } from "vitest";

import { calibrate, flags, median, MIN_ATTEMPTS } from "./calibrate";
import { formulaAnswer, paramsFor, seedFor, type RandomSpec } from "./random";
import {
  closeEnough,
  estimationScore,
  multiScore,
  orderingScore,
  readNumber,
  symbolicMatch,
} from "./rules";

describe("readNumber", () => {
  it.each([
    ["0,25", "fraction", [0.25]],
    ["25%", "fraction", [0.25]],
    ["1/4", "fraction", [0.25]],
    ["-0,5", "fraction", [-0.5]],
    ["−3/8", "fraction", [-0.375]], // a typographic minus (pasted text) is accepted
    ["1e-3", "fraction", [0.001]],
    ["25", "percent", [25, 2500]],
    ["25%", "percent", [25]],
    ["0,25", "percent", [0.25, 25]],
    ["25%", "number", "percent-not-allowed"],
    ["12,5", "number", [12.5]],
    ["1,000", "fraction", "unreadable"], // ambiguous thousands separator
    ["abc", "fraction", "unreadable"],
  ] as const)("%j as %s → %j", (raw, unit, expected) => {
    const result = readNumber(raw, unit);
    if (typeof expected === "string") expect(result).toBe(expected);
    else expect(result).toEqual(expected.map((v) => expect.closeTo(v, 10) as unknown));
  });
});

describe("closeEnough", () => {
  it("uses the absolute tolerance, or the relative one when given", () => {
    expect(closeEnough(1.004, 1, 0.005)).toBe(true);
    expect(closeEnough(1.006, 1, 0.005)).toBe(false);
    expect(closeEnough(1_010_000, 1_000_000, 0, 0.01)).toBe(true);
    expect(closeEnough(-2, -2, 0)).toBe(true);
  });
});

describe("estimationScore (bands)", () => {
  it.each([
    [86_400, 86_400, 1],
    [150_000, 86_400, 1], // within 2×
    [43_200, 86_400, 1], // exactly 2× under
    [432_000, 86_400, 0.5], // 5×
    [8_640, 86_400, 0.5], // 10× under
    [1_000, 86_400, 0], // more than 10×
    [-86_400, 86_400, 0], // wrong sign
    [0, 86_400, 0],
  ])("%d for %d → %d", (value, answer, score) => {
    expect(estimationScore(value, answer)).toBe(score);
  });
});

describe("orderingScore (Kendall tau)", () => {
  it.each([
    [["a", "b", "c", "d"], 1],
    [["d", "c", "b", "a"], 0],
    [["b", "a", "c", "d"], 5 / 6], // one swap
    [["a", "c", "b", "d"], 5 / 6],
    [["b", "c", "d", "a"], 3 / 6],
    [["a", "b", "c"], 0], // missing item
    [["a", "a", "c", "d"], 0], // duplicate
  ])("%j → %d", (given, score) => {
    expect(orderingScore(given, ["a", "b", "c", "d"])).toBeCloseTo(score, 10);
  });
});

describe("multiScore", () => {
  it("rewards right picks and penalises wrong ones, never below 0", () => {
    expect(multiScore(["a", "c"], ["a", "c"])).toBe(1);
    expect(multiScore(["a"], ["a", "c"])).toBe(0.5);
    expect(multiScore(["a", "b"], ["a", "c"])).toBe(0);
    expect(multiScore(["b", "d"], ["a", "c"])).toBe(0);
  });
});

describe("symbolicMatch", () => {
  it.each([
    ["x + x", "2x"],
    ["a^2 + 2ab + b^2", "(a+b)^2"],
    ["2 ln(x)", "ln(x^2)"],
    ["(x^2 - 1)/(x - 1)", "x + 1"], // undefined at x = 1, equal elsewhere
    ["0,5x", "x/2"],
  ])("%s ≡ %s", (given, answer) => {
    expect(symbolicMatch(given, answer)).toBe(true);
  });

  it("holds params fixed and rejects other forms", () => {
    expect(symbolicMatch("3x", "k x", { k: 3 })).toBe(true);
    expect(symbolicMatch("4x", "k x", { k: 3 })).toBe(false);
    expect(symbolicMatch("x^2", "2x")).toBe(false);
    expect(symbolicMatch("x +", "2x")).toBe("unreadable");
  });
});

describe("random variants", () => {
  const spec: RandomSpec = {
    params: {
      k: { min: 100, max: 1000, step: 100 },
      r: { choices: [1, 2, 5] },
      p: { min: 0.5, max: 0.6, step: 0.01 },
    },
    formula: "k * (1 + r / 100)",
  };

  it("is deterministic per seed and differs across attempts", () => {
    const s0 = seedFor("learner-1", "ex", 0);
    expect(paramsFor(spec, s0)).toEqual(paramsFor(spec, s0));
    const distinct = new Set(
      Array.from({ length: 20 }, (_, n) =>
        JSON.stringify(paramsFor(spec, seedFor("learner-1", "ex", n))),
      ),
    );
    expect(distinct.size).toBeGreaterThan(10);
    expect(seedFor("learner-1", "ex", 0)).not.toBe(seedFor("learner-2", "ex", 0));
  });

  it("keeps every value inside its spec, on its step", () => {
    for (let s = 0; s < 500; s++) {
      const p = paramsFor(spec, s);
      expect(p.k).toBeGreaterThanOrEqual(100);
      expect(p.k).toBeLessThanOrEqual(1000);
      expect((p.k ?? 0) % 100).toBe(0);
      expect([1, 2, 5]).toContain(p.r);
      expect(p.p).toBeGreaterThanOrEqual(0.5);
      expect(p.p).toBeLessThanOrEqual(0.6);
      expect(Number((p.p ?? 0).toFixed(2))).toBe(p.p);
    }
  });

  it("computes the answer with the formula", () => {
    expect(formulaAnswer(spec.formula, { k: 200, r: 5 })).toBeCloseTo(210, 10);
  });
});

describe("calibration", () => {
  const rows = (id: string, solved: number, total: number) =>
    Array.from({ length: total }, (_, i) => ({
      exerciseId: id,
      score: i < solved ? 1 : 0.5,
      timeMs: 1000 * (i + 1),
    }));

  it("computes success rate and median time per exercise", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(3); // rounded mean of 2 and 3
    expect(median([])).toBeNull();
    expect(calibrate([...rows("a", 3, 4), ...rows("b", 0, 2)])).toEqual([
      { exerciseId: "a", attempts: 4, successRate: 0.75, medianTimeMs: 2500 },
      { exerciseId: "b", attempts: 2, successRate: 0, medianTimeMs: 1500 },
    ]);
  });

  it("flags exercises whose success rate doesn't fit their level", () => {
    const stats = calibrate([
      ...rows("easy-l5", MIN_ATTEMPTS, MIN_ATTEMPTS), // 100% at level 5
      ...rows("hard-l1", 3, MIN_ATTEMPTS), // 10% at level 1
      ...rows("fine-l3", 18, MIN_ATTEMPTS), // 60% at level 3
      ...rows("few-l1", 0, 5), // too few attempts to judge
    ]);
    const level = (id: string) => Number(id.at(-1));
    expect(flags(stats, level)).toEqual([
      { exerciseId: "easy-l5", level: 5, successRate: 1, verdict: "too-easy" },
      { exerciseId: "hard-l1", level: 1, successRate: 0.1, verdict: "too-hard" },
    ]);
  });
});
