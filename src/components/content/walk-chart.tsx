import { randomWalk } from "@/lib/math/rng";
import { extent, linearScale, niceTicks } from "@/lib/math/scale";

export type WalkSummary = { start: number; end: number; min: number; max: number; days: number };

type WalkChartProps = {
  seed: number;
  /** Number of trading days; the path has `days + 1` prices. */
  days?: number;
  sigma?: number;
  /** Accessible description, localised by the caller and computed from the real data. */
  describe: (summary: WalkSummary) => string;
  /** Locale-aware number formatter for tick and end labels. */
  format: (v: number) => string;
};

/**
 * Static, server-rendered random-walk chart (no JS). Drawn twice, at a desktop and a
 * phone aspect ratio, so the 11px labels stay 11px on a 390px screen instead of
 * shrinking with the viewBox. Phase 12 replaces this with the interactive framework.
 */
export function WalkChart({ seed, days = 250, sigma = 0.01, describe, format }: WalkChartProps) {
  const path = randomWalk({ points: days + 1, sigma, seed });
  const [min, max] = extent(path);
  const summary: WalkSummary = { start: path[0] ?? 0, end: path.at(-1) ?? 0, min, max, days };

  return (
    <div role="img" aria-label={describe(summary)}>
      <Plot
        path={path}
        width={640}
        height={220}
        xTarget={5}
        yTarget={5}
        format={format}
        className="hidden sm:block"
      />
      <Plot
        path={path}
        width={360}
        height={200}
        xTarget={2}
        yTarget={4}
        format={format}
        className="sm:hidden"
      />
    </div>
  );
}

type PlotProps = {
  path: number[];
  width: number;
  height: number;
  xTarget: number;
  yTarget: number;
  format: (v: number) => string;
  className: string;
};

function Plot({ path, width: W, height: H, xTarget, yTarget, format, className }: PlotProps) {
  const [L, R, T, B] = [40, 10, 12, 24];
  const days = path.length - 1;
  const [lo, hi] = extent(path);
  const pad = (hi - lo) * 0.12 || 1;

  const x = linearScale([0, days], [L, W - R]);
  const y = linearScale([lo - pad, hi + pad], [H - B, T]);
  const xTicks = niceTicks(0, days, xTarget);
  const yTicks = niceTicks(lo - pad, hi + pad, yTarget);

  const d = path.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const start = path[0] ?? 0;
  const end = path.at(-1) ?? 0;
  const tick = "fill-ink-muted font-mono text-2xs";

  return (
    <svg
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      className={`block h-auto w-full ${className}`}
      aria-hidden="true"
    >
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-grid" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" className={tick}>
            {format(v)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={t} x={x(t)} y={H - 6} textAnchor="middle" className={tick}>
          {format(t)}
        </text>
      ))}
      <line
        x1={L}
        x2={W - R}
        y1={y(start)}
        y2={y(start)}
        className="stroke-ink-muted"
        strokeDasharray="3 3"
      />
      <path d={d} fill="none" className="stroke-ink" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(days)} cy={y(end)} r={3} className="fill-accent" />
      <text
        x={x(days) - 6}
        y={y(end) + 18}
        textAnchor="end"
        className="fill-ink stroke-bg font-mono text-2xs"
        strokeWidth={4}
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {format(end)}
      </text>
    </svg>
  );
}
