"use client";

import { useEffect } from "react";

import { hasUtm, withoutUtm } from "./utm";

/**
 * Counts a landing from a campaign link (Phase 19): when the address has `utm_*`
 * params, sends them once per tab to /api/utm, then removes them from the address bar
 * so shared links stay clean. No cookies, no ids; nothing happens on other visits.
 */
const SENT = "utm-sent";

export function UtmBeacon() {
  useEffect(() => {
    const { search, pathname, hash } = window.location;
    if (!hasUtm(search)) return;
    try {
      if (sessionStorage.getItem(SENT) !== search) {
        sessionStorage.setItem(SENT, search);
        // keepalive: the request survives the visitor leaving the page straight away.
        void fetch("/api/utm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ search, path: pathname }),
          keepalive: true,
        }).catch(() => undefined);
      }
    } catch {
      // Storage or beacon blocked: this landing just isn't counted.
    }
    window.history.replaceState(window.history.state, "", pathname + withoutUtm(search) + hash);
  }, []);
  return null;
}
