import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { env } from "@/env";
import { verifySubscriber } from "@/features/newsletter/core";
import { NewsletterLinkAction } from "@/features/newsletter/link-action";
import type { Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/newsletter/unsubscribe">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "newsletter" });
  return { title: t("unsubscribe.title"), robots: { index: false, follow: false } };
}

/** Leaving the newsletter (Phase 19c): the link at the bottom of every issue. */
export default function NewsletterUnsubscribePage({ searchParams }: Props) {
  return (
    <div className="mx-auto grid max-w-(--measure) gap-4 px-4 pt-12 pb-16">
      <Suspense fallback={<Skeleton className="h-32" />}>
        <Unsubscribe searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Unsubscribe({ searchParams }: Pick<Props, "searchParams">) {
  await connection();
  const t = await getTranslations("newsletter");
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const i = one(q.i);
  const s = one(q.s);
  const valid = verifySubscriber(env.EMAIL_TOKEN_SECRET, i, s) !== null;
  return (
    <>
      <h1 className="text-3xl">{t("unsubscribe.title")}</h1>
      {valid ? (
        <>
          <p className="font-serif text-reading">{t("unsubscribe.lead")}</p>
          <div>
            <NewsletterLinkAction kind="unsubscribe" i={i} s={s} />
          </div>
        </>
      ) : (
        <p role="alert" data-newsletter-result="invalid">
          {t("invalidLink")}
        </p>
      )}
    </>
  );
}
