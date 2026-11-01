"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";

import { withBookmark, withNote, withoutHighlight } from "./storage";
import { saveNotes, useNotes } from "./use-notes";

/** Bookmark toggle for a lesson (stored in this browser). */
export function BookmarkButton({ lessonId }: { lessonId: string }) {
  const t = useTranslations("notes");
  const notes = useNotes();
  const on = notes?.lessons[lessonId]?.bookmarked === true;
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-pressed={on}
      disabled={notes === null}
      onClick={() => {
        saveNotes((raw) => withBookmark(raw, lessonId, !on, new Date()));
      }}
      className={cx("print:hidden", on && "bg-sunken")}
    >
      <span aria-hidden="true" className="mr-1.5">
        {on ? "★" : "☆"}
      </span>
      {on ? t("unbookmark") : t("bookmark")}
    </Button>
  );
}

/** The lesson's personal note (autosaved) and its highlights. */
export function LessonNotes({ lessonId }: { lessonId: string }) {
  const t = useTranslations("notes");
  const notes = useNotes();
  const entry = notes?.lessons[lessonId];
  const noteId = useId();

  return (
    <section
      aria-labelledby={`${noteId}-title`}
      className="mt-12 max-w-(--measure) border-t border-rule pt-6 font-sans print:hidden"
    >
      <h2 id={`${noteId}-title`} className="mb-4 font-sans text-lg font-semibold text-ink">
        {t("title")}
      </h2>
      <label htmlFor={noteId} className="mb-1.5 block text-sm text-ink">
        {t("noteLabel")}
      </label>
      <textarea
        id={noteId}
        rows={4}
        disabled={notes === null}
        value={entry?.note ?? ""}
        placeholder={t("notePlaceholder")}
        onChange={(e) => {
          const value = e.target.value;
          saveNotes((raw) => withNote(raw, lessonId, value, new Date()));
        }}
        className="w-full rounded border border-rule-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-muted"
      />
      <p className="mt-1 text-xs text-ink-muted">{t("saved")}</p>

      <h3 className="mt-6 mb-2 text-sm font-semibold text-ink">{t("highlights")}</h3>
      {entry && entry.highlights.length > 0 ? (
        <ul className="grid gap-2">
          {entry.highlights.map((h) => (
            <li key={h.id} className="flex items-start gap-3 border-l-2 border-accent pl-3">
              <q className="flex-1 font-serif text-base text-ink">{h.exact}</q>
              <button
                type="button"
                aria-label={t("removeHighlight", { text: h.exact.slice(0, 60) })}
                onClick={() => {
                  saveNotes((raw) => withoutHighlight(raw, lessonId, h.id, new Date()));
                }}
                className="rounded-sm px-1 text-ink-muted hover:text-ink"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">{t("noHighlights")}</p>
      )}
    </section>
  );
}
