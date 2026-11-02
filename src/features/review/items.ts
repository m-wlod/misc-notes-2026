import "server-only";

import { lessons } from "#content";
import { allExercises } from "@/features/exercises/data";
import { exerciseHtml, renderText } from "@/features/exercises/render-text";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

import { exerciseOfCard, lessonOfCard } from "./cards";
import type { ReviewItem } from "./review-session";
import { buildSession, preview, type CardRow } from "./schedule";

/** Turns due rows into what the session shows (Phase 15). Unknown cards are skipped. */
export function sessionItems(
  rows: readonly CardRow[],
  now: Date,
  locale: Locale,
  formulaFront: (lesson: string) => string,
  mistakeSource: string,
): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const row of buildSession(rows, now)) {
    const next = Object.fromEntries(
      Object.entries(preview(row, now)).map(([g, d]) => [g, d.toISOString()]),
    ) as ReviewItem["next"];
    const exerciseId = exerciseOfCard(row.card_id);
    if (exerciseId) {
      const ex = allExercises().find((e) => e.id === exerciseId);
      if (!ex) continue;
      const prompt = locale === "en" ? (ex.prompt.en ?? ex.prompt.pl) : ex.prompt.pl;
      items.push({
        cardId: row.card_id,
        kind: "mistake",
        source: mistakeSource,
        frontHtml: exerciseHtml(prompt, ex.params, locale),
        backHtml: "",
        href: getPathname({
          href: { pathname: "/practice/[exercise]", params: { exercise: ex.id } },
          locale,
        }),
        next,
      });
      continue;
    }
    const lessonId = lessonOfCard(row.card_id);
    const lesson =
      lessons.find((l) => l.id === lessonId && l.locale === locale) ??
      lessons.find((l) => l.id === lessonId && l.locale === "pl");
    const card = lessons
      .find((l) => l.id === lessonId && l.locale === "pl")
      ?.reviewCards.find((c) => c.id === row.card_id);
    if (!lesson || !card) continue;
    items.push({
      cardId: row.card_id,
      kind: card.kind,
      source: lesson.title,
      frontHtml: renderText(card.kind === "formula" ? formulaFront(lesson.title) : card.front),
      backHtml: renderText(card.back),
      href: null,
      next,
    });
  }
  return items;
}
