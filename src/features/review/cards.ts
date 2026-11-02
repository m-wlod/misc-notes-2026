/**
 * Review cards from lessons (Phase 15): every `<Definition title="…">` and `<KeyFormula>`
 * block becomes a card, found in the lesson's MDX source at content build. Ids are
 * stable (the title's slug, the formula's position), so editing a lesson's prose doesn't
 * reset anyone's schedule. Mistake cards (`mistake:<exerciseId>`) are made at grading.
 */
export type LessonCard = {
  id: string;
  kind: "definition" | "formula";
  /** Definition: its title. Formula: empty (the page says "key formula of <lesson>"). */
  front: string;
  /** Markdown with math, rendered by the exercise text renderer. */
  back: string;
};

const PL: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => PL[c] ?? c)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Card text: no equation labels (they only make sense in the lesson), tidy line ends. */
const clean = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/\\label\{[^}]*\}/g, "")
    .trim();

export function lessonCards(lessonId: string, mdx: string): LessonCard[] {
  const cards: LessonCard[] = [];
  const blocks = /<(Definition|KeyFormula)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let formula = 0;
  const seen = new Set<string>();
  for (const m of mdx.matchAll(blocks)) {
    const [, tag, attrs = "", body = ""] = m;
    if (tag === "Definition") {
      const title = /title="([^"]+)"/.exec(attrs)?.[1]?.trim();
      if (!title) continue;
      let id = `lesson:${lessonId}:def:${slugify(title)}`;
      for (let n = 2; seen.has(id); n++)
        id = `lesson:${lessonId}:def:${slugify(title)}-${String(n)}`;
      seen.add(id);
      cards.push({ id, kind: "definition", front: title, back: clean(body) });
    } else {
      formula += 1;
      cards.push({
        id: `lesson:${lessonId}:formula:${String(formula)}`,
        kind: "formula",
        front: "",
        back: clean(body),
      });
    }
  }
  return cards;
}

export const mistakeCardId = (exerciseId: string) => `mistake:${exerciseId}`;
export const exerciseOfCard = (cardId: string) =>
  cardId.startsWith("mistake:") ? cardId.slice("mistake:".length) : null;
export const lessonOfCard = (cardId: string) => /^lesson:([a-z0-9-]+):/.exec(cardId)?.[1] ?? null;
