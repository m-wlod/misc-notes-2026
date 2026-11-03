import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { listEntries } from "@/features/debunk/entries";
import { listVideos, pickText } from "@/features/videos/entries";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * Internal links under a lesson (Phase 19b): the Debunk Lab entries that cite it and the
 * videos that send viewers to it. Rendered at request time, so drafts show only on
 * internal deployments; nothing renders when there is nothing to link.
 */
export async function RelatedLinks({ lessonId, locale }: { lessonId: string; locale: Locale }) {
  await connection();
  const internal = isStyleguideEnabled(env);
  const entries = listEntries(locale, internal).filter((e) => e.relatedLessons.includes(lessonId));
  const videos = listVideos(internal).filter((v) => v.nextLesson === lessonId);
  if (entries.length === 0 && videos.length === 0) return null;
  const t = await getTranslations("seo");
  return (
    <section
      aria-labelledby="related-links"
      data-related-links={lessonId}
      className="mx-auto mt-10 max-w-(--measure) border-t border-rule pt-6"
    >
      <h2 id="related-links" className="mb-3 text-xl">
        {t("relatedTitle")}
      </h2>
      <ul className="grid gap-2">
        {entries.map((e) => (
          <li key={e.id} data-related-debunk={e.id}>
            <Link href={{ pathname: "/debunk/[slug]", params: { slug: e.slug } }}>
              {t("relatedDebunk", { claim: e.claim })}
            </Link>
          </li>
        ))}
        {videos.map((v) => (
          <li key={v.id} data-related-video={v.slug}>
            <Link href={{ pathname: "/v/[slug]", params: { slug: v.slug } }}>
              {t("relatedVideo", { title: pickText(v.title, locale) })}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
