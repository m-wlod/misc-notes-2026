import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/display";
import { UnsubscribeView } from "@/features/notify/unsubscribe-view";
import type { Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/unsubscribe">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "notify.unsubscribe" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** One-click unsubscribe from an email (Phase 15). No sign-in: the link is signed. */
export default async function UnsubscribePage({ searchParams }: Props) {
  const t = await getTranslations("notify.unsubscribe");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-6 text-3xl">{t("title")}</h1>
      <Suspense fallback={<Skeleton className="h-24 max-w-xl" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: Pick<Props, "searchParams">) {
  const q = await searchParams;
  const one = (k: string) => {
    const v = q[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  return <UnsubscribeView u={one("u")} k={one("k")} s={one("s")} />;
}
