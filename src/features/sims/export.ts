import { drawAxes, makePlot } from "./axes";
import type { AxisFormat, Palette, Params, SimData, SimDef } from "./types";

/**
 * PNG export of the current frame (Phase 12). Renders off-screen with the same draw
 * functions and axis model as the page. Recording mode is a 1080×1920 (9:16) frame for
 * vertical video: title on top, the chart, the parameters and a source line below.
 */
export const RECORDING = { width: 1080, height: 1920 } as const;

export type ExportText = {
  title: string;
  xLabel: string;
  yLabel: string;
  /** One line describing the current state (the accessible summary). */
  summary: string;
  /** e.g. "seed 42 · paths 200 · σ 0.2" */
  details: string;
  source: string;
};

export function renderFrame(
  def: SimDef,
  data: SimData,
  params: Params,
  t: number,
  c: Palette,
  fmt: (v: number, f: AxisFormat | undefined) => string,
  label: (key: string) => string,
  text: ExportText,
  opts: { recording: boolean; width?: number; height?: number },
): HTMLCanvasElement {
  const width = opts.recording ? RECORDING.width : (opts.width ?? 1600);
  const height = opts.recording ? RECORDING.height : (opts.height ?? 960);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const css = getComputedStyle(document.body);
  const font = {
    sans: css.getPropertyValue("--font-sans").trim() || "sans-serif",
    mono: css.getPropertyValue("--font-mono").trim() || "monospace",
    serif: css.getPropertyValue("--font-serif").trim() || "serif",
  };
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, width, height);

  const view = def.view(data, params);
  // Recording: the chart is a 1080-wide square-ish block in the middle third.
  const scale = opts.recording ? 2.4 : width / 800;
  const chart = opts.recording
    ? { x: 40, y: 440, w: width - 80, h: 1000 }
    : { x: 0, y: 0, w: width, h: height };
  ctx.save();
  ctx.translate(chart.x, chart.y);
  const plot = makePlot(view, chart.w, chart.h, scale);
  drawAxes(ctx, view, plot, c, fmt, { x: text.xLabel, y: text.yLabel }, font);
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plot.width, plot.height);
  ctx.clip();
  def.draw(ctx, data, 0, t, plot, c, params);
  def.overlay?.(ctx, data, t, plot, c, params, label);
  ctx.restore();
  ctx.restore();

  if (opts.recording) {
    ctx.fillStyle = c.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `600 84px ${font.serif}`;
    wrap(ctx, text.title, 72, 140, width - 144, 96);
    ctx.font = `40px ${font.sans}`;
    ctx.fillStyle = c.ink;
    wrap(ctx, text.summary, 72, 1500, width - 144, 54);
    ctx.fillStyle = c.muted;
    ctx.font = `32px ${font.mono}`;
    wrap(ctx, text.details, 72, 1680, width - 144, 44);
    ctx.font = `34px ${font.sans}`;
    ctx.fillText(text.source, 72, 1810);
  }
  return canvas;
}

/** Greedy word wrap; returns the y after the last line. */
function wrap(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  max: number,
  line: number,
) {
  let row = "";
  let yy = y;
  for (const word of s.split(/\s+/)) {
    const next = row ? `${row} ${word}` : word;
    if (ctx.measureText(next).width > max && row) {
      ctx.fillText(row, x, yy);
      row = word;
      yy += line;
    } else row = next;
  }
  if (row) ctx.fillText(row, x, yy);
  return yy + line;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }, "image/png");
}
