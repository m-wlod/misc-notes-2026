import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";

// Self-hosted at build time by next/font. latin-ext carries the Polish diacritics
// (ąćęłńóśźż); the style guide renders a test line in every face.

// `subsets` = what gets preloaded. latin-ext (ą ć ę ł ń ó ś ź ż) is still declared and
// fetched on demand through its unicode-range, so preloading it only delayed the first
// paint (Lighthouse, Phase 6b). Mono is small print (numbers, code): not preloaded.
export const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  // No optical-size axis: it more than doubled each file (~130 KB → see PROGRESS) for a
  // subtle refinement on large headings, and the fonts gate the first paint on phones.
  variable: "--font-newsreader",
  display: "swap",
});

export const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  preload: false,
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});
