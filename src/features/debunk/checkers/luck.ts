import { normalCdf } from "@/lib/math/stats";

import { binomialPmf } from "./ev";

/**
 * "Is this track record luck?" (Phase 16): how likely a result is with no edge at all,
 * and how much likelier once many strategies or traders were tried and only the best
 * one is shown (multiple testing, survivorship).
 */

/** P(X ≥ k) for X ~ Binomial(n, p): the chance of at least k wins by luck alone. */
export function binomialTail(n: number, k: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  const pmf = binomialPmf(n, p);
  let s = 0;
  for (let i = k; i <= n; i++) s += pmf[i] ?? 0;
  return Math.min(1, s);
}

/** The chance that at least one of `tries` independent no-edge attempts looks this good. */
export const atLeastOne = (p: number, tries: number) => 1 - (1 - p) ** Math.max(1, tries);

/**
 * A Sharpe ratio S measured over T years has a t-statistic of about S·√T under no edge
 * (returns ~ i.i.d.); the one-sided p-value is P(Z ≥ t).
 */
export function sharpePValue(sharpe: number, years: number): number {
  return 1 - normalCdf(sharpe * Math.sqrt(Math.max(0, years)));
}

/**
 * The expected best Sharpe among M no-edge strategies over T years: their measured
 * Sharpes are ≈ N(0, 1/T), and E[max of M standard normals] ≈ Φ⁻¹(1 − 1/(M+1)) (a good
 * approximation, exact for M = 1). So with enough tries a "great" Sharpe is expected.
 */
export function expectedBestSharpe(tries: number, years: number): number {
  if (tries <= 1 || years <= 0) return 0;
  return inverseNormalCdf(1 - 1 / (tries + 1)) / Math.sqrt(years);
}

/** Φ⁻¹ by bisection on normalCdf (accurate to ~1e-10; called rarely). */
export function inverseNormalCdf(u: number): number {
  if (u <= 0) return -Infinity;
  if (u >= 1) return Infinity;
  let lo = -10;
  let hi = 10;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < u) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
