import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { debunk } from "#content";
import { isStyleguideEnabled } from "@/config/runtime";
import { siteConfig } from "@/config/site";
import { env } from "@/env";
import { SHARE_SIZES } from "@/features/gamification/daily";

/**
 * A Debunk Lab entry's share card (Phase 16): the claim and the verdict, as a link card
 * (1200×630) or a story (1080×1920). Only entries the visitor could open are drawn.
 */
const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
const C = { bg: "#f6f1e7", ink: "#1b2230", muted: "#5d6472", accent: "#b4440e" };
const SYMBOL = { false: "✕", misleading: "!", "true-but-irrelevant": "≈", depends: "?" } as const;

const params = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,120}$/),
  lang: z.enum(["pl", "en"]).default("pl"),
  format: z.enum(["og", "story"]).default("og"),
});

export async function GET(request: NextRequest) {
  const parsed = params.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return new Response("bad parameters", { status: 400 });
  const { id, lang, format } = parsed.data;
  const internal = isStyleguideEnabled(env);
  const pick = (l: "pl" | "en") =>
    debunk.find((e) => e.id === id && e.locale === l && (e.status === "published" || internal));
  const entry = pick(lang) ?? pick("pl");
  if (!entry) return new Response("not found", { status: 404 });

  const t = await getTranslations({ locale: lang, namespace: "debunk" });
  const [w, h] = SHARE_SIZES[format];
  const story = format === "story";
  const s = story ? 1.6 : 1;
  const [sans4, sans4x, sans6, sans6x] = await Promise.all([
    font("ibm-plex-sans-latin-400-normal.woff"),
    font("ibm-plex-sans-latin-ext-400-normal.woff"),
    font("ibm-plex-sans-latin-600-normal.woff"),
    font("ibm-plex-sans-latin-ext-600-normal.woff"),
  ]);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: story ? "center" : "space-between",
        gap: 48 * s,
        padding: `${String(72 * s)}px ${String(80 * s)}px`,
        background: C.bg,
        color: C.ink,
        fontFamily: "Plex Sans",
      }}
    >
      <div style={{ display: "flex", fontSize: 28 * s, color: C.accent, fontWeight: 600 }}>
        {`Debunk Lab · ${t(`category.${entry.category}`)}`}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: (entry.claim.length > 70 ? 48 : 60) * s,
          fontWeight: 600,
          lineHeight: 1.15,
        }}
      >
        {`„${entry.claim}”`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 * s }}>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            border: `${String(3 * s)}px solid ${C.ink}`,
            borderRadius: 6 * s,
            padding: `${String(6 * s)}px ${String(16 * s)}px`,
            fontSize: 34 * s,
            fontWeight: 600,
          }}
        >
          {`${SYMBOL[entry.verdict]}  ${t(`verdict.${entry.verdict}`)}`}
        </div>
        <div style={{ display: "flex", fontSize: 26 * s, color: C.muted }}>
          {`${siteConfig.name} · ${t("entry.principle")}`}
        </div>
      </div>
    </div>,
    {
      width: w,
      height: h,
      fonts: [
        { name: "Plex Sans", data: sans4, weight: 400, style: "normal" },
        { name: "Plex Sans", data: sans4x, weight: 400, style: "normal" },
        { name: "Plex Sans", data: sans6, weight: 600, style: "normal" },
        { name: "Plex Sans", data: sans6x, weight: 600, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=3600" },
    },
  );
}
