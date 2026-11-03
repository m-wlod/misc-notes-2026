import "server-only";

import { videos, type Video } from "#content";
import type { Locale } from "@/i18n/routing";

/**
 * Video landing pages (Phase 19). Published ones for everyone; drafts and labelled
 * samples only on internal deployments. Newest first.
 */
export type { Video };

const visible = (v: Video, internal: boolean) => v.status === "published" || internal;

export function listVideos(internal: boolean): Video[] {
  return videos
    .filter((v) => visible(v, internal))
    .sort((a, b) => b.published.localeCompare(a.published) || a.id.localeCompare(b.id));
}

export function videoBySlug(slug: string, internal: boolean): Video | null {
  return listVideos(internal).find((v) => v.slug === slug) ?? null;
}

/** Every slug, for static params (visibility is checked again at request time). */
export const allVideoSlugs = () => videos.map((v) => ({ slug: v.slug }));

export const pickText = (t: { pl: string; en?: string | undefined }, locale: Locale) =>
  locale === "en" ? (t.en ?? t.pl) : t.pl;

/** The video's link to play, YouTube first (no-cookie player), then TikTok. */
export const videoUrl = (v: Video) => v.urls.youtube ?? v.urls.tiktok ?? null;
