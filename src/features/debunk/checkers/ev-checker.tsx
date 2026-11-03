"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  breakEvenWinRate,
  equityDistribution,
  expectedValue,
  losingStreakProbability,
  riskOfRuin,
} from "./ev";
import { BarChart, NumField, Result, Results } from "./ui";

export type EvPreset = {
  p: number;
  win: number;
  loss: number;
  cost: number;
  capital: number;
  trades: number;
  streak: number;
  ruinAt: number;
};

export const EV_DEFAULTS: EvPreset = {
  p: 0.9,
  win: 10,
  loss: 100,
  cost: 1,
  capital: 1000,
  trades: 200,
  streak: 3,
  ruinAt: 500,
};

/** Strategy EV checker (Phase 16): everything exact, recomputed as you type. */
export function EvChecker({ preset }: { preset?: Partial<EvPreset> | undefined }) {
  const t = useTranslations("debunk.ev");
  const format = useFormatter();
  const [v, setV] = useState<EvPreset>({ ...EV_DEFAULTS, ...preset });
  const set = (k: keyof EvPreset) => (x: number) => {
    setV((s) => ({ ...s, [k]: x }));
  };

  const r = useMemo(() => {
    const input = { p: v.p, win: v.win, loss: v.loss, cost: v.cost };
    const dist = equityDistribution(input, v.capital, v.trades);
    // The chart shows the central 99.8% of outcomes (e.g. "all 200 trades lost" is
    // possible but would squash the picture); the numbers above use everything.
    let acc = 0;
    let lo = dist[0]?.equity ?? 0;
    let hi = dist.at(-1)?.equity ?? 1;
    let loSet = false;
    for (const d of dist) {
      acc += d.probability;
      if (!loSet && acc >= 0.001) {
        lo = d.equity;
        loSet = true;
      }
      if (acc >= 0.999) {
        hi = d.equity;
        break;
      }
    }
    const bins = Math.min(
      40,
      Math.max(1, dist.filter((d) => d.equity >= lo && d.equity <= hi).length),
    );
    const width = (hi - lo) / bins || 1;
    const bars = Array.from({ length: bins }, (_, i) => ({ x: lo + (i + 0.5) * width, y: 0 }));
    let mean = 0;
    let below = 0;
    for (const d of dist) {
      mean += d.equity * d.probability;
      if (d.equity < v.capital) below += d.probability;
      if (d.equity < lo || d.equity > hi) continue;
      const i = Math.min(bins - 1, Math.floor((d.equity - lo) / width));
      const bar = bars[i];
      if (bar) bar.y += d.probability;
    }
    return {
      ev: expectedValue(input),
      breakEven: breakEvenWinRate(input),
      streak: losingStreakProbability(v.p, v.trades, v.streak),
      ruin: riskOfRuin(input, v.capital, v.trades, v.ruinAt),
      mean,
      below,
      bars,
    };
  }, [v]);

  const money = (x: number) => format.number(x, { maximumFractionDigits: 2 });
  const pct = (x: number) => format.number(x, { style: "percent", maximumFractionDigits: 1 });

  return (
    <div
      data-checker="ev"
      className="grid gap-5 rounded-md border border-rule-strong bg-surface px-5 py-5"
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <NumField
          label={t("p")}
          value={v.p}
          onChange={set("p")}
          min={0}
          max={1}
          hint={t("pHint")}
        />
        <NumField label={t("win")} value={v.win} onChange={set("win")} min={0} max={1e9} />
        <NumField label={t("loss")} value={v.loss} onChange={set("loss")} min={0} max={1e9} />
        <NumField label={t("cost")} value={v.cost} onChange={set("cost")} min={0} max={1e9} />
        <NumField
          label={t("capital")}
          value={v.capital}
          onChange={set("capital")}
          min={1}
          max={1e12}
        />
        <NumField
          label={t("trades")}
          value={v.trades}
          onChange={set("trades")}
          min={1}
          max={1000}
          integer
        />
        <NumField
          label={t("streak")}
          value={v.streak}
          onChange={set("streak")}
          min={1}
          max={100}
          integer
        />
        <NumField
          label={t("ruinAt")}
          value={v.ruinAt}
          onChange={set("ruinAt")}
          min={0}
          max={1e12}
        />
      </div>
      <Results>
        <Result label={t("ev")} value={money(r.ev)} emphasis />
        <Result label={t("breakEven")} value={pct(r.breakEven)} />
        <Result label={t("streakProb", { k: v.streak, n: v.trades })} value={pct(r.streak)} />
        <Result label={t("ruinProb", { n: v.trades })} value={pct(r.ruin)} />
        <Result label={t("meanEquity", { n: v.trades })} value={money(r.mean)} />
        <Result label={t("belowStart")} value={pct(r.below)} />
      </Results>
      <p data-verdict={r.ev > 0 ? "positive" : "negative"} className="font-serif text-reading">
        {r.ev > 0 ? t("positive") : t("negative", { breakEven: pct(r.breakEven), p: pct(v.p) })}
      </p>
      <BarChart
        bars={r.bars}
        markers={[
          { x: v.capital, label: t("start") },
          { x: v.ruinAt, label: t("ruinLine") },
        ]}
        label={t("chart", { n: v.trades })}
        summary={t("chartSummary", { mean: money(r.mean), below: pct(r.below) })}
        xFormat={(x) => format.number(x, { notation: "compact" })}
      />
    </div>
  );
}
