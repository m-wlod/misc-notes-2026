import { mulberry32, normal } from "@/lib/math/rng";

import { num } from "../params";
import type { SimDef } from "../types";

/**
 * Backtest overfitting: N strategies that are pure noise (no edge at all), tested on the
 * same in-sample period. The best one looks brilliant; after the dashed line (out of
 * sample) it is as random as the rest. Computed in the Web Worker.
 */
export type OverfitData = {
  T: number;
  inSample: number;
  strategies: number;
  /** Cumulative returns (in %) of the best in-sample strategy, T + 1 values. */
  best: Float32Array;
  /** Cumulative returns of a sample of other strategies, path-major. */
  sample: Float32Array;
  shown: number;
  bestIsSharpe: number;
  bestOosSharpe: number;
  /** Median in-sample Sharpe of all strategies (≈ 0). */
  medianIsSharpe: number;
  lo: number;
  hi: number;
};

const SHOWN = 30;
const DAILY_VOL = 1; // % per day
const annualSharpe = (mean: number, sd: number) => (sd === 0 ? 0 : (mean / sd) * Math.sqrt(252));

export const overfitting: SimDef<OverfitData> = {
  id: "overfitting",
  slug: { pl: "przeuczony-backtest", en: "backtest-overfitting" },
  lessonId: "overfitting",
  worker: true,
  seconds: 8,
  params: {
    strategies: { kind: "int", min: 10, max: 2000, step: 10, default: 200 },
    inSample: { kind: "int", min: 100, max: 1000, step: 50, default: 500 },
    outSample: { kind: "int", min: 100, max: 1000, step: 50, default: 250 },
  },
  compute(p, seed) {
    const z = normal(mulberry32(seed));
    const N = num(p, "strategies");
    const IS = num(p, "inSample");
    const T = IS + num(p, "outSample");
    const shown = Math.min(SHOWN, N - 1);
    const returns = new Float32Array(N * T);
    const isSharpe = new Float32Array(N);
    let bestK = 0;
    for (let k = 0; k < N; k++) {
      let s = 0;
      let s2 = 0;
      for (let i = 0; i < T; i++) {
        const r = DAILY_VOL * z();
        returns[k * T + i] = r;
        if (i < IS) {
          s += r;
          s2 += r * r;
        }
      }
      const m = s / IS;
      isSharpe[k] = annualSharpe(m, Math.sqrt(Math.max(1e-12, s2 / IS - m * m)));
      if ((isSharpe[k] ?? 0) > (isSharpe[bestK] ?? 0)) bestK = k;
    }
    const cumulate = (k: number, out: Float32Array, offset: number) => {
      let c = 0;
      out[offset] = 0;
      for (let i = 0; i < T; i++) {
        c += returns[k * T + i] ?? 0;
        out[offset + i + 1] = c;
      }
    };
    const best = new Float32Array(T + 1);
    cumulate(bestK, best, 0);
    const sample = new Float32Array(shown * (T + 1));
    let lo = 0;
    let hi = 0;
    for (let j = 0, k = 0; j < shown; k++) {
      if (k === bestK) continue;
      cumulate(k, sample, j * (T + 1));
      j++;
    }
    for (const arr of [best, sample]) {
      for (const v of arr) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    let s = 0;
    let s2 = 0;
    for (let i = IS; i < T; i++) {
      const r = returns[bestK * T + i] ?? 0;
      s += r;
      s2 += r * r;
    }
    const n = T - IS;
    const m = s / n;
    const sorted = Array.from(isSharpe).sort((a, b) => a - b);
    return {
      T,
      inSample: IS,
      strategies: N,
      best,
      sample,
      shown,
      bestIsSharpe: isSharpe[bestK] ?? 0,
      bestOosSharpe: annualSharpe(m, Math.sqrt(Math.max(1e-12, s2 / n - m * m))),
      medianIsSharpe: sorted[Math.floor(N / 2)] ?? 0,
      lo,
      hi,
    };
  },
  view(d) {
    const pad = (d.hi - d.lo) * 0.06 || 1;
    return {
      x: [0, d.T],
      y: [d.lo - pad, d.hi + pad],
      xLabel: "days",
      yLabel: "cumReturn",
      xFormat: "int",
      yFormat: "num",
    };
  },
  draw(ctx, d, from, to, plot, c) {
    const n = d.T + 1;
    const start = Math.max(0, from - 1);
    const end = Math.min(to, d.T);
    if (from === 0) {
      // The end of the in-sample period.
      ctx.strokeStyle = c.ink;
      ctx.setLineDash([5 * plot.px, 4 * plot.px]);
      ctx.lineWidth = 1.5 * plot.px;
      ctx.beginPath();
      ctx.moveTo(plot.x(d.inSample), plot.top);
      ctx.lineTo(plot.x(d.inSample), plot.top + plot.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.lineJoin = "round";
    ctx.strokeStyle = c.muted;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = plot.px;
    ctx.beginPath();
    for (let k = 0; k < d.shown; k++) {
      ctx.moveTo(plot.x(start), plot.y(d.sample[k * n + start] ?? 0));
      for (let i = start + 1; i <= end; i++)
        ctx.lineTo(plot.x(i), plot.y(d.sample[k * n + i] ?? 0));
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 2.5 * plot.px;
    ctx.beginPath();
    ctx.moveTo(plot.x(start), plot.y(d.best[start] ?? 0));
    for (let i = start + 1; i <= end; i++) ctx.lineTo(plot.x(i), plot.y(d.best[i] ?? 0));
    ctx.stroke();
  },
  overlay(ctx, d, t, plot, c, _p, label) {
    ctx.font = `${String(12 * plot.px)}px sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillStyle = c.ink;
    ctx.textAlign = "right";
    ctx.fillText(label("inSample"), plot.x(d.inSample) - 6 * plot.px, plot.top + 4 * plot.px);
    if (t > d.inSample) {
      ctx.textAlign = "left";
      ctx.fillText(label("outSample"), plot.x(d.inSample) + 6 * plot.px, plot.top + 4 * plot.px);
    }
  },
  summary(d, t) {
    const r2 = (v: number) => Math.round(v * 100) / 100;
    return {
      mode: t > d.inSample ? "oos" : "is",
      day: Math.min(t, d.T),
      strategies: d.strategies,
      isSharpe: r2(d.bestIsSharpe),
      oosSharpe: r2(d.bestOosSharpe),
      median: r2(d.medianIsSharpe),
    };
  },
};
