/**
 * Structured data for search engines (Phase 19b), as plain objects built by pure
 * functions: schema.org `WebSite`/`Organization` on the landing, `Course` on track
 * pages, `LearningResource` on lessons, `Quiz` on video pages (questions only, never
 * the answers) and `FAQPage` on Debunk Lab entries. Rendered by <JsonLd>.
 */
export type Thing = Record<string, unknown> & { "@type": string };

const CONTEXT = "https://schema.org";
const lang = (locale: string) => (locale === "pl" ? "pl-PL" : "en-GB");

export function organization(name: string, url: string, description: string): Thing {
  return { "@type": "Organization", name, url, description };
}

export function website({
  name,
  url,
  locale,
  description,
}: {
  name: string;
  url: string;
  locale: string;
  description: string;
}) {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    name,
    url,
    inLanguage: lang(locale),
    description,
    publisher: organization(name, new URL("/", url).href, description),
  };
}

export function course({
  name,
  description,
  url,
  locale,
  provider,
  lessons,
}: {
  name: string;
  description: string;
  url: string;
  locale: string;
  provider: Thing;
  lessons: readonly { name: string; url: string }[];
}) {
  return {
    "@context": CONTEXT,
    "@type": "Course",
    name,
    description,
    url,
    inLanguage: lang(locale),
    isAccessibleForFree: true,
    provider,
    hasPart: lessons.map((l) => ({ "@type": "LearningResource", name: l.name, url: l.url })),
  };
}

export function learningResource({
  name,
  description,
  url,
  locale,
  level,
  minutes,
  course: partOf,
  provider,
}: {
  name: string;
  description: string;
  url: string;
  locale: string;
  level: number;
  minutes: number;
  course: { name: string; url: string } | null;
  provider: Thing;
}) {
  return {
    "@context": CONTEXT,
    "@type": "LearningResource",
    name,
    description,
    url,
    inLanguage: lang(locale),
    learningResourceType: "lesson",
    educationalLevel: `${String(level)}/5`,
    timeRequired: `PT${String(Math.max(1, Math.round(minutes)))}M`,
    isAccessibleForFree: true,
    provider,
    ...(partOf ? { isPartOf: { "@type": "Course", name: partOf.name, url: partOf.url } } : {}),
  };
}

/** Prompts as plain text: markup and maths source are dropped, whitespace collapsed. */
export function plainText(html: string): string {
  return html
    .replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function quiz({
  name,
  url,
  locale,
  questions,
}: {
  name: string;
  url: string;
  locale: string;
  questions: readonly string[];
}) {
  return {
    "@context": CONTEXT,
    "@type": "Quiz",
    name,
    url,
    inLanguage: lang(locale),
    isAccessibleForFree: true,
    hasPart: questions.map((q) => ({ "@type": "Question", name: q })),
  };
}

export function faqPage({
  url,
  locale,
  question,
  answer,
}: {
  url: string;
  locale: string;
  question: string;
  answer: string;
}) {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    url,
    inLanguage: lang(locale),
    mainEntity: [
      {
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      },
    ],
  };
}

/** Safe inside a <script>: `<` can't close the tag or open a comment. */
export function serialize(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
