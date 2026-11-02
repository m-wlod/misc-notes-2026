import { evaluate, parseExpr } from "@/lib/math/expr";

/**
 * Randomised variants (Phase 9). An exercise's `random` spec gives each param a range or
 * a list, and `formula` computes the answer: the TypeScript twin of the Python `verify`
 * (`content:verify` checks they agree on 100 seeds). The formula is data in our own
 * expression language, so content never runs code on the server.
 */
export type ParamSpec =
  { min: number; max: number; step?: number | undefined } | { choices: number[] };
export type RandomSpec = { params: Record<string, ParamSpec>; formula: string };

/** Random learner id for seeds: set by proxy.ts, httpOnly, no personal data. */
export const LEARNER_COOKIE = "qla_sid";

/** mulberry32: small, fast, deterministic. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash: the seed for a learner, an exercise and an attempt index. */
export function seedFor(learner: string, exerciseId: string, attempt: number): number {
  let h = 2166136261;
  for (const c of `${learner}|${exerciseId}|${String(attempt)}`) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  }
  return h >>> 0;
}

const round = (v: number) => Math.round(v * 1e10) / 1e10;

/** The params for a seed: same seed, same numbers; every value inside its spec. */
export function paramsFor(spec: RandomSpec, seed: number): Record<string, number> {
  const next = rng(seed);
  const out: Record<string, number> = {};
  for (const name of Object.keys(spec.params).sort()) {
    const p = spec.params[name];
    if (!p) continue;
    if ("choices" in p) {
      out[name] = p.choices[Math.floor(next() * p.choices.length)] ?? p.choices[0] ?? 0;
    } else {
      const step = p.step ?? 1;
      const count = Math.floor((p.max - p.min) / step + 1e-9) + 1;
      out[name] = round(p.min + Math.floor(next() * count) * step);
    }
  }
  return out;
}

/** The answer for given params, computed by the formula. */
export function formulaAnswer(formula: string, params: Readonly<Record<string, number>>): number {
  return evaluate(parseExpr(formula), params);
}
