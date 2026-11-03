import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { answerText, mistakeSnippet, mistakeValue, parseAnalytics } from "./analytics";

describe("exercise analytics", () => {
  it("reads what the database function returns, and rejects anything else", () => {
    const data = {
      attempts: 5,
      users: 3,
      success_rate: 0.4,
      median_time_ms: 12_000,
      mean_hints: 0.6,
      wrong: [{ answer: { kind: "text", value: "5" }, count: 2 }],
    };
    expect(parseAnalytics(data)).toEqual(data);
    expect(parseAnalytics({ ...data, attempts: "5" })).toBeNull();
    expect(parseAnalytics(null)).toBeNull();
  });

  it("shows answers the way people typed them", () => {
    expect(answerText({ kind: "text", value: "0,5" })).toBe("0,5");
    expect(answerText({ kind: "number", value: 3 })).toBe("3");
    expect(answerText({ kind: "multi", values: ["a", "b"] })).toBe("a, b");
  });

  it("turns numeric and expression answers into mistakes[] values; choices have none", () => {
    expect(mistakeValue({ kind: "text", value: " 6 " })).toBe(6);
    expect(mistakeValue({ kind: "text", value: "0,25" })).toBe(0.25);
    expect(mistakeValue({ kind: "text", value: "k * r / 100" })).toBe("k * r / 100");
    expect(mistakeValue({ kind: "number", value: 7 })).toBe(7);
    expect(mistakeValue({ kind: "choice", value: "b" })).toBeNull();
    expect(mistakeValue({ kind: "text", value: "  " })).toBeNull();
  });

  it("the snippet is valid YAML with the answer and a feedback stub in both languages", () => {
    for (const value of [6, 'a "quoted" \\ answer']) {
      const doc = parse(mistakeSnippet(value)) as {
        mistakes: { answer: unknown; feedback: { pl: string; en: string } }[];
      };
      expect(doc.mistakes).toHaveLength(1);
      expect(doc.mistakes[0]?.answer).toBe(value);
      expect(doc.mistakes[0]?.feedback.pl).toMatch(/^TODO/);
      expect(doc.mistakes[0]?.feedback.en).toMatch(/^TODO/);
    }
  });
});
