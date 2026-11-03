"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { randomWalk } from "@/lib/math/rng";
import { extent, linearScale } from "@/lib/math/scale";

import { evaluate, noiseStudy, signalsFor, sma, type IndicatorKind } from "./indicators";

/**
 * Indicator noise test (Phase 16): signals on a pure random walk. Each roll is one walk
 * with its signals marked; underneath, the same indicator over 300 walks.
 */
const DAYS = 250;
const [W, H] = [560, 220];
const [L, R, T, B] = [8, 8, 12, 12];

export function IndicatorChecker({
  preset,
}: {
  preset?: { kind?: IndicatorKind | undefined; seed?: number | undefined } | undefined;
}) {
  const t = useTranslations("debunk.indicators");
  const format = useFormatter();
  const [kind, setKind] = useState<IndicatorKind>(preset?.kind ?? "ma");
  const [seed, setSeed] = useState(preset?.seed ?? 42);

  const walk = useMemo(() => {
    const prices = randomWalk({ points: DAYS, sigma: 0.015, seed });
    const signals = signalsFor(kind, prices);
    return {
      prices,
      signals,
      result: evaluate(prices, signals),
      ma: kind === "ma" ? [sma(prices, 10), sma(prices, 30)] : [],
    };
  }, [kind, seed]);
  const study = useMemo(() => noiseStudy(kind, 300, DAYS, 9000), [kind]);

  const [lo, hi] = extent(walk.prices);
  const x = linearScale([0, DAYS - 1], [L, W - R]);
  const y = linearScale([lo, hi], [H - B, T]);
  const path = (xs: readonly number[]) =>
    xs
      .map((v, i) => (Number.isNaN(v) ? null : `${x(i).toFixed(1)} ${y(v).toFixed(1)}`))
      .filter(Boolean)
      .map((p, i) => `${i ? "L" : "M"}${p ?? ""}`)
      .join("");
  const pct = (v: number) => format.number(v, { style: "percent", maximumFractionDigits: 1 });

  return (
    <div
      data-checker="indicators"
      className="grid gap-4 rounded-md border border-rule-strong bg-surface px-5 py-5"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 font-sans text-sm text-ink">
          {t("indicator")}
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as IndicatorKind);
            }}
            className="h-10 rounded border border-rule-strong bg-surface px-2"
          >
            <option value="ma">{t("kind.ma")}</option>
            <option value="rsi">{t("kind.rsi")}</option>
            <option value="macd">{t("kind.macd")}</option>
          </select>
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setSeed((s) => s + 1);
          }}
        >
          {t("reroll")}
        </Button>
      </div>
      <figure>
        <div
          role="img"
          data-seed={seed}
          aria-label={t("chartLabel", {
            buys: walk.signals.filter((s) => s.side === "buy").length,
            sells: walk.signals.filter((s) => s.side === "sell").length,
          })}
        >
          <svg
            viewBox={`0 0 ${String(W)} ${String(H)}`}
            className="block h-auto w-full"
            aria-hidden="true"
          >
            <path
              d={path(walk.prices)}
              fill="none"
              style={{ stroke: "var(--series-1)" }}
              strokeWidth={1.5}
            />
            {walk.ma.map((m, i) => (
              <path
                key={i}
                d={path(m)}
                fill="none"
                className="stroke-ink-muted"
                strokeWidth={1}
                strokeDasharray={i ? "4 3" : undefined}
              />
            ))}
            {walk.signals.map((s) => (
              <text
                key={`${String(s.index)}-${s.side}`}
                x={x(s.index)}
                y={y(walk.prices[s.index] ?? lo) + (s.side === "buy" ? 14 : -6)}
                textAnchor="middle"
                className="fill-ink font-sans text-2xs"
              >
                {s.side === "buy" ? "▲" : "▼"}
              </text>
            ))}
          </svg>
        </div>
        <figcaption className="mt-1 font-sans text-xs text-ink-muted">{t("legend")}</figcaption>
      </figure>
      <dl className="grid gap-x-6 gap-y-1 font-sans text-sm sm:grid-cols-[minmax(12rem,auto)_1fr]">
        <dt className="text-ink-muted">{t("thisWalk")}</dt>
        <dd className="font-mono">
          {t("walkResult", { signals: walk.result.signals, hits: walk.result.hits })}
        </dd>
        <dt className="text-ink-muted">{t("manyWalks")}</dt>
        <dd data-hit-rate={study.hitRate.toFixed(3)} className="font-mono font-semibold">
          {t("studyResult", {
            signals: study.signals,
            hitRate: pct(study.hitRate),
            ret: pct(study.meanReturn),
          })}
        </dd>
      </dl>
      <p className="font-serif text-reading">{t("conclusion")}</p>
    </div>
  );
}
