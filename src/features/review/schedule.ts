import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";

/**
 * Spaced review (Phase 15): FSRS via ts-fsrs, behind a small wrapper that speaks our
 * `review_cards` rows. Day-based scheduling (no same-day learning steps: one short daily
 * session is the habit we want) and no fuzz, so schedules are reproducible and testable.
 */
export type CardRow = {
  card_id: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
};

export const GRADES = ["again", "hard", "good", "easy"] as const;
export type GradeName = (typeof GRADES)[number];
const GRADE: Record<GradeName, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const scheduler = fsrs({
  enable_fuzz: false,
  enable_short_term: false,
  request_retention: 0.9,
  maximum_interval: 365,
});

const DAY = 86_400_000;

const STATES = [State.New, State.Learning, State.Review, State.Relearning] as const;

function toCard(row: CardRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    // ts-fsrs 5 still requires this field (6 drops it); we store our own value anyway.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: 0,
    reps: row.reps,
    lapses: row.lapses,
    state: STATES[row.state] ?? State.New,
    ...(row.last_review ? { last_review: new Date(row.last_review) } : {}),
  };
}

function toRow(cardId: string, card: Card, elapsedDays: number): CardRow {
  return {
    card_id: cardId,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

/** A new card, due now. */
export function newCard(cardId: string, now: Date): CardRow {
  return toRow(cardId, createEmptyCard(now), 0);
}

/** The row after rating a review now. */
export function rate(row: CardRow, grade: GradeName, now: Date): CardRow {
  const { card } = scheduler.next(toCard(row), now, GRADE[grade]);
  const elapsed = row.last_review
    ? Math.max(0, Math.floor((now.getTime() - Date.parse(row.last_review)) / DAY))
    : 0;
  return toRow(row.card_id, card, elapsed);
}

/** When each answer would bring the card back (shown on the buttons). */
export function preview(row: CardRow, now: Date): Record<GradeName, Date> {
  return Object.fromEntries(GRADES.map((g) => [g, new Date(rate(row, g, now).due)])) as Record<
    GradeName,
    Date
  >;
}

export const isMistake = (cardId: string) => cardId.startsWith("mistake:");

/**
 * Today's session: due cards, mistakes first (they are what went wrong), then the most
 * overdue; capped so a session stays about 5–10 minutes.
 */
export function buildSession(rows: readonly CardRow[], now: Date, limit = 20): CardRow[] {
  return rows
    .filter((r) => Date.parse(r.due) <= now.getTime())
    .sort(
      (a, b) =>
        Number(isMistake(b.card_id)) - Number(isMistake(a.card_id)) ||
        Date.parse(a.due) - Date.parse(b.due) ||
        (a.card_id < b.card_id ? -1 : 1),
    )
    .slice(0, limit);
}

export const dueCount = (rows: readonly CardRow[], now: Date) =>
  rows.filter((r) => Date.parse(r.due) <= now.getTime()).length;
