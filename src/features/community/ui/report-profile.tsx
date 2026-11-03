"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { report, type CommunityResult } from "../actions";
import { inputClass, useResultText } from "./composer";

/** "Zgłoś profil" on a public profile (Phase 17b). */
export function ReportProfile({ userId }: { userId: string }) {
  const t = useTranslations("community");
  const text = useResultText();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<CommunityResult | null>(null);
  const [pending, startTransition] = useTransition();
  if (result?.ok) return <p className="font-sans text-sm text-ink-muted">{t("post.reported")}</p>;
  return (
    <div className="grid justify-items-start gap-2">
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {t("profile.report")}
      </Button>
      {open ? (
        <form
          className="grid w-full max-w-(--measure) gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              setResult(await report({ targetType: "profile", targetId: userId, reason }));
            });
          }}
        >
          <label htmlFor={`${id}-reason`} className="font-sans text-sm">
            {t("post.reportReason")}
          </label>
          <textarea
            id={`${id}-reason`}
            rows={2}
            maxLength={2000}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
            className={inputClass}
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending || reason.trim().length < 3}>
              {t("post.reportSend")}
            </Button>
            <p role="status" className="font-sans text-sm empty:hidden">
              {text(result)}
            </p>
          </div>
        </form>
      ) : null}
    </div>
  );
}
