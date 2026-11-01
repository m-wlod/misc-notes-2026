import { describe, expect, it } from "vitest";

import { extent, linearScale, niceTicks } from "./scale";

describe("linearScale", () => {
  it("maps the domain onto the range, including inverted ranges (SVG y)", () => {
    const y = linearScale([0, 10], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(10)).toBe(0);
    expect(y(2.5)).toBe(150);
  });

  it("maps a zero-width domain to the range midpoint instead of NaN", () => {
    expect(linearScale([5, 5], [0, 100])(5)).toBe(50);
  });
});

describe("extent", () => {
  it("returns min and max", () => {
    expect(extent([3, -1, 7, 2])).toEqual([-1, 7]);
  });
  it("handles arrays too large to spread into Math.min", () => {
    const big = Array.from({ length: 300_000 }, (_, i) => i);
    expect(extent(big)).toEqual([0, 299_999]);
  });
});

describe("niceTicks", () => {
  it("covers a 250-step axis with round numbers inside the range", () => {
    expect(niceTicks(0, 249, 5)).toEqual([0, 50, 100, 150, 200]);
    expect(niceTicks(0, 250, 5)).toEqual([0, 50, 100, 150, 200, 250]);
  });

  it("uses 1/2/2.5/5 × 10^k steps", () => {
    expect(niceTicks(0, 1, 4)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(93.2, 111.7, 5)).toEqual([95, 100, 105, 110]);
    expect(niceTicks(0, 1000, 5)).toEqual([0, 200, 400, 600, 800, 1000]);
  });

  it("keeps the tick count near the target for wide ranges (review M3: no 25 overlapping labels)", () => {
    for (const [lo, hi] of [
      [40, 260],
      [0.001, 0.0093],
      [-3.7, 12.2],
      [12, 4800],
    ] as const) {
      const t = niceTicks(lo, hi, 5);
      expect(t.length).toBeGreaterThanOrEqual(3);
      expect(t.length).toBeLessThanOrEqual(8);
      expect(t.every((v) => v >= lo && v <= hi)).toBe(true);
    }
  });

  it("rounds away floating-point noise", () => {
    expect(niceTicks(0, 0.3, 3)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it("handles degenerate input", () => {
    expect(niceTicks(5, 5)).toEqual([5]);
    expect(niceTicks(10, 0, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(Number.NaN, 1)).toEqual([]);
  });
});
