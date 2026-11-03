"use server";

import { z } from "zod";

import { audit, staffFor } from "./server";

/**
 * Admin actions (Phase 18). Each one checks the role for its section first, writes with
 * the secret key, and records an audit row. They return only ok / a reason.
 */
export type AdminResult =
  { ok: true } | { ok: false; reason: "forbidden" | "invalid" | "self" | "failed" };

const ROLES = ["admin", "moderator", "reviewer"] as const;

export async function setRole(input: unknown): Promise<AdminResult> {
  const parsed = z
    .object({ userId: z.uuid(), role: z.enum(ROLES), grant: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const staff = await staffFor("users");
  if (!staff) return { ok: false, reason: "forbidden" };
  const { userId, role, grant } = parsed.data;
  // Nobody locks themselves (or the last way in) out by accident.
  if (!grant && role === "admin" && userId === staff.actor) return { ok: false, reason: "self" };
  const table = staff.admin.from("user_roles");
  const { error } = grant
    ? await table.upsert(
        { user_id: userId, role },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      )
    : await table.delete().eq("user_id", userId).eq("role", role);
  if (error) return { ok: false, reason: "failed" };
  const logged = await audit(
    staff.admin,
    staff.actor,
    grant ? "role.grant" : "role.revoke",
    `user:${userId}`,
    {
      role,
    },
  );
  return logged ? { ok: true } : { ok: false, reason: "failed" };
}
