"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { resolveDispute } from "../disputes";

/** Uphold a dispute with a new score (0–4 points) or reject it (Phase 18b). */
export function DisputeActions({ id, points }: { id: number; points: number }) {
  const t = useTranslations("admin.disputes");
  const field = useId();
  const [value, setValue] = useState(Math.min(4, points + 1));
  const [done, setDone] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  if (done) {
    return (
      <p role="status" className="font-sans text-xs text-ink-muted">
        {done}
      </p>
    );
  }
  const act = (
    body: { id: number; status: "approved"; points: number } | { id: number; status: "rejected" },
  ) => {
    setFailed(false);
    startTransition(async () => {
      const r = await resolveDispute(body).catch(() => null);
      if (!r?.ok) {
        setFailed(true);
        return;
      }
      if (body.status === "rejected") setDone(t("rejected"));
      else setDone(r.xp ? t("upheldXp", { xp: r.xp }) : t("upheld"));
    });
  };
  return (
    <div className="flex flex-wrap items-end gap-2 font-sans text-sm">
      <label htmlFor={field} className="grid gap-1">
        {t("newScore")}
        <select
          id={field}
          value={value}
          onChange={(e) => {
            setValue(Number(e.target.value));
          }}
          className="rounded border border-rule-strong bg-surface px-2 py-1"
        >
          {[0, 1, 2, 3, 4].map((p) => (
            <option key={p} value={p}>
              {p}/4
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        data-dispute-uphold={id}
        onClick={() => {
          act({ id, status: "approved", points: value });
        }}
      >
        {t("uphold")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        data-dispute-reject={id}
        onClick={() => {
          act({ id, status: "rejected" });
        }}
      >
        {t("reject")}
      </Button>
      {failed ? (
        <p role="alert" className="w-full text-xs text-wrong">
          {t("failed")}
        </p>
      ) : null}
    </div>
  );
}
