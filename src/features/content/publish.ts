/**
 * Review workflow (draft → review → published): a lesson's body is public only once it
 * is published. Drafts show "in preparation" on lesson pages; the internal preview
 * (`preview: true`) shows everything for review. Decided per build, independent of the
 * environment, so promoting a preview deployment can never publish a draft.
 */
export function showsBody(
  lesson: { status: "draft" | "review" | "published"; isStub: boolean },
  preview: boolean,
): boolean {
  return !lesson.isStub && (preview || lesson.status === "published");
}
