import { describe, expect, it } from "vitest";

import { equivalent, evaluate, ExprError, parseExpr, toTex, variables } from "./expr";

const ev = (src: string, vars: Record<string, number> = {}) => evaluate(parseExpr(src), vars);

describe("parseExpr / evaluate", () => {
  it.each([
    ["1 + 2 * 3", 7],
    ["(1 + 2) * 3", 9],
    ["2^3^2", 512], // right-associative
    ["-2^2", -4],
    ["0,5 + 0.25", 0.75], // Polish comma
    ["1e-3 * 1000", 1],
    ["2pi", 2 * Math.PI],
    ["sqrt(16) + abs(-3)", 7],
    ["ln(e)", 1],
    ["log(1000)", 3],
    ["6 / 3 / 2", 1],
  ])("%s = %d", (src, value) => {
    expect(ev(src)).toBeCloseTo(value, 10);
  });

  it("handles implicit multiplication and variables", () => {
    expect(ev("2x", { x: 3 })).toBe(6);
    expect(ev("3(x+1)", { x: 2 })).toBe(9);
    expect(ev("xy", { x: 2, y: 5 })).toBe(10);
    expect(ev("2 sqrt(x)", { x: 9 })).toBe(6);
    expect(ev("x · y − 1", { x: 2, y: 3 })).toBe(5);
    expect(variables(parseExpr("2pi r + e^x"))).toEqual(["r", "x"]);
  });

  it.each(["", "2 +", "(1 + 2", "sqrt 4", "2 $ 3", "1 + )"])(
    "rejects %j with a position",
    (src) => {
      expect(() => parseExpr(src)).toThrow(ExprError);
    },
  );
});

describe("toTex", () => {
  it.each([
    ["1/2", String.raw`\frac{1}{2}`],
    ["x^2", "{x}^{2}"],
    ["2x", "2x"],
    ["2*3", String.raw`2 \cdot 3`],
    ["sqrt(x)", String.raw`\sqrt{x}`],
    ["(a+b)^2", String.raw`{\left(a + b\right)}^{2}`],
    ["a - (b - c)", String.raw`a - \left(b - c\right)`],
    ["pi", String.raw`\pi`],
  ])("%s → %s", (src, tex) => {
    expect(toTex(parseExpr(src))).toBe(tex);
  });

  it("prints Polish decimal commas when asked", () => {
    expect(toTex(parseExpr("0.5x"), true)).toBe("0{,}5x");
  });
});

describe("equivalent", () => {
  const eq = (a: string, b: string) => equivalent(parseExpr(a), parseExpr(b));
  it.each([
    ["2x", "x + x"],
    ["(a+b)^2", "a^2 + 2ab + b^2"],
    ["ln(x^2)", "2 ln(x)"],
    ["1/2", "0,5"],
  ])("%s ≡ %s", (a, b) => {
    expect(eq(a, b)).toBe(true);
  });
  it.each([
    ["2x", "x^2"],
    ["a + b", "a - b"],
    ["x", "y"],
  ])("%s ≢ %s", (a, b) => {
    expect(eq(a, b)).toBe(false);
  });
});
