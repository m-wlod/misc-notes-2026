import { mulberry32 } from "@/lib/math/rng";

import { num, str } from "../params";
import type { SimDef } from "../types";

/**
 * Martingale betting (doubling after every loss). Each of many players starts with the
 * same bankroll; most see a smooth climb, while the share of ruined players rises round
 * after round. Ruin: the next bet can't be covered.
 */
export type MartingaleData = {
  T: number;
  players: number;
  bankroll: number;
  /** Share of players ruined after each round (T + 1 values). */
  ruined: Float32Array;
  /** Mean bankroll across all players after each round. */
  mean: Float32Array;
  /** Bankroll paths of the first SHOWN players, path-major. */
  sample: Float32Array;
  shown: number;
  hi: number;
};

const SHOWN = 40;

export const martingale: SimDef<MartingaleData> = {
  id: "martingale",
  slug: { pl: "martyngal-podwajanie-stawki", en: "martingale-doubling" },
  lessonId: "martingale-betting",
  seconds: 10,
  params: {
    bankroll: { kind: "int", min: 100, max: 10_000, step: 100, default: 1000 },
    bet: { kind: "int", min: 1, max: 50, default: 5 },
    p: { kind: "number", min: 0.4, max: 0.5, step: 0.001, default: 0.486 },
    players: { kind: "int", min: 100, max: 2000, step: 100, default: 1000 },
    rounds: { kind: "int", min: 50, max: 2000, step: 50, default: 1000 },
    view: { kind: "choice", options: ["ruin", "paths"], default: "ruin" },
  },
  compute(p, seed) {
    const rand = mulberry32(seed);
    const players = num(p, "players");
    const T = num(p, "rounds");
    const start = num(p, "bankroll");
    const base = num(p, "bet");
    const pw = num(p, "p");
    const shown = Math.min(SHOWN, players);
    const ruinedCount = new Uint32Array(T + 1);
    const sum = new Float64Array(T + 1);
    const sample = new Float32Array(shown * (T + 1));
    let hi = start;
    for (let k = 0; k < players; k++) {
      let cash = start;
      let bet = base;
      let broke = false;
      for (let i = 0; i <= T; i++) {
        if (i > 0 && !broke) {
          if (bet > cash)
            broke = true; // can't cover the doubled bet
          else if (rand() < pw) {
            cash += bet;
            bet = base;
          } else {
            cash -= bet;
            bet *= 2;
            if (cash < base) broke = true;
          }
        }
        if (broke) ruinedCount[i] = (ruinedCount[i] ?? 0) + 1;
        sum[i] = (sum[i] ?? 0) + cash;
        if (k < shown) {
          sample[k * (T + 1) + i] = cash;
          if (cash > hi) hi = cash;
        }
      }
    }
    const ruined = new Float32Array(T + 1);
    const mean = new Float32Array(T + 1);
    for (let i = 0; i <= T; i++) {
      ruined[i] = (ruinedCount[i] ?? 0) / players;
      mean[i] = (sum[i] ?? 0) / players;
    }
    return { T, players, bankroll: start, ruined, mean, sample, shown, hi };
  },
  view(d, p) {
    if (str(p, "view") === "paths") {
      return {
        x: [0, d.T],
        y: [0, d.hi * 1.08],
        xLabel: "rounds",
        yLabel: "bankroll",
        xFormat: "int",
        yFormat: "int",
      };
    }
    return {
      x: [0, d.T],
      y: [0, 1],
      xLabel: "rounds",
      yLabel: "ruined",
      xFormat: "int",
      yFormat: "pct",
    };
  },
  draw(ctx, d, from, to, plot, c, p) {
    const n = d.T + 1;
    const start = Math.max(0, from - 1);
    const end = Math.min(to, d.T);
    ctx.lineJoin = "round";
    if (str(p, "view") === "paths") {
      if (from === 0) {
        ctx.strokeStyle = c.ink;
        ctx.setLineDash([4 * plot.px, 4 * plot.px]);
        ctx.lineWidth = 1.5 * plot.px;
        ctx.beginPath();
        ctx.moveTo(plot.left, plot.y(d.bankroll));
        ctx.lineTo(plot.left + plot.width, plot.y(d.bankroll));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = c.muted;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = plot.px;
      ctx.beginPath();
      for (let k = 0; k < d.shown; k++) {
        ctx.moveTo(plot.x(start), plot.y(d.sample[k * n + start] ?? 0));
        for (let i = start + 1; i <= end; i++)
          ctx.lineTo(plot.x(i), plot.y(d.sample[k * n + i] ?? 0));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 2 * plot.px;
    ctx.beginPath();
    ctx.moveTo(plot.x(start), plot.y(d.ruined[start] ?? 0));
    for (let i = start + 1; i <= end; i++) ctx.lineTo(plot.x(i), plot.y(d.ruined[i] ?? 0));
    ctx.stroke();
  },
  summary(d, t) {
    const i = Math.min(t, d.T);
    return {
      round: i,
      rounds: d.T,
      ruined: Math.round((d.ruined[i] ?? 0) * 1000) / 10,
      mean: Math.round(d.mean[i] ?? 0),
      start: d.bankroll,
    };
  },
};
