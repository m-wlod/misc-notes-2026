import { z } from "zod";

/** Shape of content/curriculum.ts. Kept free of server-only imports: Velite loads it too. */

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const localized = z.object({ pl: z.string().min(1), en: z.string().min(1) }).strict();
const slugs = z.object({ pl: id, en: id }).strict();

export const moduleSchema = z
  .object({ id, slug: slugs, name: localized, lessons: z.array(id).min(1) })
  .strict();

export const trackSchema = z
  .object({
    id,
    slug: slugs,
    name: localized,
    description: localized,
    modules: z.array(moduleSchema).min(1),
  })
  .strict();

export const curriculumSchema = z.array(trackSchema).min(1);

export type CurriculumModule = z.infer<typeof moduleSchema>;
export type Track = z.infer<typeof trackSchema>;
export type Curriculum = z.infer<typeof curriculumSchema>;
