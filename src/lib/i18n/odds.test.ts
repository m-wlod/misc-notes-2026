import { describe, expect, it } from "vitest";

import { formatOdds, randomTypingOdds } from "./odds";

describe("randomTypingOdds", () => {
  it("is 1 in 38^n for a path of n characters, ignoring the leading slash", () => {
    expect(randomTypingOdds("/a")).toEqual({ length: 1, mantissa: 3.8, exponent: 1 });
    expect(randomTypingOdds("/ab")).toEqual({ length: 2, mantissa: 1.4, exponent: 3 }); // 1444
  });

  it("matches 38^n in scientific form for long paths", () => {
    const path = "/pl/nie-ma-takiej-strony"; // 23 characters after the slash
    const odds = randomTypingOdds(path);
    expect(odds.length).toBe(23);
    // log10(38^23) = 23 · 1.5798 = 36.335 → 2.2 · 10^36
    expect(odds.exponent).toBe(36);
    expect(odds.mantissa).toBeCloseTo(2.2, 1);
  });

  it("carries a mantissa that rounds up to 10 into the exponent", () => {
    // 10^0.99999 rounds to 10.0 at one decimal → must become 1.0 · 10^(e+1)
    const odds = randomTypingOdds("/" + "a".repeat(3), 10 ** (2.99999 / 3));
    expect(odds).toEqual({ length: 3, mantissa: 1, exponent: 3 });
  });
});

describe("formatOdds", () => {
  it("writes small odds out in full with locale grouping", () => {
    expect(formatOdds({ length: 2, mantissa: 1.444, exponent: 3 }, "en")).toBe("1,444");
  });

  it("uses a localised mantissa and superscript exponent for large odds", () => {
    const odds = { length: 23, mantissa: 2.2, exponent: 36 };
    expect(formatOdds(odds, "pl")).toBe("2,2·10³⁶");
    expect(formatOdds(odds, "en")).toBe("2.2·10³⁶");
  });
});
