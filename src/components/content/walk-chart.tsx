import { randomWalk } from "@/lib/math/rng";

type WalkChartProps = {
  seed: number;
  steps?: number;
  sigma?: number;
  /** Accessible description, localised by the caller. */
  label: string;
  /** Formats the end value (locale-aware), e.g. 98,0 in Polish. */
  formatValue: (v: number) => string;
};

/**
 * Static, server-rendered random-walk chart (no JS). Drawn twice, at a desktop and a
 * phone aspect ratio, so 11px tick labels stay 11px on a 390px screen instead of
 * shrinking with the viewBox. Phase 12 replaces this with the interactive framework.
 */
export function WalkChart({ seed, steps = 250, sigma = 0.01, label, formatValue }: WalkChartProps) {
  const path = randomWalk({ steps, sigma, seed });
  return (
    <div role="img" aria-label={label}>
      <Plot
        path={path}
        width={640}
        height={220}
        xTicks={[0, 50, 100, 150, 200, 250]}
        formatValue={formatValue}
        className="hidden sm:block"
      />
      <Plot
        path={path}
        width={360}
        height={200}
        xTicks={[0, 125, 250]}
        formatValue={formatValue}
        className="sm:hidden"
      />
    </div>
  );
}

function Plot({
  path,
  width: W,
  height: H,
  xTicks,
  formatValue,
  className,
}: {
  path: number[];
  width: number;
  height: number;
  xTicks: number[];
  formatValue: (v: number) => string;
  className: string;
}) {
  const n = path.length;
  const [L, R, T, B] = [36, 10, 12, 24];
  const lo = Math.min(...path);
  const hi = Math.max(...path);
  const pad = (hi - lo) * 0.12 || 1;
  const y0 = lo - pad;
  const y1 = hi + pad;
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);

  const step = hi - lo > 12 ? 5 : 2;
  const yTicks: number[] = [];
  for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) yTicks.push(v);

  const d = path.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const end = path.at(-1) ?? 0;
  const tick = "fill-ink-muted font-mono text-[11px]";

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
            {v}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={t} x={x(Math.min(t, n - 1))} y={H - 6} textAnchor="middle" className={tick}>
          {t}
        </text>
      ))}
      <line
        x1={L}
        x2={W - R}
        y1={y(path[0] ?? 0)}
        y2={y(path[0] ?? 0)}
        className="stroke-ink-muted"
        strokeDasharray="3 3"
      />
      <path d={d} fill="none" className="stroke-ink" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(n - 1)} cy={y(end)} r={3} className="fill-accent" />
      <text
        x={x(n - 1) - 6}
        y={y(end) + 18}
        textAnchor="end"
        className="fill-ink stroke-bg font-mono text-[11px]"
        strokeWidth={4}
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {formatValue(end)}
      </text>
    </svg>
  );
}
