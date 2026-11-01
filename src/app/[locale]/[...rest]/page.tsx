import { notFound } from "next/navigation";

/** Any unknown path under a locale renders the localised 404 (next-intl pattern). */
export default function CatchAll() {
  notFound();
}
