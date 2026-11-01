import { create, insertMultiple, search, type Tokenizer } from "@orama/orama";

import { words } from "@/lib/text/fold";

import type { SearchDoc } from "./docs";

/**
 * Client-side search over the prebuilt documents. A custom tokenizer folds diacritics on
 * both the index and the query, so "rozklad" finds "rozkład". No stemming: Orama has no
 * Polish stemmer, and prefix matching already covers most inflections ("rozklad" →
 * "rozkłady"). Titles weigh more than body text.
 */
export const tokenizer: Tokenizer = {
  language: "polish",
  normalizationCache: new Map(),
  tokenize: (raw) => words(raw),
};

const schema = {
  type: "string",
  title: "string",
  context: "string",
  text: "string",
  url: "string",
} as const;

export type SearchHit = Pick<SearchDoc, "type" | "title" | "context" | "url"> & { id: string };

export async function createSearchIndex(docs: readonly SearchDoc[]) {
  const db = create({ schema, components: { tokenizer } });
  await insertMultiple(
    db,
    docs.map((d) => ({ ...d })),
  );

  return async function query(term: string, limit = 12): Promise<SearchHit[]> {
    if (words(term).length === 0) return [];
    const result = await search(db, {
      term,
      properties: ["title", "context", "text"],
      boost: { title: 4, context: 1.5 },
      // Every word must match (prefixes count), so longer queries narrow the results.
      threshold: 0,
      limit,
    });
    return result.hits.map(({ document: d }) => ({
      id: String(d.id),
      type: d.type as SearchDoc["type"],
      title: d.title,
      context: d.context,
      url: d.url,
    }));
  };
}
