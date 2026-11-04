"use client";

import { useEffect } from "react";

import { track } from "./client";

/** Sends `video_landing_viewed` once when a video landing page is shown (Phase 22b). */
export function TrackVideoView({ slug }: { slug: string }) {
  useEffect(() => {
    track("video_landing_viewed", { slug });
  }, [slug]);
  return null;
}
