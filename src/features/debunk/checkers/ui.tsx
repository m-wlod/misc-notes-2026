"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";

import { NumberInput } from "@/components/ui/number-input";
import { linearScale, niceTicks } from "@/lib/math/scale";

/**
 * Building blocks shared by the claim checkers (Phase 16): a labelled number field that
 * accepts "0,25", "25%" or "1/4" and keeps the last valid value, a result row, and a
 * small bar chart (one series, marker lines labelled in text, a summary for screen
 * readers).
 */
export function NumField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  integer = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  hint?: string;
  integer?: boolean;
}) {
  const id = useId();
  const t = useTranslations("placement.invalid");
  const [raw, setRaw] = useState(() => String(value).replace(".", ","));
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="font-sans text-sm text-ink">
        {label}
      </label>
      <NumberInput
        id={id}
        value={raw}
        className="w-36"
        invalidMessage={(reason) => t(reason)}
        onValueChange={(text, parsed) => {
          setRaw(text);
          if (!parsed.ok) return;
          let v = parsed.value;
          if (integer) v = Math.round(v);
          onChange(Math.min(max, Math.max(min, v)));
        }}
      />
      {hint ? <p className="font-sans text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function Results({ children }: { children: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 font-sans text-sm sm:grid-cols-[minmax(12rem,auto)_1fr]">
      {children}
    </dl>
  );
}

export function Result({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd
        className={emphasis ? "font-mono text-base font-semibold text-ink" : "font-mono text-ink"}
      >
        {value}
      </dd>
    </>
  );
}

export type Bar = { x: number; y: number };
export type Marker = { x: number; label: string };

/** Bars over a numeric x axis with labelled vertical marker lines. */
export function BarChart({
  bars,
  markers = [],
  label,
  summary,
  xFormat,
  logY = false,
}: {
  bars: Bar[];
  markers?: Marker[];
  label: string;
  summary: string;
  xFormat: (v: number) => string;
  logY?: boolean;
}) {
  const [W, H] = [560, 200];
  const [L, R, T, B] = [12, 12, 28, 24];
  if (bars.length === 0) return null;
  const xs = [...bars.map((b) => b.x), ...markers.map((m) => m.x)];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const pad = (x1 - x0) * 0.04 || 1;
  const x = linearScale([x0 - pad, x1 + pad], [L, W - R]);
  const yv = (v: number) => (logY ? Math.log10(Math.max(1, v)) : v);
  const top = Math.max(...bars.map((b) => yv(b.y))) || 1;
  const y = linearScale([0, top], [H - B, T]);
  const step = bars.length > 1 ? Math.abs(x(bars[1]?.x ?? 0) - x(bars[0]?.x ?? 0)) : 20;
  const w = Math.max(1, Math.min(40, step - 2));
  return (
    <figure className="my-2">
      <div role="img" aria-label={`${label}. ${summary}`}>
        <svg
          viewBox={`0 0 ${String(W)} ${String(H)}`}
          className="block h-auto w-full"
          aria-hidden="true"
        >
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="stroke-rule-strong" />
          {bars.map((b, i) => (
            <rect
              key={i}
              x={x(b.x) - w / 2}
              y={y(yv(b.y))}
              width={w}
              height={Math.max(0, H - B - y(yv(b.y)))}
              rx={Math.min(2, w / 2)}
              style={{ fill: "var(--series-1)" }}
            />
          ))}
          {niceTicks(x0, x1, 5).map((v) => (
            <text
              key={v}
              x={x(v)}
              y={H - 6}
              textAnchor="middle"
              className="fill-ink-muted font-mono text-2xs"
            >
              {xFormat(v)}
            </text>
          ))}
          {markers.map((m, i) => (
            <g key={m.label}>
              <line
                x1={x(m.x)}
                x2={x(m.x)}
                y1={T - 4}
                y2={H - B}
                className="stroke-ink"
                strokeDasharray="4 3"
              />
              <text
                x={x(m.x)}
                y={12 + i * 12}
                textAnchor={x(m.x) > W * 0.7 ? "end" : "start"}
                dx={x(m.x) > W * 0.7 ? -4 : 4}
                className="fill-ink stroke-surface font-sans text-2xs"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {m.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="mt-1 font-sans text-xs text-ink-muted">{label}</figcaption>
    </figure>
  );
}
