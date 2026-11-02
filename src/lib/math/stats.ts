/**
 * Small statistics toolkit for the simulations (Phase 12). Pure and dependency-free.
 */

/** Standard normal density. */
export const normalPdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

/**
 * Standard normal CDF via the complementary error function (W. J. Cody-style rational
 * approximation, |error| < 1.2e-7), accurate enough for prices and probabilities shown
 * to a few decimals.
 */
export function normalCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * z);
  const erfc =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? 1 - erfc / 2 : erfc / 2;
}

export function mean(xs: ArrayLike<number>, n = xs.length): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += xs[i] ?? 0;
  return n === 0 ? 0 : s / n;
}

export function variance(xs: ArrayLike<number>, n = xs.length): number {
  if (n < 2) return 0;
  const m = mean(xs, n);
  let s = 0;
  for (let i = 0; i < n; i++) s += ((xs[i] ?? 0) - m) ** 2;
  return s / (n - 1);
}

/** Counts of `values[0..n)` in `bins` equal bins over [lo, hi]; values outside are clamped. */
export function histogram(
  values: ArrayLike<number>,
  n: number,
  lo: number,
  hi: number,
  bins: number,
): Uint32Array {
  const out = new Uint32Array(bins);
  const w = (hi - lo) / bins || 1;
  for (let i = 0; i < n; i++) {
    const b = Math.floor(((values[i] ?? 0) - lo) / w);
    out[Math.min(bins - 1, Math.max(0, b))] = (out[Math.min(bins - 1, Math.max(0, b))] ?? 0) + 1;
  }
  return out;
}
