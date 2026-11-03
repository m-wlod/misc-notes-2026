import { connection } from "next/server";
import { Suspense } from "react";

import { siteConfig } from "@/config/site";
import { isSupabaseConfigured } from "@/lib/db/config";

import { loadSolutions, loadThread } from "./server/thread";
import type { Target } from "./types";
import { SolutionsView } from "./ui/solutions";
import { ThreadView } from "./ui/thread";

/**
 * Discussions (Phase 17b) for server pages. Without a database (accounts off) they
 * render nothing and add no request-time work, so the page stays fully static.
 */
export function Discussion({ target, id }: { target: Target; id: string }) {
  if (!isSupabaseConfigured()) return null;
  return (
    <Suspense fallback={null}>
      <LoadedThread target={target} id={id} />
    </Suspense>
  );
}

async function LoadedThread({ target, id }: { target: Target; id: string }) {
  await connection();
  const thread = await loadThread(target, id);
  return thread ? <ThreadView thread={thread} discord={siteConfig.social.discord} /> : null;
}

/** Shared solutions under an exercise; nothing until the spoiler gate opens. */
export function Solutions({ exerciseId }: { exerciseId: string }) {
  if (!isSupabaseConfigured()) return null;
  return (
    <Suspense fallback={null}>
      <LoadedSolutions exerciseId={exerciseId} />
    </Suspense>
  );
}

async function LoadedSolutions({ exerciseId }: { exerciseId: string }) {
  await connection();
  const data = await loadSolutions(exerciseId);
  if (!data?.open) return null;
  return <SolutionsView exerciseId={exerciseId} viewer={data.viewer} solutions={data.solutions} />;
}
