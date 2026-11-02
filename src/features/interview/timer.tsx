"use client";

import { useTranslations } from "next-intl";

/** mm:ss from milliseconds (rounded up, so 0:00 means the time is really up). */
export function clock(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, "0")}`;
}

export function Timer({ remaining }: { remaining: number }) {
  const t = useTranslations("interview.timer");
  // The live region's text changes only when a threshold is crossed, so it is read twice.
  const announce =
    remaining <= 0
      ? ""
      : remaining <= 10_000
        ? t("tenSeconds")
        : remaining <= 60_000
          ? t("oneMinute")
          : "";
  return (
    <p className="font-sans text-sm text-ink-muted">
      <span aria-hidden="true">
        {t("left")} <span className="num font-semibold text-ink">{clock(remaining)}</span>
      </span>
      <span role="status" className="sr-only">
        {announce}
      </span>
    </p>
  );
}
