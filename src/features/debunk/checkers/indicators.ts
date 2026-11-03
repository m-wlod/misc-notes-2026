import { randomWalk } from "@/lib/math/rng";

/**
 * Indicator noise test (Phase 16): classic indicators and their "signals" on random
 * walks, where by construction there is nothing to predict. Signals still appear; their
 * hit rate stays near a coin flip.
 */

/** Simple moving average; NaN until the window is full. */
export function sma(xs: readonly number[], n: number): number[] {
  const out: number[] = [];
  let s = 0;
  xs.forEach((x, i) => {
    s += x;
    if (i >= n) s -= xs[i - n] ?? 0;
    out.push(i >= n - 1 ? s / n : NaN);
  });
  return out;
}

/** Exponential moving average with α = 2/(n+1), seeded with the first value. */
export function ema(xs: readonly number[], n: number): number[] {
  const a = 2 / (n + 1);
  const out: number[] = [];
  xs.forEach((x, i) => {
    out.push(i === 0 ? x : a * x + (1 - a) * (out[i - 1] ?? x));
  });
  return out;
}

/** RSI with Wilder's smoothing; NaN for the first n values. 100 when there are no losses. */
export function rsi(xs: readonly number[], n = 14): number[] {
  const out: number[] = new Array<number>(xs.length).fill(NaN);
  if (xs.length <= n) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = (xs[i] ?? 0) - (xs[i - 1] ?? 0);
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  const value = () => (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  out[n] = value();
  for (let i = n + 1; i < xs.length; i++) {
    const d = (xs[i] ?? 0) - (xs[i - 1] ?? 0);
    gain = (gain * (n - 1) + Math.max(0, d)) / n;
    loss = (loss * (n - 1) + Math.max(0, -d)) / n;
    out[i] = value();
  }
  return out;
}

/** MACD line (EMA12 − EMA26) and its signal line (EMA9 of MACD). */
export function macd(xs: readonly number[], fast = 12, slow = 26, signal = 9) {
  const f = ema(xs, fast);
  const s = ema(xs, slow);
  const line = xs.map((_, i) => (f[i] ?? 0) - (s[i] ?? 0));
  return { line, signal: ema(line, signal) };
}

export type Signal = { index: number; side: "buy" | "sell" };

/** Where series a crosses above (buy) or below (sell) series b. */
export function crossings(a: readonly number[], b: readonly number[]): Signal[] {
  const out: Signal[] = [];
  for (let i = 1; i < a.length; i++) {
    const [a0, a1, b0, b1] = [a[i - 1], a[i], b[i - 1], b[i]];
    if ([a0, a1, b0, b1].some((v) => v === undefined || Number.isNaN(v))) continue;
    if ((a0 as number) <= (b0 as number) && (a1 as number) > (b1 as number))
      out.push({ index: i, side: "buy" });
    else if ((a0 as number) >= (b0 as number) && (a1 as number) < (b1 as number))
      out.push({ index: i, side: "sell" });
  }
  return out;
}

/** RSI leaving oversold (crossing up through 30) = buy; leaving overbought (down through 70) = sell. */
export function rsiSignals(r: readonly number[], low = 30, high = 70): Signal[] {
  const out: Signal[] = [];
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1];
    const b = r[i];
    if (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b)) continue;
    if (a < low && b >= low) out.push({ index: i, side: "buy" });
    else if (a > high && b <= high) out.push({ index: i, side: "sell" });
  }
  return out;
}

export type IndicatorKind = "ma" | "rsi" | "macd";

export function signalsFor(kind: IndicatorKind, prices: readonly number[]): Signal[] {
  if (kind === "ma") return crossings(sma(prices, 10), sma(prices, 30));
  if (kind === "rsi") return rsiSignals(rsi(prices, 14));
  const m = macd(prices);
  return crossings(m.line, m.signal);
}

/** A signal "hits" when the price `horizon` days later moved its way. */
export function evaluate(prices: readonly number[], signals: readonly Signal[], horizon = 10) {
  let hits = 0;
  let counted = 0;
  let sumReturn = 0;
  for (const s of signals) {
    const now = prices[s.index];
    const later = prices[s.index + horizon];
    if (now === undefined || later === undefined) continue;
    const ret = (later - now) / now;
    const signed = s.side === "buy" ? ret : -ret;
    counted += 1;
    sumReturn += signed;
    if (signed > 0) hits += 1;
  }
  return { signals: counted, hits, meanReturn: counted ? sumReturn / counted : 0 };
}

/** Many random walks: total signals, overall hit rate and mean signed return. */
export function noiseStudy(
  kind: IndicatorKind,
  walks: number,
  days: number,
  seed: number,
  horizon = 10,
) {
  let signals = 0;
  let hits = 0;
  let sum = 0;
  for (let w = 0; w < walks; w++) {
    const prices = randomWalk({ points: days, sigma: 0.015, seed: seed + w * 7919 });
    const r = evaluate(prices, signalsFor(kind, prices), horizon);
    signals += r.signals;
    hits += r.hits;
    sum += r.meanReturn * r.signals;
  }
  return {
    signals,
    hitRate: signals ? hits / signals : 0,
    meanReturn: signals ? sum / signals : 0,
  };
}
