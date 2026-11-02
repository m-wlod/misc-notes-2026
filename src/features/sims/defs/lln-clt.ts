import { mulberry32 } from "@/lib/math/rng";
import { normalPdf } from "@/lib/math/stats";

import { num, str } from "../params";
import type { SimDef } from "../types";

/**
 * Law of large numbers and the central limit theorem. LLN view: the running average of
 * single draws settles on the mean. CLT view: averages of n draws pile up into a bell
 * curve of width σ/√n, whatever the shape of one draw.
 */
type Dist = "coin" | "die" | "exp";
const MOMENTS: Record<Dist, { mu: number; sd: number; lo: number; hi: number }> = {
  coin: { mu: 0.5, sd: 0.5, lo: 0, hi: 1 },
  die: { mu: 3.5, sd: Math.sqrt(35 / 12), lo: 1, hi: 6 },
  exp: { mu: 1, sd: 1, lo: 0, hi: 3 },
};

export type LlnCltData = {
  T: number;
  n: number;
  dist: Dist;
  /** Running mean of single draws (LLN), length T. */
  running: Float32Array;
  /** Means of T independent samples of size n (CLT). */
  means: Float32Array;
  mu: number;
  sd: number;
};

function draw(dist: Dist, rand: () => number): number {
  switch (dist) {
    case "coin":
      return rand() < 0.5 ? 1 : 0;
    case "die":
      return 1 + Math.floor(rand() * 6);
    case "exp":
      return -Math.log(1 - rand());
  }
}

const BINS = 41;

export const llnClt: SimDef<LlnCltData> = {
  id: "lln-clt",
  slug: { pl: "prawo-wielkich-liczb-i-ctg", en: "law-of-large-numbers-and-clt" },
  lessonId: "central-limit-theorem",
  seconds: 8,
  params: {
    dist: { kind: "choice", options: ["coin", "die", "exp"], default: "die" },
    n: { kind: "int", min: 1, max: 100, default: 10 },
    samples: { kind: "int", min: 100, max: 5000, step: 100, default: 2000 },
    view: { kind: "choice", options: ["clt", "lln"], default: "clt" },
  },
  compute(p, seed) {
    const rand = mulberry32(seed);
    const dist = str(p, "dist") as Dist;
    const n = num(p, "n");
    const T = num(p, "samples");
    const running = new Float32Array(T);
    let sum = 0;
    for (let i = 0; i < T; i++) {
      sum += draw(dist, rand);
      running[i] = sum / (i + 1);
    }
    const means = new Float32Array(T);
    for (let i = 0; i < T; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += draw(dist, rand);
      means[i] = s / n;
    }
    return { T, n, dist, running, means, mu: MOMENTS[dist].mu, sd: MOMENTS[dist].sd };
  },
  view(d, p) {
    if (str(p, "view") === "lln") {
      const m = MOMENTS[d.dist];
      return {
        x: [1, d.T],
        y: [m.lo, m.hi],
        xLabel: "draws",
        yLabel: "average",
        xFormat: "int",
        yFormat: "num",
      };
    }
    const se = d.sd / Math.sqrt(d.n);
    return {
      x: [d.mu - 4 * se, d.mu + 4 * se],
      y: [0, (normalPdf(0) / se) * 1.35],
      xLabel: "sampleMean",
      yLabel: "density",
      xFormat: "num",
      yFormat: "num",
    };
  },
  draw(ctx, d, from, to, plot, c, p) {
    ctx.lineJoin = "round";
    if (str(p, "view") === "lln") {
      if (from === 0) {
        ctx.strokeStyle = c.ink;
        ctx.lineWidth = 1.5 * plot.px;
        ctx.setLineDash([4 * plot.px, 4 * plot.px]);
        ctx.beginPath();
        ctx.moveTo(plot.left, plot.y(d.mu));
        ctx.lineTo(plot.left + plot.width, plot.y(d.mu));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 2 * plot.px;
      ctx.beginPath();
      for (let i = Math.max(0, from - 1); i < Math.min(to, d.T); i++) {
        const x = plot.x(i + 1);
        const y = plot.y(d.running[i] ?? d.mu);
        if (i === Math.max(0, from - 1)) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }
    if (from === 0) {
      // The CLT's prediction: N(μ, σ²/n).
      const se = d.sd / Math.sqrt(d.n);
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 2 * plot.px;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const v = d.mu - 4 * se + (8 * se * i) / 200;
        const y = plot.y(normalPdf((v - d.mu) / se) / se);
        if (i === 0) ctx.moveTo(plot.x(v), y);
        else ctx.lineTo(plot.x(v), y);
      }
      ctx.stroke();
    }
  },
  overlay(ctx, d, t, plot, c, p) {
    if (str(p, "view") === "lln" || t === 0) return;
    const se = d.sd / Math.sqrt(d.n);
    const lo = d.mu - 4 * se;
    const w = (8 * se) / BINS;
    const counts = new Uint32Array(BINS);
    for (let i = 0; i < Math.min(t, d.T); i++) {
      const b = Math.floor(((d.means[i] ?? d.mu) - lo) / w);
      if (b >= 0 && b < BINS) counts[b] = (counts[b] ?? 0) + 1;
    }
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.75;
    const gap = plot.px;
    for (let b = 0; b < BINS; b++) {
      const density = (counts[b] ?? 0) / (Math.min(t, d.T) * w);
      if (density === 0) continue;
      const x0 = plot.x(lo + b * w) + gap;
      const x1 = plot.x(lo + (b + 1) * w) - gap;
      const y = plot.y(density);
      ctx.fillRect(x0, y, Math.max(1, x1 - x0), plot.y(0) - y);
    }
    ctx.globalAlpha = 1;
  },
  summary(d, t, p) {
    const k = Math.max(1, Math.min(t, d.T));
    if (str(p, "view") === "lln") {
      return {
        mode: "lln",
        count: k,
        value: Math.round((d.running[k - 1] ?? 0) * 1000) / 1000,
        mu: Math.round(d.mu * 1000) / 1000,
        sd: "",
        se: "",
      };
    }
    let s = 0;
    let s2 = 0;
    for (let i = 0; i < k; i++) {
      const v = d.means[i] ?? 0;
      s += v;
      s2 += v * v;
    }
    const m = s / k;
    const sd = Math.sqrt(Math.max(0, s2 / k - m * m));
    return {
      mode: "clt",
      count: k,
      value: Math.round(m * 1000) / 1000,
      mu: Math.round(d.mu * 1000) / 1000,
      sd: Math.round(sd * 1000) / 1000,
      se: Math.round((d.sd / Math.sqrt(d.n)) * 1000) / 1000,
    };
  },
};
