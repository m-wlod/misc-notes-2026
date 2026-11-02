"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { linearScale } from "@/lib/math/scale";

import { KINDS } from "./kinds";
import type { SessionEntry } from "./store";
import { useInterview } from "./use-interview";

/**
 * Session history (Phase 11): one small chart per session type (score per session,
 * 0–100%), then every session in a table, which is also the chart's table view.
 * Everything comes from this browser's qla:interview:v1.
 */
export function InterviewHistory() {
  const t = useTranslations("interview");
  const format = useFormatter();
  const state = useInterview();
  if (state === null) return null; // server render: nothing stored there
  if (state.sessions.length === 0)
    return <p className="text-base text-ink-muted">{t("history.empty")}</p>;

  const byKind = KINDS.map((k) => ({
    kind: k.kind,
    sessions: state.sessions.filter((s) => s.kind === k.kind),
  })).filter((g) => g.sessions.length > 0);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="grid gap-10">
      <div className="grid gap-6 md:grid-cols-2">
        {byKind.map((g) => {
          const title = t(`kinds.${g.kind}.title`);
          const scores = g.sessions.map((s) => Math.round(s.score * 100));
          return (
            <figure
              key={g.kind}
              className="rounded-md border border-rule-strong bg-surface px-4 py-3"
            >
              <figcaption className="mb-2 font-sans text-sm font-semibold text-ink">
                {t("history.chartTitle", { kind: title })}
              </figcaption>
              <ScoreChart
                sessions={g.sessions}
                date={date}
                label={t("history.chartLabel", {
                  kind: title,
                  count: scores.length,
                  last: scores.at(-1) ?? 0,
                  best: Math.max(...scores),
                })}
              />
            </figure>
          );
        })}
      </div>

      <div>
        <table className="w-full border-collapse text-left font-sans text-sm">
          <thead>
            <tr className="border-b border-rule-strong text-ink-muted">
              <th scope="col" className="py-2 pr-3 font-normal">
                {t("history.date")}
              </th>
              <th scope="col" className="py-2 pr-3 font-normal">
                {t("history.kind")}
              </th>
              <th scope="col" className="py-2 pr-3 font-normal">
                {t("history.level")}
              </th>
              <th scope="col" className="py-2 font-normal">
                {t("history.result")}
              </th>
            </tr>
          </thead>
          <tbody>
            {[...state.sessions].reverse().map((s) => (
              <tr key={s.id} className="border-b border-rule">
                <td className="py-2 pr-3 num">{date(s.finishedAt)}</td>
                <td className="py-2 pr-3">{t(`kinds.${s.kind}.title`)}</td>
                <td className="py-2 pr-3 num">{s.level}</td>
                <td className="py-2 num">
                  {Math.round(s.score * 100)}%
                  {s.personalBest ? (
                    <span className="ml-2 text-ink-muted">({t("history.best")})</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Score per session, 0–100% on a fixed scale (so charts of different types compare).
 * One series: no legend, the caption names it. Hover or tap a point for its details.
 */
function ScoreChart({
  sessions,
  date,
  label,
}: {
  sessions: readonly SessionEntry[];
  date: (iso: string) => string;
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [W, H] = [480, 170];
  const [L, R, T, B] = [34, 12, 12, 22];
  const n = sessions.length;
  const x = linearScale([0, Math.max(1, n - 1)], [L + (n === 1 ? (W - L - R) / 2 : 0), W - R]);
  const y = linearScale([0, 100], [H - B, T]);
  const pts = sessions.map((s, i) => ({
    x: n === 1 ? (W + L - R) / 2 : x(i),
    y: y(s.score * 100),
    s,
  }));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
  const last = pts.at(-1);
  const shown = active === null ? null : pts[active];
  const band = n > 1 ? (W - L - R) / (n - 1) : W - L - R;
  const tick = "fill-ink-muted font-mono text-2xs";

  return (
    <div role="img" aria-label={label} className="relative">
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className="block h-auto w-full"
        aria-hidden="true"
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-grid" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className={tick}>
              {v}%
            </text>
          </g>
        ))}
        {shown ? (
          <line x1={shown.x} x2={shown.x} y1={T} y2={H - B} className="stroke-rule-strong" />
        ) : null}
        {n > 1 ? (
          <path
            d={d}
            fill="none"
            className="stroke-accent"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {pts.map((p, i) => (
          <circle
            key={p.s.id}
            cx={p.x}
            cy={p.y}
            r={i === active ? 5 : 4}
            className="fill-accent stroke-surface"
            strokeWidth={2}
          />
        ))}
        {last ? (
          <text
            x={Math.min(last.x, W - R - 2)}
            y={last.y - 10}
            textAnchor={n === 1 ? "middle" : "end"}
            className="fill-ink stroke-surface font-mono text-2xs"
            strokeWidth={4}
            paintOrder="stroke"
          >
            {Math.round(last.s.score * 100)}%
          </text>
        ) : null}
        {/* Hit targets: a full-height band per session, wider than the dot. */}
        {pts.map((p, i) => (
          <rect
            key={`hit-${p.s.id}`}
            x={p.x - band / 2}
            y={T}
            width={band}
            height={H - T - B}
            fill="transparent"
            onPointerEnter={() => {
              setActive(i);
            }}
            onPointerLeave={() => {
              setActive(null);
            }}
          />
        ))}
      </svg>
      {shown ? (
        <p
          className="shadow-sm pointer-events-none absolute top-0 rounded border border-rule-strong bg-surface px-2 py-1 num font-sans text-xs text-ink"
          style={{ left: `${String(Math.min(70, Math.max(0, (shown.x / W) * 100 - 10)))}%` }}
        >
          {date(shown.s.finishedAt)} · L{shown.s.level} · {Math.round(shown.s.score * 100)}%
        </p>
      ) : null}
    </div>
  );
}
