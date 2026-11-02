/**
 * Beta distribution for Bayesian updating of a win rate (Phase 12): density via the
 * log-gamma function (Lanczos), and credible intervals by numeric integration.
 */
const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905,
  -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
];

export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let a = 0.9999999999998099;
  const t = z + 7.5;
  for (let i = 0; i < LANCZOS.length; i++) a += (LANCZOS[i] ?? 0) / (z + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

export function betaPdf(x: number, a: number, b: number): number {
  if (x <= 0 || x >= 1) return 0;
  const logB = logGamma(a) + logGamma(b) - logGamma(a + b);
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logB);
}

/** Quantiles of Beta(a, b) by integrating the density on a fine grid. */
export function betaQuantiles(a: number, b: number, qs: readonly number[], steps = 4000): number[] {
  const cdf = new Float64Array(steps + 1);
  let acc = 0;
  for (let i = 1; i <= steps; i++) {
    const x0 = (i - 1) / steps;
    const x1 = i / steps;
    acc += ((betaPdf(x0, a, b) + betaPdf(x1, a, b)) / 2) * (x1 - x0);
    cdf[i] = acc;
  }
  return qs.map((q) => {
    const target = q * acc;
    let i = 0;
    while (i < steps && (cdf[i + 1] ?? 0) < target) i++;
    return i / steps;
  });
}

/** P(X > x) for X ~ Beta(a, b), by the same integration. */
export function betaTail(x: number, a: number, b: number, steps = 4000): number {
  let total = 0;
  let above = 0;
  for (let i = 1; i <= steps; i++) {
    const u0 = (i - 1) / steps;
    const u1 = i / steps;
    const area = ((betaPdf(u0, a, b) + betaPdf(u1, a, b)) / 2) * (u1 - u0);
    total += area;
    if (u0 >= x) above += area;
  }
  return total === 0 ? 0 : above / total;
}
