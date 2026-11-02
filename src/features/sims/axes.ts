import { linearScale, niceTicks } from "@/lib/math/scale";

import type { AxisFormat, Palette, Plot, View } from "./types";

/**
 * One axis model for both renderers (Phase 12): the SVG overlay on screen and the
 * Canvas in PNG export, so an exported frame looks exactly like the page.
 */
export const MARGIN = { left: 52, right: 14, top: 12, bottom: 40 } as const;

export function makePlot(view: View, width: number, height: number, px: number): Plot {
  const left = MARGIN.left * px;
  const top = MARGIN.top * px;
  const h = height - (MARGIN.top + MARGIN.bottom) * px;
  const full = width - (MARGIN.left + MARGIN.right) * px;
  const w = view.square ? Math.min(full, h) : full;
  return {
    x: linearScale(view.x, [left, left + w]),
    y: linearScale(view.y, [top + h, top]),
    left,
    top,
    width: w,
    height: h,
    px,
  };
}

export type Tick = { v: number; at: number; label: string };

export function ticks(
  view: View,
  plot: Plot,
  fmt: (v: number, f: AxisFormat | undefined) => string,
): { x: Tick[]; y: Tick[] } {
  const xTarget = Math.max(2, Math.floor(plot.width / (90 * plot.px)));
  const yTarget = Math.max(3, Math.floor(plot.height / (50 * plot.px)));
  return {
    x: niceTicks(view.x[0], view.x[1], xTarget).map((v) => ({
      v,
      at: plot.x(v),
      label: fmt(v, view.xFormat),
    })),
    y: niceTicks(view.y[0], view.y[1], yTarget).map((v) => ({
      v,
      at: plot.y(v),
      label: fmt(v, view.yFormat),
    })),
  };
}

/** Axes on a canvas (export). Font sizes match the SVG at the same scale. */
export function drawAxes(
  ctx: CanvasRenderingContext2D,
  view: View,
  plot: Plot,
  c: Palette,
  fmt: (v: number, f: AxisFormat | undefined) => string,
  labels: { x: string; y: string },
  font: { mono: string; sans: string },
) {
  const t = ticks(view, plot, fmt);
  const px = plot.px;
  ctx.save();
  ctx.lineWidth = px;
  ctx.strokeStyle = c.grid;
  for (const y of t.y) {
    ctx.beginPath();
    ctx.moveTo(plot.left, y.at);
    ctx.lineTo(plot.left + plot.width, y.at);
    ctx.stroke();
  }
  ctx.fillStyle = c.muted;
  ctx.font = `${String(11 * px)}px ${font.mono}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const y of t.y) ctx.fillText(y.label, plot.left - 6 * px, y.at);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const x of t.x) ctx.fillText(x.label, x.at, plot.top + plot.height + 6 * px);
  ctx.font = `${String(12 * px)}px ${font.sans}`;
  ctx.fillText(labels.x, plot.left + plot.width / 2, plot.top + plot.height + 22 * px);
  ctx.translate(14 * px, plot.top + plot.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "middle";
  ctx.fillText(labels.y, 0, 0);
  ctx.restore();
}

/** Theme colours from the CSS tokens (both themes are defined in tokens.css). */
export function readPalette(el: Element = document.documentElement): Palette {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    ink: v("--ink", "#1b2230"),
    muted: v("--ink-muted", "#5d6472"),
    accent: v("--accent", "#b4440e"),
    grid: v("--grid", "#e7dfd0"),
    bg: v("--bg", "#f6f1e7"),
    surface: v("--surface", "#fbf8f2"),
  };
}
