import { num } from "../params";
import type { SimDef } from "../types";

/**
 * Win rate × reward-to-risk × fees: expected value per trade in units of risk (R).
 * EV = p·RR − (1 − p) − fees. A still picture: blue where a strategy makes money, orange
 * where it loses, the break-even curve in ink, and the chosen strategy marked.
 */
export type EvData = {
  T: number;
  fees: number;
  p: number;
  rr: number;
  /** EV on a grid: rows by reward-to-risk (bottom to top), columns by win rate. */
  grid: Float32Array;
  cols: number;
  rows: number;
  max: number;
};

export const P_RANGE: [number, number] = [0.2, 0.8];
export const RR_RANGE: [number, number] = [0.25, 4];
export const ev = (p: number, rr: number, fees: number) => p * rr - (1 - p) - fees;

/** Linear mix of two #rrggbb colours. */
function mix(a: string, b: string, t: number): string {
  const pa = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(a);
  const pb = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(b);
  if (!pa || !pb) return t < 0.5 ? a : b;
  const ch = (i: number) =>
    Math.round(parseInt(pa[i] ?? "0", 16) * (1 - t) + parseInt(pb[i] ?? "0", 16) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(1)}${ch(2)}${ch(3)}`;
}

export const evHeatmap: SimDef<EvData> = {
  id: "ev-heatmap",
  slug: { pl: "mapa-wartosci-oczekiwanej", en: "expected-value-map" },
  lessonId: "expected-value",
  static: true,
  params: {
    fees: { kind: "number", min: 0, max: 0.5, step: 0.01, default: 0.05 },
    p: { kind: "number", min: 0.2, max: 0.8, step: 0.01, default: 0.45 },
    rr: { kind: "number", min: 0.25, max: 4, step: 0.05, default: 1.5 },
  },
  compute(p) {
    const fees = num(p, "fees");
    const cols = 60;
    const rows = 60;
    const grid = new Float32Array(cols * rows);
    let max = 0;
    for (let r = 0; r < rows; r++) {
      const rr = RR_RANGE[0] + ((r + 0.5) / rows) * (RR_RANGE[1] - RR_RANGE[0]);
      for (let c = 0; c < cols; c++) {
        const pw = P_RANGE[0] + ((c + 0.5) / cols) * (P_RANGE[1] - P_RANGE[0]);
        const v = ev(pw, rr, fees);
        grid[r * cols + c] = v;
        max = Math.max(max, Math.abs(v));
      }
    }
    return { T: 1, fees, p: num(p, "p"), rr: num(p, "rr"), grid, cols, rows, max };
  },
  view() {
    return {
      x: P_RANGE,
      y: RR_RANGE,
      xLabel: "winRate",
      yLabel: "rewardRisk",
      xFormat: "pct",
      yFormat: "num",
    };
  },
  draw(ctx, d, from, to, plot, c) {
    if (to < 1) return;
    // Diverging: orange (loss) → neutral surface (break-even) → blue (profit).
    const cw = plot.width / d.cols;
    const ch = plot.height / d.rows;
    for (let r = 0; r < d.rows; r++) {
      for (let col = 0; col < d.cols; col++) {
        const v = d.grid[r * d.cols + col] ?? 0;
        const t = Math.min(1, Math.abs(v) / Math.max(0.5, d.max * 0.6));
        ctx.fillStyle = mix(c.surface, v >= 0 ? c.series[0] : c.series[1], t);
        ctx.fillRect(
          plot.left + col * cw,
          plot.top + plot.height - (r + 1) * ch,
          Math.ceil(cw),
          Math.ceil(ch),
        );
      }
    }
    // Break-even: p·RR = (1 − p) + fees  →  RR = (1 − p + fees) / p.
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2 * plot.px;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 200; i++) {
      const pw = P_RANGE[0] + (i / 200) * (P_RANGE[1] - P_RANGE[0]);
      const rr = (1 - pw + d.fees) / pw;
      if (rr < RR_RANGE[0] || rr > RR_RANGE[1]) continue;
      if (!started) ctx.moveTo(plot.x(pw), plot.y(rr));
      else ctx.lineTo(plot.x(pw), plot.y(rr));
      started = true;
    }
    ctx.stroke();
  },
  overlay(ctx, d, t, plot, c) {
    // The chosen strategy: a ringed marker, readable on both colours.
    const x = plot.x(d.p);
    const y = plot.y(d.rr);
    ctx.lineWidth = 3 * plot.px;
    ctx.strokeStyle = c.surface;
    ctx.beginPath();
    ctx.arc(x, y, 7 * plot.px, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.lineWidth = 2 * plot.px;
    ctx.strokeStyle = c.ink;
    ctx.beginPath();
    ctx.arc(x, y, 7 * plot.px, 0, 2 * Math.PI);
    ctx.stroke();
  },
  summary(d) {
    const v = ev(d.p, d.rr, d.fees);
    return {
      p: Math.round(d.p * 100),
      rr: d.rr,
      fees: d.fees,
      ev: Math.round(v * 1000) / 1000,
      breakEven: Math.round(((1 + d.fees) / (1 + d.rr)) * 1000) / 10,
      sign: v > 0 ? "plus" : v < 0 ? "minus" : "zero",
    };
  },
};
