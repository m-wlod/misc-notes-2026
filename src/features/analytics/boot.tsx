"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useConsent } from "@/features/consent/use-consent";

import { identify, pageview, start, stop } from "./client";

/**
 * Starts PostHog when it is configured and the visitor allowed analytics, stops it when
 * they withdraw, and sends a pageview on every route change (Phase 22b). Renders nothing.
 * The key comes from the server (no env module in client code: Phase 21c).
 */
export function AnalyticsBoot({ posthogKey, host }: { posthogKey: string | null; host: string }) {
  const [consent] = useConsent();
  const pathname = usePathname();
  const on = Boolean(posthogKey) && consent.analytics;

  useEffect(() => {
    if (on && posthogKey) {
      void start(posthogKey, host).then(() => {
        pageview(window.location.href);
      });
    } else if (!consent.analytics) {
      stop();
    }
    // The pathname re-runs it: one pageview per page.
  }, [on, posthogKey, host, consent.analytics, pathname]);

  return null;
}

/** Tells analytics who is signed in (the account id) or that nobody is. */
export function AnalyticsUser({ userId }: { userId: string | null }) {
  useEffect(() => {
    identify(userId);
  }, [userId]);
  return null;
}
