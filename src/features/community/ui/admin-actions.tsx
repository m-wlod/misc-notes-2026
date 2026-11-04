"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import {
  banUser,
  resolveCorrection,
  resolveReport,
  resolveXpFlag,
  setPostStatus,
  unbanUser,
  type ModerationResult,
} from "../moderation";
import { inputClass } from "./composer";

/** Moderator queue controls (Phase 17b). Every action is audited on the server. */
function useAct() {
  const t = useTranslations("community.admin");
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const act = (fn: () => Promise<ModerationResult>) => {
    startTransition(async () => {
      setDone((await fn()).ok ? t("done") : t("failed"));
    });
  };
  return { t, done, pending, act };
}

function Done({ text }: { text: string }) {
  return (
    <p role="status" className="font-sans text-xs text-ink-muted">
      {text}
    </p>
  );
}

/** An XP anomaly flag: looks fine, or a real problem (handled by hand). */
export function XpFlagActions({ id }: { id: number }) {
  const { t, done, pending, act } = useAct();
  if (done) return <Done text={done} />;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          act(() => resolveXpFlag({ id, status: "approved" }));
        }}
      >
        {t("xpFine")}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          act(() => resolveXpFlag({ id, status: "rejected" }));
        }}
      >
        {t("xpProblem")}
      </Button>
    </div>
  );
}

export function HeldPostActions({ kind, id }: { kind: "comment" | "solution"; id: number }) {
  const { t, done, pending, act } = useAct();
  if (done) return <Done text={done} />;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          act(() => setPostStatus({ kind, id, status: "approved" }));
        }}
      >
        {t("approve")}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          act(() => setPostStatus({ kind, id, status: "hidden" }));
        }}
      >
        {t("hide")}
      </Button>
    </div>
  );
}

/** A report: hide the reported post (and uphold), or dismiss the report. */
export function ReportActions({
  id,
  post,
}: {
  id: number;
  post: { kind: "comment" | "solution"; id: number } | null;
}) {
  const { t, done, pending, act } = useAct();
  if (done) return <Done text={done} />;
  return (
    <div className="flex flex-wrap gap-2">
      {post ? (
        <Button
          size="sm"
          disabled={pending}
          data-action="hide-reported"
          onClick={() => {
            act(async () => {
              const hidden = await setPostStatus({ ...post, status: "hidden" });
              return hidden.ok ? resolveReport({ id, status: "approved" }) : hidden;
            });
          }}
        >
          {t("hide")}
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            act(() => resolveReport({ id, status: "approved" }));
          }}
        >
          {t("uphold")}
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          act(() => resolveReport({ id, status: "rejected" }));
        }}
      >
        {t("dismiss")}
      </Button>
    </div>
  );
}

export function CorrectionActions({ id }: { id: number }) {
  const { t, done, pending, act } = useAct();
  if (done) return <Done text={done} />;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          act(() => resolveCorrection({ id, status: "approved" }));
        }}
      >
        {t("accept")}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          act(() => resolveCorrection({ id, status: "rejected" }));
        }}
      >
        {t("reject")}
      </Button>
    </div>
  );
}

export function BanForm({ userId }: { userId: string }) {
  const { t, done, pending, act } = useAct();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");
  if (done) return <Done text={done} />;
  if (!open) {
    return (
      <div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(true);
          }}
        >
          {t("ban")}
        </Button>
      </div>
    );
  }
  return (
    <form
      className="grid max-w-md gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        act(() => banUser({ userId, reason, days: days.trim() === "" ? null : Number(days) }));
      }}
    >
      <label htmlFor={`${id}-reason`} className="font-sans text-sm">
        {t("banReason")}
      </label>
      <input
        id={`${id}-reason`}
        value={reason}
        maxLength={500}
        onChange={(e) => {
          setReason(e.target.value);
        }}
        className={inputClass}
      />
      <label htmlFor={`${id}-days`} className="font-sans text-sm">
        {t("banDays")}
      </label>
      <input
        id={`${id}-days`}
        type="number"
        min={1}
        max={3650}
        inputMode="numeric"
        value={days}
        onChange={(e) => {
          setDays(e.target.value);
        }}
        className={`${inputClass} max-w-32`}
      />
      <div>
        <Button type="submit" size="sm" disabled={pending || reason.trim() === ""}>
          {t("ban")}
        </Button>
      </div>
    </form>
  );
}

export function UnbanButton({ userId }: { userId: string }) {
  const { t, done, pending, act } = useAct();
  if (done) return <Done text={done} />;
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        act(() => unbanUser({ userId }));
      }}
    >
      {t("unban")}
    </Button>
  );
}
