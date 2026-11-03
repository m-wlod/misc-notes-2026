import { renderMarkdown } from "./markdown";
import type { Author, Post, SolutionPost, Thread, Viewer } from "./types";

/**
 * Style guide specimens for the community UI (Phase 17b): sample data only, labelled
 * as such on the page. Nothing here is real content.
 */
const at = "2026-11-03T10:00:00.000Z";
const later = "2026-11-03T12:30:00.000Z";

const viewer: Viewer = {
  signedIn: true,
  staff: true,
  banned: false,
  linksAllowed: true,
  userId: "me",
};

const ania: Author = { handle: "ania_k", name: "Ania", public: true, badges: ["pomocny"] };
const tomek: Author = { handle: "tomek", name: null, public: false, badges: [] };
const me: Author = { handle: "przyklad", name: "Przykład", public: false, badges: [] };

const post = (p: Partial<Post> & Pick<Post, "id" | "author">, source: string): Post => ({
  parentId: null,
  authorId: null,
  own: false,
  body: null,
  status: "approved",
  createdAt: at,
  edited: false,
  score: 0,
  myVote: 0,
  html: renderMarkdown(source),
  ...p,
});

export const sampleThread: Thread = {
  target: "lesson",
  id: "styleguide-sample",
  viewer,
  state: "open",
  posts: [
    post(
      { id: 1, author: ania, score: 4, myVote: 1 },
      "Przykładowy wpis. Wartość oczekiwana to $E[X] = \\sum_i p_i x_i$, a w kodzie `np.mean(x)`.\n\n- jeden punkt\n- drugi punkt",
    ),
    post(
      { id: 2, parentId: 1, author: tomek, createdAt: later },
      "Przykładowa odpowiedź z linkiem: https://example.com/zrodlo.",
    ),
    post(
      {
        id: 3,
        author: me,
        own: true,
        body: "Mój wpis, ukryty.",
        status: "hidden",
        createdAt: later,
        edited: true,
      },
      "Mój wpis, ukryty.",
    ),
  ],
};

export const lockedThread: Thread = {
  target: "exercise",
  id: "styleguide-locked",
  viewer: { ...viewer, staff: false },
  state: "locked",
  posts: [],
};

export const sampleSolutions: SolutionPost[] = [
  {
    id: 11,
    author: ania,
    authorId: null,
    own: false,
    html: renderMarkdown("$$\nP = \\binom{4}{2} \\cdot 0{,}5^4 = 0{,}375\n$$"),
    format: "math",
    status: "approved",
    mentorPick: true,
    createdAt: at,
    score: 7,
    myVote: 0,
  },
  {
    id: 12,
    author: tomek,
    authorId: null,
    own: false,
    html: renderMarkdown("```\nfrom math import comb\nprint(comb(4, 2) / 16)\n```"),
    format: "code",
    status: "approved",
    mentorPick: false,
    createdAt: later,
    score: 2,
    myVote: 0,
  },
];

export const sampleViewer = viewer;
