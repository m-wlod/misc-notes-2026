import type { NextRequest } from "next/server";

import { applyNewsletterUnsubscribe } from "@/features/newsletter/server";

/**
 * RFC 8058 one-click unsubscribe for the newsletter (Phase 19c): mail apps POST to the
 * URL in the List-Unsubscribe header, which carries the signed subscriber id.
 */
export async function POST(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const res = await applyNewsletterUnsubscribe(q.get("i"), q.get("s"));
  return Response.json(res, {
    status: res.ok ? 200 : 400,
    headers: { "Cache-Control": "no-store" },
  });
}
