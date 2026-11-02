import { mulberry32 } from "@/lib/math/rng";

import { num } from "../params";
import type { SimDef } from "../types";

/**
 * Coin-flip random walk vs "chart patterns": prices made only of coin flips, drawn like
 * a stock chart. Every trend, double top and breakout you see is noise.
 */
export type CoinWalkData = {
  T: number;
  paths: number;
  /** paths × (T + 1) prices, path-major. */
  prices: Float32Array;
  lo: number;
  hi: number;
};

export const coinWalk: SimDef<CoinWalkData> = {
  id: "coin-walk",
  slug: { pl: "rzut-moneta-czy-formacja", en: "coin-flip-or-pattern" },
  lessonId: "random-walk",
  seconds: 8,
  params: {
    paths: { kind: "int", min: 1, max: 9, default: 4 },
    steps: { kind: "int", min: 50, max: 1000, step: 10, default: 250 },
    up: { kind: "number", min: 0.3, max: 0.7, step: 0.01, default: 0.5 },
    move: { kind: "number", min: 0.5, max: 5, step: 0.5, default: 1 },
  },
  compute(p, seed) {
    const rand = mulberry32(seed);
    const paths = num(p, "paths");
    const T = num(p, "steps");
    const up = num(p, "up");
    const m = num(p, "move") / 100;
    const prices = new Float32Array(paths * (T + 1));
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = 0; k < paths; k++) {
      let s = 100;
      for (let i = 0; i <= T; i++) {
        if (i > 0) s *= rand() < up ? 1 + m : 1 - m;
        prices[k * (T + 1) + i] = s;
        if (s < lo) lo = s;
        if (s > hi) hi = s;
      }
    }
    return { T, paths, prices, lo, hi };
  },
  view(d) {
    const pad = (d.hi - d.lo) * 0.08 || 1;
    return {
      x: [0, d.T],
      y: [d.lo - pad, d.hi + pad],
      xLabel: "days",
      yLabel: "price",
      xFormat: "int",
      yFormat: "num",
    };
  },
  draw(ctx, d, from, to, plot, c) {
    const n = d.T + 1;
    ctx.lineJoin = "round";
    for (let k = d.paths - 1; k >= 0; k--) {
      ctx.strokeStyle = k === 0 ? c.accent : c.muted;
      ctx.globalAlpha = k === 0 ? 1 : 0.55;
      ctx.lineWidth = (k === 0 ? 2 : 1.25) * plot.px;
      ctx.beginPath();
      for (let i = Math.max(0, from - 1); i <= Math.min(to, d.T); i++) {
        const x = plot.x(i);
        const y = plot.y(d.prices[k * n + i] ?? 100);
        if (i === Math.max(0, from - 1)) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
  summary(d, t) {
    const i = Math.min(t, d.T);
    return {
      paths: d.paths,
      day: i,
      days: d.T,
      price: Math.round((d.prices[i] ?? 100) * 100) / 100,
    };
  },
};
