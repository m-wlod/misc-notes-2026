import { extent } from "@/lib/math/scale";

import type { RawPlot } from "./protocol";

/** Points drawn per line: more is invisible on any screen and slows the SVG down. */
export const MAX_POINTS = 2000;

export type LineSeries = { kind: "line"; label: string | null; points: [number, number][] };
export type HistBin = { from: number; to: number; count: number };
export type Histogram = { kind: "hist"; label: string | null; bins: HistBin[]; n: number };
export type CleanPlot = (LineSeries | Histogram) & {
  /** Values dropped because they weren't finite numbers (NaN, ±inf). */
  dropped: number;
  /** True when the line was thinned to MAX_POINTS. */
  thinned: boolean;
};

/**
 * Keeps every k-th point plus the min and max of each bucket, so spikes survive
 * thinning (a plain stride would hide exactly the crash a learner is looking for).
 */
export function thin(points: [number, number][], max = MAX_POINTS): [number, number][] {
  if (points.length <= max) return points;
  const buckets = Math.floor((max - 2) / 2);
  const size = points.length / buckets;
  const first = points[0];
  const out: [number, number][] = first ? [first] : [];
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * size);
    const end = Math.min(points.length, Math.floor((b + 1) * size));
    let lo = start;
    let hi = start;
    for (let i = start; i < end; i++) {
      if ((points[i]?.[1] ?? 0) < (points[lo]?.[1] ?? 0)) lo = i;
      if ((points[i]?.[1] ?? 0) > (points[hi]?.[1] ?? 0)) hi = i;
    }
    for (const i of lo <= hi ? [lo, hi] : [hi, lo]) {
      const p = points[i];
      if (p && out.at(-1) !== p) out.push(p);
    }
  }
  const last = points.at(-1);
  if (last && out.at(-1) !== last) out.push(last);
  return out;
}

export function histogram(values: readonly number[], bins: number): HistBin[] {
  if (values.length === 0) return [];
  const k = Math.max(1, Math.min(200, Math.round(bins)));
  let [lo, hi] = extent(values);
  if (lo === hi) {
    lo -= 0.5;
    hi += 0.5;
  }
  const width = (hi - lo) / k;
  const out = Array.from({ length: k }, (_, i) => ({
    from: lo + i * width,
    to: lo + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    const i = Math.min(k - 1, Math.floor((v - lo) / width));
    const bin = out[i];
    if (bin) bin.count++;
  }
  return out;
}

/** Cleans a plot from Python: drops non-finite values, thins long lines, bins histograms. */
export function cleanPlot(raw: RawPlot): CleanPlot {
  if (raw.kind === "hist") {
    const values = Array.from(raw.y).filter(Number.isFinite);
    return {
      kind: "hist",
      label: raw.label,
      bins: histogram(values, raw.bins),
      n: values.length,
      dropped: raw.y.length - values.length,
      thinned: false,
    };
  }
  const n = raw.x ? Math.min(raw.x.length, raw.y.length) : raw.y.length;
  const points: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const x = raw.x ? (raw.x[i] ?? NaN) : i;
    const y = raw.y[i] ?? NaN;
    if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y]);
  }
  const thinned = thin(points);
  return {
    kind: "line",
    label: raw.label,
    points: thinned,
    dropped: n - points.length,
    thinned: thinned.length < points.length,
  };
}
