"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/display";
import { Input } from "@/components/ui/field";

import { groupByInitial, matches, type GlossaryEntry } from "./glossary";

/**
 * A–Z glossary with a live filter. The full list is server-rendered (this is a client
 * component, but it renders on the server too), so the page works without JS.
 */
export function GlossarySearch({
  entries,
  locale,
}: {
  /** Already sorted for `locale`. */
  entries: readonly GlossaryEntry[];
  locale: string;
}) {
  const t = useTranslations("glossary");
  const [query, setQuery] = useState("");
  const inputId = useId();
  const visible = entries.filter((e) => matches(e, query));
  const groups = groupByInitial(visible, locale);

  return (
    <div className="grid gap-8">
      <div className="grid max-w-md gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {t("searchLabel")}
        </label>
        <Input
          id={inputId}
          type="search"
          value={query}
          placeholder={t("searchPlaceholder")}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />
        <p role="status" className="num text-xs text-ink-muted">
          {t("count", { count: visible.length })}
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-base">{t("empty", { query })}</p>
      ) : (
        <div className="grid gap-10">
          {groups.map(({ letter, entries: inGroup }) => (
            <section key={letter} aria-labelledby={`letter-${letter}`}>
              <h2
                id={`letter-${letter}`}
                className="mb-3 border-b border-rule pb-1 font-serif text-xl text-ink"
              >
                {letter}
              </h2>
              <dl className="grid max-w-(--measure) gap-5">
                {inGroup.map((entry) => (
                  <div key={entry.id} id={entry.id} className="scroll-mt-24">
                    <dt className="flex flex-wrap items-baseline gap-x-2 font-serif text-lg text-ink">
                      {entry.name}
                      <span className="font-sans text-sm text-ink-muted">{entry.otherName}</span>
                      {entry.sample ? <Badge>{t("sample")}</Badge> : null}
                    </dt>
                    <dd className="mt-1 text-base text-ink-muted">{entry.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
