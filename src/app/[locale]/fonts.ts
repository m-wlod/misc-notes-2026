import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";

// Self-hosted at build time by next/font. latin-ext carries the Polish diacritics
// (ąćęłńóśźż); the style guide renders a test line in every face.

export const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

export const sans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});
