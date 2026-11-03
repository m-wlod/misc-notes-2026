import { linearScale, niceTicks } from "@/lib/math/scale";

/**
 * DAU and WAU over a date range (Phase 18 dashboard). Server-rendered SVG, one y-axis
 * (both are counts of people), 2px lines, a legend, and a text summary for screen
 * readers; the exact numbers are in the table under it.
 */
export type ActivityPoint = { day: string; dau: number; wau: number };

const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 24, left: 36 };

export function ActivityChart({
  points,
  label,
  legend,
}: {
  points: ActivityPoint[];
  label: string;
  legend: { dau: string; wau: string };
}) {
  if (points.length < 2) return null;
  const max = Math.max(1, ...points.map((p) => Math.max(p.dau, p.wau)));
  const ticks = niceTicks(0, max, 4);
  const top = Math.max(max, ticks.at(-1) ?? max);
  const x = linearScale([0, points.length - 1], [PAD.left, W - PAD.right]);
  const y = linearScale([0, top], [H - PAD.bottom, PAD.top]);
  const line = (key: "dau" | "wau") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`)
      .join("");
  const labelEvery = Math.ceil(points.length / 6);

  return (
    <figure className="grid gap-2">
      <ul className="flex gap-4 font-sans text-xs text-ink-muted" aria-hidden="true">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-(--series-1)" />
          {legend.dau}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-(--series-2)" />
          {legend.wau}
        </li>
      </ul>
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        role="img"
        aria-label={label}
        className="h-auto w-full"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-ink-muted text-2xs"
            >
              {t}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text
              key={p.day}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              className="fill-ink-muted text-2xs"
            >
              {p.day.slice(5)}
            </text>
          ) : null,
        )}
        <path
          d={line("wau")}
          fill="none"
          stroke="var(--series-2)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <path
          d={line("dau")}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
    </figure>
  );
}
