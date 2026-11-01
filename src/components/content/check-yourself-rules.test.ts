import { describe, expect, it } from "vitest";

import { isCorrect, toCheck } from "./check-yourself-rules";

describe("toCheck", () => {
  it("rejects broken questions at build time", () => {
    expect(() => toCheck({ options: ["a", "b"], answer: 2 })).toThrow(/option index 0–1/);
    expect(() => toCheck({ options: ["only"], answer: 0 })).toThrow(/at least 2/);
    expect(() => toCheck({ answer: "pół" })).toThrow(/not a number/);
  });
});

describe("isCorrect", () => {
  const half = toCheck({ answer: "0.5" });
  it.each(["0,5", "0.5", "1/2", "50%", " 0,500 "])("accepts %j for 0.5", (raw) => {
    expect(isCorrect(half, raw)).toBe(true);
  });
  it.each(["0,51", "", "abc", "1,000"])("rejects %j", (raw) => {
    expect(isCorrect(half, raw)).toBe(false);
  });
  it("respects a tolerance and checks choices by index", () => {
    expect(isCorrect(toCheck({ answer: "3.14", tolerance: 0.01 }), "3,1415")).toBe(true); // 3 digits after a comma would be ambiguous (thousands)
    const choice = toCheck({ options: ["a", "b", "c"], answer: 1 });
    expect(isCorrect(choice, "1")).toBe(true);
    expect(isCorrect(choice, "2")).toBe(false);
  });
});
