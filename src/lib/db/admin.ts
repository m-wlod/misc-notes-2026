import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/env";

import type { Database } from "./database.types";

/**
 * Secret-key client: bypasses RLS. Only for server code that must write
 * server-owned tables (graded attempts, XP, entitlements, audit log) or delete an
 * account. Never import from client code (`server-only` makes that a build error).
 * Always check the caller's identity with the user client before using this.
 */
export function createAdminClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
