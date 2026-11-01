import { describe, expect, it } from "vitest";

import { parseLocaleNumber } from "./parse-number";

const value = (s: string) => {
  const r = parseLocaleNumber(s);
  return r.ok ? r.value : r.reason;
};

describe("parseLocaleNumber", () => {
  it.each([
    ["0,25", 0.25],
    ["0.25", 0.25],
    [",5", 0.5],
    ["-1,5", -1.5],
    ["−1,5", -1.5], // U+2212
    ["+2", 2],
    ["  42  ", 42],
    ["0,125", 0.125], // leading zero: cannot be a thousands group
    ["1,5", 1.5],
    ["12,25", 12.25],
    ["1,2345", 1.2345],
    ["1234,5", 1234.5],
    ["1000", 1000],
  ])("decimal %s → %d", (input, expected) => {
    expect(parseLocaleNumber(input)).toMatchObject({ ok: true, kind: "decimal" });
    expect(value(input)).toBeCloseTo(expected, 12);
  });

  it.each([
    ["1 240", 1240],
    ["1 240,5", 1240.5],
    ["1 000", 1000],
    ["12 345 678", 12345678],
    ["-1 000,25", -1000.25],
  ])("space-grouped %s → %d", (input, expected) => {
    expect(value(input)).toBeCloseTo(expected, 12);
  });

  it.each([
    ["12,5%", 0.125],
    ["25%", 0.25],
    ["-0,1%", -0.001],
    ["25 %", 0.25],
  ])("percent %s → %d", (input, expected) => {
    expect(parseLocaleNumber(input)).toMatchObject({ ok: true, kind: "percent" });
    expect(value(input)).toBeCloseTo(expected, 12);
  });

  it.each([
    ["3/8", 0.375],
    ["-3/8", -0.375],
    ["1/3", 1 / 3],
    ["2,5/5", 0.5],
    ["3 / 8", 0.375],
  ])("fraction %s → %d", (input, expected) => {
    expect(parseLocaleNumber(input)).toMatchObject({ ok: true, kind: "fraction" });
    expect(value(input)).toBeCloseTo(expected, 12);
  });

  it.each([
    ["1e-3", 0.001],
    ["1,5e-3", 0.0015],
    ["2E6", 2e6],
    ["2,5·10^-3", 0.0025],
    ["2,5 × 10^-3", 0.0025],
    ["4*10^2", 400],
    ["3 x 10^2", 300],
    ["0e5", 0],
  ])("scientific %s → %d", (input, expected) => {
    expect(parseLocaleNumber(input)).toMatchObject({ ok: true, kind: "scientific" });
    expect(value(input)).toBeCloseTo(expected, 12);
  });

  it("builds scientific values exactly (3e-1 is 0.3, not 0.30000000000000004)", () => {
    expect(value("3e-1")).toBe(0.3);
    expect(value("1,1e1")).toBe(11);
  });

  it.each([
    // thousands-separator lookalikes: never guessed (review H1)
    ["1,000", "ambiguous"],
    ["1.000", "ambiguous"],
    ["12,500", "ambiguous"],
    ["-999.999", "ambiguous"],
    ["1,000%", "ambiguous"],
    ["1.234,5", "ambiguous"],
    ["1,234.5", "ambiguous"],
    // loose spaces are not grouping (review H1)
    ["2 3", "invalid"],
    ["1 2 3,4", "invalid"],
    ["12 34", "invalid"],
    ["1 2345", "invalid"],
    // ×10 needs ^ (review H2)
    ["2x103", "invalid"],
    ["2·105", "invalid"],
    ["3*1012", "invalid"],
    ["5x10", "invalid"],
    // under/overflow (review L1)
    ["1e-400", "invalid"],
    ["1e999", "invalid"],
    // garbage
    ["", "empty"],
    ["   ", "empty"],
    ["abc", "invalid"],
    ["1,2,3", "invalid"],
    ["0,25%%", "invalid"],
    ["1/2/3", "invalid"],
    ["1/-2", "invalid"],
    ["1/0", "division-by-zero"],
    ["--1", "invalid"],
    ["1e", "invalid"],
    ["Infinity", "invalid"],
    ["NaN", "invalid"],
    ["0x10", "invalid"],
  ])("rejects %j as %s", (input, reason) => {
    expect(parseLocaleNumber(input)).toEqual({ ok: false, reason });
  });
});
