"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { extent, linearScale, niceTicks } from "@/lib/math/scale";

import type { CleanPlot } from "./plot";

/**
 * A plot from `qla.show` / `qla.hist` in the site's chart style (Phase 13): one series
 * per chart, so no legend (the label is the caption); thin line, recessive grid, ticks in
 * muted mono. Hover or tap shows the nearest value.
 */
const [W, H] = [560, 220];
const [L, R, T, B] = [56, 14, 12, 26];
const tick = "fill-ink-muted font-mono text-2xs";

/** About five ticks on month starts (or every few months/years for long ranges), UTC ms. */
export function dateTicks([a, b]: readonly [number, number]): number[] {
  const months = (b - a) / (30.44 * 864e5);
  const step = [1, 2, 3, 6, 12, 24, 60].find((s) => months / s <= 6) ?? 120;
  const d = new Date(a);
  let cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  const out: number[] = [];
  while (cur <= b && out.length < 12) {
    const m = new Date(cur);
    if ((m.getUTCFullYear() * 12 + m.getUTCMonth()) % step === 0) out.push(cur);
    cur = Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1);
  }
  return out;
}

export function PlotView({ plot, xDates }: { plot: CleanPlot; xDates: boolean }) {
  const t = useTranslations("python");
  const format = useFormatter();
  const [active, setActive] = useState<number | null>(null);

  const num = (v: number) =>
    format.number(
      v,
      Math.abs(v) >= 1e6 || (v !== 0 && Math.abs(v) < 1e-3)
        ? { notation: "scientific", maximumFractionDigits: 2 }
        : { maximumFractionDigits: 4 },
    );
  const xText = (v: number) =>
    xDates ? format.dateTime(new Date(v), { dateStyle: "medium", timeZone: "UTC" }) : num(v);

  const model = useMemo(() => {
    if (plot.kind === "hist") {
      const top = Math.max(1, ...plot.bins.map((b) => b.count));
      return {
        xd: [plot.bins[0]?.from ?? 0, plot.bins.at(-1)?.to ?? 1] as [number, number],
        yd: [0, top] as [number, number],
      };
    }
    const xs = plot.points.map((p) => p[0]);
    const ys = plot.points.map((p) => p[1]);
    const xd = xs.length ? extent(xs) : ([0, 1] as [number, number]);
    const [y0, y1] = ys.length ? extent(ys) : [0, 1];
    const pad = (y1 - y0) * 0.06 || Math.abs(y0) * 0.1 || 1;
    return { xd, yd: [y0 - pad, y1 + pad] as [number, number] };
  }, [plot]);

  const x = linearScale(model.xd, [L, W - R]);
  const y = linearScale(model.yd, [H - B, T]);
  const yTicks = niceTicks(model.yd[0], model.yd[1], 4);
  const xTicks = xDates ? dateTicks(model.xd) : niceTicks(model.xd[0], model.xd[1], 5);

  const caption = plot.label ?? (plot.kind === "hist" ? t("plot.histogram") : t("plot.line"));
  const summary =
    plot.kind === "hist"
      ? t("plot.histSummary", { n: plot.n, bins: plot.bins.length })
      : t("plot.lineSummary", { n: plot.points.length });

  let readout: string | null = null;
  let marker: { cx: number; cy: number } | null = null;
  if (active !== null) {
    if (plot.kind === "hist") {
      const b = plot.bins[active];
      if (b) readout = t("plot.binReadout", { from: num(b.from), to: num(b.to), count: b.count });
    } else {
      const p = plot.points[active];
      if (p) {
        readout = `${xText(p[0])}: ${num(p[1])}`;
        marker = { cx: x(p[0]), cy: y(p[1]) };
      }
    }
  }

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!box) return;
    const sx = ((e.clientX - box.left) / box.width) * W;
    if (plot.kind === "hist") {
      const i = plot.bins.findIndex((b) => sx >= x(b.from) && sx < x(b.to));
      setActive(i >= 0 ? i : null);
      return;
    }
    let best = -1;
    let dist = Infinity;
    plot.points.forEach((p, i) => {
      const d = Math.abs(x(p[0]) - sx);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setActive(best >= 0 ? best : null);
  };

  const line =
    plot.kind === "line"
      ? plot.points
          .map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`)
          .join("")
      : "";

  return (
    <figure data-plot={plot.kind} className="my-3">
      <figcaption className="mb-1 font-sans text-sm text-ink">{caption}</figcaption>
      <div role="img" aria-label={`${caption}. ${summary}`} className="relative">
        <svg
          viewBox={`0 0 ${String(W)} ${String(H)}`}
          className="block h-auto w-full"
          aria-hidden="true"
        >
          {yTicks.map((v) => (
            <g key={`y${String(v)}`}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-grid" />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" className={tick}>
                {num(v)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${String(v)}`} x={x(v)} y={H - 8} textAnchor="middle" className={tick}>
              {xDates
                ? format.dateTime(new Date(v), {
                    month: "short",
                    year: "2-digit",
                    timeZone: "UTC",
                  })
                : num(v)}
            </text>
          ))}
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="stroke-rule-strong" />
          {plot.kind === "hist" ? (
            plot.bins.map((b, i) => {
              const x0 = x(b.from);
              const w = Math.max(1, x(b.to) - x0 - 2);
              return (
                <rect
                  key={i}
                  x={x0 + 1}
                  y={y(b.count)}
                  width={w}
                  height={Math.max(0, H - B - y(b.count))}
                  rx={Math.min(2, w / 2)}
                  style={{
                    fill: "var(--series-1)",
                    opacity: active === null || active === i ? 1 : 0.55,
                  }}
                />
              );
            })
          ) : (
            <path
              d={line}
              fill="none"
              style={{ stroke: "var(--series-1)" }}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {marker ? (
            <>
              <line
                x1={marker.cx}
                x2={marker.cx}
                y1={T}
                y2={H - B}
                className="stroke-rule-strong"
              />
              <circle
                cx={marker.cx}
                cy={marker.cy}
                r={4}
                className="stroke-surface"
                strokeWidth={2}
                style={{ fill: "var(--series-1)" }}
              />
            </>
          ) : null}
          <rect
            x={L}
            y={T}
            width={W - L - R}
            height={H - T - B}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => {
              setActive(null);
            }}
          />
        </svg>
        {readout ? (
          <p className="pointer-events-none absolute top-0 right-0 rounded-sm border border-rule bg-surface px-2 py-0.5 font-mono text-2xs text-ink">
            {readout}
          </p>
        ) : null}
      </div>
      {plot.dropped > 0 || (plot.kind === "line" && plot.thinned) ? (
        <p className="mt-1 font-sans text-xs text-ink-muted">
          {[
            plot.dropped > 0 ? t("plot.dropped", { n: plot.dropped }) : null,
            plot.kind === "line" && plot.thinned ? t("plot.thinned") : null,
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
      ) : null}
    </figure>
  );
}
