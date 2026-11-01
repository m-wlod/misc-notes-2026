import { z } from "zod/mini";

/**
 * Personal notes, highlights and bookmarks, kept in this browser until accounts exist
 * (then synced to lesson_notes / highlights / bookmarks, which already exist with RLS).
 * Pure functions over the raw stored string, so they are unit-tested without a DOM.
 */
export const NOTES_KEY = "qla:notes:v1";

const quote = z.object({
  exact: z.string().check(z.minLength(1), z.maxLength(2000)),
  prefix: z.string().check(z.maxLength(64)),
  suffix: z.string().check(z.maxLength(64)),
});
export type TextQuote = z.infer<typeof quote>;

const highlight = z.extend(quote, {
  id: z.string().check(z.minLength(1), z.maxLength(64)),
  createdAt: z.iso.datetime(),
});
export type Highlight = z.infer<typeof highlight>;

const lessonNotes = z.object({
  note: z._default(z.string().check(z.maxLength(20_000)), ""),
  bookmarked: z._default(z.boolean(), false),
  highlights: z._default(z.array(highlight).check(z.maxLength(500)), []),
  updatedAt: z.iso.datetime(),
});
export type LessonNotes = z.infer<typeof lessonNotes>;

export const notesSchema = z.object({
  version: z.literal(1),
  lessons: z.record(z.string().check(z.maxLength(120)), lessonNotes),
});
export type NotesState = z.infer<typeof notesSchema>;

export function parseNotes(raw: string | null): NotesState {
  if (!raw) return { version: 1, lessons: {} };
  try {
    const parsed = notesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : { version: 1, lessons: {} };
  } catch {
    return { version: 1, lessons: {} };
  }
}

const blank = (now: Date): LessonNotes => ({
  note: "",
  bookmarked: false,
  highlights: [],
  updatedAt: now.toISOString(),
});

/** Apply a change to one lesson; lessons left with nothing are dropped. */
function update(
  raw: string | null,
  lessonId: string,
  now: Date,
  change: (entry: LessonNotes) => LessonNotes,
): string {
  const state = parseNotes(raw);
  const next = { ...change(state.lessons[lessonId] ?? blank(now)), updatedAt: now.toISOString() };
  if (!next.note.trim() && !next.bookmarked && next.highlights.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- keyed by lesson id
    delete state.lessons[lessonId];
  } else {
    state.lessons[lessonId] = next;
  }
  return JSON.stringify(state);
}

export const withNote = (raw: string | null, id: string, note: string, now: Date) =>
  update(raw, id, now, (e) => ({ ...e, note: note.slice(0, 20_000) }));

export const withBookmark = (raw: string | null, id: string, bookmarked: boolean, now: Date) =>
  update(raw, id, now, (e) => ({ ...e, bookmarked }));

export const withHighlight = (
  raw: string | null,
  id: string,
  h: TextQuote & { id: string },
  now: Date,
) =>
  update(raw, id, now, (e) =>
    e.highlights.some((x) => x.exact === h.exact && x.prefix === h.prefix)
      ? e
      : { ...e, highlights: [...e.highlights, { ...h, createdAt: now.toISOString() }] },
  );

export const withoutHighlight = (raw: string | null, id: string, highlightId: string, now: Date) =>
  update(raw, id, now, (e) => ({
    ...e,
    highlights: e.highlights.filter((h) => h.id !== highlightId),
  }));

/* ---------- text-quote anchoring (W3C Web Annotation "TextQuoteSelector") ---------- */

const CONTEXT = 32;

/** Describe [start, end) of `text` by its words and some context on each side. */
export function quoteAt(text: string, start: number, end: number): TextQuote {
  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
  };
}

/**
 * Where a quote is in `text`, or -1. Among several occurrences, the one whose
 * surroundings match the stored context best wins, so a highlight survives edits
 * elsewhere in the lesson and picks the right copy of a repeated phrase.
 */
export function findQuote(text: string, q: TextQuote): number {
  let best = -1;
  let bestScore = -1;
  for (let i = text.indexOf(q.exact); i !== -1; i = text.indexOf(q.exact, i + 1)) {
    const before = text.slice(Math.max(0, i - q.prefix.length), i);
    const after = text.slice(i + q.exact.length, i + q.exact.length + q.suffix.length);
    const score = commonSuffix(before, q.prefix) + commonPrefix(after, q.suffix);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}
function commonSuffix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}
