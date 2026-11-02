/**
 * The simulation framework's contract (Phase 12). A simulation computes all its data up
 * front from (params, seed), deterministically, then the player reveals it frame by
 * frame: frame t of T. That makes every run reproducible from a link, lets the heavy
 * part run in a Web Worker, and keeps drawing cheap (only new frames are drawn).
 */
export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;

export type ParamSpec =
  | { kind: "number"; min: number; max: number; step: number; default: number }
  | { kind: "int"; min: number; max: number; step?: number; default: number }
  | { kind: "choice"; options: readonly string[]; default: string }
  | { kind: "toggle"; default: boolean };

export type SimData = { T: number };

/** Pixel mapping of the plot area, in canvas pixels (already scaled for the device). */
export type Plot = {
  x: (v: number) => number;
  y: (v: number) => number;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Device pixel ratio (or export scale): multiply line widths and font sizes by it. */
  px: number;
};

export type Palette = {
  ink: string;
  muted: string;
  accent: string;
  grid: string;
  bg: string;
  surface: string;
  /** Categorical series (blue, orange, aqua); also the diverging poles (1 and 2). */
  series: [string, string, string];
};

/** `log10`: the value is log10(x); ticks are labelled with x. */
export type AxisFormat = "int" | "num" | "pct" | "money" | "log10";
export type View = {
  x: [number, number];
  y: [number, number];
  /** i18n keys in the `sims.axes` namespace. */
  xLabel: string;
  yLabel: string;
  xFormat?: AxisFormat;
  yFormat?: AxisFormat;
  /** Equal units on both axes (a square plot area), e.g. points in the unit square. */
  square?: boolean;
};

export interface SimDef<D extends SimData = SimData> {
  id: string;
  slug: { pl: string; en: string };
  /** The lesson it belongs to (content/curriculum.ts). */
  lessonId: string;
  params: Readonly<Record<string, ParamSpec>>;
  /** Run `compute` in the Web Worker (heavy data). */
  worker?: boolean;
  /** A still picture (no animation): shown complete, without playback controls. */
  static?: boolean;
  /** Seconds the whole animation takes at 1× speed. */
  seconds?: number;
  compute(p: Params, seed: number): D;
  view(d: D, p: Params): View;
  /** Draws frames [from, to) onto the persistent layer (incremental). */
  draw(
    ctx: CanvasRenderingContext2D,
    d: D,
    from: number,
    to: number,
    plot: Plot,
    c: Palette,
    p: Params,
  ): void;
  /** Redrawn every frame on top (cheap: histograms, markers, current values). */
  overlay?(
    ctx: CanvasRenderingContext2D,
    d: D,
    t: number,
    plot: Plot,
    c: Palette,
    p: Params,
    /** Localised text for `sims.<id>.labels.<key>` (direct labels on the chart). */
    label: (key: string) => string,
  ): void;
  /** Values for the `sims.<id>.summary` message at frame t (the accessible description). */
  summary(d: D, t: number, p: Params): Record<string, number | string>;
}
