import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";
import { LessonView } from "@/features/content/lesson-view";
import { getLesson, listLessons } from "@/features/content/lessons";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * Internal tool: renders any lesson, drafts included, for review. Same gate as
 * /styleguide (proxy.ts 404s it in production; this page re-checks at request time).
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ContentPreviewPage({
  params,
  searchParams,
}: PageProps<"/[locale]/dev/content-preview">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6">
      <Suspense fallback={null}>
        <Gate params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Gate({
  params,
  searchParams,
}: Pick<PageProps<"/[locale]/dev/content-preview">, "params" | "searchParams">) {
  await connection();
  if (!isStyleguideEnabled(env)) notFound();
  const locale = (await params).locale as Locale;
  const { id } = await searchParams;
  const t = await getTranslations("content.preview");

  if (typeof id === "string") {
    const resolved = getLesson(id, locale, { includeDrafts: true });
    return (
      <>
        <p className="mb-8 font-sans text-sm">
          <Link href="/dev/content-preview" className="text-accent-text underline">
            ← {t("back")}
          </Link>
        </p>
        {resolved ? <LessonView {...resolved} /> : <p>{t("notFound", { id })}</p>}
      </>
    );
  }

  const all = listLessons({ includeDrafts: true });
  return (
    <>
      <h1 className="mb-2 text-3xl">{t("title")}</h1>
      <p className="mb-8 text-base text-ink-muted">{t("lead")}</p>
      {all.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="grid max-w-(--measure) gap-3">
          {all.map(({ lesson, locales }) => (
            <li key={lesson.id} className="border-b border-rule pb-3">
              <Link
                href={{ pathname: "/dev/content-preview", query: { id: lesson.id } }}
                className="text-lg text-accent-text underline-offset-2 hover:underline"
              >
                {lesson.title}
              </Link>
              <p className="num text-xs text-ink-muted">
                {lesson.id} · {lesson.status} · {locales.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
