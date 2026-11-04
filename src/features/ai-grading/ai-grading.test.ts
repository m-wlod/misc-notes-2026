import { describe, expect, it, vi } from "vitest";

import type { Exercise } from "@/features/exercises/schema";
import type { AiGrade } from "@/lib/ai/grade-schema";
import type { GraderModel, ModelReply } from "@/lib/ai/grader";
import { memoryKV } from "@/lib/kv/store";

import { cacheKey, normaliseAnswer } from "./cache";
import { checkQuota, dayStart, recordUse, type QuotaConfig } from "./quota";

vi.mock("server-only", () => ({}));
const { gradeOpenAnswer } = await import("./service");

const config: QuotaConfig = { userDailyQuota: 10, ipDailyLimit: 20, dailyBudgetUsd: 5 };
const T0 = Date.UTC(2026, 10, 2, 9);
const NEXT_DAY = Date.UTC(2026, 10, 3, 0, 1);

describe("quota", () => {
  it("allows 10 gradings a day per user, then refuses until the next day", async () => {
    const kv = memoryKV(() => T0);
    for (let i = 0; i < 10; i++) {
      expect(await checkQuota(kv, config, { userId: "u", ip: "1", now: T0 })).toMatchObject({
        ok: true,
        remaining: 10 - i,
      });
      await recordUse(kv, { userId: "u", ip: "1", costUsd: 0.01, now: T0 });
    }
    expect(await checkQuota(kv, config, { userId: "u", ip: "1", now: T0 })).toEqual({
      ok: false,
      reason: "user-quota",
    });
    // Another user still has their own quota; tomorrow the first one does again.
    expect((await checkQuota(kv, config, { userId: "v", ip: "2", now: T0 })).ok).toBe(true);
    expect((await checkQuota(kv, config, { userId: "u", ip: "1", now: NEXT_DAY })).ok).toBe(true);
  });

  it("limits gradings per IP across users", async () => {
    const kv = memoryKV(() => T0);
    const strict = { ...config, ipDailyLimit: 3 };
    for (const userId of ["a", "b", "c"]) {
      await recordUse(kv, { userId, ip: "9", costUsd: 0, now: T0 });
    }
    expect(await checkQuota(kv, strict, { userId: "d", ip: "9", now: T0 })).toEqual({
      ok: false,
      reason: "ip-limit",
    });
  });

  it("switches AI grading off for everyone once the daily budget is spent", async () => {
    const kv = memoryKV(() => T0);
    await recordUse(kv, { userId: "a", ip: "1", costUsd: 4.99, now: T0 });
    expect((await checkQuota(kv, config, { userId: "b", ip: "2", now: T0 })).ok).toBe(true);
    await recordUse(kv, { userId: "a", ip: "1", costUsd: 0.02, now: T0 });
    expect(await checkQuota(kv, config, { userId: "b", ip: "2", now: T0 })).toEqual({
      ok: false,
      reason: "budget",
    });
    expect((await checkQuota(kv, config, { userId: "b", ip: "2", now: NEXT_DAY })).ok).toBe(true);
  });
});

describe("quota day", () => {
  it("starts at midnight UTC, the window the usage log is summed over", () => {
    expect(dayStart(Date.UTC(2026, 10, 9, 23, 59))).toBe("2026-11-09T00:00:00.000Z");
  });

  it("the usage log's spend switches grading off even when this instance counted nothing", async () => {
    const kv = memoryKV(() => T0);
    expect(
      await checkQuota(kv, config, { userId: "u", ip: "1", now: T0, recordedSpend: 5 }),
    ).toEqual({ ok: false, reason: "budget" });
  });
});

describe("cache key", () => {
  it("ignores spacing and case, but not the exercise, version or language", () => {
    expect(normaliseAnswer("  Sum  /\n Count ")).toBe("sum / count");
    const k = cacheKey("ex", 0, "pl", "Sum / count");
    expect(cacheKey("ex", 0, "pl", "  sum   /  COUNT ")).toBe(k);
    expect(cacheKey("ex", 1, "pl", "Sum / count")).not.toBe(k);
    expect(cacheKey("ex", 0, "en", "Sum / count")).not.toBe(k);
    expect(cacheKey("other", 0, "pl", "Sum / count")).not.toBe(k);
  });
});

describe("gradeOpenAnswer", () => {
  const ex = {
    id: "przyklad-otwarte",
    type: "open",
    level: 2,
    topics: ["t"],
    lessonIds: ["l"],
    prompt: { pl: "Wyjaśnij średnią." },
    params: {},
    hints: [],
    solution: { pl: "Suma podzielona przez liczbę." },
    estimatedMinutes: 1,
    status: "draft",
    sample: true,
    interview: [],
    rubric: ["Adds the values", { pl: "Dzieli przez liczbę", en: "Divides by the count" }],
  } satisfies Exercise;
  const good: AiGrade = {
    score: 4,
    verdict: "correct",
    rubricItems: [
      { index: 0, status: "met", reason: "" },
      { index: 1, status: "met", reason: "" },
    ],
    feedback: "f",
    misconceptions: [],
    nextStep: "n",
  };
  const model = (reply: ModelReply) => {
    const m: GraderModel & { calls: number } = {
      id: "claude-opus-5-5",
      calls: 0,
      call: () => {
        m.calls++;
        return Promise.resolve(reply);
      },
    };
    return m;
  };
  const log = () => {
    const entries = { usage: [] as number[], attempts: 0 };
    return {
      entries,
      usage: ({ costUsd }: { costUsd: number }) => {
        entries.usage.push(costUsd);
        return Promise.resolve();
      },
      attempt: () => {
        entries.attempts++;
        return Promise.resolve(entries.attempts);
      },
    };
  };
  const req = { version: 0, answer: "Sum / count", lang: "pl" as const, userId: "u", ip: "1" };

  it("is off without a model (no key)", async () => {
    expect(await gradeOpenAnswer(ex, req, { kv: memoryKV(), model: null })).toEqual({
      ok: false,
      reason: "not-configured",
    });
  });

  it("grades, logs the cost, and serves the same answer from the cache for free", async () => {
    const kv = memoryKV(() => T0);
    const m = model({ ok: true, output: good, usage: { input_tokens: 1000, output_tokens: 500 } });
    const l = log();
    const deps = { kv, model: m, config, now: T0, log: l };
    expect(await gradeOpenAnswer(ex, req, deps)).toMatchObject({
      ok: true,
      cached: false,
      remaining: 9,
      attemptId: 1,
    });
    expect(l.entries.usage).toEqual([0.014]);
    expect(await gradeOpenAnswer(ex, { ...req, answer: "  sum   /  COUNT " }, deps)).toMatchObject({
      ok: true,
      cached: true,
      attemptId: 2,
    });
    expect(m.calls).toBe(1);
    expect(l.entries.usage).toHaveLength(1);
    expect(await checkQuota(kv, config, { userId: "u", ip: "1", now: T0 })).toMatchObject({
      remaining: 9,
    });
  });

  it("falls back, still counting the cost, when the model fails", async () => {
    const kv = memoryKV(() => T0);
    const l = log();
    const m = model({ ok: false, reason: "api", usage: { input_tokens: 10, output_tokens: 0 } });
    expect(await gradeOpenAnswer(ex, req, { kv, model: m, config, now: T0, log: l })).toEqual({
      ok: false,
      reason: "fallback",
    });
    expect(l.entries.usage).toEqual([0.00004]);
    expect(l.entries.attempts).toBe(0);
  });

  it("refuses once the quota is used up, without calling the model", async () => {
    const kv = memoryKV(() => T0);
    const m = model({ ok: true, output: good, usage: { input_tokens: 1, output_tokens: 1 } });
    const deps = { kv, model: m, config: { ...config, userDailyQuota: 1 }, now: T0, log: log() };
    await gradeOpenAnswer(ex, req, deps);
    expect(await gradeOpenAnswer(ex, { ...req, answer: "different" }, deps)).toEqual({
      ok: false,
      reason: "user-quota",
    });
    expect(m.calls).toBe(1);
  });

  it("parallel requests can't overshoot the quota: claims are taken before the call", async () => {
    const kv = memoryKV(() => T0);
    const m = model({ ok: true, output: good, usage: { input_tokens: 1, output_tokens: 1 } });
    const deps = { kv, model: m, config: { ...config, userDailyQuota: 2 }, now: T0, log: log() };
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        gradeOpenAnswer(ex, { ...req, answer: `answer ${String(i)}` }, deps),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(m.calls).toBe(2);
  });

  it("an exhausted user can't replay a cached answer either (Phase 21)", async () => {
    const kv = memoryKV(() => T0);
    const m = model({ ok: true, output: good, usage: { input_tokens: 1, output_tokens: 1 } });
    const deps = { kv, model: m, config: { ...config, userDailyQuota: 1 }, now: T0, log: log() };
    await gradeOpenAnswer(ex, req, deps);
    expect(await gradeOpenAnswer(ex, req, deps)).toEqual({ ok: false, reason: "user-quota" });
  });

  it("the budget holds across instances: the usage log's spend counts (Phase 21)", async () => {
    const m = model({ ok: true, output: good, usage: { input_tokens: 1, output_tokens: 1 } });
    const spend = () => Promise.resolve(config.dailyBudgetUsd);
    expect(
      await gradeOpenAnswer(ex, req, {
        kv: memoryKV(() => T0),
        model: m,
        config,
        now: T0,
        log: log(),
        spend,
      }),
    ).toEqual({ ok: false, reason: "budget" });
    expect(m.calls).toBe(0);
  });
});
