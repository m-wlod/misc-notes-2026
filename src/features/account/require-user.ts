import "server-only";

import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Profile } from "@/lib/db/profile";
import { getSession, type Session } from "@/lib/db/session";

/**
 * For pages that need an account: returns the session and profile, or redirects to
 * sign-in. Server-side check; RLS still guards every query underneath.
 */
export async function requireUser(locale: Locale): Promise<Session & { profile: Profile }> {
  const session = await getSession();
  if (!session) redirect({ href: "/sign-in", locale });
  const s = session as Session;
  const { data: profile } = await s.supabase
    .from("profiles")
    .select("*")
    .eq("id", s.user.id)
    .single();
  if (!profile) redirect({ href: "/sign-in", locale });
  return { ...s, profile: profile as Profile };
}
