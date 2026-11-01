import { getTranslations } from "next-intl/server";

import { ProgressMerger } from "@/features/progress/progress-merger";
import { Link } from "@/i18n/navigation";
import { isSupabaseConfigured } from "@/lib/db/config";
import { getSession } from "@/lib/db/session";

const linkClass = "text-sm text-ink-muted hover:text-ink";

/**
 * Top-bar account slot: "Zaloguj" or the user's handle. Reads the session cookie, so it
 * renders inside a <Suspense> boundary and the rest of the page stays static.
 */
export async function AccountLink() {
  const t = await getTranslations();
  if (!isSupabaseConfigured()) {
    return (
      <Link href="/profile" className={linkClass}>
        {t("nav.profile")}
      </Link>
    );
  }
  const session = await getSession();
  if (!session) {
    return (
      <Link href="/sign-in" className={linkClass}>
        {t("auth.signIn")}
      </Link>
    );
  }
  const { data: profile } = await session.supabase
    .from("profiles")
    .select("handle")
    .eq("id", session.user.id)
    .single();
  return (
    <>
      <Link href="/profile" className={`${linkClass} num`}>
        {profile?.handle ?? t("nav.profile")}
      </Link>
      <ProgressMerger />
    </>
  );
}

/** Same footprint as the link, so the bar doesn't shift while the session loads. */
export function AccountLinkFallback() {
  return <span className="inline-block h-5 w-16" aria-hidden="true" />;
}
