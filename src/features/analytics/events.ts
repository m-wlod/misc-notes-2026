/**
 * The product events (Phase 22b), and the only properties they may carry. Nothing that
 * identifies a person: ids of content, levels, results, places in the app. The funnels
 * built from them are in docs/analytics.md. `events.test.ts` keeps personal fields out.
 */
export type Events = {
  /** An exercise was answered. `context` tells the sample funnel apart (landing, video). */
  exercise_attempted: {
    exercise_id: string;
    level: number;
    result: "correct" | "partial" | "wrong";
    context: "landing" | "video" | "practice" | "lesson" | "daily" | "other";
  };
  lesson_completed: { lesson_id: string };
  /** Onboarding finished: the account exists (the funnel's sign-up step). */
  signed_up: { goal: string; level: number };
  video_landing_viewed: { slug: string };
  newsletter_subscribed: { place: "landing" | "footer" | "links" };
  feature_used: {
    feature: "simulation" | "notebook" | "interview" | "debunk_checker" | "review" | "search";
    id?: string;
  };
};

export type EventName = keyof Events;

/** Property names allowed on any event: the union of the types above, kept as a list. */
export const ALLOWED_PROPERTIES = [
  "exercise_id",
  "level",
  "result",
  "context",
  "lesson_id",
  "goal",
  "slug",
  "place",
  "feature",
  "id",
] as const;
