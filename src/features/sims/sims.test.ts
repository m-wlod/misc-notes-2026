import { describe, expect, it } from "vitest";

import { bsPrice } from "@/lib/math/black-scholes";

import { coinWalk } from "./defs/coin-walk";
import { ev, evHeatmap } from "./defs/ev-heatmap";
import { expected, gbm } from "./defs/gbm";
import { growthRate, kelly, kellyOptimum } from "./defs/kelly";
import { llnClt } from "./defs/lln-clt";
import { martingale } from "./defs/martingale";
import { monteCarlo } from "./defs/monte-carlo";
import { volDrag } from "./defs/vol-drag";
import { clampParam, defaults, parseState, stateQuery } from "./params";
import { SIMS, simBySlug } from "./registry";

describe("params and URL state", () => {
  const specs = gbm.params;

  it("round-trips params, seed and frame through the URL", () => {
    const state = {
      params: { ...defaults(specs), paths: 500, mu: -0.1, model: "bm" },
      seed: 42,
      t: 120,
    };
    const back = parseState(specs, new URLSearchParams(stateQuery(specs, state)), 1);
    expect(back).toEqual(state);
  });

  it("clamps, snaps and falls back on bad values", () => {
    const q = new URLSearchParams("paths=99999&mu=0.123456&sigma=abc&model=evil&seed=-3&t=x");
    const s = parseState(specs, q, 7);
    expect(s.params).toMatchObject({ paths: 1000, mu: 0.12, sigma: 0.2, model: "gbm" });
    expect(s.seed).toBe(7);
    expect(s.t).toBeNull();
    expect(clampParam({ kind: "number", min: 0, max: 1, step: 0.1, default: 0.5 }, "0,3")).toBe(
      0.3,
    );
    expect(clampParam({ kind: "toggle", default: false }, "1")).toBe(true);
    expect(clampParam({ kind: "int", min: 0, max: 10, default: 5 }, "")).toBe(5);
  });

  it("every simulation has unique ids and slugs, and valid defaults", () => {
    expect(new Set(SIMS.map((s) => s.id)).size).toBe(SIMS.length);
    for (const s of SIMS) {
      expect(simBySlug(s.slug.pl)).toBe(s);
      expect(simBySlug(s.slug.en)).toBe(s);
      for (const [k, spec] of Object.entries(s.params))
        expect(clampParam(spec, spec.default), `${s.id}.${k}`).toEqual(spec.default);
    }
  });
});

describe("simulations are deterministic per seed", () => {
  it.each(SIMS.map((s) => [s.id, s] as const))("%s", (_, s) => {
    const p = defaults(s.params);
    const a = s.compute(p, 11);
    expect(s.compute(p, 11)).toEqual(a);
    // A still picture (the EV map) doesn't use the seed.
    if (!s.static) expect(s.compute(p, 12)).not.toEqual(a);
    expect(a.T).toBeGreaterThan(0);
    expect(Object.keys(s.summary(a, a.T, p)).length).toBeGreaterThan(0);
  });
});

describe("the maths behind each simulation", () => {
  it("coin walk: a fair coin's prices start at 100 and move by the step", () => {
    const d = coinWalk.compute({ ...defaults(coinWalk.params), paths: 1, move: 2 }, 3);
    expect(d.prices[0]).toBe(100);
    expect([102, 98]).toContain(Math.round((d.prices[1] ?? 0) * 1000) / 1000);
  });

  it("LLN: the running mean of 5000 die rolls is close to 3.5", () => {
    const d = llnClt.compute({ dist: "die", n: 10, samples: 5000, view: "lln" }, 5);
    expect(d.running[4999]).toBeCloseTo(3.5, 1);
  });

  it("CLT: means of n draws have spread σ/√n", () => {
    const p = { dist: "exp", n: 25, samples: 5000, view: "clt" };
    const d = llnClt.compute(p, 9);
    const s = llnClt.summary(d, d.T, p);
    expect(Number(s.sd)).toBeCloseTo(1 / 5, 1);
    expect(Number(s.value)).toBeCloseTo(1, 1);
  });

  it("GBM: the average terminal value matches S0·e^{μT}", () => {
    const p = { paths: 1000, steps: 100, mu: 0.1, sigma: 0.2, model: "gbm" };
    const d = gbm.compute(p, 21);
    const s = gbm.summary(d, d.T, p);
    expect(Number(s.mean) / expected("gbm", 0.1, 1)).toBeCloseTo(1, 1);
    expect(Number(s.expected)).toBeCloseTo(100 * Math.exp(0.1), 1);
    // Time-major layout: all paths start at 100.
    expect([...d.values.subarray(0, 1000)].every((v) => v === 100)).toBe(true);
  });

  it("Monte Carlo: π and a call price within their 95% margins", () => {
    const pi = monteCarlo.compute({ ...defaults(monteCarlo.params), samples: 20_000 }, 4);
    expect(Math.abs((pi.estimate[19_999] ?? 0) - Math.PI)).toBeLessThan(
      ((1.96 * pi.sd) / Math.sqrt(20_000)) * 1.5,
    );
    const p = { ...defaults(monteCarlo.params), target: "call", samples: 20_000 };
    const call = monteCarlo.compute(p, 4);
    expect(call.truth).toBeCloseTo(
      bsPrice("call", { S: 100, K: 100, sigma: 0.2, T: 1, r: 0.03 }),
      9,
    );
    expect(Math.abs((call.estimate[19_999] ?? 0) - call.truth)).toBeLessThan(
      ((1.96 * call.sd) / Math.sqrt(20_000)) * 1.5,
    );
  });
});

describe("12b simulations", () => {
  it("martingale: ruin only grows, and an unfair game drains the average bankroll", () => {
    const p = { ...defaults(martingale.params), players: 500, rounds: 500 };
    const d = martingale.compute(p, 2);
    for (let i = 1; i <= d.T; i++)
      expect(d.ruined[i] ?? 0).toBeGreaterThanOrEqual(d.ruined[i - 1] ?? 0);
    expect(d.ruined[d.T]).toBeGreaterThan(0.05);
    expect(d.mean[d.T]).toBeLessThan(d.bankroll);
  });

  it("Kelly: f* = p − q/b, and the growth rate peaks there", () => {
    expect(kellyOptimum(0.55, 1)).toBeCloseTo(0.1, 12);
    expect(kellyOptimum(0.6, 2)).toBeCloseTo(0.4, 12);
    expect(kellyOptimum(0.4, 1)).toBe(0);
    const g = (f: number) => growthRate(f, 0.55, 1);
    expect(g(0.1)).toBeGreaterThan(g(0.05));
    expect(g(0.1)).toBeGreaterThan(g(0.15));
    expect(g(0.2)).toBeCloseTo(0, 2); // twice Kelly at even money: about no growth
    const d = kelly.compute({ p: 0.55, b: 1, bets: 1000, runs: 300 }, 8);
    const s = kelly.summary(d, d.T, {});
    expect(Number(s.full)).toBeGreaterThan(Number(s.double));
    expect(Number(s.full)).toBeGreaterThan(Number(s.half));
  });

  it("volatility drag: the median compounds near μ − σ²/2 and trails the mean", () => {
    const p = { mu: 0.07, sigma: 0.35, years: 30, paths: 2000 };
    const d = volDrag.compute(p, 13);
    const s = volDrag.summary(d, d.T, p);
    // Shown to one decimal: 7% − 6.125% = 0.875% → 0.9.
    expect(Number(s.geo)).toBe(Math.round((0.07 - 0.35 ** 2 / 2) * 1000) / 10);
    expect(Number(s.median)).toBeLessThan(Number(s.mean));
    // Median growth per year within a couple of points of the geometric estimate.
    const yearly = Number(s.median) ** (1 / 30) - 1;
    expect(Math.abs(yearly - (0.07 - 0.35 ** 2 / 2))).toBeLessThan(0.02);
  });

  it("EV map: EV = p·RR − (1 − p) − fees, break-even at p = (1 + fees)/(1 + RR)", () => {
    expect(ev(0.5, 1, 0)).toBe(0);
    expect(ev(0.45, 1.5, 0.05)).toBeCloseTo(0.075, 12);
    const d = evHeatmap.compute({ fees: 0.1, p: 0.5, rr: 1 }, 0);
    expect(d.T).toBe(1);
    expect(evHeatmap.summary(d, 1, {})).toMatchObject({ ev: -0.1, breakEven: 55 });
    expect(evHeatmap.static).toBe(true);
  });
});
