/**
 * The interview session state machine (Phase 11): running → finished, one question at a
 * time, no going back, a hard deadline. Pure: the caller passes `now`, so the timer is a
 * deadline (it survives a sleeping tab) and everything is unit-tested without a clock.
 */
export const SESSION_KINDS = [
  "mental_math",
  "market_making",
  "probability_sprint",
  "brainteasers",
  "open_modelling",
] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

export type AnswerRecord = {
  questionId: string;
  /** What the learner entered (shown again in review). */
  given: string;
  /** 0–1 for this question. */
  score: number;
  ms: number;
  topic: string;
};

export type Session<Q> = {
  kind: SessionKind;
  level: number;
  seed: number;
  startedAt: number;
  deadline: number;
  questions: readonly Q[];
  /** Index of the current question; equals questions.length when all are answered. */
  index: number;
  /** When the current question was shown. */
  shownAt: number;
  answers: AnswerRecord[];
  status: "running" | "finished";
  finishedAt: number | null;
};

export function startSession<Q>(opts: {
  kind: SessionKind;
  level: number;
  seed: number;
  questions: readonly Q[];
  durationMs: number;
  now: number;
}): Session<Q> {
  return {
    kind: opts.kind,
    level: opts.level,
    seed: opts.seed,
    startedAt: opts.now,
    deadline: opts.now + opts.durationMs,
    questions: opts.questions,
    index: 0,
    shownAt: opts.now,
    answers: [],
    status: opts.questions.length === 0 ? "finished" : "running",
    finishedAt: opts.questions.length === 0 ? opts.now : null,
  };
}

export const remainingMs = (s: Session<unknown>, now: number) =>
  s.status === "finished" ? 0 : Math.max(0, s.deadline - now);

/** Ends the session if its time is up. Returns the same object when nothing changes. */
export function tick<Q>(s: Session<Q>, now: number): Session<Q> {
  if (s.status === "finished" || now < s.deadline) return s;
  return { ...s, status: "finished", finishedAt: s.deadline };
}

/** Records the answer to the current question and moves on; there is no way back. */
export function answer<Q>(
  s: Session<Q>,
  record: Omit<AnswerRecord, "ms">,
  now: number,
): Session<Q> {
  const live = tick(s, now);
  if (live.status === "finished") return live;
  const answers = [...live.answers, { ...record, ms: Math.max(0, now - live.shownAt) }];
  const index = live.index + 1;
  const done = index >= live.questions.length;
  return {
    ...live,
    answers,
    index,
    shownAt: now,
    status: done ? "finished" : "running",
    finishedAt: done ? now : null,
  };
}

/** Ends the session now (the learner stops early); unanswered questions count as missed. */
export function finish<Q>(s: Session<Q>, now: number): Session<Q> {
  if (s.status === "finished") return s;
  return { ...s, status: "finished", finishedAt: Math.min(now, s.deadline) };
}

export type Scorecard = {
  /** Mean score over all questions in the session (unanswered = 0), 0–1. */
  score: number;
  /** Questions with a full score. */
  correct: number;
  answered: number;
  total: number;
  /** Mean of the answered questions, 0–1 (null if none answered). */
  accuracy: number | null;
  avgMs: number | null;
  durationMs: number;
  /** Topics answered at least twice with accuracy below 70%, worst first. */
  review: string[];
};

export function scorecard(s: Session<unknown>): Scorecard {
  const total = s.questions.length;
  const answered = s.answers.length;
  const sum = s.answers.reduce((a, r) => a + r.score, 0);
  const byTopic = new Map<string, { sum: number; n: number }>();
  for (const r of s.answers) {
    const t = byTopic.get(r.topic) ?? { sum: 0, n: 0 };
    byTopic.set(r.topic, { sum: t.sum + r.score, n: t.n + 1 });
  }
  const review = [...byTopic.entries()]
    .filter(([, t]) => t.n >= 2 && t.sum / t.n < 0.7)
    .sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n)
    .map(([topic]) => topic);
  return {
    score: total === 0 ? 0 : sum / total,
    correct: s.answers.filter((r) => r.score >= 1).length,
    answered,
    total,
    accuracy: answered === 0 ? null : sum / answered,
    avgMs: answered === 0 ? null : s.answers.reduce((a, r) => a + r.ms, 0) / answered,
    durationMs: (s.finishedAt ?? s.deadline) - s.startedAt,
    review,
  };
}
