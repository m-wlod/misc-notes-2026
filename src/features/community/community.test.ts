import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./markdown";
import { badgesFor, linksAllowed, NEW_ACCOUNT_DAYS, rateOk, screen } from "./policy";

const md = (s: string, links = true) => renderMarkdown(s, { links });

describe("community markdown", () => {
  it("formats the supported subset", () => {
    expect(md("**gruby** i *pochyły* i `kod`")).toBe(
      "<p><strong>gruby</strong> i <em>pochyły</em> i <code>kod</code></p>",
    );
    expect(md("- a\n- b\n\n1. x\n2. y")).toBe(
      "<ul><li>a</li><li>b</li></ul>\n<ol><li>x</li><li>y</li></ol>",
    );
    expect(md("```\nx = <1>\n```")).toBe("<pre><code>x = &lt;1&gt;</code></pre>");
    expect(md("a\nb\n\nc")).toBe("<p>a<br>b</p>\n<p>c</p>");
  });

  it("renders math with KaTeX, and leaves prices alone", () => {
    expect(md("$E[X] = \\sum p_i x_i$")).toContain('class="katex"');
    expect(md("$$\n\\sigma^2\n$$")).toContain('class="katex-display"');
    expect(md("kosztuje $5 a nie $10")).not.toContain("katex");
  });

  it("neutralises HTML and script injection", () => {
    for (const attack of [
      "<script>alert(1)</script>",
      '<img src=x onerror="alert(1)">',
      "[klik](javascript:alert(1))",
      '[x](https://a.test" onmouseover="alert(1))',
      "**<b onclick=alert(1)>**",
      "\u00000\u0000",
    ]) {
      const html = md(attack);
      // No real tag carries an event handler or a javascript: URL; escaped text is inert.
      expect(html).not.toMatch(/<script|<img|<[a-z][^>]*\son\w+=|href="javascript/i);
    }
    expect(md("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("KaTeX can't create links or HTML (trust is off)", () => {
    const html = md("$\\href{javascript:alert(1)}{x}$ $\\htmlClass{evil}{y}$");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain('class="evil"');
  });

  it("links: nofollow for established accounts, plain text for new ones", () => {
    expect(md("zob. https://example.com/a.")).toBe(
      '<p>zob. <a href="https://example.com/a" rel="nofollow ugc noopener noreferrer">https://example.com/a</a>.</p>',
    );
    expect(md("[źródło](https://example.com)")).toContain(">źródło</a>");
    expect(md("zob. https://example.com/a", false)).toBe("<p>zob. https://example.com/a</p>");
    expect(md("[źródło](https://example.com)", false)).toBe("<p>źródło (https://example.com)</p>");
  });
});

describe("posting policy", () => {
  it("new accounts can't link for the first days", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(linksAllowed(new Date("2026-11-09T12:00:00Z"), now)).toBe(false);
    expect(linksAllowed(new Date(now.getTime() - NEW_ACCOUNT_DAYS * 86_400_000), now)).toBe(true);
  });

  it("the keyword filter holds spam and abuse for review, never drops it", () => {
    for (const spam of [
      "Zapraszam na priv, mam sygnały",
      "Dołącz: t.me/xyz",
      "Gwarantowany zysk 20% miesięcznie",
      "DM me for signals",
      "send me USDT and I double your crypto",
    ]) {
      expect(screen(spam)).toEqual({ status: "pending", reason: "keyword" });
    }
    expect(screen("Wartość oczekiwana jest ujemna, bo straty są większe.")).toEqual({
      status: "approved",
      reason: null,
    });
    expect(screen("Telegrafuję wynik: 0,25")).toEqual({ status: "approved", reason: null });
  });

  it("rate limits and helper badges", () => {
    expect(rateOk({ lastTenMinutes: 4, lastDay: 29 })).toBe(true);
    expect(rateOk({ lastTenMinutes: 5, lastDay: 6 })).toBe(false);
    expect(rateOk({ lastTenMinutes: 0, lastDay: 30 })).toBe(false);
    expect(badgesFor(9)).toEqual([]);
    expect(badgesFor(10)).toEqual(["pomocny"]);
    expect(badgesFor(250)).toEqual(["pomocny", "mentor", "filar"]);
  });
});
