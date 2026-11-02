import type { Metadata } from "next";
import { connection } from "next/server";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { challenges } from "#content";
import { alternatesFor } from "@/components/shell/section-page";
import { Skeleton } from "@/components/ui/display";
import { ChallengeForm } from "@/features/challenge/challenge-form";
import { currentChallenge } from "@/features/challenge/current";
import { renderText } from "@/features/exercises/render-text";
import type { Locale } from "@/i18n/routing";
import { isSupabaseConfigured } from "@/lib/db/config";
import { getSession } from "@/lib/db/session";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/challenge">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "challenge" });
  return {
    title: t("metaTitle"),
    description: t("lead"),
    alternates: alternatesFor("/challenge", locale),
  };
}

/** The weekly challenge (Phase 15). Request-time: which week it is. */
export default async function ChallengePage() {
  const t = await getTranslations("challenge");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-3 text-3xl">{t("metaTitle")}</h1>
      <p className="mb-8 max-w-(--measure) text-base text-ink-muted">{t("lead")}</p>
      <Suspense fallback={<Skeleton className="h-64 max-w-xl" />}>
        <ChallengeBody />
      </Suspense>
    </div>
  );
}

async function ChallengeBody() {
  await connection();
  const t = await getTranslations("challenge");
  const locale = await getLocale();
  const format = await getFormatter();
  const c = currentChallenge(challenges, new Date());
  if (!c) {
    return (
      <p data-challenge-none="" className="max-w-(--measure) font-serif text-reading">
        {t("none")}
      </p>
    );
  }
  const session = isSupabaseConfigured() ? await getSession() : null;
  return (
    <article data-challenge={c.id} className="grid max-w-(--measure) gap-5">
      <h2 className="text-xl">{c.title[locale]}</h2>
      <div
        className="font-serif text-reading"
        dangerouslySetInnerHTML={{ __html: renderText(c.prompt[locale]) }}
      />
      <p className="font-sans text-sm text-ink-muted">
        {c.open
          ? t("deadline", {
              date: format.dateTime(new Date(c.deadline), {
                dateStyle: "full",
                timeStyle: "short",
                timeZone: "Europe/Warsaw",
              }),
            })
          : t("closed")}
      </p>
      {c.open ? (
        session ? (
          <ChallengeForm challengeId={c.id} />
        ) : (
          <p className="font-sans text-sm">{t("signedOut")}</p>
        )
      ) : null}
      <p className="font-sans text-xs text-ink-muted">{t("community")}</p>
    </article>
  );
}
