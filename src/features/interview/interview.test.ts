import { describe, expect, it } from "vitest";

import {
  generateRounds,
  mean,
  scenario,
  SCENARIO_IDS,
  sd,
  settleQuote,
  type Round,
} from "./market-making";
import { checkMental, generateMentalMath, LEVEL_TOPICS, MENTAL_MATH } from "./mental-math";
import { answer, finish, remainingMs, scorecard, startSession, tick } from "./session";
import { emptyInterview, entryFrom, MAX_SESSIONS, parseInterview, withSession } from "./store";

const T0 = 1_000_000;

describe("session", () => {
  const start = (n = 3, durationMs = 60_000) =>
    startSession({
      kind: "mental_math",
      level: 1,
      seed: 1,
      questions: Array.from({ length: n }, (_, i) => i),
      durationMs,
      now: T0,
    });

  it("moves forward one question at a time and finishes after the last", () => {
    let s = start();
    s = answer(s, { questionId: "0", given: "1", score: 1, topic: "add" }, T0 + 2000);
    expect(s).toMatchObject({ index: 1, status: "running", shownAt: T0 + 2000 });
    s = answer(s, { questionId: "1", given: "x", score: 0, topic: "add" }, T0 + 3000);
    s = answer(s, { questionId: "2", given: "3", score: 1, topic: "mul" }, T0 + 7000);
    expect(s).toMatchObject({ index: 3, status: "finished", finishedAt: T0 + 7000 });
    expect(s.answers.map((a) => a.ms)).toEqual([2000, 1000, 4000]);
    // No going back and nothing after the end.
    expect(answer(s, { questionId: "x", given: "", score: 1, topic: "add" }, T0 + 8000)).toBe(s);
  });

  it("ends at the deadline, even if the tab slept past it", () => {
    const s = start(80, 8 * 60_000);
    expect(remainingMs(s, T0 + 60_000)).toBe(7 * 60_000);
    expect(tick(s, T0 + 1000)).toBe(s);
    const late = answer(
      s,
      { questionId: "0", given: "1", score: 1, topic: "add" },
      T0 + 9 * 60_000,
    );
    expect(late).toMatchObject({ status: "finished", finishedAt: T0 + 8 * 60_000, answers: [] });
    expect(remainingMs(late, T0)).toBe(0);
  });

  it("scores the whole session, with unanswered questions as missed", () => {
    let s = start(4);
    s = answer(s, { questionId: "0", given: "", score: 1, topic: "add" }, T0 + 1000);
    s = answer(s, { questionId: "1", given: "", score: 0, topic: "mul" }, T0 + 3000);
    s = answer(s, { questionId: "2", given: "", score: 0, topic: "mul" }, T0 + 6000);
    s = finish(s, T0 + 10_000);
    expect(scorecard(s)).toEqual({
      score: 0.25,
      correct: 1,
      answered: 3,
      total: 4,
      accuracy: 1 / 3,
      avgMs: 2000,
      durationMs: 10_000,
      review: ["mul"],
    });
  });
});

describe("mental math", () => {
  it("is deterministic per seed and has the right size", () => {
    const a = generateMentalMath(3, 42);
    expect(a).toHaveLength(MENTAL_MATH.count);
    expect(generateMentalMath(3, 42)).toEqual(a);
    expect(generateMentalMath(3, 43)).not.toEqual(a);
  });

  it("only uses the level's topics, with correct answers and whole divisions", () => {
    for (const level of [1, 2, 3, 4, 5]) {
      for (const q of generateMentalMath(level, level * 7, 400)) {
        expect(LEVEL_TOPICS[level]).toContain(q.topic);
        const expected =
          q.op === "+"
            ? q.a + q.b
            : q.op === "−"
              ? q.a - q.b
              : q.op === "×"
                ? q.a * q.b
                : q.op === "÷"
                  ? q.a / q.b
                  : q.op === "%"
                    ? (q.a / 100) * q.b
                    : q.a / q.b;
        expect(q.answer).toBeCloseTo(expected, 9);
        if (q.op === "÷") expect(Number.isInteger(q.answer)).toBe(true);
        if (level <= 2 && q.op === "−") expect(q.answer).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("reads answers like the rest of the app", () => {
    const q = { id: "x", a: 1, op: "/" as const, b: 8, answer: 0.125, topic: "frac" as const };
    for (const ok of ["0,125", "0.125", "1/8", "12,5%"]) expect(checkMental(ok, q)).toBe(true);
    for (const bad of ["0,12", "", "abc"]) expect(checkMental(bad, q)).toBe(false);
  });
});

describe("market making", () => {
  it("has exact distributions (probabilities sum to 1, known means)", () => {
    for (const id of SCENARIO_IDS) {
      const s = scenario(id);
      expect(s.dist.reduce((a, x) => a + x.p, 0)).toBeCloseTo(1, 12);
    }
    expect(scenario("three-dice").ev).toBeCloseTo(10.5, 12);
    expect(scenario("three-dice").sd).toBeCloseTo(Math.sqrt(35 / 4), 12);
    expect(scenario("ten-coins").ev).toBeCloseTo(5, 12);
    expect(scenario("ten-coins").sd).toBeCloseTo(Math.sqrt(2.5), 12);
    expect(scenario("max-two-dice").ev).toBeCloseTo(161 / 36, 12);
    expect(scenario("two-cards").ev).toBeCloseTo(11, 12);
    expect(mean([{ value: 2, p: 1 }])).toBe(2);
    expect(sd([{ value: 2, p: 1 }])).toBe(0);
  });

  it("generates seeded rounds with possible values", () => {
    const rounds = generateRounds(9);
    expect(generateRounds(9)).toEqual(rounds);
    for (const r of rounds) {
      expect(scenario(r.scenario).dist.map((x) => x.value)).toContain(r.value);
    }
  });

  const round: Round = { id: "r", scenario: "three-dice", value: 14, traderView: 13 };

  it("trades against the quote and books the P&L", () => {
    // Trader thinks 13: above an ask of 12, so they buy from you at 12; truth 14 → −2.
    expect(settleQuote(round, 9, 12)).toMatchObject({ trade: "buy", pnl: -2 });
    // Below a bid of 14 → they sell to you at 14; truth 14 → 0.
    expect(settleQuote(round, 14, 16)).toMatchObject({ trade: "sell", pnl: 0 });
    expect(settleQuote(round, 10, 15)).toMatchObject({ trade: "none", pnl: 0 });
  });

  it("scores the quote, not the luck", () => {
    const s = scenario("three-dice"); // ev 10.5, sd ≈ 2.96
    expect(settleQuote(round, 10, 11)).toMatchObject({ evInside: true, score: 1 });
    const wide = settleQuote(round, 3, 18);
    expect(wide).toMatchObject({ evInside: true, score: 0.5 });
    const off = settleQuote(round, 12, 13);
    expect(off).toMatchObject({ evInside: false, score: 0 });
    expect(s.sd).toBeGreaterThan(2.9);
  });

  it("refuses crossed or empty quotes", () => {
    expect(settleQuote(round, 11, 10)).toEqual({ ok: false, reason: "crossed" });
    expect(settleQuote(round, 10, 10)).toEqual({ ok: false, reason: "crossed" });
    expect(settleQuote(round, Number.NaN, 10)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("store", () => {
  const card = {
    score: 0.5,
    correct: 40,
    answered: 60,
    total: 80,
    accuracy: 0.66,
    avgMs: 4000.4,
    durationMs: 480_000,
    review: ["mul"],
  };
  const at = new Date("2026-11-02T10:00:00Z");

  it("keeps sessions and a personal best per kind and level", () => {
    let out = withSession(null, entryFrom("a", "mental_math", 3, card, at));
    expect(out.personalBest).toBe(true);
    out = withSession(out.raw, entryFrom("b", "mental_math", 3, { ...card, score: 0.4 }, at));
    expect(out.personalBest).toBe(false);
    out = withSession(out.raw, entryFrom("c", "mental_math", 3, { ...card, score: 0.7 }, at));
    expect(out.personalBest).toBe(true);
    const state = parseInterview(out.raw);
    expect(state.sessions.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(state.best).toEqual({ "mental_math:3": 0.7 });
    expect(state.sessions[0]?.avgMs).toBe(4000);
    // The same session saved twice (a double click) is stored once.
    expect(
      parseInterview(withSession(out.raw, entryFrom("c", "mental_math", 3, card, at)).raw).sessions,
    ).toHaveLength(3);
  });

  it("caps the list but keeps the best, and survives bad data", () => {
    let raw: string | null = null;
    for (let i = 0; i < MAX_SESSIONS + 5; i++) {
      raw = withSession(
        raw,
        entryFrom(`s${String(i)}`, "market_making", 2, { ...card, score: i === 0 ? 1 : 0.1 }, at),
      ).raw;
    }
    const state = parseInterview(raw);
    expect(state.sessions).toHaveLength(MAX_SESSIONS);
    expect(state.best["market_making:2"]).toBe(1);
    expect(parseInterview("{oops")).toEqual(emptyInterview());
    expect(parseInterview(JSON.stringify({ version: 2 }))).toEqual(emptyInterview());
  });
});
