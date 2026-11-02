import { describe, expect, it } from "vitest";

import { bsGreeks, bsPrice, type BsInput } from "./black-scholes";
import { histogram, mean, normalCdf, normalPdf, variance } from "./stats";

describe("normal distribution", () => {
  it("matches known values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
    expect(normalCdf(-1)).toBeCloseTo(0.1586553, 6);
    expect(normalCdf(1) + normalCdf(-1)).toBeCloseTo(1, 12);
    expect(normalPdf(0)).toBeCloseTo(0.3989423, 7);
  });
});

describe("mean, variance, histogram", () => {
  it("computes sample statistics and bins", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(variance([1, 2, 3, 4])).toBeCloseTo(5 / 3, 12);
    expect(mean([1, 2, 3, 4], 2)).toBe(1.5);
    expect([...histogram([0, 0.1, 0.5, 0.99, 5, -3], 6, 0, 1, 2)]).toEqual([3, 3]);
  });
});

describe("Black–Scholes", () => {
  const x: BsInput = { S: 100, K: 100, sigma: 0.2, T: 1, r: 0.05 };

  it("prices the textbook at-the-money call and put", () => {
    expect(bsPrice("call", x)).toBeCloseTo(10.4506, 3);
    expect(bsPrice("put", x)).toBeCloseTo(5.5735, 3);
  });

  it("satisfies put–call parity", () => {
    for (const K of [80, 100, 125]) {
      const y = { ...x, K };
      expect(bsPrice("call", y) - bsPrice("put", y)).toBeCloseTo(100 - K * Math.exp(-0.05), 9);
    }
  });

  /** Within 0.1% (plus a tiny absolute floor): the step's own error is ~h². */
  const near = (a: number, b: number) => {
    expect(Math.abs(a - b)).toBeLessThan(1e-3 * Math.abs(b) + 1e-4);
  };

  it("gives Greeks that match finite differences", () => {
    // The CDF approximation (~1e-7) limits how small a step the differences can use.
    const h = 1e-2;
    for (const type of ["call", "put"] as const) {
      const g = bsGreeks(type, x);
      const p = (o: Partial<BsInput>) => bsPrice(type, { ...x, ...o });
      near(g.delta, (p({ S: 100 + h }) - p({ S: 100 - h })) / (2 * h));
      near(g.gamma, (p({ S: 100 + h }) - 2 * p({}) + p({ S: 100 - h })) / h ** 2);
      near(g.vega, (p({ sigma: 0.2 + h }) - p({ sigma: 0.2 - h })) / (2 * h));
      near(g.theta, -(p({ T: 1 + h }) - p({ T: 1 - h })) / (2 * h));
      near(g.rho, (p({ r: 0.05 + h }) - p({ r: 0.05 - h })) / (2 * h));
    }
  });

  it("falls back to discounted intrinsic value at expiry", () => {
    expect(bsPrice("call", { ...x, K: 90, T: 0 })).toBe(10);
    expect(bsPrice("put", { ...x, K: 90, T: 0 })).toBe(0);
  });
});
