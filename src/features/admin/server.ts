import "server-only";

import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/db/admin";
import { isSupabaseConfigured } from "@/lib/db/config";
import { getSession, type Session } from "@/lib/db/session";

import { canAccess, type Section } from "./access";

/**
 * Server-side admin checks (Phase 18): every admin page, action and API route calls one
 * of these first. The proxy has already shown a 403 to anyone without the role; this is
 * the enforcement that doesn't rely on it.
 */
export type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export type Staff = { session: Session; roles: string[]; admin: Admin; actor: string };

export async function rolesOf(session: Session): Promise<string[]> {
  const { data } = await session.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);
  return (data ?? []).map((r) => r.role);
}

/** The signed-in staff member if their role opens `section`, else null. */
export async function staffFor(section: Section): Promise<Staff | null> {
  if (!isSupabaseConfigured()) return null;
  const session = await getSession();
  if (!session) return null;
  const roles = await rolesOf(session);
  const admin = createAdminClient();
  if (!admin || !canAccess(roles, section)) return null;
  return { session, roles, admin, actor: session.user.id };
}

/** For admin pages (inside their Suspense boundary). */
export async function requirePage(section: Section): Promise<Staff> {
  const staff = await staffFor(section);
  if (!staff) notFound();
  return staff;
}

/** For admin API routes: the staff member, or a 403 response to return. */
export async function requireApi(section: Section): Promise<Staff | Response> {
  return (
    (await staffFor(section)) ??
    Response.json({ error: "forbidden" }, { status: 403, headers: { "cache-control": "no-store" } })
  );
}

/** One audit row; every admin write goes through this (users can't write the log). */
export async function audit(
  admin: Admin,
  actor: string,
  action: string,
  target: string,
  details: Record<string, unknown> = {},
): Promise<boolean> {
  const { error } = await admin.from("audit_log").insert({
    actor_id: actor,
    action,
    target,
    details: JSON.parse(JSON.stringify(details)) as never,
  });
  return !error;
}
