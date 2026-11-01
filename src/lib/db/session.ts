import "server-only";

import type { User } from "@supabase/supabase-js";

import { createClient } from "./server";

export type Session = {
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
  user: User;
};

/**
 * The signed-in user, validated with the auth server (getUser, not getSession).
 * null when signed out or when Supabase isn't configured on this deployment.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, user: data.user } : null;
}
