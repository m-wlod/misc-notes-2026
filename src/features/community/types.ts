/** Shapes the community UI renders (Phase 17b); built on the server, plain data only. */
export type Target = "lesson" | "exercise" | "debunk";

export type Viewer = {
  signedIn: boolean;
  staff: boolean;
  banned: boolean;
  /** May this viewer post clickable links (account older than NEW_ACCOUNT_DAYS)? */
  linksAllowed: boolean;
  userId: string | null;
};

export type Author = {
  handle: string | null;
  name: string | null;
  /** Has a public profile at /u/[handle]. */
  public: boolean;
  badges: string[];
};

export type ModerationStatus = "pending" | "approved" | "rejected" | "hidden";

export type Post = {
  id: number;
  parentId: number | null;
  author: Author;
  /** Only for staff (ban controls). */
  authorId: string | null;
  own: boolean;
  /** Rendered by the safe markdown renderer on the server. */
  html: string;
  /** The source, for the author's own edit form only. */
  body: string | null;
  status: ModerationStatus;
  createdAt: string;
  edited: boolean;
  score: number;
  myVote: number;
};

export type Thread = {
  target: Target;
  id: string;
  viewer: Viewer;
  state: "open" | "locked";
  posts: Post[];
};

export type SolutionPost = {
  id: number;
  author: Author;
  authorId: string | null;
  own: boolean;
  html: string;
  format: "text" | "math" | "code";
  status: ModerationStatus;
  mentorPick: boolean;
  createdAt: string;
  score: number;
  myVote: number;
};
