import { serialize } from "./jsonld";

/** One JSON-LD block (Phase 19b). The data comes from the builders in ./jsonld. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Built from our own content and escaped by `serialize`.
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
    />
  );
}
