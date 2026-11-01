import { describe, expect, it } from "vitest";

import { mulberry32, normal, randomWalk } from "./rng";

describe("mulberry32", () => {
  it("is deterministic per seed and differs across seeds", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const c = mulberry32(8);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect([c(), c(), c()]).not.toEqual(seqA);
  });

  it("stays in [0, 1) and is roughly uniform", () => {
    const r = mulberry32(1);
    const xs = Array.from({ length: 20_000 }, r);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeCloseTo(0.5, 1);
  });
});

describe("normal", () => {
  it("has mean ≈ 0 and variance ≈ 1", () => {
    const z = normal(mulberry32(42));
    const xs = Array.from({ length: 50_000 }, z);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(variance).toBeCloseTo(1, 1);
  });
});

describe("randomWalk", () => {
  it("starts at `start`, has `points` prices, stays positive and is reproducible", () => {
    const p = randomWalk({ points: 251, sigma: 0.01, seed: 7 });
    expect(p).toHaveLength(251);
    expect(p[0]).toBe(100);
    expect(p.every((v) => v > 0)).toBe(true);
    expect(randomWalk({ points: 251, sigma: 0.01, seed: 7 })).toEqual(p);
  });
});
