import "server-only";

import { env } from "@/env";
import { variantOf } from "@/features/exercises/grade";
import { fillPlaceholders } from "@/features/exercises/render-text";
import type { Exercise } from "@/features/exercises/schema";
import { DEFAULT_GRADER_MODEL, graderModel } from "@/lib/ai/client";
import type { Usage } from "@/lib/ai/cost";
import type { AiGrade } from "@/lib/ai/grade-schema";
import { gradeOpen, type GraderModel } from "@/lib/ai/grader";
import type { Lang } from "@/lib/ai/prompt";
import { createAdminClient } from "@/lib/db/admin";
import { sharedKV } from "@/lib/kv/shared";
import type { KV } from "@/lib/kv/store";

import { cacheKey, getCached, setCached } from "./cache";
import { checkQuota, dayStart, recordUse, withSettings, type QuotaConfig } from "./quota";

/**
 * AI grading of one open answer (Phase 10), shared by the route and its tests:
 * quota → cache → model → guards → usage log. Off (and never called) until both an
 * Anthropic key and accounts exist.
 */
export type OpenExercise = Extract<Exercise, { type: "open" | "brainteaser" }>;
export const isOpen = (ex: Exercise): ex is OpenExercise =>
  ex.type === "open" || ex.type === "brainteaser";

/** AI grading needs a key (cost) and accounts (per-user quota). */
export function aiAvailable(): boolean {
  return Boolean(
    env.ANTHROPIC_API_KEY &&
    env.NEXT_PUBLIC_SUPABASE_URL &&
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    env.SUPABASE_SECRET_KEY,
  );
}

/** The env defaults; an admin can override them in the panel (`app_settings`, Phase 18c). */
export const envQuotaConfig = (): QuotaConfig => ({
  userDailyQuota: env.AI_USER_DAILY_QUOTA,
  ipDailyLimit: env.AI_IP_DAILY_LIMIT,
  dailyBudgetUsd: env.AI_DAILY_BUDGET_USD,
});

export async function quotaConfig(): Promise<QuotaConfig> {
  const base = envQuotaConfig();
  const admin = createAdminClient();
  if (!admin) return base;
  const { data } = await admin.from("app_settings").select("value").eq("key", "ai").maybeSingle();
  return withSettings(base, data?.value);
}

/** Today's AI spend from the usage log (shared by every instance); null without a database. */
async function recordedSpend(now: number): Promise<number | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("ai_spend_since", { since: dayStart(now) });
  return error ? null : data;
}

export const graderModelId = () => env.AI_GRADER_MODEL ?? DEFAULT_GRADER_MODEL;

const pick = (t: string | { pl: string; en?: string | undefined }, lang: Lang) =>
  typeof t === "string" ? t : lang === "en" ? (t.en ?? t.pl) : t.pl;

export function rubricTexts(ex: OpenExercise, lang: Lang): string[] {
  return ex.rubric.map((r) => pick(r, lang));
}

export type ServiceResult =
  | {
      ok: true;
      grade: AiGrade;
      cached: boolean;
      remaining: number | null;
      /** The stored attempt (for "report unfair grading"); null without a database. */
      attemptId: number | null;
    }
  | { ok: false; reason: "ip-limit" | "budget" | "user-quota" | "fallback" | "not-configured" };

/** Where usage and graded attempts go. Default: the database (secret-key client). */
export interface GradingLog {
  usage(entry: {
    userId: string;
    exerciseId: string;
    model: string;
    usage: Usage;
    costUsd: number;
  }): Promise<void>;
  attempt(entry: {
    userId: string;
    exerciseId: string;
    version: number;
    answer: string;
    grade: AiGrade;
  }): Promise<number | null>;
}

export const databaseLog: GradingLog = {
  async usage({ userId, exerciseId, model, usage, costUsd }) {
    await createAdminClient()
      ?.from("ai_grading_usage")
      .insert({
        user_id: userId,
        exercise_id: exerciseId,
        model,
        tokens_in:
          usage.input_tokens +
          (usage.cache_read_input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0),
        tokens_out: usage.output_tokens,
        cost_usd: costUsd,
      });
  },
  async attempt({ userId, exerciseId, version, answer, grade }) {
    const admin = createAdminClient();
    if (!admin) return null;
    // The same answer graded again (a cached grade): reuse its attempt instead of
    // writing another row each time (Phase 21).
    const { data: same } = await admin
      .from("exercise_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId)
      .eq("variant_seed", version)
      .eq("grader", "ai")
      .contains("answer", { kind: "text", value: answer })
      .limit(1)
      .maybeSingle();
    if (same) return same.id;
    const { data } = await admin
      .from("exercise_attempts")
      .insert({
        user_id: userId,
        exercise_id: exerciseId,
        variant_seed: version,
        answer: { kind: "text", value: answer },
        score: grade.score / 4,
        grader: "ai",
        feedback: grade,
        source: "app",
      })
      .select("id")
      .single();
    return data?.id ?? null;
  },
};

export async function gradeOpenAnswer(
  ex: OpenExercise,
  {
    version,
    answer,
    lang,
    userId,
    ip,
  }: { version: number; answer: string; lang: Lang; userId: string; ip: string },
  deps: {
    kv?: KV;
    model?: GraderModel | null;
    config?: QuotaConfig;
    now?: number;
    log?: GradingLog;
    /** The day's spend from the usage log (default: the database). */
    spend?: (now: number) => Promise<number | null>;
  } = {},
): Promise<ServiceResult> {
  const kv = deps.kv ?? sharedKV();
  const log = deps.log ?? databaseLog;
  const model = deps.model === undefined ? graderModel() : deps.model;
  if (!model) return { ok: false, reason: "not-configured" };
  const store = (grade: AiGrade) =>
    log.attempt({ userId, exerciseId: ex.id, version, answer, grade });

  // Limits first, also for answers already graded: an exhausted user or IP can't replay
  // cached answers to write rows (Phase 21). A cached grade uses no quota and no money.
  const now = deps.now ?? Date.now();
  const quota = await checkQuota(kv, deps.config ?? (await quotaConfig()), {
    userId,
    ip,
    now,
    recordedSpend: await (deps.spend ?? recordedSpend)(now),
  });
  if (!quota.ok) return { ok: false, reason: quota.reason };

  // Same answer as before: the stored grade, no model call, no quota used.
  const key = cacheKey(ex.id, version, lang, answer);
  const hit = await getCached(kv, key);
  if (hit)
    return { ok: true, grade: hit, cached: true, remaining: null, attemptId: await store(hit) };

  const { params } = variantOf(ex, version);
  const outcome = await gradeOpen(
    {
      question: fillPlaceholders(pick(ex.prompt, lang), params, lang),
      rubric: rubricTexts(ex, lang),
      solution: ex.solution ? fillPlaceholders(pick(ex.solution, lang), params, lang) : undefined,
      answer,
      lang,
    },
    model,
  );
  // Every model call costs money, also the ones that fell back.
  await recordUse(kv, { userId, ip, costUsd: outcome.costUsd, now });
  await log.usage({
    userId,
    exerciseId: ex.id,
    model: model.id,
    usage: outcome.usage,
    costUsd: outcome.costUsd,
  });
  if (!outcome.ok) return { ok: false, reason: "fallback" };
  await setCached(kv, key, outcome.grade);
  return {
    ok: true,
    grade: outcome.grade,
    cached: false,
    remaining: quota.remaining - 1,
    attemptId: await store(outcome.grade),
  };
}
