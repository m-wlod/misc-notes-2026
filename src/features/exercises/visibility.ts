/**
 * Published exercises are public. Samples and drafts are visible only where the internal
 * pages are (development, previews, ENABLE_STYLEGUIDE), decided at request time.
 */
export function isVisible(
  ex: { status: "draft" | "review" | "published" },
  internal: boolean,
): boolean {
  return ex.status === "published" || internal;
}
