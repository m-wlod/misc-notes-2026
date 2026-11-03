import katex from "katex";

/**
 * Markdown for community posts (Phase 17): a deliberately small, safe subset. Every
 * character of user text is HTML-escaped first; the only markup that comes out is what
 * this file writes. Supported: paragraphs, **bold**, *italic*, `code`, fenced code
 * blocks, "- " and "1. " lists, $inline$ and $$display$$ math (KaTeX with `trust: false`,
 * so \href, \url and \html* are inert), and http(s) links with rel="nofollow ugc noopener".
 * New accounts' links are shown as plain text (anti-spam).
 */
export const MAX_POST_CHARS = 5000;

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

function math(tex: string, display: boolean): string {
  return katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    maxSize: 20,
    maxExpand: 200,
    output: "htmlAndMathml",
  });
}

type Options = { links: boolean };

/** Inline formatting on one block of text. */
function inline(text: string, opts: Options): string {
  const stash: string[] = [];
  const keep = (html: string) => `\u0000${String(stash.push(html) - 1)}\u0000`;
  let s = text
    // Code first: nothing inside it is formatted.
    .replace(/`([^`\n]+)`/g, (_, c: string) => keep(`<code>${esc(c)}</code>`))
    // Inline math: $…$ that doesn't start or end with a space (so "$5 and $10" stays text).
    .replace(/\$([^\s$](?:[^$\n]*[^\s$])?)\$/g, (_, t: string) => keep(math(t, false)))
    // Links: [label](https://…) and bare https://… URLs.
    .replace(
      /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]{1,500})\)/g,
      (_, label: string, url: string) => keep(link(url, label, opts)),
    )
    .replace(/\bhttps?:\/\/[^\s<>()]{1,500}/g, (url) => keep(link(url, url, opts)));
  s = esc(s)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\n]+)_(?![_\w])/g, "$1<em>$2</em>")
    .replace(/\n/g, "<br>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => stash[Number(i)] ?? "");
}

function link(url: string, label: string, opts: Options): string {
  // Trailing punctuation belongs to the sentence, not the URL.
  const m = /^(.*?)([.,;:!?]*)$/.exec(url);
  const clean = m?.[1] ?? url;
  const tail = m?.[2] ?? "";
  const shown = label === url ? clean : label;
  if (!opts.links) return `${esc(shown)}${label === url ? "" : ` (${esc(clean)})`}${esc(tail)}`;
  return `<a href="${esc(clean)}" rel="nofollow ugc noopener noreferrer">${esc(shown)}</a>${esc(tail)}`;
}

export function renderMarkdown(source: string, opts: Options = { links: true }): string {
  // \u0000 is the internal placeholder marker: users can't type their way into it.
  const lines = source
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .slice(0, MAX_POST_CHARS)
    .split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join("\n"), opts)}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? "ol" : "ul";
      out.push(`<${tag}>${list.items.map((i) => `<li>${inline(i, opts)}</li>`).join("")}</${tag}>`);
    }
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    // Fenced code block.
    if (/^```/.test(line)) {
      flushPara();
      flushList();
      const body: string[] = [];
      for (i += 1; i < lines.length && !/^```/.test(lines[i] ?? ""); i++) body.push(lines[i] ?? "");
      out.push(`<pre><code>${esc(body.join("\n"))}</code></pre>`);
      continue;
    }
    // Display math: $$ on its own line … $$, or $$…$$ on one line.
    if (/^\s*\$\$/.test(line)) {
      flushPara();
      flushList();
      const one = /^\s*\$\$(.+)\$\$\s*$/.exec(line);
      if (one?.[1]) {
        out.push(`<div class="math">${math(one[1], true)}</div>`);
        continue;
      }
      const body: string[] = [line.replace(/^\s*\$\$/, "")];
      for (i += 1; i < lines.length && !/\$\$\s*$/.test(lines[i] ?? ""); i++)
        body.push(lines[i] ?? "");
      body.push((lines[i] ?? "").replace(/\$\$\s*$/, ""));
      out.push(`<div class="math">${math(body.join("\n").trim(), true)}</div>`);
      continue;
    }
    const item = /^\s*(?:([-*])|(\d{1,3})\.)\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      const ordered = item[2] !== undefined;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(item[3] ?? "");
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      flushList();
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return out.join("\n");
}
