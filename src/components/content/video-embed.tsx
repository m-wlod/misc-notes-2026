"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { videoSource } from "./video-source";

/**
 * A video behind a click: nothing is requested from YouTube or TikTok until the reader
 * presses play (privacy and page speed). Unknown URLs become a plain link.
 */
export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const t = useTranslations("reader.video");
  const [playing, setPlaying] = useState(false);
  const source = videoSource(url);

  if (!source) {
    return (
      <a
        href={url}
        rel="noopener noreferrer"
        target="_blank"
        className="text-accent-text underline"
      >
        {title}
      </a>
    );
  }
  const platform = source.platform === "youtube" ? "YouTube" : "TikTok";
  const ratio = source.platform === "youtube" ? "aspect-video" : "aspect-[9/16] max-w-xs";

  return (
    <figure className="my-6">
      <div
        className={`relative w-full overflow-hidden rounded-md border border-rule-strong bg-sunken ${ratio}`}
      >
        {playing ? (
          <iframe
            src={source.embedUrl}
            title={title}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setPlaying(true);
            }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center font-sans"
          >
            <span
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-full bg-ink text-bg"
            >
              ▶
            </span>
            <span className="text-base text-ink">{t("play", { title })}</span>
            <span className="text-xs text-ink-muted">{t("consent", { platform })}</span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 font-sans text-sm text-ink-muted">
        {title} ·{" "}
        <a href={url} rel="noopener noreferrer" target="_blank" className="underline">
          {t("openOn", { platform })}
        </a>
      </figcaption>
    </figure>
  );
}
