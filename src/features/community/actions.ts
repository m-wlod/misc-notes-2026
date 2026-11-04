"use server";

import { z } from "zod";

import { debunk, lessons } from "#content";
import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { getExercise } from "@/features/exercises/data";
import { createAdminClient } from "@/lib/db/admin";
import { isSupabaseConfigured } from "@/lib/db/config";
import { getSession, type Session } from "@/lib/db/session";
import { allowWrite } from "@/lib/rate/write";

import { MAX_POST_CHARS } from "./limits";
import { MIN_POST_CHARS, rateOk, screen } from "./policy";

/**
 * Community actions (Phase 17), signed-in only; the database enforces the same rules
 * (RLS: own rows, bans, the spoiler gate), these add rate limits and the keyword hold.
 * Posts the filter holds are written by the server as `pending` (users can only insert
 * approved rows), scoped to the session's user.
 */
const TARGETS = ["lesson", "exercise", "debunk"] as const;
type Target = (typeof TARGETS)[number];

export type CommunityResult =
  | { ok: true; held?: boolean }
  | {
      ok: false;
      reason: "signed-out" | "invalid" | "locked" | "rate-limited" | "banned" | "failed";
    };

function targetExists(type: Target, id: string): boolean {
  if (type === "lesson") return lessons.some((l) => l.id === id);
  if (type === "debunk") return debunk.some((e) => e.id === id);
  return getExercise(id, isStyleguideEnabled(env)) !== undefined;
}

async function signedIn(): Promise<Session | null> {
  return isSupabaseConfigured() ? getSession() : null;
}

async function recentPosts(session: Session) {
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const count = async (from: string) => {
    const { count: n } = await session.supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .gte("created_at", from);
    return n ?? 0;
  };
  return { lastTenMinutes: await count(since(600_000)), lastDay: await count(since(86_400_000)) };
}

async function unlocked(session: Session, exerciseId: string): Promise<boolean> {
  const { data } = await session.supabase.rpc("discussion_unlocked", { exercise_id: exerciseId });
  return data === true;
}

async function banned(session: Session): Promise<boolean> {
  const { data } = await session.supabase.rpc("is_banned");
  return data === true;
}

const body = z.string().trim().min(MIN_POST_CHARS).max(MAX_POST_CHARS);

export async function postComment(input: unknown): Promise<CommunityResult> {
  const parsed = z
    .object({
      target: z.enum(TARGETS),
      targetId: z.string().regex(/^[a-z0-9-]{1,120}$/),
      parentId: z.number().int().positive().nullable().default(null),
      body,
    })
    .safeParse(input);
  if (!parsed.success || !targetExists(parsed.data.target, parsed.data.targetId)) {
    return { ok: false, reason: "invalid" };
  }
  const session = await signedIn();
  if (!session) return { ok: false, reason: "signed-out" };
  const { target, targetId, parentId } = parsed.data;
  if (await banned(session)) return { ok: false, reason: "banned" };
  if (target === "exercise" && !(await unlocked(session, targetId))) {
    return { ok: false, reason: "locked" };
  }
  if (!rateOk(await recentPosts(session))) return { ok: false, reason: "rate-limited" };
  // A reply answers an approved comment in the same thread (Phase 21).
  if (parentId !== null) {
    const { data: parent } = await session.supabase
      .from("comments")
      .select("id")
      .eq("id", parentId)
      .eq("target_type", target)
      .eq("target_id", targetId)
      .eq("status", "approved")
      .maybeSingle();
    if (!parent) return { ok: false, reason: "invalid" };
  }
  const verdict = screen(parsed.data.body);
  const row = {
    user_id: session.user.id,
    target_type: target,
    target_id: targetId,
    parent_id: parentId,
    body: parsed.data.body,
  };
  // Only the server writes posts (Phase 21c, pentest M2): the checks above (ban, spoiler
  // gate, rate limit, reply thread) and the screening below can't be skipped by writing
  // to the table directly. user_id always comes from the session.
  const admin = createAdminClient();
  const held = verdict.status !== "approved";
  const { error } = (await admin
    ?.from("comments")
    .insert({ ...row, status: held ? ("pending" as const) : ("approved" as const) })) ?? {
    error: true,
  };
  if (error) return { ok: false, reason: "failed" };
  return held ? { ok: true, held: true } : { ok: true };
}

export async function shareSolution(input: unknown): Promise<CommunityResult> {
  const parsed = z
    .object({
      exerciseId: z.string().regex(/^[a-z0-9-]{1,120}$/),
      format: z.enum(["text", "math", "code"]),
      body: z.string().trim().min(MIN_POST_CHARS).max(20_000),
    })
    .safeParse(input);
  if (!parsed.success || !targetExists("exercise", parsed.data.exerciseId)) {
    return { ok: false, reason: "invalid" };
  }
  const session = await signedIn();
  if (!session) return { ok: false, reason: "signed-out" };
  if (!(await allowWrite("shareSolution", session.user.id)))
    return { ok: false, reason: "rate-limited" };
  if (await banned(session)) return { ok: false, reason: "banned" };
  if (!(await unlocked(session, parsed.data.exerciseId))) return { ok: false, reason: "locked" };
  const row = {
    user_id: session.user.id,
    exercise_id: parsed.data.exerciseId,
    format: parsed.data.format,
    body: parsed.data.body,
  };
  // Server writes only (pentest M2), as for comments.
  const held = screen(parsed.data.body).status !== "approved";
  const { error } = (await createAdminClient()
    ?.from("shared_solutions")
    .insert({ ...row, status: held ? ("pending" as const) : ("approved" as const) })) ?? {
    error: true,
  };
  if (error) return { ok: false, reason: "failed" };
  return held ? { ok: true, held: true } : { ok: true };
}

/** +1 / −1, and the same value again takes the vote back. */
export async function vote(input: unknown): Promise<CommunityResult> {
  const parsed = z
    .object({
      targetType: z.enum(["comment", "solution"]),
      targetId: z.number().int().positive(),
      value: z.union([z.literal(1), z.literal(-1)]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const session = await signedIn();
  if (!session) return { ok: false, reason: "signed-out" };
  if (!(await allowWrite("vote", session.user.id))) return { ok: false, reason: "rate-limited" };
  const { targetType, targetId, value } = parsed.data;
  const { data: existing } = await session.supabase
    .from("votes")
    .select("value")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  const db = session.supabase.from("votes");
  const { error } =
    existing?.value === value
      ? await db
          .delete()
          .eq("target_type", targetType)
          .eq("target_id", targetId)
          .eq("user_id", session.user.id)
      : await db.upsert(
          { user_id: session.user.id, target_type: targetType, target_id: targetId, value },
          { onConflict: "user_id,target_type,target_id" },
        );
  return error
    ? { ok: false, reason: (await banned(session)) ? "banned" : "failed" }
    : { ok: true };
}

export async function report(input: unknown): Promise<CommunityResult> {
  const parsed = z
    .object({
      targetType: z.enum(["comment", "solution", "profile"]),
      targetId: z.string().max(64),
      reason: z.string().trim().min(3).max(2000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const session = await signedIn();
  if (!session) return { ok: false, reason: "signed-out" };
  if (!(await allowWrite("report", session.user.id))) return { ok: false, reason: "rate-limited" };
  const { error } = await session.supabase.from("reports").insert({
    user_id: session.user.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
  });
  return error
    ? { ok: false, reason: (await banned(session)) ? "banned" : "failed" }
    : { ok: true };
}

export async function editComment(input: unknown): Promise<CommunityResult> {
  const parsed = z.object({ id: z.number().int().positive(), body }).safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const session = await signedIn();
  if (!session) return { ok: false, reason: "signed-out" };
  if (!(await allowWrite("editComment", session.user.id)))
    return { ok: false, reason: "rate-limited" };
  if (await banned(session)) return { ok: false, reason: "banned" };
  if (screen(parsed.data.body).status === "pending") {
    // Held again: only the server may set `pending`, for the author's own comment.
    const { error } = (await createAdminClient()
      ?.from("comments")
      .update({ body: parsed.data.body, status: "pending" })
      .eq("id", parsed.data.id)
      .eq("user_id", session.user.id)
      // A hidden comment stays hidden.
      .in("status", ["approved", "pending"])) ?? { error: true };
    return error ? { ok: false, reason: "failed" } : { ok: true, held: true };
  }
  // Server writes only (pentest M2): the author's own comment, never a hidden one.
  const { data: changed, error } = (await createAdminClient()
    ?.from("comments")
    .update({ body: parsed.data.body })
    .eq("id", parsed.data.id)
    .eq("user_id", session.user.id)
    .in("status", ["approved", "pending"])
    .select("id")) ?? { data: null, error: true };
  return error || !changed?.length ? { ok: false, reason: "failed" } : { ok: true };
}

export async function deleteComment(input: unknown): Promise<CommunityResult> {
  const parsed = z.object({ id: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const session = await signedIn();
  if (!session) return { ok: false, reason: "signed-out" };
  if (!(await allowWrite("deleteComment", session.user.id)))
    return { ok: false, reason: "rate-limited" };
  const { error } = await session.supabase.from("comments").delete().eq("id", parsed.data.id);
  return error ? { ok: false, reason: "failed" } : { ok: true };
}
