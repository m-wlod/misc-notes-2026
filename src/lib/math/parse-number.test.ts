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
    ["1 240", 1240],
    ["1 240,5", 1240.5],
    ["1 000", 1000],
  ])("decimal %s → %d", (input, expected) => {
    expect(value(input)).toBeCloseTo(expected, 12);
  });

  it.each([
    ["12,5%", 0.125],
    ["25%", 0.25],
    ["-0,1%", -0.001],
    ["25 %", 0.25],
  ])("percent %s → %d", (input, expected) => {
    const r = parseLocaleNumber(input);
    expect(r).toMatchObject({ ok: true, kind: "percent" });
    expect(value(input)).toBeCloseTo(expected, 12);
  });

  it.each([
    ["3/8", 0.375],
    ["-3/8", -0.375],
    ["1/3", 1 / 3],
    ["2,5/5", 0.5],
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
  ])("scientific %s → %d", (input, expected) => {
    expect(parseLocaleNumber(input)).toMatchObject({ ok: true, kind: "scientific" });
    expect(value(input)).toBeCloseTo(expected, 12);
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["1.234,5", "ambiguous"],
    ["1,234.5", "ambiguous"],
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
    ["1e999", "invalid"],
  ])("rejects %j as %s", (input, reason) => {
    expect(parseLocaleNumber(input)).toEqual({ ok: false, reason });
  });
});
