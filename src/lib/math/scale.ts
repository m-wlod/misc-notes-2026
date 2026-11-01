/** Maps [d0, d1] linearly onto [r0, r1]. A zero-width domain maps to the range midpoint. */
export function linearScale(
  [d0, d1]: readonly [number, number],
  [r0, r1]: readonly [number, number],
) {
  const span = d1 - d0;
  return (v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0));
}

/** Min and max of a non-empty array (avoids spreading huge arrays into Math.min). */
export function extent(values: readonly number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

/**
 * "Nice" tick values covering [min, max]: steps of 1, 2, 2.5 or 5 × 10^k, aiming for
 * about `target` ticks. Ticks lie inside [min, max] and are rounded to the step's
 * precision, so labels don't print 0.30000000000000004.
 */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || target < 1) return [];
  if (min === max) return [min];
  const [lo, hi] = min < max ? [min, max] : [max, min];

  const rough = (hi - lo) / target;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= rough) ?? 10) * pow;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + (step / pow === 2.5 ? 1 : 0));

  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    ticks.push(Number(v.toFixed(decimals)));
  }
  return ticks;
}
