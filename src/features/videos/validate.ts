import katex from "katex";

import { videoSource } from "@/components/content/video-source";

/**
 * Rules for video landing pages beyond their shape (Phase 19), run at content build:
 * unique ids and short slugs, at least one playable link, and every reference (the
 * simulation, the three exercises, the next lesson, the debunk entry) points at
 * something that exists. The formula must render with KaTeX.
 */
export type VideoRef = {
  id: string;
  slug: string;
  file: string;
  urls: { tiktok?: string | undefined; youtube?: string | undefined };
  formula: string;
  simulation: string;
  exercises: readonly string[];
  nextLesson: string;
  debunk?: string | undefined;
};

export type KnownIds = {
  sims: ReadonlySet<string>;
  exercises: ReadonlySet<string>;
  lessons: ReadonlySet<string>;
  debunk: ReadonlySet<string>;
};

export function validateVideos(videos: readonly VideoRef[], known: KnownIds): string[] {
  const errors: string[] = [];
  const ids = new Map<string, string>();
  const slugs = new Map<string, string>();
  for (const v of videos) {
    const at = (field: string, msg: string) => errors.push(`${v.file}: ${field}: ${msg}`);
    const idFirst = ids.get(v.id);
    if (idFirst) at("id", `"${v.id}" is already used by ${idFirst}`);
    else ids.set(v.id, v.file);
    const slugFirst = slugs.get(v.slug);
    if (slugFirst) at("slug", `"${v.slug}" is already used by ${slugFirst}`);
    else slugs.set(v.slug, v.file);

    const links = Object.entries(v.urls).filter(([, u]) => u !== undefined);
    if (links.length === 0) at("urls", "give a tiktok or youtube link");
    for (const [platform, url] of links) {
      const src = url ? videoSource(url) : null;
      if (src?.platform !== platform) at(`urls.${platform}`, `not a ${platform} video link`);
    }
    try {
      katex.renderToString(v.formula, { throwOnError: true, strict: "error", displayMode: true });
    } catch (e) {
      at("formula", e instanceof Error ? (e.message.split("\n")[0] ?? "invalid") : "invalid");
    }
    if (!known.sims.has(v.simulation)) at("simulation", `no simulation "${v.simulation}"`);
    if (v.exercises.length !== 3) at("exercises", "list exactly 3 exercise ids");
    if (new Set(v.exercises).size !== v.exercises.length) at("exercises", "ids repeat");
    for (const ex of v.exercises) {
      if (!known.exercises.has(ex)) at("exercises", `no exercise "${ex}"`);
    }
    if (!known.lessons.has(v.nextLesson)) at("nextLesson", `no lesson "${v.nextLesson}"`);
    if (v.debunk !== undefined && !known.debunk.has(v.debunk)) {
      at("debunk", `no debunk entry "${v.debunk}"`);
    }
  }
  return errors;
}
