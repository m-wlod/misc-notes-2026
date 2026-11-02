import type { NextRequest } from "next/server";

import { prefsStore, tokenSecret } from "@/features/notify/server";
import { applyUnsubscribe } from "@/features/notify/unsubscribe";

/**
 * RFC 8058 one-click unsubscribe: mail apps POST here (List-Unsubscribe-Post). The
 * parameters are in the URL the header carries; the body is `List-Unsubscribe=One-Click`.
 */
export async function POST(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const res = await applyUnsubscribe(prefsStore(), tokenSecret(), {
    u: q.get("u"),
    k: q.get("k"),
    s: q.get("s"),
  });
  return Response.json(res, {
    status: res.ok ? 200 : 400,
    headers: { "Cache-Control": "no-store" },
  });
}
