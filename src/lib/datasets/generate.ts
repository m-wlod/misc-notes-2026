import { mulberry32, normal } from "@/lib/math/rng";

/**
 * Sample datasets for the Python lab and data exercises (Phase 13). Synthetic: generated
 * here from fixed seeds, never market data (no licences involved). `pnpm datasets`
 * writes them to public/datasets/<id>.csv; a unit test keeps the files in sync.
 */
export type DatasetId = "ceny-gbm" | "ceny-rezim";
export const DATASET_IDS: readonly DatasetId[] = ["ceny-gbm", "ceny-rezim"];

const DAYS = 750; // about three years of trading days

/** Weekdays from 2020-01-02, as YYYY-MM-DD (no holidays: the data is made up anyway). */
function tradingDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(2020, 0, 2));
  while (out.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Daily closes of a geometric Brownian motion; `vol(i)` is the daily volatility on day i. */
function prices(seed: number, mu: number, vol: (i: number) => number): number[] {
  const z = normal(mulberry32(seed));
  const out = [100];
  for (let i = 1; i < DAYS; i++) {
    const s = vol(i);
    out.push((out[i - 1] ?? 100) * Math.exp(mu - (s * s) / 2 + s * z()));
  }
  return out;
}

const round2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2);

export function generateDataset(id: DatasetId): string {
  const dates = tradingDays(DAYS);
  const close =
    id === "ceny-gbm"
      ? prices(20_130_001, 0.0003, () => 0.012)
      : // Calm, then a stormy second half (volatility triples on day 400).
        prices(20_130_002, 0.0002, (i) => (i < 400 ? 0.008 : 0.024));
  const rows = dates.map((d, i) => `${d},${round2(close[i] ?? 0)}`);
  return `date,close\n${rows.join("\n")}\n`;
}
