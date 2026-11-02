import { bsGreeks, bsPrice, type OptionType } from "@/lib/math/black-scholes";

import { num, str } from "../params";
import type { Params, SimDef } from "../types";

/**
 * Option payoff builder: up to two legs (call or put, long or short, own strike). Payoff
 * at expiry (net of what was paid) and the Black–Scholes value today across stock prices,
 * with the position's price and Greeks at the current stock price. A still picture.
 */
type Leg = { type: OptionType; sign: 1 | -1; K: number };
export type OptionsData = {
  T: number;
  legs: Leg[];
  S: number;
  sigma: number;
  years: number;
  r: number;
  /** Premium paid (positive) or received (negative) for the whole position today. */
  cost: number;
  lo: number;
  hi: number;
  xs: [number, number];
};

const legsOf = (p: Params): Leg[] => {
  const legs: Leg[] = [
    {
      type: str(p, "type1") === "put" ? "put" : "call",
      sign: str(p, "side1") === "short" ? -1 : 1,
      K: num(p, "K1"),
    },
  ];
  if (str(p, "type2") !== "none") {
    legs.push({
      type: str(p, "type2") === "put" ? "put" : "call",
      sign: str(p, "side2") === "short" ? -1 : 1,
      K: num(p, "K2"),
    });
  }
  return legs;
};

const payoffAt = (legs: Leg[], S: number) =>
  legs.reduce((v, l) => v + l.sign * Math.max(0, l.type === "call" ? S - l.K : l.K - S), 0);

export function positionValue(d: Pick<OptionsData, "legs" | "sigma" | "years" | "r">, S: number) {
  return d.legs.reduce(
    (v, l) => v + l.sign * bsPrice(l.type, { S, K: l.K, sigma: d.sigma, T: d.years, r: d.r }),
    0,
  );
}

export function positionGreeks(d: Pick<OptionsData, "legs" | "sigma" | "years" | "r">, S: number) {
  const g = { delta: 0, gamma: 0, vega: 0, theta: 0 };
  for (const l of d.legs) {
    const x = bsGreeks(l.type, { S, K: l.K, sigma: d.sigma, T: d.years, r: d.r });
    g.delta += l.sign * x.delta;
    g.gamma += l.sign * x.gamma;
    g.vega += l.sign * x.vega;
    g.theta += l.sign * x.theta;
  }
  return g;
}

export const optionBuilder: SimDef<OptionsData> = {
  id: "option-builder",
  slug: { pl: "kreator-opcji", en: "option-payoff-builder" },
  lessonId: "option-payoffs",
  static: true,
  params: {
    type1: { kind: "choice", options: ["call", "put"], default: "call" },
    side1: { kind: "choice", options: ["long", "short"], default: "long" },
    K1: { kind: "int", min: 50, max: 150, default: 100 },
    type2: { kind: "choice", options: ["none", "call", "put"], default: "none" },
    side2: { kind: "choice", options: ["long", "short"], default: "short" },
    K2: { kind: "int", min: 50, max: 150, default: 110 },
    S: { kind: "int", min: 50, max: 150, default: 100 },
    sigma: { kind: "number", min: 0.05, max: 1, step: 0.01, default: 0.25 },
    years: { kind: "number", min: 0.05, max: 2, step: 0.05, default: 0.5 },
    r: { kind: "number", min: 0, max: 0.1, step: 0.005, default: 0.03 },
  },
  compute(p) {
    const legs = legsOf(p);
    const [S, sigma, years, r] = [num(p, "S"), num(p, "sigma"), num(p, "years"), num(p, "r")];
    const base = { legs, sigma, years, r };
    const cost = positionValue(base, S);
    const strikes = legs.map((l) => l.K);
    const xs: [number, number] = [
      Math.max(1, Math.min(S, ...strikes) * 0.6),
      Math.max(S, ...strikes) * 1.4,
    ];
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const x = xs[0] + ((xs[1] - xs[0]) * i) / 200;
      for (const v of [payoffAt(legs, x) - cost, positionValue(base, x) - cost]) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    return { T: 1, legs, S, sigma, years, r, cost, lo, hi, xs };
  },
  view(d) {
    const pad = (d.hi - d.lo) * 0.1 || 1;
    return {
      x: d.xs,
      y: [d.lo - pad, d.hi + pad],
      xLabel: "stockPrice",
      yLabel: "profit",
      xFormat: "num",
      yFormat: "num",
    };
  },
  draw(ctx, d, from, to, plot, c) {
    if (to < 1) return;
    const line = (f: (x: number) => number, color: string, width: number, dash: number[] = []) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width * plot.px;
      ctx.setLineDash(dash.map((v) => v * plot.px));
      ctx.beginPath();
      for (let i = 0; i <= 300; i++) {
        const x = d.xs[0] + ((d.xs[1] - d.xs[0]) * i) / 300;
        if (i === 0) ctx.moveTo(plot.x(x), plot.y(f(x)));
        else ctx.lineTo(plot.x(x), plot.y(f(x)));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    // Zero line, payoff at expiry, value today.
    line(() => 0, c.muted, 1);
    line((x) => payoffAt(d.legs, x) - d.cost, c.series[1], 2.5);
    line((x) => positionValue(d, x) - d.cost, c.series[0], 2, [6, 4]);
    // Current stock price.
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = plot.px;
    ctx.beginPath();
    ctx.moveTo(plot.x(d.S), plot.top);
    ctx.lineTo(plot.x(d.S), plot.top + plot.height);
    ctx.stroke();
  },
  overlay(ctx, d, t, plot, c, _p, label) {
    ctx.font = `${String(12 * plot.px)}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    const xEnd = d.xs[1];
    const clampY = (v: number) =>
      Math.min(
        plot.top + plot.height - 8 * plot.px,
        Math.max(plot.top + 14 * plot.px, plot.y(v) - 10 * plot.px),
      );
    const items = [
      { text: label("expiry"), y: clampY(payoffAt(d.legs, xEnd) - d.cost), color: c.series[1] },
      { text: label("today"), y: clampY(positionValue(d, xEnd) - d.cost), color: c.series[0] },
    ].sort((a, b) => a.y - b.y);
    // Keep the two labels at least a line apart.
    const gap = 16 * plot.px;
    const [first, second] = items;
    if (first && second && second.y - first.y < gap) second.y = first.y + gap;
    const tx = plot.left + plot.width - 6 * plot.px;
    for (const { text, y, color } of items) {
      ctx.lineWidth = 4 * plot.px;
      ctx.strokeStyle = c.bg;
      ctx.lineJoin = "round";
      ctx.strokeText(text, tx, y);
      // Text in ink; the swatch beside it carries the series colour.
      ctx.fillStyle = c.ink;
      ctx.fillText(text, tx, y);
      ctx.fillStyle = color;
      ctx.fillRect(
        tx - ctx.measureText(text).width - 16 * plot.px,
        y - 1.5 * plot.px,
        10 * plot.px,
        3 * plot.px,
      );
    }
  },
  summary(d) {
    const g = positionGreeks(d, d.S);
    const r = (v: number, k = 2) => Math.round(v * 10 ** k) / 10 ** k;
    return {
      value: r(d.cost),
      delta: r(g.delta, 3),
      gamma: r(g.gamma, 4),
      vega: r(g.vega / 100, 3),
      theta: r(g.theta / 365, 3),
      S: d.S,
    };
  },
};
