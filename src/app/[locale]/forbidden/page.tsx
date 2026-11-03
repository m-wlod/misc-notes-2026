import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The 403 page (Phase 18). The proxy rewrites admin paths here, with status 403, for
 * anyone whose role doesn't open that section (signed out included). Static.
 */
export default async function ForbiddenPage() {
  const t = await getTranslations("errors.forbidden");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-16 pb-16 sm:px-6" data-forbidden="">
      <p className="mb-3 num text-xs text-ink-muted">403</p>
      <h1 className="mb-4 text-3xl">{t("title")}</h1>
      <p className="mb-8 max-w-(--measure) font-serif text-reading">{t("body")}</p>
      <Link href="/" className="text-accent-text underline underline-offset-4">
        {t("home")}
      </Link>
    </div>
  );
}
