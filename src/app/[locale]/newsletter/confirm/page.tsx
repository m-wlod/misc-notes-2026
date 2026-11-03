import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { isConfirmToken } from "@/features/newsletter/core";
import { NewsletterLinkAction } from "@/features/newsletter/link-action";
import type { Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/newsletter/confirm">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "newsletter" });
  return { title: t("confirm.title"), robots: { index: false, follow: false } };
}

/** Double opt-in, step two (Phase 19c): the link from the confirmation email. */
export default function NewsletterConfirmPage({ searchParams }: Props) {
  return (
    <div className="mx-auto grid max-w-(--measure) gap-4 px-4 pt-12 pb-16">
      <Suspense fallback={<Skeleton className="h-32" />}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Confirm({ searchParams }: Pick<Props, "searchParams">) {
  await connection();
  const t = await getTranslations("newsletter");
  const raw = (await searchParams).t;
  const token = Array.isArray(raw) ? raw[0] : raw;
  return (
    <>
      <h1 className="text-3xl">{t("confirm.title")}</h1>
      {isConfirmToken(token) ? (
        <>
          <p className="font-serif text-reading">{t("confirm.lead")}</p>
          <div>
            <NewsletterLinkAction kind="confirm" token={token} />
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
