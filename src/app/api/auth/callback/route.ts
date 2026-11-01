import { NextResponse, type NextRequest } from "next/server";

import { localeOfPath, safeNext } from "@/features/auth/safe-next";
import { getPathname } from "@/i18n/navigation";
import { createClient } from "@/lib/db/server";

/**
 * Landing point for magic links and OAuth (PKCE). Exchanges the one-time code for a
 * session cookie, then sends new users to onboarding and everyone else to `next`.
 * Lives under /api so the locale proxy leaves it alone.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const locale = url.searchParams.get("locale") === "en" ? "en" : "pl";
  const fallback = getPathname({ href: "/profile", locale });
  const next = safeNext(url.searchParams.get("next"), fallback);
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));
  const signInError = () =>
    to(`${getPathname({ href: "/sign-in", locale: localeOfPath(next) })}?error=callback`);

  const code = url.searchParams.get("code");
  const supabase = await createClient();
  if (!code || !supabase) return signInError();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return signInError();

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, locale")
    .eq("id", data.user.id)
    .single();

  if (!profile?.onboarded_at) {
    return to(
      getPathname({
        href: "/onboarding",
        locale: profile?.locale === "en" ? "en" : localeOfPath(next),
      }),
    );
  }
  return to(next);
}
