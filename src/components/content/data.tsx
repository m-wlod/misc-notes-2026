import type { ReactNode } from "react";

/** Inline mono statistic: label + value, e.g. "Seria 12 dni". Tabular figures. */
export function StatTicker({
  label,
  value,
  unit,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
}) {
  return (
    <span className="inline-flex items-baseline gap-1 num text-xs text-ink-muted">
      {label} <b className="font-medium text-ink">{value}</b>
      {unit ? <span>{unit}</span> : null}
    </span>
  );
}

/**
 * A hairline divider that can carry a tiny sparkline: decoration made of data.
 * `values` are plotted min-max scaled; the last point is marked with the accent.
 */
export function DataRule({ values, label }: { values?: readonly number[]; label?: string }) {
  if (!values || values.length < 2) return <hr className="my-8 border-0 border-t border-rule" />;

  const W = 240;
  const H = 20;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map(
    (v, i) => [(i / (values.length - 1)) * W, H - 2 - ((v - lo) / span) * (H - 4)] as const,
  );
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const last = pts.at(-1) ?? [0, 0];

  return (
    <div
      className="my-8 flex items-center gap-4"
      role={label ? "img" : "separator"}
      aria-label={label}
    >
      <span className="h-px flex-1 bg-rule" />
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className="h-5 w-40 shrink-0 overflow-visible"
        aria-hidden="true"
      >
        <path d={d} fill="none" stroke="var(--ink-muted)" strokeWidth="1" />
        <circle cx={last[0]} cy={last[1]} r="2" fill="var(--accent)" />
      </svg>
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}
