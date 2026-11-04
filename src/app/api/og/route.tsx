import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { SECTIONS } from "@/components/shell/section-page";
import { isStyleguideEnabled } from "@/config/runtime";
import { siteConfig } from "@/config/site";
import { env } from "@/env";
import { getLesson } from "@/features/content/lessons";
import { getCurriculum, lessonsInOrder } from "@/features/curriculum";
import { polyline, series, seedOf, SIM_MODEL, type ChartModel } from "@/features/seo/chart";
import { OG_SIZE } from "@/features/seo/og";
import { simById, SIMS } from "@/features/sims/registry";
import { listVideos, pickText } from "@/features/videos/entries";
import type { Locale } from "@/i18n/routing";

/**
 * Link preview images (Phase 19b): the page's title and a small real chart, 1200×630, in
 * both languages. GET /api/og?kind=lesson|track|video|sim|page&id=…&lang=pl|en.
 * Only pages a visitor could open are drawn.
 */
const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
const C = { bg: "#f6f1e7", ink: "#1b2230", muted: "#5d6472", accent: "#b4440e", rule: "#d8cfbf" };

const params = z.object({
  kind: z.enum(["page", "lesson", "track", "video", "sim"]),
  id: z.string().regex(/^[a-z0-9-]{1,120}$/),
  lang: z.enum(["pl", "en"]).default("pl"),
});

type Card = { eyebrow: string; title: string; model: ChartModel; chartLabel: string };

const isSection = (id: string): id is keyof typeof SECTIONS => Object.hasOwn(SECTIONS, id);

async function card(
  kind: z.infer<typeof params>["kind"],
  id: string,
  locale: Locale,
  internal: boolean,
): Promise<Card | null> {
  const t = await getTranslations({ locale });
  const ts = await getTranslations({ locale, namespace: "sims" });
  const simTitle = (simId: string) => ts(`${simId}.title` as Parameters<typeof ts>[0]);
  const simLabel = (simId: string) => t("seo.ogSimulation", { title: simTitle(simId) });
  const illustration = t("seo.ogIllustration");
  const fromSim = (simId: string | undefined) => {
    const model = simId ? SIM_MODEL[simId] : undefined;
    return model && simId
      ? { model, chartLabel: simLabel(simId) }
      : { model: "walk" as const, chartLabel: illustration };
  };

  switch (kind) {
    case "page": {
      if (id === "home") {
        return { eyebrow: siteConfig.name, title: t("home.title"), ...fromSim(undefined) };
      }
      if (!isSection(id)) return null;
      return { eyebrow: siteConfig.name, title: t(`sections.${id}.title`), ...fromSim(undefined) };
    }
    case "sim": {
      const sim = simById(id);
      if (!sim) return null;
      return { eyebrow: t("sims.lab.title"), title: simTitle(sim.id), ...fromSim(sim.id) };
    }
    case "track": {
      const track = getCurriculum(locale).find((tr) => tr.id === id);
      if (!track) return null;
      return { eyebrow: siteConfig.name, title: track.name, ...fromSim(undefined) };
    }
    case "lesson": {
      const resolved = getLesson(id, locale, { includeDrafts: internal });
      if (!resolved) return null;
      const place = lessonsInOrder(locale).find((p) => p.lesson.id === id);
      const sim = SIMS.find((s) => s.lessonId === id && SIM_MODEL[s.id]);
      return {
        eyebrow: place ? `${place.lesson.number} · ${place.track.name}` : siteConfig.name,
        title: resolved.lesson.title,
        ...fromSim(sim?.id),
      };
    }
    case "video": {
      const video = listVideos(internal).find((v) => v.id === id);
      if (!video) return null;
      return {
        eyebrow: t("seo.ogVideo"),
        title: pickText(video.title, locale),
        ...fromSim(video.simulation),
      };
    }
  }
}

export async function GET(request: NextRequest) {
  const parsed = params.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return new Response("bad parameters", { status: 400 });
  const { kind, id, lang } = parsed.data;
  const c = await card(kind, id, lang, isStyleguideEnabled(env));
  if (!c) return new Response("not found", { status: 404 });

  const chartW = 1040;
  const chartH = 190;
  const points = polyline(series(c.model, seedOf(`${kind}:${id}`)), chartW, chartH);
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
        justifyContent: "space-between",
        padding: "56px 80px",
        background: C.bg,
        color: C.ink,
        fontFamily: "Plex Sans",
      }}
    >
      <div style={{ display: "flex", fontSize: 26, color: C.accent, fontWeight: 600 }}>
        {c.eyebrow}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: c.title.length > 60 ? 50 : 62,
          fontWeight: 600,
          lineHeight: 1.12,
        }}
      >
        {c.title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <svg width={chartW} height={chartH} viewBox={`0 0 ${String(chartW)} ${String(chartH)}`}>
          <line x1="0" y1={chartH} x2={chartW} y2={chartH} stroke={C.rule} strokeWidth="2" />
          <polyline
            points={points}
            fill="none"
            stroke={C.accent}
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </svg>
        <div
          style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: C.muted }}
        >
          <span>{c.chartLabel}</span>
          <span>{siteConfig.name}</span>
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
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
