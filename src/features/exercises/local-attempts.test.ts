import { describe, expect, it } from "vitest";

import { solvedIds, withAttempt } from "./local-attempts";

const attempt = (n: number, score = 1) => ({
  clientId: `3f8a1c2e-5b6d-4e7f-8a9b-${String(n).padStart(12, "0")}`,
  exerciseId: `ex-${String(n % 3)}`,
  score,
  answer: { kind: "text", value: String(n) },
  createdAt: "2026-11-02T10:00:00Z",
});

describe("withAttempt", () => {
  it("appends to valid progress and replaces garbage", () => {
    const one = withAttempt(null, attempt(1));
    const two = withAttempt(one, attempt(2, 0));
    expect((JSON.parse(two) as { attempts: unknown[] }).attempts).toHaveLength(2);
    expect(
      (JSON.parse(withAttempt("{x", attempt(3))) as { attempts: unknown[] }).attempts,
    ).toHaveLength(1);
  });

  it("keeps only the newest 1000", () => {
    let raw: string | null = null;
    for (let i = 0; i < 1003; i++) raw = withAttempt(raw, attempt(i));
    const attempts = (JSON.parse(raw ?? "{}") as { attempts: { clientId: string }[] }).attempts;
    expect(attempts).toHaveLength(1000);
    expect(attempts[0]?.clientId).toMatch(/000000000003$/);
  });

  it("counts an exercise as solved only with a full score", () => {
    const raw = withAttempt(withAttempt(null, attempt(1, 0.5)), attempt(2, 1));
    expect([...solvedIds(JSON.parse(raw) as never)]).toEqual(["ex-2"]);
  });
});
