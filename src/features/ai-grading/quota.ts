import type { KV } from "@/lib/kv/store";

/**
 * Cost control for AI grading (Phase 10): the one place that decides whether a grading
 * may run. Checked in order: per-IP limit, global daily budget (kill-switch), per-user
 * daily quota. Days are UTC. Counters are only increased for gradings that run, so a
 * refused request doesn't use anything up.
 */
export type QuotaConfig = {
  userDailyQuota: number;
  ipDailyLimit: number;
  dailyBudgetUsd: number;
};

export type QuotaDecision =
  { ok: true; remaining: number } | { ok: false; reason: "ip-limit" | "budget" | "user-quota" };

const DAY = 86_400;
const day = (now: number) => new Date(now).toISOString().slice(0, 10);
const keys = (now: number, userId: string, ip: string) => ({
  ip: `ai:ip:${day(now)}:${ip}`,
  user: `ai:user:${day(now)}:${userId}`,
  spend: `ai:spend:${day(now)}`,
});

/**
 * The user's daily quota. TODO(entitlements): paid tiers read `entitlements` here and
 * get a higher number; nothing else changes.
 */
export function userQuota(_userId: string, config: QuotaConfig): number {
  return config.userDailyQuota;
}

export async function checkQuota(
  kv: KV,
  config: QuotaConfig,
  { userId, ip, now = Date.now() }: { userId: string; ip: string; now?: number | undefined },
): Promise<QuotaDecision> {
  const k = keys(now, userId, ip);
  const [ipCount, spent, userCount] = await Promise.all([
    kv.get<number>(k.ip),
    kv.get<number>(k.spend),
    kv.get<number>(k.user),
  ]);
  if ((ipCount ?? 0) >= config.ipDailyLimit) return { ok: false, reason: "ip-limit" };
  if ((spent ?? 0) >= config.dailyBudgetUsd) return { ok: false, reason: "budget" };
  const quota = userQuota(userId, config);
  if ((userCount ?? 0) >= quota) return { ok: false, reason: "user-quota" };
  return { ok: true, remaining: quota - (userCount ?? 0) };
}

/** After a grading ran: count it for the user and the IP, and add its cost to the day. */
export async function recordUse(
  kv: KV,
  {
    userId,
    ip,
    costUsd,
    now = Date.now(),
  }: { userId: string; ip: string; costUsd: number; now?: number | undefined },
): Promise<void> {
  const k = keys(now, userId, ip);
  await Promise.all([
    kv.incr(k.user, 1, DAY),
    kv.incr(k.ip, 1, DAY),
    kv.incr(k.spend, costUsd, DAY),
  ]);
}
