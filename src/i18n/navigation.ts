import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/** Locale-aware, typed navigation. Use these instead of next/link and next/navigation for in-app links. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
