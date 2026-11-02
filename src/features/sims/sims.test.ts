import { describe, expect, it } from "vitest";

import { bsPrice } from "@/lib/math/black-scholes";

import { coinWalk } from "./defs/coin-walk";
import { expected, gbm } from "./defs/gbm";
import { llnClt } from "./defs/lln-clt";
import { monteCarlo } from "./defs/monte-carlo";
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
    expect(s.compute(p, 12)).not.toEqual(a);
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
