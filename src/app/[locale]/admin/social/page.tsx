import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton, Table, Td, Th } from "@/components/ui/display";
import { requirePage } from "@/features/admin/server";
import {
  filterSocial,
  uncovered,
  type SocialRow,
  type SocialStatus,
} from "@/features/admin/social";
import { getLesson } from "@/features/content/lessons";
import { lessonsInOrder } from "@/features/curriculum";
import { listEntries } from "@/features/debunk/entries";
import { SIMS } from "@/features/sims/registry";
import { listVideos } from "@/features/videos/entries";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Props = PageProps<"/[locale]/admin/social">;

/**
 * Content calendar for the TikTok/YouTube channel (Phase 19c, admins only): lessons and
 * Debunk Lab entries that no video covers yet, each with the link to record it in 9:16.
 */
export default function AdminSocialPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Social params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const KINDS: readonly SocialRow["kind"][] = ["lesson", "debunk"];
const STATUSES: readonly SocialStatus[] = ["draft", "review", "published"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Social({ params, searchParams }: Props) {
  await connection();
  await requirePage("social");
  const locale = (await params).locale as Locale;
  const t = await getTranslations("admin.social");
  const tc = await getTranslations("admin.content");
  const sp = await searchParams;
  const kind = KINDS.find((k) => k === one(sp.typ));
  const status = STATUSES.find((s) => s === one(sp.status));

  const rows = uncovered({
    lessons: lessonsInOrder(locale).flatMap(({ lesson }) => {
      const resolved = getLesson(lesson.id, locale, { includeDrafts: true });
      if (!resolved) return [];
      const sim = SIMS.find((s) => s.lessonId === lesson.id);
      return [
        {
          id: lesson.id,
          title: lesson.title,
          status: resolved.lesson.status,
          simulationPath: sim
            ? getPathname({
                href: { pathname: "/lab/sims/[id]", params: { id: sim.slug[locale] } },
                locale,
              })
            : null,
        },
      ];
    }),
    debunk: listEntries(locale, true).map((e) => ({
      id: e.id,
      claim: e.claim,
      status: e.status,
      path: getPathname({ href: { pathname: "/debunk/[slug]", params: { slug: e.slug } }, locale }),
      hasVideo: e.relatedVideo !== undefined,
    })),
    videos: listVideos(true),
  });
  const shown = filterSocial(rows, { kind, status });

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="max-w-prose text-sm text-ink-muted">{t("note")}</p>
      <form className="flex flex-wrap items-end gap-3 font-sans text-sm">
        <label className="grid gap-1">
          {t("kind")}
          <select
            name="typ"
            defaultValue={kind ?? ""}
            className="rounded border border-rule-strong bg-surface px-2 py-1"
          >
            <option value="">{t("all")}</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          {t("status")}
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded border border-rule-strong bg-surface px-2 py-1"
          >
            <option value="">{t("all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {tc(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm" variant="secondary">
          {t("filter")}
        </Button>
      </form>
      <p role="status" className="font-sans text-sm text-ink-muted">
        {t("count", { n: shown.length })}
      </p>
      {shown.length === 0 ? (
        <p className="text-ink-muted">{t("empty")}</p>
      ) : (
        <Table label={t("title")}>
          <thead>
            <tr>
              <Th>{t("kind")}</Th>
              <Th>{tc("col.title")}</Th>
              <Th>{t("status")}</Th>
              <Th>{t("recording")}</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={`${r.kind}:${r.id}`} data-social={`${r.kind}:${r.id}`}>
                <Td>{t(r.kind)}</Td>
                <Td>{r.title}</Td>
                <Td>{tc(`status.${r.status}`)}</Td>
                <Td>
                  {r.recording ? (
                    <a href={r.recording} data-recording-link>
                      {t("record")}
                    </a>
                  ) : (
                    t("noRecording")
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
