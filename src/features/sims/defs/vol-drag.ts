import { mulberry32, normal } from "@/lib/math/rng";

import { num } from "../params";
import type { SimDef } from "../types";

/**
 * Volatility drag: yearly returns with arithmetic mean μ and volatility σ. The average
 * investor's wealth follows (1 + μ)^t, but the typical (median) investor compounds at
 * roughly μ − σ²/2. The gap is the drag. Log scale (log10 of wealth, start 1).
 */
export type VolDragData = {
  T: number;
  paths: number;
  mu: number;
  sigma: number;
  /** log10 wealth of every path, time-major. */
  values: Float32Array;
  /** log10 of the mean and the median wealth across paths at each year. */
  mean: Float32Array;
  median: Float32Array;
  lo: number;
  hi: number;
};

export const volDrag: SimDef<VolDragData> = {
  id: "vol-drag",
  slug: { pl: "zmiennosc-zjada-zyski", en: "volatility-drag" },
  lessonId: "volatility-drag",
  seconds: 8,
  params: {
    mu: { kind: "number", min: -0.05, max: 0.2, step: 0.01, default: 0.07 },
    sigma: { kind: "number", min: 0, max: 0.8, step: 0.01, default: 0.35 },
    years: { kind: "int", min: 10, max: 100, step: 5, default: 30 },
    paths: { kind: "int", min: 100, max: 2000, step: 100, default: 1000 },
  },
  compute(p, seed) {
    const z = normal(mulberry32(seed));
    const mu = num(p, "mu");
    const sigma = num(p, "sigma");
    const T = num(p, "years");
    const paths = num(p, "paths");
    const values = new Float32Array(paths * (T + 1));
    for (let k = 0; k < paths; k++) {
      let w = 0;
      for (let i = 1; i <= T; i++) {
        // A yearly return can't lose more than everything.
        const r = Math.max(-0.99, mu + sigma * z());
        w += Math.log10(1 + r);
        values[i * paths + k] = w;
      }
    }
    const mean = new Float32Array(T + 1);
    const median = new Float32Array(T + 1);
    const row = new Float32Array(paths);
    let lo = 0;
    let hi = 0;
    for (let i = 0; i <= T; i++) {
      let s = 0;
      for (let k = 0; k < paths; k++) {
        const v = values[i * paths + k] ?? 0;
        row[k] = v;
        s += 10 ** v;
      }
      row.sort();
      mean[i] = Math.log10(s / paths);
      median[i] = row[Math.floor(paths / 2)] ?? 0;
      lo = Math.min(lo, row[Math.floor(paths * 0.05)] ?? 0, median[i] ?? 0);
      hi = Math.max(hi, row[Math.floor(paths * 0.95)] ?? 0, mean[i] ?? 0);
    }
    return { T, paths, mu, sigma, values, mean, median, lo, hi };
  },
  view(d) {
    const pad = Math.max(0.1, (d.hi - d.lo) * 0.06);
    return {
      x: [0, d.T],
      y: [d.lo - pad, d.hi + pad],
      xLabel: "years",
      yLabel: "wealth",
      xFormat: "int",
      yFormat: "log10",
    };
  },
  draw(ctx, d, from, to, plot, c) {
    const P = d.paths;
    const start = Math.max(0, from - 1);
    const end = Math.min(to, d.T);
    // A thin sample of paths for texture.
    ctx.strokeStyle = c.muted;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = plot.px;
    ctx.beginPath();
    for (let k = 0; k < Math.min(P, 150); k++) {
      ctx.moveTo(plot.x(start), plot.y(d.values[start * P + k] ?? 0));
      for (let i = start + 1; i <= end; i++)
        ctx.lineTo(plot.x(i), plot.y(d.values[i * P + k] ?? 0));
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.5 * plot.px;
    ctx.lineJoin = "round";
    for (const [arr, color] of [
      [d.mean, c.series[0]],
      [d.median, c.series[1]],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(plot.x(start), plot.y(arr[start] ?? 0));
      for (let i = start + 1; i <= end; i++) ctx.lineTo(plot.x(i), plot.y(arr[i] ?? 0));
      ctx.stroke();
    }
  },
  overlay(ctx, d, t, plot, c, _p, label) {
    const i = Math.min(t, d.T);
    if (i === 0) return;
    ctx.font = `${String(12 * plot.px)}px sans-serif`;
    ctx.textBaseline = "middle";
    const x = plot.x(i);
    const right = x > plot.left + plot.width * 0.75;
    ctx.textAlign = right ? "right" : "left";
    let yMean = plot.y(d.mean[i] ?? 0);
    let yMed = plot.y(d.median[i] ?? 0);
    if (Math.abs(yMed - yMean) < 14 * plot.px) {
      yMean -= 7 * plot.px;
      yMed += 7 * plot.px;
    }
    for (const [text, y, color] of [
      [label("mean"), yMean, c.series[0]],
      [label("median"), yMed, c.series[1]],
    ] as const) {
      ctx.fillStyle = color;
      ctx.fillRect(x + (right ? -6 : 2) * plot.px, y - 2 * plot.px, 4 * plot.px, 4 * plot.px);
      ctx.lineWidth = 4 * plot.px;
      ctx.strokeStyle = c.bg;
      ctx.lineJoin = "round";
      ctx.strokeText(text, x + (right ? -10 : 10) * plot.px, y);
      ctx.fillStyle = c.ink;
      ctx.fillText(text, x + (right ? -10 : 10) * plot.px, y);
    }
  },
  summary(d, t) {
    const i = Math.min(t, d.T);
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const pct = (v: number) => Math.round(v * 1000) / 10;
    return {
      year: i,
      years: d.T,
      mean: r2(10 ** (d.mean[i] ?? 0)),
      median: r2(10 ** (d.median[i] ?? 0)),
      mu: pct(d.mu),
      geo: pct(d.mu - (d.sigma * d.sigma) / 2),
    };
  },
};
