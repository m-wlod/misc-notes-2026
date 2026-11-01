import { describe, expect, it } from "vitest";

import { parse } from "./use-local-progress";

describe("parse (local progress)", () => {
  it("reads lesson statuses from a valid payload", () => {
    const raw = JSON.stringify({
      version: 1,
      lessons: { "exp-log": { status: "completed", updatedAt: "2026-11-01T10:00:00Z" } },
      attempts: [],
    });
    expect([...parse(raw)]).toEqual([["exp-log", "completed"]]);
  });

  it.each([null, "", "not json", "{}", JSON.stringify({ version: 2, lessons: {}, attempts: [] })])(
    "treats %j as no progress",
    (raw) => {
      expect(parse(raw).size).toBe(0);
    },
  );
});
