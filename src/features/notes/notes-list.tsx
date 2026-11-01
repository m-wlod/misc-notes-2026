"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/display";

import { useNotes } from "./use-notes";

export type LessonIndex = Record<string, { title: string; href: string; context: string }>;

/** Every lesson with a note, highlights or a bookmark in this browser, newest first. */
export function NotesList({ lessons }: { lessons: LessonIndex }) {
  const t = useTranslations("notes.page");
  const notes = useNotes();
  if (notes === null) return <div className="min-h-24" />;
  const entries = Object.entries(notes.lessons)
    .filter(([id]) => id in lessons)
    .sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt));

  if (entries.length === 0) return <p className="max-w-(--measure) text-base">{t("empty")}</p>;
  return (
    <ul className="grid max-w-(--measure) gap-8">
      {entries.map(([id, entry]) => {
        const lesson = lessons[id];
        if (!lesson) return null;
        return (
          <li key={id} data-lesson={id} className="border-b border-rule pb-6">
            <p className="font-sans text-xs text-ink-muted">{lesson.context}</p>
            <h2 className="mb-2 text-xl">
              <a href={lesson.href} className="underline-offset-4 hover:underline">
                {lesson.title}
              </a>
            </h2>
            <p className="mb-3 flex flex-wrap gap-2 font-sans text-xs text-ink-muted">
              {entry.bookmarked ? <Badge>★ {t("bookmarked")}</Badge> : null}
              {entry.highlights.length > 0 ? (
                <span>{t("highlightCount", { count: entry.highlights.length })}</span>
              ) : null}
            </p>
            {entry.note.trim() ? (
              <p className="mb-3 font-serif text-base whitespace-pre-wrap text-ink">{entry.note}</p>
            ) : null}
            {entry.highlights.length > 0 ? (
              <ul className="grid gap-1.5">
                {entry.highlights.map((h) => (
                  <li
                    key={h.id}
                    className="border-l-2 border-accent pl-3 font-serif text-base text-ink"
                  >
                    <q>{h.exact}</q>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
