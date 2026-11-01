import type { ReactNode } from "react";

import { extent, linearScale } from "@/lib/math/scale";

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
 * `values` are min-max scaled; the last point is marked with the accent.
 * With `label` it is announced as an image; without it, it's purely decorative.
 */
export function DataRule({ values, label }: { values?: readonly number[]; label?: string }) {
  if (!values || values.length < 2) return <hr className="my-8 border-0 border-t border-rule" />;

  const W = 240;
  const H = 20;
  const x = linearScale([0, values.length - 1], [0, W]);
  const y = linearScale(extent(values), [H - 2, 2]);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const last = values.at(-1) ?? 0;

  return (
    <div
      className="my-8 flex items-center gap-4"
      {...(label ? { role: "img", "aria-label": label } : { role: "separator" })}
    >
      <span className="h-px flex-1 bg-rule" />
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className="h-5 w-40 shrink-0 overflow-visible"
        aria-hidden="true"
      >
        <path d={d} fill="none" className="stroke-ink-muted" strokeWidth="1" />
        <circle cx={W} cy={y(last)} r="2" className="fill-accent" />
      </svg>
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}
