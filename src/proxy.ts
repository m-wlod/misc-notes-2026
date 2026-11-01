import { NextResponse } from "next/server";

import { isStyleguideEnabled } from "@/config/runtime";
import { env } from "@/env";

/**
 * Next.js 16 proxy (formerly middleware). Per CLAUDE.md it only redirects or hides
 * routes; authorization always lives in RLS and server code.
 *
 * Today: hide the internal /styleguide at request time (review M11). Phase 2 adds
 * next-intl locale handling here.
 */
export function proxy() {
  if (!isStyleguideEnabled(env)) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/styleguide", "/styleguide/:path*"],
};
