import type { LessonNode } from "./index";

/** next-intl href for a lesson page. Client-safe (index.ts is server-only). */
export function lessonHref(node: Pick<LessonNode, "trackSlug" | "moduleSlug" | "slug">) {
  return {
    pathname: "/learn/[track]/[module]/[lesson]",
    params: { track: node.trackSlug, module: node.moduleSlug, lesson: node.slug },
  } as const;
}
