import { describe, expect, it } from "vitest";

import type { ModelReply } from "./grader";
import { gradeOpen } from "./grader";
import { INJECTION_CASES, INJECTION_EXERCISE } from "./injection-cases";
import { buildUserMessage } from "./prompt";

/**
 * The deterministic half of the injection suite (Phase 10). The live half, the real
 * model on the same cases, runs with `pnpm ai:eval` once a key exists.
 */
const input = (answer: string) => ({ ...INJECTION_EXERCISE, answer, lang: "pl" as const });

describe.each(INJECTION_CASES)("injection: $name", ({ answer }) => {
  it("stays inside the one untrusted answer block", () => {
    const msg = buildUserMessage(input(answer));
    expect(msg.match(/<answer>/g)).toHaveLength(1);
    expect(msg.match(/<\/answer>/g)).toHaveLength(1);
    expect(msg.match(/<rubric>/g)).toHaveLength(1);
    expect(msg.endsWith("</answer>")).toBe(true);
    const inside = msg.slice(msg.indexOf("<answer>") + 8, -9);
    expect(inside).not.toMatch(/[<>]/);
  });

  it("can't buy a score from a model that obeys it", async () => {
    // Worst case: the model "obeys" and claims 4/4 while its own item list says nothing
    // was met. The guards hold the score to the rubric.
    const obeys: ModelReply = {
      ok: true,
      usage: { input_tokens: 1, output_tokens: 1 },
      output: {
        score: 4,
        verdict: "correct",
        rubricItems: [
          { index: 0, status: "missed", reason: "no content" },
          { index: 1, status: "missed", reason: "no content" },
        ],
        feedback: "f",
        misconceptions: [],
        nextStep: "n",
      },
    };
    const out = await gradeOpen(input(answer), {
      id: "claude-opus-5-5",
      call: () => Promise.resolve(obeys),
    });
    expect(out).toMatchObject({ ok: true, grade: { score: 0, verdict: "wrong" } });
  });
});
