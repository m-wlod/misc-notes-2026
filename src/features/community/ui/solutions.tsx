"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { Badge } from "@/components/ui/display";

import { shareSolution } from "../actions";
import type { SolutionPost, Viewer } from "../types";
import { Composer, inputClass } from "./composer";
import { AuthorLine, PostControls, StatusNote } from "./post";

export function SolutionCard({
  solution,
  viewer,
  onChanged,
}: {
  solution: SolutionPost;
  viewer: Viewer;
  onChanged: () => void;
}) {
  const t = useTranslations("community");
  return (
    <li data-solution={solution.id} className="grid gap-2 rounded-md border border-rule px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {solution.mentorPick ? <Badge tone="correct">{t("post.mentorPick")}</Badge> : null}
        <AuthorLine author={solution.author} at={solution.createdAt} />
      </div>
      <StatusNote status={solution.status} />
      <div
        className="community-body font-serif text-reading"
        // Built on the server by the escape-first renderer (markdown.ts).
        dangerouslySetInnerHTML={{ __html: solution.html }}
      />
      <PostControls
        kind="solution"
        id={solution.id}
        viewer={viewer}
        own={solution.own}
        score={solution.score}
        myVote={solution.myVote}
        status={solution.status}
        mentorPick={solution.mentorPick}
        onChanged={onChanged}
      />
    </li>
  );
}

/** Shared solutions under a solved exercise: Mentor picks first, then by votes. */
export function SolutionsView({
  exerciseId,
  viewer,
  solutions,
}: {
  exerciseId: string;
  viewer: Viewer;
  solutions: SolutionPost[];
}) {
  const t = useTranslations("community.solutions");
  const router = useRouter();
  const id = useId();
  const [, startTransition] = useTransition();
  const [format, setFormat] = useState<"text" | "math" | "code">("text");
  const refresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };
  return (
    <section
      aria-labelledby={`${id}-h`}
      data-solutions=""
      className="mt-12 grid max-w-(--measure) gap-4 border-t border-rule pt-6"
    >
      <h2 id={`${id}-h`} className="text-xl">
        {t("title")}
      </h2>
      {solutions.length === 0 ? <p className="text-ink-muted">{t("empty")}</p> : null}
      <ul className="grid gap-3">
        {solutions.map((s) => (
          <SolutionCard key={s.id} solution={s} viewer={viewer} onChanged={refresh} />
        ))}
      </ul>
      {viewer.signedIn && !viewer.banned ? (
        <details className="grid gap-2">
          <summary className="cursor-pointer font-sans text-sm">{t("share")}</summary>
          <div className="mt-3 grid gap-2">
            <label htmlFor={`${id}-format`} className="font-sans text-sm">
              {t("format")}
            </label>
            <select
              id={`${id}-format`}
              value={format}
              onChange={(e) => {
                setFormat(e.target.value as typeof format);
              }}
              className={`${inputClass} max-w-48`}
            >
              {(["text", "math", "code"] as const).map((f) => (
                <option key={f} value={f}>
                  {t(`formats.${f}`)}
                </option>
              ))}
            </select>
            <Composer
              label={t("body")}
              submitLabel={t("share")}
              linksAllowed={viewer.linksAllowed}
              maxChars={20_000}
              onSubmit={async (body) => {
                const r = await shareSolution({ exerciseId, format, body });
                if (r.ok) refresh();
                return r;
              }}
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}
