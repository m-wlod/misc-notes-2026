/**
 * The small chart on link previews (Phase 19b): a real, seeded run of a simple model,
 * not a decorative squiggle. Pages tied to a simulation draw that simulation's model;
 * others draw a labelled random walk ("ilustracja"). Pure and deterministic, so the
 * same page always gets the same picture.
 */
export type ChartModel = "gbm" | "walk" | "kelly";

/** Which model each simulation's preview draws. */
export const SIM_MODEL: Readonly<Record<string, ChartModel>> = {
  gbm: "gbm",
  "monte-carlo": "gbm",
  "vol-drag": "gbm",
  kelly: "kelly",
  "coin-walk": "walk",
  martingale: "walk",
  "lln-clt": "walk",
};

/** mulberry32: tiny, seedable, good enough for a picture. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable seed from any text (FNV-1a). */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

function normal(next: () => number): number {
  // Box–Muller; 1 - u keeps log away from 0.
  const u = 1 - next();
  const v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** `points` values of the model, starting at its natural start (100 or 0). */
export function series(model: ChartModel, seed: number, points = 120): number[] {
  const next = rng(seed);
  const out: number[] = [];
  if (model === "gbm") {
    // One year of daily prices: drift 5%, volatility 20% a year.
    const dt = 1 / 252;
    const mu = 0.05;
    const sigma = 0.2;
    let s = 100;
    for (let i = 0; i < points; i++) {
      out.push(s);
      s *= Math.exp((mu - (sigma * sigma) / 2) * dt + sigma * Math.sqrt(dt) * normal(next));
    }
  } else if (model === "kelly") {
    // Even-money bets won 55% of the time, staking the Kelly fraction f* = 2p - 1 = 10%.
    const p = 0.55;
    const f = 2 * p - 1;
    let w = 100;
    for (let i = 0; i < points; i++) {
      out.push(w);
      w *= next() < p ? 1 + f : 1 - f;
    }
  } else {
    let x = 0;
    for (let i = 0; i < points; i++) {
      out.push(x);
      x += next() < 0.5 ? 1 : -1;
    }
  }
  return out;
}

/** SVG polyline points scaled into a width × height box (y grows downwards). */
export function polyline(values: readonly number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(" ");
}
