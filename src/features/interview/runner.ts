"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { saveInterviewSession } from "./actions";
import {
  answer as answerQ,
  finish as finishQ,
  startSession,
  tick,
  type AnswerRecord,
  type Session,
  type SessionKind,
} from "./session";
import { scorecard } from "./session";
import { entryFrom, saveSession } from "./store";

/**
 * Drives one session in the browser: start, answer, the deadline, and saving the
 * scorecard once (to this browser, and to the account when signed in). Saving is
 * idempotent by session id, so a repeated call can't store a session twice.
 */
export function useSessionRunner<Q>(kind: SessionKind) {
  const [session, setSession] = useState<Session<Q> | null>(null);
  const [id, setId] = useState("");
  // 0 until a session starts: no clock reads while prerendering.
  const [now, setNow] = useState(0);
  const ref = useRef<{ session: Session<Q> | null; id: string; extra: () => { pnl?: number } }>({
    session: null,
    id: "",
    extra: () => ({}),
  });

  const persist = useCallback(
    (s: Session<Q>, sessionId: string) => {
      const card = scorecard(s);
      const { pnl } = ref.current.extra();
      const entry = entryFrom(
        sessionId,
        kind,
        s.level,
        card,
        new Date(s.finishedAt ?? Date.now()),
        pnl,
      );
      saveSession(entry);
      // Dormant until accounts exist; never blocks the scorecard.
      void saveInterviewSession({ entry, answers: s.answers }).catch(() => undefined);
    },
    [kind],
  );

  const update = useCallback(
    (next: Session<Q>) => {
      const before = ref.current.session;
      ref.current.session = next;
      setSession(next);
      if (next.status === "finished" && before?.status !== "finished")
        persist(next, ref.current.id);
    },
    [persist],
  );

  // The clock: re-render while running, end the session at its deadline.
  const running = session?.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const s = ref.current.session;
      if (s?.status === "running" && t >= s.deadline) update(tick(s, t));
    }, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [running, update]);

  const start = useCallback(
    (opts: { level: number; seed: number; questions: readonly Q[]; durationMs: number }) => {
      const t = Date.now();
      const sessionId = `${kind}-${String(t)}-${String(opts.seed)}`;
      ref.current.id = sessionId;
      setId(sessionId);
      setNow(t);
      update(startSession({ kind, ...opts, now: t }));
    },
    [kind, update],
  );

  const answer = useCallback(
    (record: Omit<AnswerRecord, "ms">) => {
      const s = ref.current.session;
      if (s) update(answerQ(s, record, Date.now()));
    },
    [update],
  );

  const finish = useCallback(() => {
    const s = ref.current.session;
    if (s) update(finishQ(s, Date.now()));
  }, [update]);

  const reset = useCallback(() => {
    ref.current.session = null;
    setSession(null);
  }, []);

  /** Extra fields for the saved scorecard (market making's P&L). */
  const setExtra = useCallback((fn: () => { pnl?: number }) => {
    ref.current.extra = fn;
  }, []);

  return { session, id, now, start, answer, finish, reset, setExtra };
}

/** A random 32-bit seed for a new session. */
export function newSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] ?? 1;
}
