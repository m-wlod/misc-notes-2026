"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { claimCertificate } from "./actions";
import { eligible, MIN_MASTERY, type Progress } from "./eligibility";

/** Certificates on the profile (Phase 15): one row per track, earned or how far off. */
export type TrackRow = {
  id: string;
  name: string;
  progress: Progress;
  certificateId: string | null;
};

export function CertificatesPanel({ tracks }: { tracks: TrackRow[] }) {
  const t = useTranslations("certificates");
  const format = useFormatter();
  const locale = useLocale();
  const [issued, setIssued] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-3">
      <ul className="grid gap-2" data-certificates="">
        {tracks.map((tr) => {
          const cert = tr.certificateId ?? issued[tr.id] ?? null;
          const p = tr.progress;
          return (
            <li
              key={tr.id}
              data-track={tr.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rule px-4 py-3"
            >
              <div>
                <p className="font-sans text-sm font-semibold text-ink">{tr.name}</p>
                <p className="font-sans text-xs text-ink-muted">
                  {t("lessons", { done: p.lessonsDone, total: p.lessonsTotal })}
                  {p.mastery !== null
                    ? ` · ${t("mastery", {
                        value: format.number(p.mastery, { style: "percent" }),
                        min: format.number(MIN_MASTERY, { style: "percent" }),
                      })}`
                    : ""}
                </p>
              </div>
              {cert ? (
                <a href={`/${locale}/verify/${cert}`} className="font-sans text-sm">
                  {t("view")}
                </a>
              ) : eligible(p) ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await claimCertificate({ trackId: tr.id });
                      if (res.ok) setIssued((x) => ({ ...x, [tr.id]: res.id }));
                      else setFailed(tr.id);
                    });
                  }}
                >
                  {t("claim")}
                </Button>
              ) : (
                <span className="font-sans text-xs text-ink-muted">{t("notYet")}</span>
              )}
            </li>
          );
        })}
      </ul>
      {failed ? (
        <p role="alert" className="font-sans text-sm text-wrong">
          {t("claimFailed")}
        </p>
      ) : null}
      <p className="font-sans text-xs text-ink-muted">{t("disclaimer")}</p>
    </div>
  );
}
