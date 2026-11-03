/**
 * Content calendar for videos (Phase 19c): which lessons and Debunk Lab entries have no
 * video yet, and where to record one. Pure; the page feeds it the content build.
 * A lesson is covered when a video sends viewers to it (`nextLesson`); a debunk entry
 * when a video names it (`debunk`) or the entry already links a video (`relatedVideo`).
 */
export type SocialStatus = "draft" | "review" | "published";

export type SocialRow = {
  kind: "lesson" | "debunk";
  id: string;
  title: string;
  status: SocialStatus;
  /** Where to record: the entry's 9:16 mode, or the lesson's simulation in 9:16. */
  recording: string | null;
};

export type SocialInput = {
  lessons: readonly {
    id: string;
    title: string;
    status: SocialStatus;
    simulationPath: string | null;
  }[];
  debunk: readonly {
    id: string;
    claim: string;
    status: SocialStatus;
    path: string;
    hasVideo: boolean;
  }[];
  videos: readonly { nextLesson: string; debunk?: string | undefined }[];
};

const recordingOf = (path: string) => `${path}${path.includes("?") ? "&" : "?"}nagranie=1`;

export function uncovered(input: SocialInput): SocialRow[] {
  const lessonsCovered = new Set(input.videos.map((v) => v.nextLesson));
  const debunkCovered = new Set(input.videos.flatMap((v) => (v.debunk ? [v.debunk] : [])));
  return [
    ...input.lessons
      .filter((l) => !lessonsCovered.has(l.id))
      .map((l) => ({
        kind: "lesson" as const,
        id: l.id,
        title: l.title,
        status: l.status,
        recording: l.simulationPath ? recordingOf(l.simulationPath) : null,
      })),
    ...input.debunk
      .filter((e) => !e.hasVideo && !debunkCovered.has(e.id))
      .map((e) => ({
        kind: "debunk" as const,
        id: e.id,
        title: e.claim,
        status: e.status,
        recording: recordingOf(e.path),
      })),
  ];
}

export function filterSocial(
  rows: readonly SocialRow[],
  f: { kind?: SocialRow["kind"] | undefined; status?: SocialStatus | undefined },
): SocialRow[] {
  return rows.filter((r) => (!f.kind || r.kind === f.kind) && (!f.status || r.status === f.status));
}
