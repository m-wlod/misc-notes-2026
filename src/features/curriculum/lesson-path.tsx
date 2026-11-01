"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/display";
import { CheckIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";

import { lessonHref } from "./href";
import type { LessonNode } from "./index";
import { missingPrerequisites, nodeState, type NodeState } from "./node-state";
import { useLocalProgress } from "./use-local-progress";

type LessonPathProps = {
  lessons: readonly LessonNode[];
  /** Titles of every prerequisite these lessons mention (may be in other tracks). */
  titles: Readonly<Record<string, string>>;
};

const circle: Record<NodeState | "unknown", string> = {
  unknown: "border-rule bg-bg text-ink-muted",
  locked: "border-rule-strong bg-bg text-ink-muted",
  available: "border-accent bg-bg text-accent-text",
  in_progress: "border-accent bg-sunken text-accent-text",
  done: "border-ink bg-ink text-bg",
  mastered: "border-accent bg-accent text-on-accent",
};

/**
 * A vertical path of lesson nodes (Duolingo-like, in the research-notebook style).
 * The layout is identical before and after progress is read: only colours and the
 * state label change, so there is no layout shift.
 */
export function LessonPath({ lessons, titles }: LessonPathProps) {
  const t = useTranslations("curriculum");
  const levels = useTranslations("onboarding.levels");
  const statuses = useLocalProgress();

  return (
    <ol className="relative grid gap-5">
      {lessons.map((lesson, i) => {
        const state = statuses ? nodeState(lesson.id, lesson.prerequisites, statuses) : null;
        const missing = statuses ? missingPrerequisites(lesson.prerequisites, statuses) : [];
        const names = (ids: readonly string[]) => ids.map((id) => titles[id] ?? id).join(", ");
        return (
          <li
            key={lesson.id}
            id={lesson.id}
            data-lesson={lesson.id}
            data-state={state ?? "unknown"}
            className="relative flex scroll-mt-24 items-start gap-4"
          >
            {i < lessons.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute top-11 bottom-[-1.25rem] left-5.5 w-px bg-rule-strong"
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cx(
                "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-2 num text-xs",
                circle[state ?? "unknown"],
              )}
            >
              {state === "done" ? (
                <CheckIcon className="size-4" />
              ) : state === "mastered" ? (
                "★"
              ) : (
                lesson.number.split(".").at(-1)
              )}
            </span>
            <div className="min-w-0 pt-1.5">
              <Popover>
                <PopoverTrigger className="rounded-sm text-left font-serif text-lg leading-snug text-ink underline-offset-4 hover:underline">
                  {lesson.title}
                </PopoverTrigger>
                <PopoverContent label={lesson.title} align="start" className="w-80 font-sans">
                  <p className="num text-xs text-ink-muted">
                    {t("lesson", { number: lesson.number })}
                  </p>
                  <p className="mt-1 mb-2 font-serif text-lg text-ink">{lesson.title}</p>
                  <p className="mb-3 text-ink-muted">{lesson.summary}</p>
                  <p className="mb-2 text-xs text-ink-muted">
                    {t("level", { level: lesson.level })} ·{" "}
                    {levels(`${String(lesson.level) as "1"}.name`)} ·{" "}
                    {t("minutes", { minutes: lesson.minutes })}
                  </p>
                  <p className="text-sm">
                    {lesson.prerequisites.length === 0
                      ? t("noPrerequisites")
                      : t("recommendedAfter", {
                          lessons: names(missing.length > 0 ? missing : lesson.prerequisites),
                        })}
                  </p>
                  {lesson.isStub ? (
                    <p className="mt-3 border-t border-rule pt-2 text-xs text-ink-muted">
                      {t("stubNote")}
                    </p>
                  ) : null}
                  <p className="mt-3">
                    <Link
                      href={lessonHref(lesson)}
                      className="text-sm font-semibold text-accent-text underline underline-offset-2"
                    >
                      {t("openLesson")}
                    </Link>
                  </p>
                </PopoverContent>
              </Popover>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-xs text-ink-muted">
                <span className="num">{lesson.number}</span>
                <span>{t("level", { level: lesson.level })}</span>
                <span className="num">{t("minutes", { minutes: lesson.minutes })}</span>
                {state ? <span data-testid="node-state">{t(`state.${state}`)}</span> : null}
                {lesson.isStub ? <Badge>{t("stub")}</Badge> : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
