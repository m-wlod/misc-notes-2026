"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { resolveItem } from "./actions";

/** Approve / reject one queue item (Phase 16); the RLS staff policy authorises it. */
export function QueueActions({
  table,
  id,
}: {
  table: "debunk_submissions" | "content_error_reports";
  id: number;
}) {
  const t = useTranslations("debunk.admin");
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (done) return <span className="font-sans text-xs text-ink-muted">{done}</span>;
  const act = (status: "approved" | "rejected", label: string) => {
    startTransition(async () => {
      const r = await resolveItem({ table, id, status });
      if (r.ok) setDone(label);
    });
  };
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          act("approved", t("approve"));
        }}
      >
        {t("approve")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          act("rejected", t("reject"));
        }}
      >
        {t("reject")}
      </Button>
    </div>
  );
}
