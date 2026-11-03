import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { alternatesFor } from "@/components/shell/section-page";
import { Skeleton } from "@/components/ui/display";
import { isStyleguideEnabled } from "@/config/runtime";
import { siteConfig } from "@/config/site";
import { env } from "@/env";
import { bioSource, withUtm, type Utm } from "@/features/utm/utm";
import { listVideos, pickText } from "@/features/videos/entries";
import { getPathname } from "@/i18n/navigation";
import type { Locale, StaticPathname } from "@/i18n/routing";

type Props = PageProps<"/[locale]/links">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "links" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternatesFor("/links", locale),
    // The link-in-bio page is a door, not content: keep it out of search results.
    robots: { index: false, follow: true },
  };
}

/**
 * Link in bio (Phase 19): one page for TikTok, YouTube and Instagram profiles. Every
 * link carries the campaign (`?src=tiktok` → utm_source=tiktok), so visits show in the
 * admin dashboard's campaign table.
 */
export default function LinksPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-12 h-96 max-w-md" />}>
      <Links params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const SECTIONS: readonly { key: "learn" | "debunk" | "lab" | "practice"; href: StaticPathname }[] =
  [
    { key: "learn", href: "/learn" },
    { key: "debunk", href: "/debunk" },
    { key: "lab", href: "/lab" },
    { key: "practice", href: "/practice" },
  ];

async function Links({ params, searchParams }: Props) {
  await connection();
  const locale = (await params).locale as Locale;
  const t = await getTranslations("links");
  const utm: Utm = {
    source: bioSource((await searchParams).src),
    medium: "link-in-bio",
    campaign: "bio",
  };
  const videos = listVideos(isStyleguideEnabled(env)).slice(0, 5);
  const link = (href: string) => withUtm(href, utm);
  const item =
    "block rounded-md border border-rule-strong bg-surface px-4 py-3 text-center font-medium text-ink no-underline hover:bg-sunken";

  return (
    <div className="mx-auto grid max-w-md gap-8 px-4 pt-12 pb-16" data-links={utm.source}>
      <header className="grid gap-2 text-center">
        <h1 className="text-2xl">{siteConfig.name}</h1>
        <p className="text-ink-muted">{t("tagline")}</p>
      </header>
      <nav aria-label={t("title")}>
        <ul className="grid gap-3">
          <li>
            <a href={link(getPathname({ href: "/", locale }))} className={item}>
              {t("home")}
            </a>
          </li>
          {videos.map((v) => (
            <li key={v.id}>
              <a
                href={link(
                  getPathname({
                    href: { pathname: "/v/[slug]", params: { slug: v.slug } },
                    locale,
                  }),
                )}
                className={item}
                data-links-video={v.slug}
              >
                {t("video", { title: pickText(v.title, locale) })}
              </a>
            </li>
          ))}
          {SECTIONS.map((s) => (
            <li key={s.key}>
              <a href={link(getPathname({ href: s.href, locale }))} className={item}>
                {t(s.key)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
