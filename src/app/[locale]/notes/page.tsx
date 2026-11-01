import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { alternatesFor } from "@/components/shell/section-page";
import { listLessons } from "@/features/content/lessons";
import { lessonHref, lessonsInOrder } from "@/features/curriculum";
import { NotesList, type LessonIndex } from "@/features/notes/notes-list";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/notes">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "notes.page" });
  // Personal page: nothing for search engines.
  return {
    title: t("title"),
    robots: { index: false },
    alternates: alternatesFor("/notes", locale),
  };
}

/** "Moje notatki": everything kept in this browser. The list itself renders on the client. */
export default async function NotesPage({ params }: PageProps<"/[locale]/notes">) {
  const locale = (await params).locale as Locale;
  const t = await getTranslations("notes.page");

  const lessons: LessonIndex = Object.fromEntries(
    lessonsInOrder(locale).map(({ track, module, lesson }) => [
      lesson.id,
      {
        title: lesson.title,
        href: getPathname({ href: lessonHref(lesson), locale }),
        context: `${track.name} · ${module.name}`,
      },
    ]),
  );
  // Samples live outside the curriculum and are reachable in the internal preview only.
  for (const { lesson } of listLessons({ includeDrafts: true })) {
    if (lesson.sample) {
      lessons[lesson.id] = {
        title: lesson.title,
        href: `${getPathname({ href: "/dev/content-preview", locale })}?id=${lesson.id}`,
        context: "",
      };
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
      <h1 className="mb-3 text-3xl">{t("title")}</h1>
      <p className="mb-2 max-w-(--measure) text-base text-ink-muted">{t("lead")}</p>
      <p className="mb-10 max-w-(--measure) font-sans text-sm text-ink-muted">{t("privacy")}</p>
      <NotesList lessons={lessons} />
    </div>
  );
}
