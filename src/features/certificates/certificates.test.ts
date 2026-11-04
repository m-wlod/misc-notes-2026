import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  bestScores,
  eligible,
  isCertificateId,
  mastery,
  solvedBeforeReveal,
  MIN_MASTERY,
  trackProgress,
} from "./eligibility";
import { certificatePdf } from "./pdf";

describe("certificate eligibility", () => {
  const lessons = ["a", "b", "c"];
  const ex = ["e1", "e2"];

  it("needs every lesson and enough mastery (best score per exercise, untried = 0)", () => {
    const best = bestScores([
      { exercise_id: "e1", score: 0.5 },
      { exercise_id: "e1", score: 1 },
      { exercise_id: "e2", score: 0.6 },
    ]);
    expect(best.get("e1")).toBe(1);
    expect(mastery(ex, best)).toBeCloseTo(0.8);
    const done = new Set(lessons);
    expect(eligible(trackProgress(lessons, done, ex, best))).toBe(true);
    expect(eligible(trackProgress(lessons, new Set(["a", "b"]), ex, best))).toBe(false);
    const weaker = bestScores([
      { exercise_id: "e1", score: 1 },
      { exercise_id: "e2", score: 0.59 },
    ]);
    expect(eligible(trackProgress(lessons, done, ex, weaker))).toBe(false);
    // An exercise never tried counts as zero.
    expect(mastery(ex, bestScores([{ exercise_id: "e1", score: 1 }]))).toBe(0.5);
  });

  it("a track without exercises needs the lessons only; an empty track never", () => {
    expect(eligible(trackProgress(lessons, new Set(lessons), [], new Map()))).toBe(true);
    expect(trackProgress(lessons, new Set(lessons), [], new Map()).mastery).toBeNull();
    expect(eligible(trackProgress([], new Set(), [], new Map()))).toBe(false);
    expect(MIN_MASTERY).toBe(0.8);
  });

  it("ids must be UUIDs before they reach the database", () => {
    expect(isCertificateId("0b9e7c1e-1d2a-4f5b-9c8d-1234567890ab")).toBe(true);
    expect(isCertificateId("not-a-uuid")).toBe(false);
    expect(isCertificateId("0b9e7c1e-1d2a-4f5b-9c8d-1234567890ab' or 1=1")).toBe(false);
  });
});

describe("certificate PDF", () => {
  it("is a one-page A4 landscape PDF with Polish text", async () => {
    const bytes = await certificatePdf({
      heading: "Certyfikat ukończenia",
      name: "Zażółć Gęślą-Jaźń",
      completed: "ukończył(a) ścieżkę",
      track: "Prawdopodobieństwo i statystyka",
      date: "2 listopada 2026",
      verifyLabel: "Weryfikacja",
      verifyUrl: "https://example.test/pl/verify/0b9e7c1e-1d2a-4f5b-9c8d-1234567890ab",
      disclaimer: "Nie jest kwalifikacją zawodową.",
      site: "APP",
    });
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([842, 595]);
    expect(doc.getTitle()).toBe("Certyfikat ukończenia: Prawdopodobieństwo i statystyka");
  });
});

describe("solves after a reveal don't count (Phase 21c)", () => {
  it("keeps attempts made before the exercise's first reveal, drops the rest", () => {
    const rows = [
      { exercise_id: "a", score: 1, answer: { kind: "text", value: "5" } },
      { exercise_id: "b", score: 0, answer: { revealed: true } },
      { exercise_id: "b", score: 1, answer: { kind: "text", value: "7" } },
      { exercise_id: "a", score: 0, answer: { revealed: true } },
      { exercise_id: "a", score: 1, answer: { kind: "text", value: "5" } },
    ];
    expect(solvedBeforeReveal(rows).map((r) => [r.exercise_id, r.score])).toEqual([["a", 1]]);
  });
});
