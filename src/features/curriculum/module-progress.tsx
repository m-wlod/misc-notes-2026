"use client";

import { useTranslations } from "next-intl";

import { Progress } from "@/components/ui/display";

import { finishedCount } from "./node-state";
import { useLocalProgress } from "./use-local-progress";

/** "Ukończone: 2 z 6" with a bar. Space is reserved until progress is read (no layout shift). */
export function ModuleProgress({ lessonIds }: { lessonIds: readonly string[] }) {
  const t = useTranslations("curriculum");
  const statuses = useLocalProgress();
  const done = statuses ? finishedCount(lessonIds, statuses) : 0;
  const label = t("progress", { done, total: lessonIds.length });
  return (
    <div className="mt-4 grid max-w-xs gap-1.5">
      <p className="min-h-4 font-sans text-xs text-ink-muted" data-testid="unit-progress">
        {statuses ? label : null}
      </p>
      <Progress value={done} max={lessonIds.length} aria-label={label} />
    </div>
  );
}
