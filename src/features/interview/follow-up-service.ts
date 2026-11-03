import "server-only";

import { checkQuota, recordUse, type QuotaConfig } from "@/features/ai-grading/quota";
import {
  databaseLog,
  quotaConfig,
  type GradingLog,
  type OpenExercise,
} from "@/features/ai-grading/service";
import { variantOf } from "@/features/exercises/grade";
import { fillPlaceholders } from "@/features/exercises/render-text";
import { followUpModel } from "@/lib/ai/client";
import { askFollowUp } from "@/lib/ai/follow-up";
import type { GraderModel } from "@/lib/ai/grader";
import type { Lang } from "@/lib/ai/prompt";
import { sharedKV } from "@/lib/kv/shared";
import type { KV } from "@/lib/kv/store";

/**
 * One interviewer follow-up question (Phase 11). Optional, and it counts toward the
 * same daily AI quota and budget as grading. Off until a key and accounts exist.
 */
export type FollowUpResult =
  | { ok: true; question: string }
  | { ok: false; reason: "not-configured" | "ip-limit" | "budget" | "user-quota" | "fallback" };

export async function followUpQuestion(
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
  } = {},
): Promise<FollowUpResult> {
  const model = deps.model === undefined ? followUpModel() : deps.model;
  if (!model) return { ok: false, reason: "not-configured" };
  const kv = deps.kv ?? sharedKV();
  const quota = await checkQuota(kv, deps.config ?? (await quotaConfig()), {
    userId,
    ip,
    now: deps.now,
  });
  if (!quota.ok) return { ok: false, reason: quota.reason };

  const prompt = lang === "en" ? (ex.prompt.en ?? ex.prompt.pl) : ex.prompt.pl;
  const out = await askFollowUp(
    { question: fillPlaceholders(prompt, variantOf(ex, version).params, lang), answer, lang },
    model,
  );
  await recordUse(kv, { userId, ip, costUsd: out.costUsd, now: deps.now });
  await (deps.log ?? databaseLog).usage({
    userId,
    exerciseId: ex.id,
    model: model.id,
    usage: out.usage,
    costUsd: out.costUsd,
  });
  return out.ok ? { ok: true, question: out.question } : { ok: false, reason: "fallback" };
}
