"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/display";
import { cx } from "@/lib/cx";

import { useSolvedIds } from "./use-solved";

/** A GET form that submits itself when a select changes; the button covers no-JS. */
export function FiltersForm({ children, action }: { children: ReactNode; action: string }) {
  return (
    <form
      method="get"
      action={action}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
      className="flex flex-wrap items-end gap-x-4 gap-y-3 font-sans text-sm"
    >
      {children}
    </form>
  );
}

export type ListItem = {
  id: string;
  href: string;
  promptHtml: string;
  level: number;
  typeLabel: string;
  minutes: number;
  sample: boolean;
};

/** Results, with "unsolved only" read from this browser's attempts. */
export function PracticeList({
  items,
  sampleLabel,
}: {
  items: readonly ListItem[];
  sampleLabel: string;
}) {
  const t = useTranslations("exercises");
  const solved = useSolvedIds();
  const [unsolvedOnly, setUnsolvedOnly] = useState(false);
  const toggleId = useId();
  const shown = unsolvedOnly ? items.filter((i) => !solved.has(i.id)) : items;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 font-sans text-sm">
        <p role="status" className="text-ink-muted">
          {t("hub.count", { count: shown.length })}
        </p>
        <label htmlFor={toggleId} className="flex items-center gap-2 text-ink">
          <input
            id={toggleId}
            type="checkbox"
            checked={unsolvedOnly}
            onChange={(e) => {
              setUnsolvedOnly(e.target.checked);
            }}
            className="size-4 accent-(--accent)"
          />
          {t("hub.unsolved")}
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="text-base">{t("hub.allSolved")}</p>
      ) : (
        <ul className="grid gap-3">
          {shown.map((item) => (
            <li
              key={item.id}
              data-exercise={item.id}
              className={cx(
                "rounded-md border border-rule-strong bg-surface px-4 py-3",
                solved.has(item.id) && "border-correct",
              )}
            >
              <p className="mb-1 flex flex-wrap items-center gap-2 font-sans text-xs text-ink-muted">
                <Badge>{t("level", { level: item.level })}</Badge>
                <span>{item.typeLabel}</span>
                <span className="num">{t("minutes", { minutes: item.minutes })}</span>
                {item.sample ? <Badge>{sampleLabel}</Badge> : null}
                {solved.has(item.id) ? (
                  <span className="text-correct">✓ {t("hub.solved")}</span>
                ) : null}
              </p>
              <a
                href={item.href}
                className="block font-serif text-base text-ink underline-offset-4 hover:underline"
              >
                <span dangerouslySetInnerHTML={{ __html: item.promptHtml }} />
                <span className="sr-only"> ({t("hub.open")})</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
