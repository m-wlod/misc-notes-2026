import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { gradeAnswer, gradePlacement, suggestLevel, toUnit, type QuestionResult } from "./grade";
import { PLACEMENT_QUESTIONS } from "./questions";

const PYTHON = process.platform === "win32" ? "python" : "python3";

describe("placement questions", () => {
  it("has two questions per level 1–4 with unique ids", () => {
    const ids = PLACEMENT_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(8);
    for (const level of [1, 2, 3, 4]) {
      expect(PLACEMENT_QUESTIONS.filter((q) => q.level === level)).toHaveLength(2);
    }
  });

  it.each(PLACEMENT_QUESTIONS)("$id: stored answer matches its Python verify", (q) => {
    const out = execFileSync(PYTHON, ["-c", q.verify], { encoding: "utf8" });
    const pythonValue = Number(out.trim());
    expect(Number.isFinite(pythonValue)).toBe(true);
    expect(Math.abs(pythonValue - q.expected)).toBeLessThanOrEqual(q.tolerance / 10);
  });
});

describe("gradeAnswer", () => {
  const byId = (id: string) => {
    const q = PLACEMENT_QUESTIONS.find((x) => x.id === id);
    if (!q) throw new Error(id);
    return q;
  };

  it.each([
    ["drawdown-recovery", "100%", true],
    ["drawdown-recovery", "100", true],
    ["drawdown-recovery", "1", false], // asked in percent
    ["drawdown-recovery", "50%", false],
    ["three-losses", "0,091", true],
    ["three-losses", "9,1125%", true],
    ["three-losses", "0,09", false], // outside tolerance
    ["kelly-even-money", "0,2", true],
    ["kelly-even-money", "20%", true],
    ["kelly-even-money", "1/5", true],
    ["gbm-log-return", "8%", true],
    ["gbm-log-return", "0.08", true],
    ["gbm-log-return", "0,1", false], // forgot the volatility drag
    ["lognormal-mean", "1,6487", true],
    ["lognormal-mean", "1", false],
    ["die-expected-value", "3,5", true],
    ["die-expected-value", "", false],
    ["die-expected-value", "abc", false],
    ["die-expected-value", "1,000", false], // ambiguous input never counts
  ])("%s: %j → %s", (id, raw, correct) => {
    expect(gradeAnswer(byId(id), raw).correct).toBe(correct);
  });

  it("converts units", () => {
    expect(toUnit(1, "percent", "percentPoints")).toBe(100);
    expect(toUnit(100, "decimal", "percentPoints")).toBe(100);
    expect(toUnit(0.2, "percent", "fraction")).toBe(0.2);
  });
});

describe("suggestLevel", () => {
  const r = (correctLevels: number[]): QuestionResult[] =>
    [1, 1, 2, 2, 3, 3, 4, 4].map((level, i) => ({
      id: String(i),
      level,
      correct: correctLevels.includes(i),
    }));

  it.each([
    [[], 1],
    [[0], 1], // one level-1 right
    [[0, 2], 2],
    [[1, 3, 5], 3],
    [[0, 2, 4, 6], 4],
    [[0, 1, 2, 3, 4, 5, 6, 7], 5],
    [[0, 4, 6], 1], // a gap at level 2 stops the climb
    [[2, 3, 4, 5], 1], // level 1 wrong: start at the beginning
  ])("correct indexes %j → level %d", (correct, level) => {
    expect(suggestLevel(r(correct))).toBe(level);
  });

  it("grades a full submission", () => {
    const answers = {
      "drawdown-recovery": "100%",
      "die-expected-value": "3,5",
      "three-losses": "0,0911",
    };
    const { results, suggested } = gradePlacement(PLACEMENT_QUESTIONS, answers);
    expect(results.filter((x) => x.correct).map((x) => x.id)).toEqual([
      "drawdown-recovery",
      "die-expected-value",
      "three-losses",
    ]);
    expect(suggested).toBe(2);
  });
});
