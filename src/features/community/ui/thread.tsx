"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { postComment } from "../actions";
import type { Post, Thread } from "../types";
import { Composer } from "./composer";
import { AuthorLine, PostControls, StatusNote } from "./post";

type Sort = "new" | "top";

function PostBody({ html }: { html: string }) {
  return (
    <div
      className="community-body font-serif text-reading"
      // Built on the server by the escape-first renderer (markdown.ts).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function PostItem({
  post,
  replies,
  thread,
  onChanged,
}: {
  post: Post;
  replies: Post[];
  thread: Thread;
  onChanged: () => void;
}) {
  const t = useTranslations("community");
  const [replying, setReplying] = useState(false);
  const canPost = thread.viewer.signedIn && !thread.viewer.banned;
  return (
    <li data-comment={post.id} data-status={post.status} className="grid gap-2">
      <AuthorLine author={post.author} at={post.createdAt} edited={post.edited} />
      <StatusNote status={post.status} />
      <PostBody html={post.html} />
      <PostControls
        kind="comment"
        id={post.id}
        viewer={thread.viewer}
        own={post.own}
        score={post.score}
        myVote={post.myVote}
        status={post.status}
        body={post.body}
        onChanged={onChanged}
      />
      {post.parentId === null && canPost && thread.state === "open" ? (
        replying ? (
          <Composer
            label={t("composer.replyLabel")}
            submitLabel={t("composer.reply")}
            linksAllowed={thread.viewer.linksAllowed}
            onSubmit={async (body) => {
              const r = await postComment({
                target: thread.target,
                targetId: thread.id,
                parentId: post.id,
                body,
              });
              if (r.ok) {
                setReplying(false);
                onChanged();
              }
              return r;
            }}
            onCancel={() => {
              setReplying(false);
            }}
          />
        ) : (
          <div>
            <button
              type="button"
              className={buttonClass("ghost", "sm")}
              onClick={() => {
                setReplying(true);
              }}
            >
              {t("composer.reply")}
            </button>
          </div>
        )
      ) : null}
      {replies.length > 0 ? (
        <ul className="ml-3 grid gap-5 border-l border-rule pl-4 sm:ml-6">
          {replies.map((r) => (
            <PostItem key={r.id} post={r} replies={[]} thread={thread} onChanged={onChanged} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** One level of replies; top-level posts sorted newest-first or by votes. */
export function sortThread(posts: readonly Post[], sort: Sort) {
  const top = posts.filter((p) => p.parentId === null);
  const replies = new Map<number, Post[]>();
  for (const p of posts) {
    if (p.parentId !== null) replies.set(p.parentId, [...(replies.get(p.parentId) ?? []), p]);
  }
  top.sort((a, b) =>
    sort === "top"
      ? b.score - a.score || b.createdAt.localeCompare(a.createdAt)
      : b.createdAt.localeCompare(a.createdAt),
  );
  return top.map((p) => ({ post: p, replies: replies.get(p.id) ?? [] }));
}

/**
 * A discussion under a lesson, exercise or Debunk Lab entry (Phase 17b). The server
 * decides what's in `thread` (RLS); this only arranges and acts on it.
 */
export function ThreadView({ thread, discord }: { thread: Thread; discord: string | null }) {
  const t = useTranslations("community");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sort, setSort] = useState<Sort>("new");
  const refresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };
  const headingId = `discussion-${thread.target}-${thread.id}`;
  return (
    <section
      aria-labelledby={headingId}
      data-discussion={thread.state}
      className="mt-12 grid max-w-(--measure) gap-5 border-t border-rule pt-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-xl">
          {t("discussion.title")}
          {thread.state === "open" ? (
            <span className="ml-2 font-sans text-sm text-ink-muted">
              {t("discussion.count", { count: thread.posts.length })}
            </span>
          ) : null}
        </h2>
        {discord ? (
          <a href={discord} rel="noopener noreferrer" className="font-sans text-sm">
            {t("discussion.discord")}
          </a>
        ) : null}
      </div>

      {thread.state === "locked" ? (
        <div
          data-locked=""
          className="grid justify-items-start gap-3 rounded-md border border-rule px-4 py-4"
        >
          <p className="font-serif text-reading">
            {thread.viewer.signedIn ? t("discussion.locked") : t("discussion.lockedSignedOut")}
          </p>
          {thread.viewer.signedIn ? (
            <button type="button" className={buttonClass("secondary", "sm")} onClick={refresh}>
              {t("discussion.recheck")}
            </button>
          ) : (
            <Link href="/sign-in" className={buttonClass("secondary", "sm")}>
              {t("discussion.signIn")}
            </Link>
          )}
        </div>
      ) : (
        <>
          {thread.viewer.banned ? (
            <p className="font-sans text-sm text-ink-muted">{t("discussion.banned")}</p>
          ) : thread.viewer.signedIn ? (
            <div className="grid gap-2">
              <p className="font-sans text-xs text-ink-muted">{t("discussion.rules")}</p>
              <Composer
                label={t("composer.label")}
                submitLabel={t("composer.submit")}
                linksAllowed={thread.viewer.linksAllowed}
                onSubmit={async (body) => {
                  const r = await postComment({ target: thread.target, targetId: thread.id, body });
                  if (r.ok) refresh();
                  return r;
                }}
              />
            </div>
          ) : (
            <p className="font-sans text-sm">
              <Link href="/sign-in">{t("discussion.signIn")}</Link>
            </p>
          )}

          {thread.posts.length === 0 ? (
            <p className="text-ink-muted">{t("discussion.empty")}</p>
          ) : (
            <>
              <div
                role="group"
                aria-label={t("discussion.sortLabel")}
                className="flex gap-1 font-sans text-sm"
              >
                {(["new", "top"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={sort === s}
                    onClick={() => {
                      setSort(s);
                    }}
                    className="rounded px-2 py-0.5 text-ink-muted aria-pressed:bg-sunken aria-pressed:text-ink"
                  >
                    {s === "new" ? t("discussion.sortNew") : t("discussion.sortTop")}
                  </button>
                ))}
              </div>
              <ul className="grid gap-6">
                {sortThread(thread.posts, sort).map(({ post, replies }) => (
                  <PostItem
                    key={post.id}
                    post={post}
                    replies={replies}
                    thread={thread}
                    onChanged={refresh}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
