"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { Badge } from "@/components/ui/display";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";

import { deleteComment, editComment, report, type CommunityResult, vote } from "../actions";
import { setMentorPick, setPostStatus } from "../moderation";
import type { Author, ModerationStatus, Viewer } from "../types";
import { Composer, inputClass, useResultText } from "./composer";

const smallButton =
  "rounded px-2 py-0.5 font-sans text-sm text-ink-muted hover:bg-sunken hover:text-ink disabled:opacity-50";

export function AuthorLine({
  author,
  at,
  edited,
}: {
  author: Author;
  at: string;
  edited?: boolean;
}) {
  const t = useTranslations("community");
  const format = useFormatter();
  const name = author.name ?? author.handle ?? t("post.anonymous");
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-xs text-ink-muted">
      <span className="font-medium text-ink">
        {author.public && author.handle ? (
          <Link href={{ pathname: "/u/[handle]", params: { handle: author.handle } }}>{name}</Link>
        ) : (
          name
        )}
      </span>
      {author.handle && author.name ? <span>@{author.handle}</span> : null}
      {author.badges.map((b) => (
        <Badge key={b}>{t(`badges.${b as "pomocny"}`)}</Badge>
      ))}
      <time dateTime={at}>{format.dateTime(new Date(at), { dateStyle: "medium" })}</time>
      {edited ? <span>· {t("post.edited")}</span> : null}
    </p>
  );
}

export function StatusNote({ status }: { status: ModerationStatus }) {
  const t = useTranslations("community.post");
  if (status === "approved") return null;
  return (
    <p className="border-l-2 border-rule-strong pl-2 font-sans text-xs text-ink-muted">
      {status === "hidden" || status === "rejected" ? t("hidden") : t("pending")}
    </p>
  );
}

type Kind = "comment" | "solution";

/** Votes, report, and (own) edit/delete or (staff) hide/restore/Mentor pick. */
export function PostControls({
  kind,
  id,
  viewer,
  own,
  score,
  myVote,
  status,
  mentorPick,
  body,
  onChanged,
}: {
  kind: Kind;
  id: number;
  viewer: Viewer;
  own: boolean;
  score: number;
  myVote: number;
  status: ModerationStatus;
  mentorPick?: boolean;
  body?: string | null;
  onChanged: () => void;
}) {
  const t = useTranslations("community");
  const text = useResultText();
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CommunityResult | null>(null);
  const [panel, setPanel] = useState<"none" | "report" | "edit" | "delete">("none");
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);

  const run = (fn: () => Promise<CommunityResult | { ok: boolean }>) => {
    startTransition(async () => {
      const r = await fn();
      setResult(r.ok ? { ok: true } : { ok: false, reason: "reason" in r ? r.reason : "failed" });
      if (r.ok) onChanged();
    });
  };
  const canAct = viewer.signedIn && !viewer.banned;

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className={cx(smallButton, myVote === 1 && "text-accent")}
          aria-pressed={myVote === 1}
          disabled={!canAct || own || pending}
          onClick={() => {
            run(() => vote({ targetType: kind, targetId: id, value: 1 }));
          }}
        >
          ▲ <span className="sr-only">{t("post.up")}</span>
        </button>
        <span className="font-sans text-sm tabular-nums" aria-label={t("post.score", { score })}>
          {score}
        </span>
        <button
          type="button"
          className={cx(smallButton, myVote === -1 && "text-accent")}
          aria-pressed={myVote === -1}
          disabled={!canAct || own || pending}
          onClick={() => {
            run(() => vote({ targetType: kind, targetId: id, value: -1 }));
          }}
        >
          ▼ <span className="sr-only">{t("post.down")}</span>
        </button>
        {canAct && !own ? (
          <button
            type="button"
            className={smallButton}
            aria-expanded={panel === "report"}
            aria-controls={`${formId}-report`}
            onClick={() => {
              setPanel(panel === "report" ? "none" : "report");
            }}
          >
            {t("post.report")}
          </button>
        ) : null}
        {own && kind === "comment" && body != null && status === "approved" ? (
          <button
            type="button"
            className={smallButton}
            aria-expanded={panel === "edit"}
            onClick={() => {
              setPanel(panel === "edit" ? "none" : "edit");
            }}
          >
            {t("post.edit")}
          </button>
        ) : null}
        {own && kind === "comment" ? (
          panel === "delete" ? (
            <button
              type="button"
              className={cx(smallButton, "text-wrong")}
              disabled={pending}
              onClick={() => {
                run(() => deleteComment({ id }));
              }}
            >
              {t("post.confirmDelete")}
            </button>
          ) : (
            <button
              type="button"
              className={smallButton}
              onClick={() => {
                setPanel("delete");
              }}
            >
              {t("post.delete")}
            </button>
          )
        ) : null}
        {viewer.staff ? (
          <button
            type="button"
            className={smallButton}
            disabled={pending}
            onClick={() => {
              run(() =>
                setPostStatus({ kind, id, status: status === "approved" ? "hidden" : "approved" }),
              );
            }}
          >
            {status === "approved" ? t("post.hide") : t("post.restore")}
          </button>
        ) : null}
        {viewer.staff && kind === "solution" ? (
          <button
            type="button"
            className={smallButton}
            disabled={pending}
            onClick={() => {
              run(() => setMentorPick({ id, pick: !mentorPick }));
            }}
          >
            {mentorPick ? t("post.unpick") : t("post.pick")}
          </button>
        ) : null}
        <p role="status" className="font-sans text-xs empty:hidden">
          {result && !result.ok ? text(result) : ""}
        </p>
      </div>
      {panel === "report" ? (
        <form
          id={`${formId}-report`}
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await report({ targetType: kind, targetId: String(id), reason });
              setResult(r);
              if (r.ok) {
                setPanel("none");
                setReported(true);
              }
            });
          }}
        >
          <label htmlFor={`${formId}-reason`} className="font-sans text-sm">
            {t("post.reportReason")}
          </label>
          <textarea
            id={`${formId}-reason`}
            rows={2}
            maxLength={2000}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
            className={inputClass}
          />
          <div>
            <button
              type="submit"
              className={cx(smallButton, "border border-rule-strong")}
              disabled={pending || reason.trim().length < 3}
            >
              {t("post.reportSend")}
            </button>
          </div>
        </form>
      ) : null}
      {reported ? <p className="font-sans text-xs text-ink-muted">{t("post.reported")}</p> : null}
      {panel === "edit" && body != null ? (
        <Composer
          label={t("post.edit")}
          submitLabel={t("composer.save")}
          linksAllowed={viewer.linksAllowed}
          initial={body}
          onSubmit={async (next) => {
            const r = await editComment({ id, body: next });
            if (r.ok) {
              setPanel("none");
              onChanged();
            }
            return r;
          }}
          onCancel={() => {
            setPanel("none");
          }}
        />
      ) : null}
    </div>
  );
}
