"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { Button, buttonClass } from "@/components/ui/button";

import {
  DAILY_KEY,
  dailyKey,
  grid,
  parseDaily,
  shareQuery,
  solved,
  type DailyStore,
} from "../daily";

/**
 * Problems of the day (Phase 15): the per-level list with "solved" marks, and the share
 * panel shown after solving one. Results live in this browser (`qla:daily:v1`).
 */
let lastRaw: string | null | undefined;
let lastValue: DailyStore = { version: 1, days: {} };
function read(): DailyStore {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DAILY_KEY);
  } catch {
    raw = null;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastValue = parseDaily(raw);
  }
  return lastValue;
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
  };
}
const useDaily = () => useSyncExternalStore(subscribe, read, () => null);

export type DailyItem = { level: number; id: string; title: string; href: string; sample: boolean };

export function DailyProblems({ day, items }: { day: string; items: DailyItem[] }) {
  const t = useTranslations("gamification.daily");
  const tSample = useTranslations("exercises");
  const daily = useDaily();
  return (
    <section aria-labelledby="daily-title" className="mb-10" data-daily-problems="">
      <h2 id="daily-title" className="mb-2 text-xl">
        {t("title")}
      </h2>
      <p className="mb-4 max-w-(--measure) font-sans text-sm text-ink-muted">{t("lead")}</p>
      {items.length === 0 ? (
        <p className="font-sans text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const done = solved(daily?.days[dailyKey(day, it.level)]);
            return (
              <li
                key={it.level}
                data-daily-level={it.level}
                className="rounded-md border border-rule-strong bg-surface px-4 py-3"
              >
                <p className="font-sans text-xs text-ink-muted">
                  {t("slot", { level: it.level })}
                  {it.sample ? ` · ${tSample("sample")}` : ""}
                  {done ? ` · ${t("solved")}` : ""}
                </p>
                <a href={it.href} className="text-base">
                  {it.title}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** After a problem of the day is graded: the result grid and ways to share it. */
export function DailyShare({ day, level }: { day: string; level: number }) {
  const t = useTranslations("gamification.share");
  const locale = useLocale();
  const format = useFormatter();
  const daily = useDaily();
  const [copied, setCopied] = useState(false);
  const r = daily?.days[dailyKey(day, level)];
  if (!r || r.marks.length === 0) return null;

  const params = {
    d: day,
    l: level,
    r: r.marks.join(""),
    h: r.hints,
    lang: locale === "en" ? ("en" as const) : ("pl" as const),
  };
  const story = `/api/share/daily?${shareQuery({ ...params, format: "story" })}`;
  const date = format.dateTime(new Date(`${day}T12:00:00Z`), {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const text = `${t("text", { level, date, grid: grid(r.marks) })}\n${location.origin}`;

  const share = async () => {
    try {
      const blob = await (await fetch(story)).blob();
      const file = new File([blob], `zadanie-dnia-${day}-${String(level)}.png`, {
        type: "image/png",
      });
      if ("canShare" in navigator && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // cancelled or not allowed: the download link is right there
    }
  };

  return (
    <section
      aria-label={t("yourResult")}
      data-daily-share=""
      className="mt-4 grid gap-3 rounded-md border border-rule px-4 py-3"
    >
      <p className="font-sans text-sm text-ink">
        {t("yourResult")}:{" "}
        <span className="font-mono" aria-hidden="true">
          {grid(r.marks)}
        </span>
        <span className="sr-only">
          {solved(r) ? t("solved", { attempts: r.marks.indexOf("o") + 1 }) : t("notSolved")}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void share()}>
          {t("button")}
        </Button>
        <a href={story} download className={buttonClass("secondary", "sm")}>
          {t("download")}
        </a>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
            });
          }}
        >
          {copied ? t("copied") : t("copy")}
        </Button>
      </div>
    </section>
  );
}
