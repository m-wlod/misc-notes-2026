// pnpm content:draft <content/_inbox/note.md>
// Checks an inbox note and writes <note>.brief.md for a Claude Code writing session.
// It writes no lesson text (content is a separate task) and changes no other file.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { brief, parseInboxNote } from "@/features/content/pipeline/draft";
import { loadLessonSources } from "@/features/content/pipeline/qa";

import { curriculum } from "../content/curriculum";

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error("usage: pnpm content:draft content/_inbox/<note>.md");
  process.exit(1);
}
const parsed = parseInboxNote(readFileSync(file, "utf8"));
if ("errors" in parsed) {
  console.error(`${file}:\n${parsed.errors.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(1);
}
const { note } = parsed;
const place = curriculum
  .flatMap((t) => t.modules.map((m) => ({ t, m })))
  .find(({ m }) => m.lessons.includes(note.lesson));
const lesson = loadLessonSources("content").find((l) => l.id === note.lesson && l.locale === "pl");
if (!place || !lesson) {
  console.error(`${file}: lesson: "${note.lesson}" is not in content/curriculum.ts`);
  process.exit(1);
}
const front = readFileSync(lesson.file, "utf8");
const title = /^title:\s*"?(.*?)"?\s*$/m.exec(front)?.[1] ?? note.lesson;
const level = Number(/^level:\s*(\d)/m.exec(front)?.[1] ?? 1);
const prerequisites = (/^prerequisites:\s*\[(.*)\]/m.exec(front)?.[1] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const out = file.replace(/\.md$/, ".brief.md");
writeFileSync(
  out,
  brief(note, {
    id: note.lesson,
    title,
    level,
    prerequisites,
    track: place.t.name.pl,
    module: place.m.name.pl,
    lessonFile: lesson.file,
    exercisesDir: `content/exercises/${place.t.id}/${note.lesson}`,
  }),
);
console.log(
  `content:draft: wrote ${out}${lesson.isStub ? "" : " (note: the lesson already has a body)"}`,
);
