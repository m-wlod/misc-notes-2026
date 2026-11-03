"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  bottomShare,
  membersPerLevel,
  POLAND_POPULATION,
  recruitsToBreakEven,
  saturationLevel,
} from "./mlm";
import { BarChart, NumField, Result, Results } from "./ui";

export type MlmPreset = {
  price: number;
  tier1: number;
  tier2: number;
  tier3: number;
  recruits: number;
  population: number;
};

export const MLM_DEFAULTS: MlmPreset = {
  price: 2000,
  tier1: 0.3,
  tier2: 0.1,
  tier3: 0.05,
  recruits: 3,
  population: POLAND_POPULATION,
};

/** Course / MLM economics (Phase 16): how fast "bring three friends" runs out of people. */
export function MlmChecker({ preset }: { preset?: Partial<MlmPreset> | undefined }) {
  const t = useTranslations("debunk.mlm");
  const format = useFormatter();
  const [v, setV] = useState<MlmPreset>({ ...MLM_DEFAULTS, ...preset });
  const set = (k: keyof MlmPreset) => (x: number) => {
    setV((s) => ({ ...s, [k]: x }));
  };

  const r = useMemo(() => {
    const level = saturationLevel(v.recruits, v.population);
    const last = level ?? 12;
    const levels = membersPerLevel(v.recruits, last);
    return {
      level,
      levels,
      bottom: level !== null && level > 0 ? bottomShare(v.recruits, level - 1) : null,
      breakEven: recruitsToBreakEven(v.price, [v.tier1, v.tier2, v.tier3], v.recruits),
      breakEvenDirectOnly: recruitsToBreakEven(v.price, [v.tier1], v.recruits),
    };
  }, [v]);

  const int = (x: number) => format.number(x, { maximumFractionDigits: 0 });
  const pct = (x: number) => format.number(x, { style: "percent", maximumFractionDigits: 1 });

  return (
    <div
      data-checker="mlm"
      className="grid gap-5 rounded-md border border-rule-strong bg-surface px-5 py-5"
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <NumField label={t("price")} value={v.price} onChange={set("price")} min={0} max={1e9} />
        <NumField
          label={t("recruits")}
          value={v.recruits}
          onChange={set("recruits")}
          min={1}
          max={50}
          integer
        />
        <NumField
          label={t("population")}
          value={v.population}
          onChange={set("population")}
          min={1}
          max={1e10}
          integer
          hint={t("populationHint")}
        />
        <NumField
          label={t("tier", { n: 1 })}
          value={v.tier1}
          onChange={set("tier1")}
          min={0}
          max={1}
        />
        <NumField
          label={t("tier", { n: 2 })}
          value={v.tier2}
          onChange={set("tier2")}
          min={0}
          max={1}
        />
        <NumField
          label={t("tier", { n: 3 })}
          value={v.tier3}
          onChange={set("tier3")}
          min={0}
          max={1}
        />
      </div>
      <Results>
        <Result
          label={t("saturation")}
          value={r.level === null ? t("never") : t("levelN", { n: r.level })}
          emphasis
        />
        {r.bottom !== null ? <Result label={t("bottom")} value={pct(r.bottom)} emphasis /> : null}
        <Result
          label={t("breakEven")}
          value={r.breakEven === null ? t("never") : int(r.breakEven)}
        />
        <Result
          label={t("breakEvenDirect")}
          value={r.breakEvenDirectOnly === null ? t("never") : int(r.breakEvenDirectOnly)}
        />
      </Results>
      <BarChart
        bars={r.levels.map((y, x) => ({ x, y }))}
        markers={r.level !== null ? [{ x: r.level, label: t("runsOut") }] : []}
        label={t("chart")}
        summary={t("chartSummary", {
          levels: r.levels.length - 1,
          last: int(r.levels.at(-1) ?? 0),
        })}
        xFormat={(x) => (Number.isInteger(x) ? int(x) : "")}
        logY
      />
      <p className="font-sans text-xs text-ink-muted">{t("logNote")}</p>
    </div>
  );
}
