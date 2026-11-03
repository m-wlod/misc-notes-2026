import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import { isSupabaseConfigured } from "@/lib/db/config";
import { createClient } from "@/lib/db/server";
import { getSession } from "@/lib/db/session";

import { renderMarkdown } from "../markdown";
import { badgesFor, linksAllowed } from "../policy";
import type { Author, Post, SolutionPost, Target, Thread, Viewer } from "../types";

/**
 * Reads a discussion for rendering (Phase 17b). Rows come through the viewer's own
 * client, so RLS decides what they may see: a locked exercise thread returns no rows
 * from the database, not just from this code. Author names come from `profiles` via
 * the secret key (handle and display name only; profile links only for public ones).
 */
type Client = NonNullable<Awaited<ReturnType<typeof createClient>>>;

const ANON_AUTHOR: Author = { handle: null, name: null, public: false, badges: [] };

async function viewerFor(): Promise<{ viewer: Viewer; client: Client } | null> {
  if (!isSupabaseConfigured()) return null;
  const session = await getSession();
  if (!session) {
    const client = await createClient();
    if (!client) return null;
    return {
      client,
      viewer: { signedIn: false, staff: false, banned: false, linksAllowed: false, userId: null },
    };
  }
  const [staff, banned, profile] = await Promise.all([
    session.supabase.rpc("is_staff"),
    session.supabase.rpc("is_banned"),
    session.supabase.from("profiles").select("created_at").eq("id", session.user.id).maybeSingle(),
  ]);
  const created = profile.data?.created_at ?? session.user.created_at;
  return {
    client: session.supabase,
    viewer: {
      signedIn: true,
      staff: staff.data === true,
      banned: banned.data === true,
      linksAllowed: linksAllowed(new Date(created)),
      userId: session.user.id,
    },
  };
}

type AuthorRow = {
  id: string;
  handle: string;
  display_name: string | null;
  is_public: boolean;
  created_at: string;
};

async function authors(ids: readonly string[]): Promise<Map<string, AuthorRow & { rep: number }>> {
  const admin = createAdminClient();
  const unique = [...new Set(ids)];
  if (!admin || unique.length === 0) return new Map();
  const { data } = await admin
    .from("profiles")
    .select("id, handle, display_name, is_public, created_at")
    .in("id", unique);
  const reps = await Promise.all(
    (data ?? []).map(async (p) => (await admin.rpc("reputation", { uid: p.id })).data ?? 0),
  );
  return new Map((data ?? []).map((p, i) => [p.id, { ...p, rep: reps[i] ?? 0 }]));
}

function authorOf(row: (AuthorRow & { rep: number }) | undefined): Author {
  if (!row) return ANON_AUTHOR;
  return {
    handle: row.handle,
    name: row.display_name,
    public: row.is_public,
    badges: badgesFor(row.rep),
  };
}

async function totals(client: Client, type: "comment" | "solution", ids: number[]) {
  if (ids.length === 0) return new Map<number, number>();
  const { data } = await client.rpc("vote_totals", { target_type: type, ids });
  return new Map((data ?? []).map((r) => [r.target_id, r.total]));
}

async function myVotes(
  client: Client,
  viewer: Viewer,
  type: "comment" | "solution",
  ids: number[],
) {
  if (!viewer.signedIn || ids.length === 0) return new Map<number, number>();
  const { data } = await client
    .from("votes")
    .select("target_id, value")
    .eq("target_type", type)
    .in("target_id", ids);
  return new Map((data ?? []).map((r) => [r.target_id, r.value]));
}

async function unlocked(client: Client, viewer: Viewer, exerciseId: string) {
  if (viewer.staff) return true;
  if (!viewer.signedIn) return false;
  const { data } = await client.rpc("discussion_unlocked", { exercise_id: exerciseId });
  return data === true;
}

/** null: discussions are off on this deployment (no database). */
export async function loadThread(target: Target, id: string): Promise<Thread | null> {
  const ctx = await viewerFor();
  if (!ctx) return null;
  const { client, viewer } = ctx;
  if (target === "exercise" && !(await unlocked(client, viewer, id))) {
    return { target, id, viewer, state: "locked", posts: [] };
  }
  const { data } = await client
    .from("comments")
    .select("id, parent_id, user_id, body, status, created_at, updated_at")
    .eq("target_type", target)
    .eq("target_id", id)
    .order("created_at", { ascending: true })
    .limit(500);
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const [people, score, mine] = await Promise.all([
    authors(rows.flatMap((r) => (r.user_id ? [r.user_id] : []))),
    totals(client, "comment", ids),
    myVotes(client, viewer, "comment", ids),
  ]);
  const posts: Post[] = rows.map((r) => {
    const author = r.user_id ? people.get(r.user_id) : undefined;
    const own = r.user_id !== null && r.user_id === viewer.userId;
    return {
      id: r.id,
      parentId: r.parent_id,
      author: authorOf(author),
      authorId: viewer.staff ? r.user_id : null,
      own,
      html: renderMarkdown(r.body, {
        links: author ? linksAllowed(new Date(author.created_at)) : false,
      }),
      body: own ? r.body : null,
      status: r.status,
      createdAt: r.created_at,
      edited: r.updated_at !== r.created_at,
      score: score.get(r.id) ?? 0,
      myVote: mine.get(r.id) ?? 0,
    };
  });
  return { target, id, viewer, state: "open", posts };
}

/** Shared solutions of an exercise: Mentor picks first, then by votes. Empty when locked. */
export async function loadSolutions(
  exerciseId: string,
): Promise<{ viewer: Viewer; open: boolean; solutions: SolutionPost[] } | null> {
  const ctx = await viewerFor();
  if (!ctx) return null;
  const { client, viewer } = ctx;
  if (!(await unlocked(client, viewer, exerciseId))) return { viewer, open: false, solutions: [] };
  const { data } = await client
    .from("shared_solutions")
    .select("id, user_id, body, format, status, mentor_pick, created_at")
    .eq("exercise_id", exerciseId)
    .limit(200);
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const [people, score, mine] = await Promise.all([
    authors(rows.flatMap((r) => (r.user_id ? [r.user_id] : []))),
    totals(client, "solution", ids),
    myVotes(client, viewer, "solution", ids),
  ]);
  const solutions: SolutionPost[] = rows.map((r) => {
    const author = r.user_id ? people.get(r.user_id) : undefined;
    const format = r.format === "code" || r.format === "math" ? r.format : "text";
    const body =
      format === "code"
        ? `\`\`\`\n${r.body}\n\`\`\``
        : format === "math"
          ? `$$\n${r.body}\n$$`
          : r.body;
    return {
      id: r.id,
      author: authorOf(author),
      authorId: viewer.staff ? r.user_id : null,
      own: r.user_id !== null && r.user_id === viewer.userId,
      html: renderMarkdown(body, {
        links: author ? linksAllowed(new Date(author.created_at)) : false,
      }),
      format,
      status: r.status,
      mentorPick: r.mentor_pick,
      createdAt: r.created_at,
      score: score.get(r.id) ?? 0,
      myVote: mine.get(r.id) ?? 0,
    };
  });
  solutions.sort((a, b) => Number(b.mentorPick) - Number(a.mentorPick) || b.score - a.score);
  return { viewer, open: true, solutions };
}
