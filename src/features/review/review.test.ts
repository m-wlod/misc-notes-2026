import { describe, expect, it } from "vitest";

import { exerciseOfCard, lessonCards, lessonOfCard, mistakeCardId, slugify } from "./cards";
import { buildSession, dueCount, newCard, preview, rate, type CardRow } from "./schedule";

const DAY = 86_400_000;
const t0 = new Date("2026-11-02T18:00:00Z");
const days = (row: CardRow, from: Date) => (Date.parse(row.due) - from.getTime()) / DAY;

describe("FSRS scheduling", () => {
  it("a new card is due now; Again < Hard < Good < Easy", () => {
    const card = newCard("c", t0);
    expect(Date.parse(card.due)).toBe(t0.getTime());
    expect(card).toMatchObject({ reps: 0, lapses: 0, state: 0 });
    const p = preview(card, t0);
    expect(p.again.getTime()).toBeLessThanOrEqual(p.hard.getTime());
    expect(p.hard.getTime()).toBeLessThan(p.good.getTime());
    expect(p.good.getTime()).toBeLessThan(p.easy.getTime());
  });

  it("intervals grow with successive Good answers, reviewed when due", () => {
    let card = newCard("c", t0);
    let now = t0;
    const intervals: number[] = [];
    for (let i = 0; i < 6; i++) {
      card = rate(card, "good", now);
      intervals.push(days(card, now));
      now = new Date(card.due);
    }
    // Strictly growing until the 365-day cap, never shrinking after it.
    for (let i = 1; i < intervals.length; i++) {
      const prev = intervals[i - 1] ?? 0;
      if (prev < 365) expect(intervals[i]).toBeGreaterThan(prev);
      else expect(intervals[i]).toBeGreaterThanOrEqual(prev);
    }
    expect(card.reps).toBe(6);
    expect(Math.max(...intervals)).toBeLessThanOrEqual(366); // the cap, plus day rounding
  });

  it("a lapse counts and brings the card back sooner than the last interval", () => {
    let card = newCard("c", t0);
    let now = t0;
    let before = 0;
    for (let i = 0; i < 4; i++) {
      card = rate(card, "good", now);
      before = days(card, now);
      now = new Date(card.due);
    }
    const lapsed = rate(card, "again", now);
    expect(lapsed.lapses).toBe(1);
    expect(days(lapsed, now)).toBeLessThan(before);
    expect(lapsed.last_review).toBe(now.toISOString());
    expect(lapsed.elapsed_days).toBeGreaterThan(0);
  });

  it("is deterministic (no fuzz) and the row keeps every column", () => {
    const a = rate(newCard("x", t0), "good", t0);
    const b = rate(newCard("x", t0), "good", t0);
    expect(a).toEqual(b);
    expect(Object.keys(a).sort()).toEqual(
      [
        "card_id",
        "difficulty",
        "due",
        "elapsed_days",
        "lapses",
        "last_review",
        "reps",
        "scheduled_days",
        "stability",
        "state",
      ].sort(),
    );
  });

  it("schedules by instants, so a DST change doesn't move a due date by a day", () => {
    // Reviewed Saturday before the October change; a 1-day interval stays 24 h.
    const sat = new Date("2026-10-24T18:00:00Z");
    const card = rate(newCard("c", sat), "good", sat);
    expect(Number.isInteger(days(card, sat))).toBe(true);
  });
});

describe("sessions", () => {
  const row = (id: string, dueIso: string): CardRow => ({ ...newCard(id, t0), due: dueIso });

  it("due cards only, mistakes first, then most overdue, capped", () => {
    const rows = [
      row("lesson:a:def:x", "2026-11-01T00:00:00Z"),
      row("lesson:a:formula:1", "2026-10-30T00:00:00Z"),
      row("mistake:e1", "2026-11-02T10:00:00Z"),
      row("lesson:b:def:y", "2026-11-05T00:00:00Z"), // not due
    ];
    expect(buildSession(rows, t0).map((r) => r.card_id)).toEqual([
      "mistake:e1",
      "lesson:a:formula:1",
      "lesson:a:def:x",
    ]);
    expect(buildSession(rows, t0, 2)).toHaveLength(2);
    expect(dueCount(rows, t0)).toBe(3);
  });
});

describe("cards from lessons", () => {
  const mdx = `
Intro.

<Definition title="Wartość oczekiwana">
Średnia ważona: $E[X] = \\sum p_i x_i$.
</Definition>

<KeyFormula>
$$
\\sigma^2 = E[X^2] - E[X]^2
$$
</KeyFormula>

<Definition title="Wartość oczekiwana">Druga definicja o tym samym tytule.</Definition>
<Definition>Bez tytułu: pominięta.</Definition>
<KeyFormula>$a = b$</KeyFormula>
`;

  it("finds definitions and key formulas with stable ids", () => {
    const cards = lessonCards("ev", mdx);
    expect(cards.map((c) => c.id)).toEqual([
      "lesson:ev:def:wartosc-oczekiwana",
      "lesson:ev:formula:1",
      "lesson:ev:def:wartosc-oczekiwana-2",
      "lesson:ev:formula:2",
    ]);
    expect(cards[0]).toMatchObject({ kind: "definition", front: "Wartość oczekiwana" });
    expect(cards[0]?.back).toContain("$E[X] = \\sum p_i x_i$");
    expect(cards[1]?.back).toContain("\\sigma^2");
    expect(lessonCards("x", "No blocks here.")).toEqual([]);
  });

  it("slugs and ids", () => {
    expect(slugify("Łączna zmienność, σ!")).toBe("laczna-zmiennosc");
    expect(mistakeCardId("ev-coin")).toBe("mistake:ev-coin");
    expect(exerciseOfCard("mistake:ev-coin")).toBe("ev-coin");
    expect(exerciseOfCard("lesson:a:def:b")).toBeNull();
    expect(lessonOfCard("lesson:ev:formula:1")).toBe("ev");
  });
});
