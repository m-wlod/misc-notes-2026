import "server-only";

import webpush from "web-push";

import type { PushSender } from "./run";

/**
 * Web push (Phase 15) with VAPID keys; only when both keys exist. A 404/410 from the
 * push service means the subscription is gone, and the run deletes it.
 */
export function webPushSender(publicKey: string, privateKey: string, subject: string): PushSender {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return {
    async send(sub, message) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(message),
          { TTL: 60 * 60 * 6 },
        );
        return "ok";
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        return status === 404 || status === 410 ? "gone" : "error";
      }
    },
  };
}
