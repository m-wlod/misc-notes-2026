"use client";

import { useTranslations } from "next-intl";

import { useLocalProgress } from "@/features/curriculum/use-local-progress";
import { Link } from "@/i18n/navigation";

import { nextLesson } from "../today";

/** The next lesson from this browser's progress (signed out; Phase 14). */
export function SignedOutNextLesson({
  lessons,
}: {
  lessons: { id: string; title: string; href: Parameters<typeof Link>[0]["href"] }[];
}) {
  const t = useTranslations("gamification.dashboard");
  const statuses = useLocalProgress();
  // Before this browser's progress is read, the first lesson (the server's guess).
  const next = nextLesson(lessons, (id) => statuses?.get(id));
  return (
    <section
      aria-label={t("nextLesson")}
      data-dashboard="next-lesson"
      className="grid content-start gap-2 rounded-md border border-rule-strong bg-surface px-5 py-4"
    >
      <h3 className="font-sans text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {t("nextLesson")}
      </h3>
      {next ? (
        <Link href={next.href} className="text-base">
          {next.title}
        </Link>
      ) : (
        <p className="font-sans text-sm text-ink-muted">{t("allLessons")}</p>
      )}
    </section>
  );
}
