import { mulberry32, normal } from "@/lib/math/rng";

import { num, str } from "../params";
import type { SimDef } from "../types";

/**
 * Brownian motion and geometric Brownian motion over one year: many paths at once, the
 * distribution of values at the current time on the right edge, and the expected value.
 * The heaviest simulation (1,000 × 500), so it is computed in the Web Worker.
 */
export type GbmData = {
  T: number;
  paths: number;
  model: "gbm" | "bm";
  mu: number;
  /** paths × (T + 1) values, time-major (all paths at step 0, then step 1, …). */
  values: Float32Array;
  lo: number;
  hi: number;
};

const S0 = 100;
const BINS = 30;

/** Expected value at time u (years): S0·e^{μu} for GBM, S0·(1 + μu) for BM. */
export const expected = (model: "gbm" | "bm", mu: number, u: number) =>
  model === "gbm" ? S0 * Math.exp(mu * u) : S0 * (1 + mu * u);

export const gbm: SimDef<GbmData> = {
  id: "gbm",
  slug: { pl: "ruch-browna", en: "brownian-motion" },
  lessonId: "gbm",
  worker: true,
  seconds: 8,
  params: {
    paths: { kind: "int", min: 10, max: 1000, step: 10, default: 200 },
    steps: { kind: "int", min: 50, max: 500, step: 10, default: 250 },
    mu: { kind: "number", min: -0.3, max: 0.3, step: 0.01, default: 0.05 },
    sigma: { kind: "number", min: 0.05, max: 1, step: 0.01, default: 0.2 },
    model: { kind: "choice", options: ["gbm", "bm"], default: "gbm" },
  },
  compute(p, seed) {
    const z = normal(mulberry32(seed));
    const paths = num(p, "paths");
    const T = num(p, "steps");
    const mu = num(p, "mu");
    const sigma = num(p, "sigma");
    const model = str(p, "model") === "bm" ? "bm" : "gbm";
    const dt = 1 / T;
    const values = new Float32Array(paths * (T + 1));
    const drift = model === "gbm" ? (mu - 0.5 * sigma * sigma) * dt : mu * dt;
    const vol = sigma * Math.sqrt(dt);
    for (let k = 0; k < paths; k++) {
      let x = model === "gbm" ? 0 : 0; // log-price (GBM) or relative change (BM)
      values[k] = S0;
      for (let i = 1; i <= T; i++) {
        x += drift + vol * z();
        values[i * paths + k] = model === "gbm" ? S0 * Math.exp(x) : S0 * (1 + x);
      }
    }
    // Axis range: the central 99.6% of all values, so one wild path doesn't flatten the rest.
    const sample = Array.from(
      { length: Math.min(values.length, 20_000) },
      (_, i) => values[Math.floor((i * values.length) / Math.min(values.length, 20_000))] ?? S0,
    ).sort((a, b) => a - b);
    const lo = sample[Math.floor(sample.length * 0.002)] ?? S0;
    const hi = sample[Math.ceil(sample.length * 0.998) - 1] ?? S0;
    return { T, paths, model, mu, values, lo: Math.min(lo, S0), hi: Math.max(hi, S0) };
  },
  view(d) {
    const pad = (d.hi - d.lo) * 0.06 || 1;
    return {
      x: [0, d.T],
      y: [d.lo - pad, d.hi + pad],
      xLabel: "steps",
      yLabel: "value",
      xFormat: "int",
      yFormat: "num",
    };
  },
  draw(ctx, d, from, to, plot, c) {
    const P = d.paths;
    ctx.strokeStyle = c.muted;
    // Many paths: fainter as there are more, so density shows.
    ctx.globalAlpha = Math.min(0.6, Math.max(0.06, 6 / P));
    ctx.lineWidth = plot.px;
    ctx.beginPath();
    const start = Math.max(0, from - 1);
    const end = Math.min(to, d.T);
    if (end > start) {
      for (let k = 0; k < P; k++) {
        ctx.moveTo(plot.x(start), plot.y(d.values[start * P + k] ?? S0));
        for (let i = start + 1; i <= end; i++)
          ctx.lineTo(plot.x(i), plot.y(d.values[i * P + k] ?? S0));
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
  overlay(ctx, d, t, plot, c) {
    const i = Math.min(t, d.T);
    // Expected value so far.
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 2 * plot.px;
    ctx.beginPath();
    for (let j = 0; j <= i; j += Math.max(1, Math.floor(d.T / 100))) {
      const y = plot.y(expected(d.model, d.mu, j / d.T));
      if (j === 0) ctx.moveTo(plot.x(j), y);
      else ctx.lineTo(plot.x(j), y);
    }
    ctx.lineTo(plot.x(i), plot.y(expected(d.model, d.mu, i / d.T)));
    ctx.stroke();
    if (i === 0) return;
    // Distribution of values at step i, as a histogram on the right edge.
    const [y0, y1] = [plot.top + plot.height, plot.top];
    const counts = new Uint32Array(BINS);
    let max = 0;
    const lo = d.lo;
    const w = (d.hi - d.lo) / BINS || 1;
    for (let k = 0; k < d.paths; k++) {
      const b = Math.floor(((d.values[i * d.paths + k] ?? S0) - lo) / w);
      const bb = Math.min(BINS - 1, Math.max(0, b));
      counts[bb] = (counts[bb] ?? 0) + 1;
      if ((counts[bb] ?? 0) > max) max = counts[bb] ?? 0;
    }
    const maxW = plot.width * 0.16;
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.55;
    for (let b = 0; b < BINS; b++) {
      const cnt = counts[b] ?? 0;
      if (!cnt) continue;
      const ya = Math.max(y1, plot.y(lo + (b + 1) * w)) + plot.px;
      const yb = Math.min(y0, plot.y(lo + b * w)) - plot.px;
      const bw = (cnt / max) * maxW;
      ctx.fillRect(plot.left + plot.width - bw, ya, bw, Math.max(1, yb - ya));
    }
    ctx.globalAlpha = 1;
  },
  summary(d, t) {
    const i = Math.min(t, d.T);
    const row = Array.from(d.values.subarray(i * d.paths, (i + 1) * d.paths)).sort((a, b) => a - b);
    const mean = row.reduce((a, b) => a + b, 0) / row.length;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    return {
      step: i,
      steps: d.T,
      paths: d.paths,
      mean: r2(mean),
      median: r2(row[Math.floor(row.length / 2)] ?? S0),
      expected: r2(expected(d.model, d.mu, i / d.T)),
    };
  },
};
