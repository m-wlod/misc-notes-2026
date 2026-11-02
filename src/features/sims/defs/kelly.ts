import { mulberry32 } from "@/lib/math/rng";

import { num } from "../params";
import type { SimDef } from "../types";

/**
 * Kelly criterion: the same sequence of bets played with half Kelly, Kelly and double
 * Kelly. Kelly maximises the long-run growth rate; betting more than that grows slower
 * and can shrink to nothing even with an edge. Lines are the geometric average across many
 * runs (the mean of log wealth, which Kelly maximises), on a log scale (start 1).
 */
export type KellyData = {
  T: number;
  runs: number;
  /** Kelly fraction f* = p − q/b (0 when there is no edge). */
  kelly: number;
  fractions: [number, number, number];
  /** Mean log10 wealth per strategy (the geometric average), 3 × (T + 1), strategy-major. */
  geo: Float32Array;
  /** Theoretical growth rate per bet, g(f) = p·ln(1 + b f) + q·ln(1 − f). */
  growth: [number, number, number];
  lo: number;
  hi: number;
};

export const kellyOptimum = (p: number, b: number) => Math.max(0, p - (1 - p) / b);
export const growthRate = (f: number, p: number, b: number) =>
  f >= 1 ? -Infinity : p * Math.log(1 + b * f) + (1 - p) * Math.log(1 - f);

export const kelly: SimDef<KellyData> = {
  id: "kelly",
  slug: { pl: "kryterium-kelly-ego", en: "kelly-criterion" },
  lessonId: "kelly-criterion",
  seconds: 8,
  params: {
    p: { kind: "number", min: 0.5, max: 0.75, step: 0.01, default: 0.55 },
    b: { kind: "number", min: 0.5, max: 3, step: 0.1, default: 1 },
    bets: { kind: "int", min: 50, max: 1000, step: 50, default: 300 },
    runs: { kind: "int", min: 25, max: 500, step: 25, default: 200 },
  },
  compute(p, seed) {
    const rand = mulberry32(seed);
    const pw = num(p, "p");
    const b = num(p, "b");
    const T = num(p, "bets");
    const runs = num(p, "runs");
    const fStar = kellyOptimum(pw, b);
    const fractions: [number, number, number] = [fStar / 2, fStar, Math.min(0.99, fStar * 2)];
    // log10 wealth of every run and strategy at every bet, then the geo per bet.
    const all = new Float32Array(3 * runs * (T + 1));
    for (let r = 0; r < runs; r++) {
      const w = [0, 0, 0];
      for (let i = 0; i <= T; i++) {
        if (i > 0) {
          const win = rand() < pw;
          for (let s = 0; s < 3; s++) {
            const f = fractions[s] ?? 0;
            w[s] = (w[s] ?? 0) + Math.log10(win ? 1 + b * f : Math.max(1e-12, 1 - f));
          }
        }
        for (let s = 0; s < 3; s++) all[(s * runs + r) * (T + 1) + i] = w[s] ?? 0;
      }
    }
    // Mean log10 wealth = log10 of the geometric average: what Kelly maximises.
    const geo = new Float32Array(3 * (T + 1));
    let lo = 0;
    let hi = 0;
    for (let st = 0; st < 3; st++) {
      for (let i = 0; i <= T; i++) {
        let sum = 0;
        for (let r = 0; r < runs; r++) sum += all[(st * runs + r) * (T + 1) + i] ?? 0;
        const m = sum / runs;
        geo[st * (T + 1) + i] = m;
        if (m < lo) lo = m;
        if (m > hi) hi = m;
      }
    }
    return {
      T,
      runs,
      kelly: fStar,
      fractions,
      geo,
      growth: [
        growthRate(fractions[0], pw, b),
        growthRate(fractions[1], pw, b),
        growthRate(fractions[2], pw, b),
      ],
      lo,
      hi,
    };
  },
  view(d) {
    const pad = Math.max(0.2, (d.hi - d.lo) * 0.08);
    return {
      x: [0, d.T],
      y: [Math.min(-0.5, d.lo - pad), Math.max(0.5, d.hi + pad)],
      xLabel: "bets",
      yLabel: "wealth",
      xFormat: "int",
      yFormat: "log10",
    };
  },
  draw(ctx, d, from, to, plot, c) {
    const n = d.T + 1;
    const start = Math.max(0, from - 1);
    const end = Math.min(to, d.T);
    if (from === 0) {
      ctx.strokeStyle = c.muted;
      ctx.setLineDash([4 * plot.px, 4 * plot.px]);
      ctx.lineWidth = plot.px;
      ctx.beginPath();
      ctx.moveTo(plot.left, plot.y(0));
      ctx.lineTo(plot.left + plot.width, plot.y(0));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.lineJoin = "round";
    ctx.lineWidth = 2 * plot.px;
    for (let s = 0; s < 3; s++) {
      ctx.strokeStyle = c.series[s] ?? c.ink;
      ctx.beginPath();
      ctx.moveTo(plot.x(start), plot.y(d.geo[s * n + start] ?? 0));
      for (let i = start + 1; i <= end; i++) ctx.lineTo(plot.x(i), plot.y(d.geo[s * n + i] ?? 0));
      ctx.stroke();
    }
  },
  overlay(ctx, d, t, plot, c) {
    // Direct labels at the current end of each line (identity is never colour alone).
    const i = Math.min(t, d.T);
    if (i === 0) return;
    const labels = ["½ Kelly", "Kelly", "2× Kelly"];
    ctx.font = `${String(12 * plot.px)}px sans-serif`;
    ctx.textBaseline = "middle";
    const ys = [0, 1, 2].map((s) => plot.y(d.geo[s * (d.T + 1) + i] ?? 0));
    // Keep labels at least one line apart.
    const order = [0, 1, 2].sort((a, b) => (ys[a] ?? 0) - (ys[b] ?? 0));
    const gap = 14 * plot.px;
    for (let k = 1; k < 3; k++) {
      const prev = order[k - 1] ?? 0;
      const cur = order[k] ?? 0;
      if ((ys[cur] ?? 0) - (ys[prev] ?? 0) < gap) ys[cur] = (ys[prev] ?? 0) + gap;
    }
    const x = plot.x(i);
    const right = x > plot.left + plot.width * 0.8;
    ctx.textAlign = right ? "right" : "left";
    for (let s = 0; s < 3; s++) {
      const y = ys[s] ?? 0;
      ctx.fillStyle = c.series[s] ?? c.ink;
      ctx.beginPath();
      ctx.arc(x, plot.y(d.geo[s * (d.T + 1) + i] ?? 0), 4 * plot.px, 0, 2 * Math.PI);
      ctx.fill();
      // A halo in the surface colour keeps the label readable over the lines.
      ctx.lineWidth = 4 * plot.px;
      ctx.strokeStyle = c.bg;
      ctx.lineJoin = "round";
      ctx.strokeText(labels[s] ?? "", x + (right ? -10 : 10) * plot.px, y);
      ctx.fillStyle = c.ink;
      ctx.fillText(labels[s] ?? "", x + (right ? -10 : 10) * plot.px, y);
    }
  },
  summary(d, t) {
    const i = Math.min(t, d.T);
    const w = (s: number) => Math.round(10 ** (d.geo[s * (d.T + 1) + i] ?? 0) * 100) / 100;
    const g = (v: number) => (Number.isFinite(v) ? Math.round(v * 10_000) / 100 : -100);
    return {
      bet: i,
      bets: d.T,
      kelly: Math.round(d.kelly * 1000) / 10,
      half: w(0),
      full: w(1),
      double: w(2),
      gHalf: g(d.growth[0]),
      gFull: g(d.growth[1]),
      gDouble: g(d.growth[2]),
    };
  },
};
