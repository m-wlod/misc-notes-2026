import type { PostHog } from "posthog-js";

import type { EventName, Events } from "./events";

/**
 * PostHog in the browser (Phase 22b), started only with a key **and** the visitor's
 * consent (21b). Loaded on demand, so pages without consent never download it. No
 * cookies (localStorage), no autocapture, no session recording, no surveys; pageviews are
 * sent by `AnalyticsBoot`. Everything here is a no-op until `start` has run.
 */
let loading: Promise<PostHog> | null = null;
let ready: PostHog | null = null;
/** The signed-in account, known before PostHog may have loaded (undefined: not known). */
let user: string | null | undefined;
/**
 * Events from before PostHog finished loading (a page's first render races the dynamic
 * import). Sent on start; dropped on stop. Without consent it never starts: nothing is
 * ever sent, the few queued events just stay in memory.
 */
const QUEUE_MAX = 20;
let queue: [string, Record<string, unknown>][] = [];

export function start(key: string, host: string): Promise<PostHog> {
  loading ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: host,
      persistence: "localStorage",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: true,
      disable_session_recording: true,
      disable_surveys: true,
      person_profiles: "identified_only",
    });
    // Consent was given before start; re-opt in after an earlier withdrawal.
    posthog.opt_in_capturing();
    ready = posthog;
    if (user !== undefined) applyUser(posthog, user);
    for (const [event, props] of queue) posthog.capture(event, props);
    queue = [];
    return posthog;
  });
  return loading;
}

/** Consent withdrawn: stop capturing and forget this browser's id. */
export function stop(): void {
  queue = [];
  if (!ready) return;
  ready.opt_out_capturing();
  ready.reset();
}

export function track<E extends EventName>(event: E, props: Events[E]): void {
  if (ready) ready.capture(event, props);
  else if (queue.length < QUEUE_MAX) queue.push([event, props]);
}

export function pageview(url: string): void {
  ready?.capture("$pageview", { $current_url: url });
}

function applyUser(posthog: PostHog, userId: string | null) {
  if (userId) posthog.identify(userId);
  else if (posthog.get_property("$user_state") === "identified") posthog.reset();
}

/** Signed in: the account id only (never an e-mail or name). Signed out: forget it. */
export function identify(userId: string | null): void {
  user = userId;
  if (ready) applyUser(ready, userId);
}

/** Where in the app an exercise was answered, from the page path (both languages). */
export function contextOf(pathname: string): "landing" | "video" | "practice" | "lesson" | "other" {
  if (/^\/(pl|en)\/?$/.test(pathname)) return "landing";
  if (/^\/(pl|en)\/v\//.test(pathname)) return "video";
  if (/^\/(pl|en)\/(praktyka|practice)(\/|$)/.test(pathname)) return "practice";
  if (/^\/(pl|en)\/(nauka|learn)\//.test(pathname)) return "lesson";
  return "other";
}

/** For tests. */
export function __resetForTests(): void {
  loading = null;
  ready = null;
  user = undefined;
  queue = [];
}
