"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { audit, staffFor } from "@/features/admin/server";
import { exerciseLimiter } from "@/features/exercises/limiter";
import { gamificationStore } from "@/features/gamification/server/index";
import { createAdminClient } from "@/lib/db/admin";
import { isSupabaseConfigured } from "@/lib/db/config";
import { getSession } from "@/lib/db/session";
import { allowWrite } from "@/lib/rate/write";

import { listEntries } from "./entries";
import { claimInput, correctionInput, submit, type SubmitResult, type Writer } from "./submit";

/**
 * Debunk Lab actions (Phase 16). Submissions go to moderated queues (never published
 * without review), so signed-out visitors may send them too: the server writes those
 * with the secret key and no user id, rate-limited per IP. Signed in, rows are written
 * as the user (RLS: own rows, status pending).
 */
async function who() {
  const session = isSupabaseConfigured() ? await getSession() : null;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  return { session, key: session ? `user:${session.user.id}` : `ip:${ip}` };
}

type Db = NonNullable<ReturnType<typeof createAdminClient>>;

/** As the signed-in user (RLS), or signed out with the secret key and no user id. */
function writerFor(
  session: Awaited<ReturnType<typeof getSession>>,
  insert: (db: Db, userId: string | null, row: Record<string, unknown>) => Promise<boolean>,
): Writer | null {
  const admin = createAdminClient();
  if (!admin) return null;
  return {
    insert: (row, userId) =>
      session ? insert(session.supabase, userId, row) : insert(admin, null, row),
  };
}

const insertClaim = async (db: Db, userId: string | null, row: Record<string, unknown>) => {
  const { error } = await db.from("debunk_submissions").insert({
    user_id: userId,
    claim: String(row.claim),
    source_url: (row.source_url as string | null) ?? null,
  });
  return !error;
};

const insertCorrection = async (db: Db, userId: string | null, row: Record<string, unknown>) => {
  const { error } = await db.from("content_error_reports").insert({
    user_id: userId,
    content_type: "debunk",
    content_id: String(row.content_id),
    body: String(row.body),
  });
  return !error;
};

export async function submitClaim(input: unknown): Promise<SubmitResult> {
  const { session, key } = await who();
  return submit(
    () => {
      const p = claimInput.safeParse(input);
      return p.success
        ? {
            success: true,
            row: { claim: p.data.claim, source_url: p.data.sourceUrl },
            honeypot: p.data.website,
          }
        : { success: false };
    },
    {
      writer: writerFor(session, insertClaim),
      userId: session?.user.id ?? null,
      allowed: async () => exerciseLimiter.hit(`debunk:${key}`),
    },
  );
}

export async function reportCorrection(input: unknown): Promise<SubmitResult> {
  const { session, key } = await who();
  return submit(
    () => {
      const p = correctionInput.safeParse(input);
      return p.success
        ? {
            success: true,
            row: { content_type: "debunk", content_id: p.data.entryId, body: p.data.body },
            honeypot: p.data.website,
          }
        : { success: false };
    },
    {
      writer: writerFor(session, insertCorrection),
      userId: session?.user.id ?? null,
      allowed: async () => exerciseLimiter.hit(`correction:${key}`),
    },
  );
}

/**
 * A signed-in reader reached the end of an entry: recorded like a lesson
 * (`lesson_progress`, id `debunk:<id>`); ten of them earn "Anty-guru" (no XP).
 */
export async function finishEntry(input: unknown): Promise<{ ok: boolean }> {
  const parsed = z.object({ id: z.string().regex(/^[a-z0-9-]{1,100}$/) }).safeParse(input);
  if (!parsed.success || !isSupabaseConfigured()) return { ok: false };
  // Only entries readers can actually open count (no made-up ids: Phase 21).
  const known = new Set(listEntries("pl", isStyleguideEnabled(env)).map((e) => e.id));
  if (!known.has(parsed.data.id)) return { ok: false };
  const session = await getSession();
  if (!session) return { ok: false };
  if (!(await allowWrite("finishEntry", session.user.id))) return { ok: false };
  const lessonId = `debunk:${parsed.data.id}`;
  const { error } = await session.supabase.from("lesson_progress").upsert(
    {
      user_id: session.user.id,
      lesson_id: lessonId,
      status: "completed",
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) return { ok: false };
  // Rows can also be written directly (RLS: own progress), so count real entries only.
  const { data: read } = await session.supabase
    .from("lesson_progress")
    .select("lesson_id")
    .like("lesson_id", "debunk:%");
  const count = (read ?? []).filter((r) => known.has(r.lesson_id.slice("debunk:".length))).length;
  if (count >= 10) {
    await gamificationStore()?.grantAchievements(session.user.id, ["anty-guru"]);
  }
  return { ok: true };
}

/**
 * Staff resolve a submitted claim (Phase 16; audited since Phase 18). Corrections go
 * through `resolveCorrection` in community moderation, which also awards XP.
 */
export async function resolveItem(input: unknown): Promise<{ ok: boolean }> {
  const parsed = z
    .object({
      table: z.literal("debunk_submissions"),
      id: z.number().int().positive(),
      status: z.enum(["approved", "rejected"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await staffFor("debunk");
  if (!who) return { ok: false };
  const { id, status } = parsed.data;
  const { data: before } = await who.admin
    .from("debunk_submissions")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { ok: false };
  const { error } = await who.admin
    .from("debunk_submissions")
    .update({ status, reviewed_by: who.actor })
    .eq("id", id);
  if (error) return { ok: false };
  return {
    ok: await audit(who.admin, who.actor, `debunk.${status}`, `debunk_submission:${String(id)}`, {
      before: before.status,
      after: status,
    }),
  };
}
