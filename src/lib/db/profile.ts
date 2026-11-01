import "server-only";

import type { Database, Json } from "./database.types";
import { profileUpdateSchema } from "./profile-schema";
import { createClient } from "./server";

export { profileUpdateSchema, type ProfileUpdate } from "./profile-schema";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** The signed-in user's profile, or null when signed out or not configured. */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
  return data;
}

/** Validates and applies a profile change as the signed-in user (RLS: own row only). */
export async function updateMyProfile(input: unknown) {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" as const };
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, error: "not-configured" as const };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, error: "signed-out" as const };
  // Zod's .partial() yields `key?: T | undefined`; drop the undefined keys so only the
  // fields actually sent are written (and exactOptionalPropertyTypes is satisfied).
  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  ) as Database["public"]["Tables"]["profiles"]["Update"];
  const { error } = await supabase.from("profiles").update(patch).eq("id", auth.user.id);
  if (error)
    return {
      ok: false as const,
      error: error.code === "23505" ? ("handle-taken" as const) : ("failed" as const),
    };
  return { ok: true as const };
}

/** RODO export: every row the signed-in user owns (export_my_data(), RLS-limited). */
export async function exportMyData(): Promise<Json | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("export_my_data");
  return error ? null : data;
}
