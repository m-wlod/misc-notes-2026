import { betaPdf, betaQuantiles, betaTail } from "@/lib/math/beta";
import { mulberry32 } from "@/lib/math/rng";

import { num } from "../params";
import type { SimDef } from "../types";

/**
 * Bayesian updating of a strategy's true win rate: start from a prior Beta(a, b), and
 * after every trade the posterior becomes Beta(a + wins, b + losses). The curve narrows
 * around the truth, slowly: a few dozen trades say little.
 */
export type BayesData = {
  T: number;
  truth: number;
  a: number;
  b: number;
  /** Wins after k trades (T + 1 values). */
  wins: Uint16Array;
};

const GRID = 300;

export const bayes: SimDef<BayesData> = {
  id: "bayes",
  slug: { pl: "bayes-skutecznosc-strategii", en: "bayes-win-rate" },
  lessonId: "bayes",
  seconds: 10,
  params: {
    truth: { kind: "number", min: 0.3, max: 0.7, step: 0.01, default: 0.55 },
    trades: { kind: "int", min: 10, max: 2000, step: 10, default: 300 },
    a: { kind: "number", min: 0.5, max: 50, step: 0.5, default: 1 },
    b: { kind: "number", min: 0.5, max: 50, step: 0.5, default: 1 },
  },
  compute(p, seed) {
    const rand = mulberry32(seed);
    const T = num(p, "trades");
    const truth = num(p, "truth");
    const wins = new Uint16Array(T + 1);
    for (let i = 1; i <= T; i++) wins[i] = (wins[i - 1] ?? 0) + (rand() < truth ? 1 : 0);
    return { T, truth, a: num(p, "a"), b: num(p, "b"), wins };
  },
  view(d) {
    // The tallest the posterior gets: at the end, with all trades seen.
    const a = d.a + (d.wins[d.T] ?? 0);
    const b = d.b + d.T - (d.wins[d.T] ?? 0);
    const mode = Math.min(0.999, Math.max(0.001, (a - 1) / Math.max(1e-9, a + b - 2)));
    const peak = Math.max(betaPdf(mode, a, b), betaPdf(d.truth, a, b), 2);
    return {
      x: [0, 1],
      y: [0, peak * 1.1],
      xLabel: "winRate",
      yLabel: "density",
      xFormat: "pct",
      yFormat: "num",
    };
  },
  draw(ctx, d, from, _to, plot, c) {
    if (from > 0) return;
    // The truth (what the trades are drawn from).
    ctx.strokeStyle = c.ink;
    ctx.setLineDash([5 * plot.px, 4 * plot.px]);
    ctx.lineWidth = 1.5 * plot.px;
    ctx.beginPath();
    ctx.moveTo(plot.x(d.truth), plot.top);
    ctx.lineTo(plot.x(d.truth), plot.top + plot.height);
    ctx.stroke();
    ctx.setLineDash([]);
  },
  overlay(ctx, d, t, plot, c) {
    const k = Math.min(t, d.T);
    const w = d.wins[k] ?? 0;
    const a = d.a + w;
    const b = d.b + k - w;
    const [lo, hi] = betaQuantiles(a, b, [0.025, 0.975], 1500);
    const curve = (x0: number, x1: number) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= GRID; i++) {
        const x = x0 + ((x1 - x0) * i) / GRID;
        pts.push([plot.x(x), Math.max(plot.top, plot.y(betaPdf(x, a, b)))]);
      }
      return pts;
    };
    // 95% credible interval, shaded.
    const band = curve(lo ?? 0, hi ?? 1);
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.moveTo(plot.x(lo ?? 0), plot.y(0));
    for (const [x, y] of band) ctx.lineTo(x, y);
    ctx.lineTo(plot.x(hi ?? 1), plot.y(0));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 2.5 * plot.px;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (const [i, [x, y]] of curve(0, 1).entries()) {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  },
  summary(d, t) {
    const k = Math.min(t, d.T);
    const w = d.wins[k] ?? 0;
    const a = d.a + w;
    const b = d.b + k - w;
    const [lo, hi] = betaQuantiles(a, b, [0.025, 0.975], 1500);
    const pct = (v: number) => Math.round(v * 1000) / 10;
    return {
      trades: k,
      wins: w,
      mean: pct(a / (a + b)),
      lo: pct(lo ?? 0),
      hi: pct(hi ?? 1),
      edge: pct(betaTail(0.5, a, b, 1500)),
      truth: pct(d.truth),
    };
  },
};
