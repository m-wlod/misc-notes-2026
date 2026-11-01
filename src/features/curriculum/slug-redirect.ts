import lessonSlugs from "../../../.velite/lesson-slugs.json";
import { curriculum } from "../../../content/curriculum";

/**
 * Track and module slugs differ per locale (`/pl/nauka/fundamenty` ↔ `/en/learn/foundations`).
 * The language switcher keeps the current slug, so `/en/learn/fundamenty` must become a
 * real 308 to `/en/learn/foundations`, and an unknown slug must be a real 404. Runs in
 * proxy.ts: pages under partial prerendering stream a 200 shell before they can redirect
 * or call notFound(). Pure, so it is unit-tested.
 */
const SECTION = { pl: "nauka", en: "learn" } as const;
const PATH = /^\/(pl|en)\/(nauka|learn)\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?\/?$/;
const slugsOf = lessonSlugs as Record<string, { pl?: string; en?: string } | undefined>;

type Slugs = { slug: { pl: string; en: string } };
const hasSlug = (item: Slugs, slug: string) => item.slug.pl === slug || item.slug.en === slug;

export type CurriculumRoute = { redirect: string } | "missing" | null;

/** `{ redirect }` for a slug from the other locale, "missing" for unknown slugs, else null. */
export function curriculumRoute(pathname: string): CurriculumRoute {
  const match = PATH.exec(pathname);
  if (!match) return null;
  const [, rawLocale, section, trackSlug = "", moduleSlug, lessonSlug] = match;
  const locale = rawLocale === "en" ? "en" : "pl";
  if (section !== SECTION[locale]) return null; // next-intl handles the section slug itself

  const track = curriculum.find((t) => hasSlug(t, trackSlug));
  if (!track) return "missing";
  const mod =
    moduleSlug === undefined ? undefined : track.modules.find((m) => hasSlug(m, moduleSlug));
  if (moduleSlug !== undefined && !mod) return "missing";
  let lesson: string | undefined;
  if (mod && lessonSlug !== undefined) {
    const id = mod.lessons.find((l) => {
      const slugs = slugsOf[l];
      return slugs?.pl === lessonSlug || slugs?.en === lessonSlug;
    });
    lesson = id ? (slugsOf[id]?.[locale] ?? slugsOf[id]?.pl) : undefined;
    if (!lesson) return "missing";
  }

  const target = [locale, SECTION[locale], track.slug[locale], mod?.slug[locale], lesson]
    .filter(Boolean)
    .join("/");
  const current = [locale, section, trackSlug, moduleSlug, lessonSlug].filter(Boolean).join("/");
  return target === current ? null : { redirect: `/${target}` };
}
