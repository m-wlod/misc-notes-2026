"use server";

import { z } from "zod";

import { mayBan } from "@/features/admin/access";
import { audit, staffFor } from "@/features/admin/server";
import { XP } from "@/features/gamification/config";
import { award } from "@/features/gamification/server/award";
import { gamificationStore, lookups } from "@/features/gamification/server/index";
import { xpKey } from "@/features/gamification/xp";

/**
 * Moderation (Phase 17), for moderators and admins. The role is checked first
 * (`staffFor`, the Phase 18 access map), then the change is written with the secret key
 * together with an `audit_log` row (actor, action, target, before/after).
 */
export type ModerationResult = { ok: boolean };

const staff = () => staffFor("community");

const POST_TABLE = { comment: "comments", solution: "shared_solutions" } as const;
const postRef = z.object({
  kind: z.enum(["comment", "solution"]),
  id: z.number().int().positive(),
});

/** Shadow-hide (the author still sees it), restore, or approve a held post. */
export async function setPostStatus(input: unknown): Promise<ModerationResult> {
  const parsed = postRef
    .extend({ status: z.enum(["hidden", "approved", "rejected"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staff();
  if (!who) return { ok: false };
  const { kind, id, status } = parsed.data;
  const table = POST_TABLE[kind];
  const { data: before } = await who.admin
    .from(table)
    .select("status, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false };
  // Nobody approves their own held post (Phase 21).
  if (status === "approved" && before.user_id === who.actor) return { ok: false };
  const { error } = await who.admin.from(table).update({ status }).eq("id", id);
  if (error) return { ok: false };
  return {
    ok: await audit(who.admin, who.actor, `${kind}.${status}`, `${kind}:${String(id)}`, {
      before: before.status,
      after: status,
    }),
  };
}

export async function setMentorPick(input: unknown): Promise<ModerationResult> {
  const parsed = z.object({ id: z.number().int().positive(), pick: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staff();
  if (!who) return { ok: false };
  const { id, pick } = parsed.data;
  const { data: before } = await who.admin
    .from("shared_solutions")
    .select("mentor_pick")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false };
  const { error } = await who.admin
    .from("shared_solutions")
    .update({ mentor_pick: pick })
    .eq("id", id);
  if (error) return { ok: false };
  return {
    ok: await audit(
      who.admin,
      who.actor,
      pick ? "solution.mentor_pick" : "solution.mentor_unpick",
      `solution:${String(id)}`,
      {
        before: before.mentor_pick,
        after: pick,
      },
    ),
  };
}

/**
 * An XP anomaly flag (Phase 21c) after a look: "approved" = fine, "rejected" = a real
 * problem (then a ban or a word with the user, by hand). XP is never changed here.
 */
export async function resolveXpFlag(input: unknown): Promise<ModerationResult> {
  const parsed = z
    .object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staff();
  if (!who) return { ok: false };
  const { id, status } = parsed.data;
  const { data: before } = await who.admin
    .from("xp_flags")
    .select("status, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!before || before.user_id === who.actor) return { ok: false };
  const { error } = await who.admin
    .from("xp_flags")
    .update({ status, reviewed_by: who.actor })
    .eq("id", id);
  if (error) return { ok: false };
  return {
    ok: await audit(who.admin, who.actor, `xp_flag.${status}`, `user:${before.user_id}`, {
      flag: id,
      before: before.status,
    }),
  };
}

export async function resolveReport(input: unknown): Promise<ModerationResult> {
  const parsed = z
    .object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staff();
  if (!who) return { ok: false };
  const { id, status } = parsed.data;
  const { data: before } = await who.admin
    .from("reports")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false };
  const { error } = await who.admin
    .from("reports")
    .update({ status, resolved_by: who.actor, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false };
  return {
    ok: await audit(who.admin, who.actor, `report.${status}`, `report:${String(id)}`, {
      before: before.status,
      after: status,
    }),
  };
}

export async function banUser(input: unknown): Promise<ModerationResult> {
  const parsed = z
    .object({
      userId: z.uuid(),
      reason: z.string().trim().min(1).max(500),
      /** Days; null = until lifted. */
      days: z.number().int().min(1).max(3650).nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staff();
  if (!who || parsed.data.userId === who.actor) return { ok: false };
  const { userId, reason, days } = parsed.data;
  const { data: targetRoles } = await who.admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (
    !mayBan(
      who.roles,
      (targetRoles ?? []).map((r) => r.role),
    )
  )
    return { ok: false };
  const until = days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString();
  const { error } = await who.admin
    .from("bans")
    .upsert({ user_id: userId, reason, until, banned_by: who.actor }, { onConflict: "user_id" });
  if (error) return { ok: false };
  return { ok: await audit(who.admin, who.actor, "user.ban", `user:${userId}`, { reason, until }) };
}

export async function unbanUser(input: unknown): Promise<ModerationResult> {
  const parsed = z.object({ userId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staff();
  // Nobody lifts their own ban, and the same rank rules as banning apply (pentest L3).
  if (!who || parsed.data.userId === who.actor) return { ok: false };
  const { data: targetRoles } = await who.admin
    .from("user_roles")
    .select("role")
    .eq("user_id", parsed.data.userId);
  if (
    !mayBan(
      who.roles,
      (targetRoles ?? []).map((r) => r.role),
    )
  )
    return { ok: false };
  const { data: before } = await who.admin
    .from("bans")
    .select("reason, until")
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (!before) return { ok: false };
  const { error } = await who.admin.from("bans").delete().eq("user_id", parsed.data.userId);
  if (error) return { ok: false };
  return {
    ok: await audit(who.admin, who.actor, "user.unban", `user:${parsed.data.userId}`, { before }),
  };
}

/**
 * A content error report is accepted or rejected. Accepting one rewards its author
 * (50 XP, idempotent per report; the first earns "Korektor" through the usual award path).
 */
export async function resolveCorrection(input: unknown): Promise<ModerationResult> {
  const parsed = z
    .object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staff();
  if (!who) return { ok: false };
  const { id, status } = parsed.data;
  const { data: before } = await who.admin
    .from("content_error_reports")
    .select("status, user_id, content_type, content_id")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false };
  const { error } = await who.admin
    .from("content_error_reports")
    .update({ status, resolved_by: who.actor, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false };
  let rewarded = false;
  if (status === "approved" && before.user_id && before.user_id !== who.actor) {
    const store = gamificationStore();
    const rewards = store
      ? await award(
          store,
          before.user_id,
          {
            reason: "correction",
            amount: XP.correctionAccepted,
            key: xpKey.correction(id),
            ref: `${before.content_type}:${before.content_id}`,
          },
          lookups,
        )
      : null;
    rewarded = rewards !== null;
  }
  return {
    ok: await audit(who.admin, who.actor, `correction.${status}`, `correction:${String(id)}`, {
      before: before.status,
      after: status,
      rewarded,
    }),
  };
}
