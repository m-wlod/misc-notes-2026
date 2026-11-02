"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";

import type { SessionKind } from "./session";
import { bestKey } from "./store";
import { useInterview } from "./use-interview";

/** Level picker (1–5) with the personal best for the chosen level, and the rules. */
export function LevelSetup({
  kind,
  rules,
  onStart,
}: {
  kind: SessionKind;
  rules: string;
  onStart: (level: number) => void;
}) {
  const t = useTranslations("interview.setup");
  const id = useId();
  const [level, setLevel] = useState(4);
  const best = useInterview()?.best[bestKey(kind, level)];
  return (
    <form
      className="grid max-w-(--measure) gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onStart(level);
      }}
    >
      <p className="text-base text-ink">{rules}</p>
      <fieldset>
        <legend className="mb-2 font-sans text-sm text-ink">{t("level")}</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((l) => (
            <label
              key={l}
              className="flex cursor-pointer items-center gap-2 rounded border border-rule-strong px-3 py-1.5 text-sm has-checked:border-ink has-checked:bg-sunken"
            >
              <input
                type="radio"
                name={`${id}-level`}
                value={l}
                checked={level === l}
                onChange={() => {
                  setLevel(l);
                }}
                className="accent-(--accent)"
              />
              {t("levelN", { level: l })}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="min-h-5 num font-sans text-sm text-ink-muted">
        {best === undefined ? "" : t("best", { percent: Math.round(best * 100) })}
      </p>
      <div>
        <Button type="submit">{t("start")}</Button>
      </div>
    </form>
  );
}
