import "server-only";

import { alertBudget } from "@/features/ai-grading/budget-alerts";
import { addSpend, reserve, type QuotaConfig } from "@/features/ai-grading/quota";
import {
  databaseLog,
  quotaConfig,
  recordedSpend,
  type GradingLog,
  type OpenExercise,
} from "@/features/ai-grading/service";
import { sendAlert, type Alert } from "@/features/alerts/send";
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
    spend?: (now: number) => Promise<number | null>;
    alert?: (a: Alert) => Promise<unknown>;
  } = {},
): Promise<FollowUpResult> {
  const model = deps.model === undefined ? followUpModel() : deps.model;
  if (!model) return { ok: false, reason: "not-configured" };
  const kv = deps.kv ?? sharedKV();
  const now = deps.now ?? Date.now();
  const config = deps.config ?? (await quotaConfig());
  const spend = deps.spend ?? recordedSpend;
  // The same shared budget as grading: the usage log's spend counts (Phase 21/22).
  const quota = await reserve(kv, config, { userId, ip, now, recordedSpend: await spend(now) });
  if (!quota.ok) return { ok: false, reason: quota.reason };

  const prompt = lang === "en" ? (ex.prompt.en ?? ex.prompt.pl) : ex.prompt.pl;
  const out = await askFollowUp(
    { question: fillPlaceholders(prompt, variantOf(ex, version).params, lang), answer, lang },
    model,
  );
  await addSpend(kv, { costUsd: out.costUsd, now });
  await (deps.log ?? databaseLog).usage({
    userId,
    exerciseId: ex.id,
    model: model.id,
    usage: out.usage,
    costUsd: out.costUsd,
  });
  await alertBudget(await spend(now), out.costUsd, config.dailyBudgetUsd, deps.alert ?? sendAlert);
  return out.ok ? { ok: true, question: out.question } : { ok: false, reason: "fallback" };
}
