import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { siteConfig } from "@/config/site";
import { SHARE_SIZES, shareParams } from "@/features/gamification/daily";

/**
 * The problem-of-the-day share card (Phase 15): a story (1080×1920) or a link card
 * (1200×630). One square per attempt, filled for the solve, outlined for a miss, so it
 * reads without colour and never gives the answer away. Fonts and colours are the site's.
 */
const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

const C = {
  bg: "#f6f1e7",
  ink: "#1b2230",
  muted: "#5d6472",
  rule: "#8a806c",
  accent: "#b4440e",
  correct: "#2f6b3a",
};

export async function GET(request: NextRequest) {
  const parsed = shareParams.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return new Response("bad parameters", { status: 400 });
  const p = parsed.data;
  const t = await getTranslations({ locale: p.lang, namespace: "gamification.share" });
  const [w, h] = SHARE_SIZES[p.format];
  const story = p.format === "story";
  const scale = story ? 1.6 : 1;
  const marks = p.r.split("");
  const solvedIn = marks.indexOf("o") + 1;
  const date = new Intl.DateTimeFormat(p.lang === "en" ? "en-GB" : "pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${p.d}T12:00:00Z`));

  const [sans4, sans4x, sans6, sans6x, mono, monox] = await Promise.all([
    font("ibm-plex-sans-latin-400-normal.woff"),
    font("ibm-plex-sans-latin-ext-400-normal.woff"),
    font("ibm-plex-sans-latin-600-normal.woff"),
    font("ibm-plex-sans-latin-ext-600-normal.woff"),
    font("ibm-plex-mono-latin-500-normal.woff"),
    font("ibm-plex-mono-latin-ext-500-normal.woff"),
  ]);

  const square = 56 * scale;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: story ? "center" : "space-between",
        gap: 48 * scale,
        padding: `${String(72 * scale)}px ${String(80 * scale)}px`,
        background: C.bg,
        color: C.ink,
        fontFamily: "Plex Sans",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 * scale }}>
        <div style={{ display: "flex", fontSize: 28 * scale, color: C.accent, fontWeight: 600 }}>
          {t("title")}
        </div>
        <div style={{ display: "flex", fontSize: 40 * scale, fontWeight: 600 }}>
          {`${t("level", { level: p.l })} · ${date}`}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16 * scale }}>
        {marks.map((m, i) => (
          <div
            key={i}
            style={{
              width: square,
              height: square,
              borderRadius: 6 * scale,
              border: `${String(4 * scale)}px solid ${m === "o" ? C.correct : C.rule}`,
              background: m === "o" ? C.correct : "transparent",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 * scale }}>
        <div style={{ display: "flex", fontSize: 36 * scale }}>
          {`${solvedIn > 0 ? t("solved", { attempts: solvedIn }) : t("notSolved")}${
            p.h > 0 ? ` · ${t("hints", { hints: p.h })}` : ""
          }`}
        </div>
        <div
          style={{ display: "flex", fontSize: 26 * scale, color: C.muted, fontFamily: "Plex Mono" }}
        >
          {`${siteConfig.name} · ${t("noSpoilers")}`}
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
        { name: "Plex Mono", data: mono, weight: 500, style: "normal" },
        { name: "Plex Mono", data: monox, weight: 500, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
    },
  );
}
