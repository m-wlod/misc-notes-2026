import { describe, expect, it } from "vitest";

import { memoryLimiter } from "@/features/exercises/rate-limit";
import { answer, finish, scorecard, startSession, tick } from "@/features/interview/session";

import { buildSession, newCard, rate } from "./schedule";

/** Edge cases of review scheduling, rate limits and interview sessions (Phase 20). */
describe("review schedule: edges", () => {
  const now = new Date("2026-03-01T10:00:00Z");

  it("an unknown stored state is read as a new card", () => {
    const row = { ...newCard("c", now), state: 99 };
    const next = rate(row, "good", now);
    expect(next.reps).toBe(1);
    expect(Date.parse(next.due)).toBeGreaterThan(now.getTime());
  });

  it("elapsed days count from the last review", () => {
    const first = rate(newCard("c", now), "good", now);
    const later = new Date(now.getTime() + 3 * 86_400_000);
    expect(rate(first, "good", later).elapsed_days).toBe(3);
  });

  it("mistakes first, then the most overdue, then by id; capped", () => {
    const due = (id: string, iso: string) => ({ ...newCard(id, new Date(iso)) });
    const rows = [
      due("b", "2026-02-01T00:00:00Z"),
      due("a", "2026-02-01T00:00:00Z"),
      due("mistake:x", "2026-02-20T00:00:00Z"),
      due("future", "2026-04-01T00:00:00Z"),
    ];
    expect(buildSession(rows, now).map((r) => r.card_id)).toEqual(["mistake:x", "a", "b"]);
    expect(buildSession(rows, now, 1)).toHaveLength(1);
  });
});

describe("memory rate limiter: edges", () => {
  it("forgets idle keys once the map grows large", () => {
    const limiter = memoryLimiter({ limit: 1, windowMs: 1000 });
    for (let i = 0; i <= 10_000; i++) void limiter.hit(`k${String(i)}`, 0);
    // All of those are outside the window by now; the sweep keeps the map bounded.
    expect(limiter.hit("fresh", 5000)).toBe(true);
    expect(limiter.hit("k0", 5000)).toBe(true);
    expect(limiter.hit("k0", 5001)).toBe(false);
  });
});

describe("interview session: edges", () => {
  const base = { kind: "mental_math" as const, level: 1, seed: 1, durationMs: 1000, now: 0 };

  it("an empty session is finished from the start and scores zero", () => {
    const s = startSession({ ...base, questions: [] });
    expect(s.status).toBe("finished");
    expect(scorecard(s).score).toBe(0);
  });

  it("an answer after the deadline is not recorded; finishing twice changes nothing", () => {
    const s = startSession({ ...base, questions: [1, 2] });
    const late = answer(s, { questionId: "q", topic: "t", score: 1, given: "1" }, 2000);
    expect(late.answers).toHaveLength(0);
    expect(late.finishedAt).toBe(1000);
    expect(finish(late, 3000)).toBe(late);
    expect(tick(late, 5000)).toBe(late);
  });

  it("topics answered twice below 70% are listed for review, worst first", () => {
    let s = startSession({ ...base, questions: [1, 2, 3, 4, 5] });
    const rec = (topic: string, score: number) => ({ questionId: topic, topic, score, given: "" });
    s = answer(s, rec("a", 0.5), 10);
    s = answer(s, rec("a", 0.5), 20);
    s = answer(s, rec("b", 0), 30);
    s = answer(s, rec("b", 0), 40);
    s = answer(s, rec("c", 0), 50);
    expect(scorecard(s).review).toEqual(["b", "a"]);
  });
});
