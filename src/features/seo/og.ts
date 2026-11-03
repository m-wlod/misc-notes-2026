import type { Metadata } from "next";

/**
 * Link previews (Phase 19b): every public page gets a 1200×630 image from /api/og, in
 * its own language. Pages without their own fall back to the layout's (the site card).
 */
export type OgKind = "page" | "lesson" | "track" | "video" | "sim";

export const OG_SIZE = { width: 1200, height: 630 } as const;

export const ogUrl = (kind: OgKind, id: string, locale: string) =>
  `/api/og?${new URLSearchParams({ kind, id, lang: locale }).toString()}`;

/** `openGraph` and `twitter` metadata with the page's preview image. */
export function ogMeta({
  kind,
  id,
  locale,
  title,
  description,
  type = "website",
}: {
  kind: OgKind;
  id: string;
  locale: string;
  title: string;
  description?: string | undefined;
  type?: "website" | "article";
}): Pick<Metadata, "openGraph" | "twitter"> {
  const image = { url: ogUrl(kind, id, locale), ...OG_SIZE, alt: title };
  return {
    openGraph: {
      type,
      title,
      ...(description ? { description } : {}),
      locale: locale === "pl" ? "pl_PL" : "en_GB",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      ...(description ? { description } : {}),
      images: [image.url],
    },
  };
}
