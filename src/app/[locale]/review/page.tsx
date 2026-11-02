import type { Metadata } from "next";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { alternatesFor } from "@/components/shell/section-page";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/display";
import { sessionItems } from "@/features/review/items";
import { ReviewSession } from "@/features/review/review-session";
import { readCards } from "@/features/review/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { isSupabaseConfigured } from "@/lib/db/config";
import { getSession } from "@/lib/db/session";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/review">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "review" });
  return {
    title: t("metaTitle"),
    description: t("lead"),
    alternates: alternatesFor("/review", locale),
    robots: { index: false },
  };
}

/** The daily review (Phase 15). Signed-in only; the cards are the user's own. */
export default async function ReviewPage() {
  const t = await getTranslations("review");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-3 text-3xl">{t("metaTitle")}</h1>
      <p className="mb-8 max-w-(--measure) text-base text-ink-muted">{t("lead")}</p>
      <Suspense fallback={<Skeleton className="h-64 max-w-xl" />}>
        <ReviewBody />
      </Suspense>
    </div>
  );
}

async function ReviewBody() {
  await connection();
  const t = await getTranslations("review");
  const tAuth = await getTranslations("auth");
  const locale = await getLocale();
  const note = (text: string) => (
    <p data-review-note="" className="max-w-(--measure) font-serif text-reading">
      {text}
    </p>
  );
  if (!isSupabaseConfigured()) return note(tAuth("notConfigured"));
  const session = await getSession();
  if (!session) {
    return (
      <div className="grid gap-4">
        {note(t("signedOut"))}
        <Link href="/sign-in" className={`${buttonClass("primary")} justify-self-start`}>
          {tAuth("signIn")}
        </Link>
      </div>
    );
  }
  const now = new Date();
  const items = sessionItems(
    await readCards(session),
    now,
    locale,
    (lesson) => t("formulaFront", { lesson }),
    t("mistakeSource"),
  );
  return <ReviewSession items={items} now={now.toISOString()} />;
}
