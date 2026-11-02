import { bsPrice } from "@/lib/math/black-scholes";
import { mulberry32, normal } from "@/lib/math/rng";

import { num, str } from "../params";
import type { SimDef } from "../types";

/**
 * Monte Carlo estimation: π from random points in a square, or a European call price
 * from simulated terminal prices. The estimate converges like 1/√N; the band is the
 * 95% interval around the true value.
 */
export type McData = {
  T: number;
  target: "pi" | "call";
  /** π: the points (x, y in [0,1]²) and whether each is inside the quarter circle. */
  xs: Float32Array;
  ys: Float32Array;
  inside: Uint8Array;
  /** Running estimate after k + 1 samples. */
  estimate: Float32Array;
  truth: number;
  /** Standard deviation of one sample (the band is truth ± 1.96·sd/√k). */
  sd: number;
};

export const monteCarlo: SimDef<McData> = {
  id: "monte-carlo",
  slug: { pl: "monte-carlo", en: "monte-carlo" },
  lessonId: "black-scholes",
  seconds: 8,
  params: {
    target: { kind: "choice", options: ["pi", "call"], default: "pi" },
    view: { kind: "choice", options: ["points", "convergence"], default: "points" },
    samples: { kind: "int", min: 500, max: 20_000, step: 500, default: 5000 },
    S: { kind: "int", min: 50, max: 150, default: 100 },
    K: { kind: "int", min: 50, max: 150, default: 100 },
    sigma: { kind: "number", min: 0.05, max: 0.8, step: 0.01, default: 0.2 },
    years: { kind: "number", min: 0.1, max: 2, step: 0.1, default: 1 },
    r: { kind: "number", min: 0, max: 0.1, step: 0.005, default: 0.03 },
  },
  compute(p, seed) {
    const rand = mulberry32(seed);
    const T = num(p, "samples");
    const target = str(p, "target") === "call" ? "call" : "pi";
    const xs = new Float32Array(target === "pi" ? T : 0);
    const ys = new Float32Array(target === "pi" ? T : 0);
    const inside = new Uint8Array(target === "pi" ? T : 0);
    const estimate = new Float32Array(T);
    if (target === "pi") {
      let hits = 0;
      for (let i = 0; i < T; i++) {
        const x = rand();
        const y = rand();
        xs[i] = x;
        ys[i] = y;
        const isIn = x * x + y * y <= 1 ? 1 : 0;
        inside[i] = isIn;
        hits += isIn;
        estimate[i] = (4 * hits) / (i + 1);
      }
      const q = Math.PI / 4;
      return {
        T,
        target,
        xs,
        ys,
        inside,
        estimate,
        truth: Math.PI,
        sd: 4 * Math.sqrt(q * (1 - q)),
      };
    }
    const z = normal(rand);
    const [S, K, sigma, years, r] = [
      num(p, "S"),
      num(p, "K"),
      num(p, "sigma"),
      num(p, "years"),
      num(p, "r"),
    ];
    const disc = Math.exp(-r * years);
    let sum = 0;
    let sum2 = 0;
    for (let i = 0; i < T; i++) {
      const ST = S * Math.exp((r - 0.5 * sigma * sigma) * years + sigma * Math.sqrt(years) * z());
      const payoff = disc * Math.max(0, ST - K);
      sum += payoff;
      sum2 += payoff * payoff;
      estimate[i] = sum / (i + 1);
    }
    const m = sum / T;
    const sd = Math.sqrt(Math.max(0, sum2 / T - m * m));
    return {
      T,
      target,
      xs,
      ys,
      inside,
      estimate,
      truth: bsPrice("call", { S, K, sigma, T: years, r }),
      sd,
    };
  },
  view(d, p) {
    if (d.target === "pi" && str(p, "view") === "points") {
      return {
        x: [0, 1],
        y: [0, 1],
        xLabel: "x",
        yLabel: "y",
        xFormat: "num",
        yFormat: "num",
        square: true,
      };
    }
    const band = (1.96 * d.sd) / Math.sqrt(Math.max(20, d.T / 100));
    return {
      x: [1, d.T],
      y: [d.truth - band * 1.4, d.truth + band * 1.4],
      xLabel: "samples",
      yLabel: d.target === "pi" ? "estimate" : "price_option",
      xFormat: "int",
      yFormat: "num",
    };
  },
  draw(ctx, d, from, to, plot, c, p) {
    if (d.target === "pi" && str(p, "view") === "points") {
      if (from === 0) {
        ctx.strokeStyle = c.ink;
        ctx.lineWidth = 1.5 * plot.px;
        ctx.beginPath();
        ctx.ellipse(
          plot.x(0),
          plot.y(0),
          plot.x(1) - plot.x(0),
          plot.y(0) - plot.y(1),
          0,
          -Math.PI / 2,
          0,
        );
        ctx.stroke();
      }
      const r = Math.max(1.2, 2.2 - d.T / 10_000) * plot.px;
      for (const flag of [1, 0]) {
        ctx.fillStyle = flag ? c.accent : c.muted;
        ctx.beginPath();
        for (let i = from; i < Math.min(to, d.T); i++) {
          if (d.inside[i] !== flag) continue;
          const x = plot.x(d.xs[i] ?? 0);
          const y = plot.y(d.ys[i] ?? 0);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, 2 * Math.PI);
        }
        ctx.fill();
      }
      return;
    }
    if (from === 0) {
      // The truth and its 95% band: truth ± 1.96·sd/√k.
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 1.5 * plot.px;
      ctx.beginPath();
      ctx.moveTo(plot.left, plot.y(d.truth));
      ctx.lineTo(plot.left + plot.width, plot.y(d.truth));
      ctx.stroke();
      ctx.setLineDash([4 * plot.px, 4 * plot.px]);
      ctx.strokeStyle = c.muted;
      for (const sign of [1, -1]) {
        ctx.beginPath();
        for (let k = 1; k <= d.T; k += Math.max(1, Math.floor(d.T / 400))) {
          const y = plot.y(d.truth + (sign * 1.96 * d.sd) / Math.sqrt(k));
          if (k === 1) ctx.moveTo(plot.x(k), y);
          else ctx.lineTo(plot.x(k), y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 2 * plot.px;
    ctx.beginPath();
    for (let i = Math.max(0, from - 1); i < Math.min(to, d.T); i++) {
      const y = plot.y(d.estimate[i] ?? d.truth);
      if (i === Math.max(0, from - 1)) ctx.moveTo(plot.x(i + 1), y);
      else ctx.lineTo(plot.x(i + 1), y);
    }
    ctx.stroke();
  },
  summary(d, t) {
    const k = Math.max(1, Math.min(t, d.T));
    const est = d.estimate[k - 1] ?? 0;
    const r4 = (v: number) => Math.round(v * 10_000) / 10_000;
    return {
      count: k,
      estimate: r4(est),
      truth: r4(d.truth),
      error: r4(est - d.truth),
      margin: r4((1.96 * d.sd) / Math.sqrt(k)),
    };
  },
};
