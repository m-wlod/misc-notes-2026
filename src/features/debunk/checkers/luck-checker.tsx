"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { binomialPmf } from "./ev";
import { atLeastOne, binomialTail, expectedBestSharpe, sharpePValue } from "./luck";
import { BarChart, NumField, Result, Results } from "./ui";

export type LuckPreset = {
  trades: number;
  wins: number;
  p0: number;
  tries: number;
  sharpe: number;
  years: number;
};

export const LUCK_DEFAULTS: LuckPreset = {
  trades: 50,
  wins: 32,
  p0: 0.5,
  tries: 100,
  sharpe: 1.5,
  years: 2,
};

/** "Is this track record luck?" (Phase 16): win counts and Sharpe ratios under no edge. */
export function LuckChecker({ preset }: { preset?: Partial<LuckPreset> | undefined }) {
  const t = useTranslations("debunk.luck");
  const format = useFormatter();
  const [v, setV] = useState<LuckPreset>({ ...LUCK_DEFAULTS, ...preset });
  const set = (k: keyof LuckPreset) => (x: number) => {
    setV((s) => ({ ...s, [k]: x }));
  };
  const wins = Math.min(v.wins, v.trades);

  const r = useMemo(() => {
    const tail = binomialTail(v.trades, wins, v.p0);
    const sharpeP = sharpePValue(v.sharpe, v.years);
    return {
      tail,
      anyTail: atLeastOne(tail, v.tries),
      sharpeP,
      anySharpe: atLeastOne(sharpeP, v.tries),
      bestSharpe: expectedBestSharpe(v.tries, v.years),
      pmf: Array.from(binomialPmf(v.trades, v.p0), (y, x) => ({ x, y })),
    };
  }, [v, wins]);

  const pct = (x: number) =>
    x < 0.001 && x > 0
      ? format.number(x, { style: "percent", maximumSignificantDigits: 2 })
      : format.number(x, { style: "percent", maximumFractionDigits: 1 });

  return (
    <div
      data-checker="luck"
      className="grid gap-5 rounded-md border border-rule-strong bg-surface px-5 py-5"
    >
      <fieldset className="grid gap-3">
        <legend className="mb-1 font-sans text-sm font-semibold text-ink">{t("winRate")}</legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumField
            label={t("trades")}
            value={v.trades}
            onChange={set("trades")}
            min={1}
            max={2000}
            integer
          />
          <NumField
            label={t("wins")}
            value={v.wins}
            onChange={set("wins")}
            min={0}
            max={2000}
            integer
          />
          <NumField
            label={t("p0")}
            value={v.p0}
            onChange={set("p0")}
            min={0.01}
            max={0.99}
            hint={t("p0Hint")}
          />
          <NumField
            label={t("tries")}
            value={v.tries}
            onChange={set("tries")}
            min={1}
            max={100000}
            integer
            hint={t("triesHint")}
          />
        </div>
      </fieldset>
      <Results>
        <Result label={t("tail", { k: wins, n: v.trades })} value={pct(r.tail)} emphasis />
        <Result label={t("anyTail", { m: v.tries })} value={pct(r.anyTail)} emphasis />
      </Results>
      <BarChart
        bars={r.pmf}
        markers={[{ x: wins, label: t("claimed", { k: wins }) }]}
        label={t("chart", { n: v.trades })}
        summary={t("chartSummary", { tail: pct(r.tail) })}
        xFormat={(x) => format.number(x)}
      />
      <fieldset className="grid gap-3">
        <legend className="mb-1 font-sans text-sm font-semibold text-ink">{t("sharpeMode")}</legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumField
            label={t("sharpe")}
            value={v.sharpe}
            onChange={set("sharpe")}
            min={-5}
            max={10}
          />
          <NumField label={t("years")} value={v.years} onChange={set("years")} min={0.1} max={50} />
        </div>
      </fieldset>
      <Results>
        <Result label={t("sharpeP")} value={pct(r.sharpeP)} />
        <Result label={t("anySharpe", { m: v.tries })} value={pct(r.anySharpe)} />
        <Result
          label={t("bestSharpe", { m: v.tries })}
          value={format.number(r.bestSharpe, { maximumFractionDigits: 2 })}
        />
      </Results>
      <p className="font-serif text-reading">{r.anyTail > 0.05 ? t("lucky") : t("notLucky")}</p>
    </div>
  );
}
