// Phase 1A direction exploration. Generates a.html, b.html, c.html: the same Polish
// lesson screen rendered in three visual directions. Exploration only, never shipped.
// Usage: node design/explorations/build.mjs && node design/explorations/shoot.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const KATEX = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist";

// ---------- shared content (identical in every option) ----------
const body = `
<header class="topbar">
  <div class="topbar-in">
    <a class="wordmark" href="#">APP_NAME</a>
    <nav class="mainnav" aria-label="Główna">
      <a href="#" aria-current="page">Nauka</a><a href="#">Praktyka</a><a href="#">Rozmowa</a><a href="#">Debunk Lab</a>
    </nav>
    <div class="stats"><span>Seria <b>12</b> dni</span><span>XP <b>1&#8239;240</b></span></div>
  </div>
</header>

<div class="page">
  <aside class="toc" aria-label="Spis treści">
    <p class="toc-h">W tej lekcji</p>
    <ol>
      <li><a href="#">Zwrot prosty a logarytmiczny</a></li>
      <li class="on"><a href="#">Spadek zmienności</a></li>
      <li><a href="#">Symulacja</a></li>
      <li><a href="#">Sprawdź się</a></li>
    </ol>
    <div class="toc-progress"><span style="width:38%"></span></div>
    <p class="toc-meta">7 min do końca</p>
  </aside>

  <main class="lesson">
    <p class="crumbs">Fundamenty <span>/</span> Stopy zwrotu <span>/</span> Lekcja 1.4</p>
    <h1>Stopy logarytmiczne i&nbsp;pułapka średniej</h1>
    <div class="meta">
      <span class="lvl"><i class="lvl-bars" aria-hidden="true"><b></b><b></b><b class="off"></b><b class="off"></b><b class="off"></b></i>Poziom 2 · Średnio</span>
      <span>12 min</span>
      <div class="depth" role="tablist" aria-label="Głębokość">
        <button role="tab" aria-selected="false">Po ludzku</button><button role="tab" aria-selected="true">Podręcznik</button>
      </div>
    </div>

    <section class="sec">
      <span class="secno">1.4.2</span>
      <h2>Spadek zmienności</h2>
      <div class="row">
        <p>Jeśli kurs rośnie o&nbsp;50%, a&nbsp;potem spada o&nbsp;50%, nie wracasz do punktu wyjścia: zostaje ci 75% kapitału. Średnia arytmetyczna obu zwrotów wynosi zero, a&nbsp;mimo to kapitał zmalał. Dlatego liczymy stopy logarytmiczne \\(r_t = \\ln(P_t / P_{t-1})\\), które w&nbsp;przeciwieństwie do zwrotów prostych się sumują.<sup class="ref">1</sup></p>
        <aside class="note"><sup>1</sup> Przybliżenie poniżej wynika z&nbsp;rozwinięcia Taylora \\(\\ln(1+x) \\approx x - x^2/2\\). Przy dużych zwrotach jest coraz mniej dokładne.</aside>
      </div>

      <figure class="eq">
        <div class="eq-body">\\[\\mathbb{E}\\big[\\ln(1+R)\\big] \\;\\approx\\; \\mu - \\frac{\\sigma^2}{2}\\]</div>
        <span class="eq-no">(4.1)</span>
      </figure>

      <p>Średni wzrost kapitału jest niższy od średniego zwrotu o&nbsp;połowę wariancji. Przy zmienności 20% rocznie to dwa punkty procentowe, które znikają co roku, nawet gdy „średnio” strategia jest na plusie.</p>

      <figure class="fig">
        <div class="fig-head"><span class="fig-label">Rys. 3.2</span><span class="fig-stats">μ = 0 · σ = 1% dziennie · 250 dni · seed 7</span></div>
        <svg class="walk" viewBox="0 0 640 220" role="img" aria-label="Wykres błądzenia losowego przez 250 dni"></svg>
        <figcaption>Błądzenie losowe bez żadnej przewagi. Każdy „trend”, „opór” i&nbsp;„formacja” na tym wykresie to szum.</figcaption>
      </figure>

      <aside class="myth">
        <p class="myth-k">Mit</p>
        <blockquote>„Strategia zarabia średnio +1% na transakcję, więc na dłuższą metę musi zarabiać.”</blockquote>
        <p class="myth-k">Dlaczego to nie działa</p>
        <p>Przy σ&nbsp;=&nbsp;10% na transakcję spadek zmienności to σ²/2&nbsp;=&nbsp;0,5%. Po prowizji i&nbsp;poślizgu 0,6% oczekiwany wzrost kapitału wynosi <span class="num neg">−0,1%</span> na transakcję.</p>
        <a class="link" href="#">Sprawdź w&nbsp;Debunk Lab →</a>
      </aside>
    </section>

    <section class="check">
      <p class="check-k">Sprawdź się</p>
      <p>Kurs spada o&nbsp;20%. O&nbsp;ile musi wzrosnąć, żeby wrócić do poziomu wyjściowego?</p>
      <div class="answer">
        <label class="sr" for="ans">Odpowiedź</label>
        <input id="ans" class="input num" value="0,25" inputmode="decimal">
        <button class="btn">Sprawdź</button>
        <span class="kbd-hint"><kbd>Enter</kbd></span>
      </div>
      <p class="feedback ok"><b>Dobrze.</b> <span class="num">1 / (1 − 0,2) − 1 = 0,25 = 25%</span></p>
    </section>

    <footer class="specimen">
      <p class="sp-serif">Zażółć gęślą jaźń — 0,25 → 25%</p>
      <p class="sp-sans">Zażółć gęślą jaźń — 0,25 → 25%</p>
      <p class="sp-mono">Zażółć gęślą jaźń — 0,25 → 25%</p>
    </footer>
  </main>
</div>

<script>
// Seeded random walk: identical data in every option.
(function () {
  let a = 7;
  const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const n = 250, sigma = 0.01, p = [100];
  for (let i = 1; i < n; i++) p.push(p[i - 1] * Math.exp(sigma * gauss()));
  const svg = document.querySelector("svg.walk");
  const W = 640, H = 220, L = 44, R = 12, T = 12, B = 26;
  const lo = Math.min(...p), hi = Math.max(...p), pad = (hi - lo) * 0.12;
  const y0 = lo - pad, y1 = hi + pad;
  const x = (i) => L + (i / (n - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const ns = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, text) => { const e = document.createElementNS(ns, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text) e.textContent = text; svg.appendChild(e); return e; };
  const step = (hi - lo) > 12 ? 5 : 2;
  for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) {
    el("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "grid" });
    el("text", { x: L - 8, y: y(v) + 4, class: "tick", "text-anchor": "end" }, v.toFixed(0));
  }
  [0, 50, 100, 150, 200, 249].forEach((i) => el("text", { x: x(i), y: H - 6, class: "tick", "text-anchor": "middle" }, String(i === 249 ? 250 : i)));
  el("line", { x1: L, x2: W - R, y1: y(100), y2: y(100), class: "base" });
  el("path", { d: p.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(""), class: "path" });
  el("circle", { cx: x(n - 1), cy: y(p[n - 1]), r: 3, class: "end" });
  el("text", { x: x(n - 1) - 6, y: y(p[n - 1]) + 18, class: "endlabel", "text-anchor": "end" }, p[n - 1].toFixed(1).replace(".", ","));
})();
renderMathInElement(document.body, { delimiters: [{ left: "\\\\[", right: "\\\\]", display: true }, { left: "\\\\(", right: "\\\\)", display: false }], output: "htmlAndMathml" });
</script>`;

// ---------- shared structural CSS ----------
const base = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}
a{color:inherit}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.num,.fig-stats,.stats,.eq-no,.tick,.endlabel,.toc-meta,.crumbs,.input{font-family:var(--mono);font-variant-numeric:tabular-nums}
.topbar{border-bottom:1px solid var(--rule);background:var(--bar-bg,var(--bg))}
.topbar-in{display:flex;align-items:center;gap:32px;max-width:var(--maxw);margin:0 auto;padding:0 24px;height:56px}
.wordmark{text-decoration:none;font-weight:600;letter-spacing:.02em}
.mainnav{display:flex;gap:24px;font-size:14px}
.mainnav a{text-decoration:none;color:var(--ink-muted);padding:18px 0;border-bottom:2px solid transparent}
.mainnav a[aria-current]{color:var(--ink);border-bottom-color:var(--accent)}
.stats{margin-left:auto;display:flex;gap:20px;font-size:12px;color:var(--ink-muted)}
.stats b{color:var(--ink);font-weight:500}
.page{display:grid;max-width:var(--maxw);margin:0 auto;padding:0 24px 96px}
.toc ol{list-style:none;margin:0;padding:0}
.toc a{text-decoration:none}
.toc-progress{height:2px;background:var(--rule);margin-top:20px}
.toc-progress span{display:block;height:100%;background:var(--accent)}
.toc-meta{font-size:11px;color:var(--ink-muted);margin-top:8px}
.lesson{min-width:0}
.crumbs{font-size:12px;color:var(--ink-muted);letter-spacing:.02em}
.crumbs span{opacity:.5;margin:0 6px}
h1,h2{font-family:var(--serif);font-weight:500;margin:0}
.meta{display:flex;align-items:center;flex-wrap:wrap;gap:20px;font-size:13px;color:var(--ink-muted)}
.lvl{display:inline-flex;align-items:center;gap:8px}
.lvl-bars{display:inline-flex;gap:2px;align-items:flex-end}
.lvl-bars b{width:4px;background:var(--ink)}
.lvl-bars b:nth-child(1){height:6px}.lvl-bars b:nth-child(2){height:8px}.lvl-bars b:nth-child(3){height:10px}.lvl-bars b:nth-child(4){height:12px}.lvl-bars b:nth-child(5){height:14px}
.lvl-bars b.off{background:var(--rule)}
.depth{margin-left:auto;display:inline-flex;border:1px solid var(--rule);border-radius:var(--r)}
.depth button{font:inherit;font-size:13px;background:none;border:0;padding:5px 12px;color:var(--ink-muted);cursor:pointer}
.depth button[aria-selected=true]{background:var(--ink);color:var(--bg)}
.depth button:first-child{border-radius:var(--r) 0 0 var(--r)}.depth button:last-child{border-radius:0 var(--r) var(--r) 0}
.lesson p{font-family:var(--serif);font-size:var(--body);line-height:1.6;margin:0 0 1em}
.ref{font-family:var(--mono);font-size:.6em;color:var(--accent)}
.row{position:relative}
.note{font-family:var(--sans);font-size:13px;line-height:1.5;color:var(--ink-muted)}
.note sup{font-family:var(--mono);color:var(--accent)}
.eq{position:relative;margin:28px 0;padding:6px 0}
.eq-body{overflow-x:auto;font-size:1.12em}
.eq-no{position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:13px;color:var(--ink-muted)}
.fig{margin:36px 0}
.fig-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:12px;margin-bottom:8px}
.fig-label{font-family:var(--sans);font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
.fig-stats{color:var(--ink-muted);font-size:11px}
.walk{display:block;width:100%;height:auto}
.walk .grid{stroke:var(--grid);stroke-width:1}
.walk .base{stroke:var(--ink-muted);stroke-width:1;stroke-dasharray:3 3}
.walk .path{fill:none;stroke:var(--ink);stroke-width:1.5;stroke-linejoin:round}
.walk .end{fill:var(--accent)}
.walk .tick{fill:var(--ink-muted);font-size:10px}
.walk .endlabel{fill:var(--ink);font-size:11px;paint-order:stroke;stroke:var(--bg);stroke-width:4px;stroke-linejoin:round}
.lesson p.crumbs{font-family:var(--mono);font-size:12px;line-height:1.4}
.lesson p .num{font-family:inherit;font-variant-numeric:tabular-nums lining-nums}
.fig figcaption{font-family:var(--sans);font-size:13px;line-height:1.5;color:var(--ink-muted);margin-top:10px}
.myth{margin:36px 0}
.myth-k,.check-k{font-family:var(--sans)!important;font-size:11px!important;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-muted);margin:0 0 6px!important}
.myth blockquote{margin:0 0 18px;font-family:var(--serif);font-style:italic;font-size:calc(var(--body) + 1px);line-height:1.5}
.myth p:not(.myth-k){font-size:calc(var(--body) - 1px)}
.neg{color:var(--wrong)}
.link{font-family:var(--sans);font-size:14px;color:var(--accent-text);text-decoration:none;font-weight:500}
.check{margin:48px 0 0;padding-top:24px}
.answer{display:flex;align-items:center;gap:10px;margin:8px 0 12px}
.input{font-size:16px;width:140px;padding:9px 12px;background:var(--surface);color:var(--ink);border:1px solid var(--rule-strong);border-radius:var(--r)}
.input:focus{outline:2px solid var(--focus);outline-offset:2px}
.btn{font:inherit;font-size:14px;font-weight:500;padding:10px 18px;border-radius:var(--r);border:0;background:var(--accent);color:var(--on-accent);cursor:pointer}
kbd{font-family:var(--mono);font-size:11px;border:1px solid var(--rule-strong);border-bottom-width:2px;border-radius:2px;padding:1px 5px;color:var(--ink-muted)}
.feedback{font-family:var(--sans)!important;font-size:14px!important}
.feedback.ok b{color:var(--correct)}
.specimen{margin-top:64px;padding-top:16px;border-top:1px solid var(--rule)}
.specimen p{margin:0 0 4px!important;font-size:15px!important;color:var(--ink-muted)}
.sp-serif{font-family:var(--serif)!important}.sp-sans{font-family:var(--sans)!important}.sp-mono{font-family:var(--mono)!important}
.katex{color:var(--ink)}
@media (max-width: 760px){
  .topbar-in{gap:16px;padding:0 16px}
  .mainnav{display:none}
  .page{display:block;padding:0 16px 64px}
  .toc{display:none}
  .depth{margin-left:0}
  .note{position:static!important;width:auto!important;margin:-4px 0 16px;padding-left:12px;border-left:2px solid var(--rule)}
  .eq-no{position:static;transform:none;display:block;text-align:right}
}`;

// ---------- the three directions ----------
const options = {
  a: {
    title: "A — Research note",
    fonts:
      "family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500",
    css: `
:root{--serif:"Newsreader",Georgia,serif;--sans:"IBM Plex Sans",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,monospace;
--maxw:1240px;--body:19px;--r:3px;
--bg:#F6F1E7;--surface:#FBF8F2;--ink:#1B2230;--ink-muted:#5D6472;--rule:#DDD4C3;--rule-strong:#B9AF9C;--grid:#E7DFD0;
--accent:#B4440E;--accent-text:#A33D0C;--on-accent:#FFF8F0;--focus:#B4440E;--correct:#2F6B3A;--wrong:#A8322B}
[data-theme=dark]{--bg:#121826;--surface:#182032;--ink:#E7E3DA;--ink-muted:#9AA1AE;--rule:#2A3346;--rule-strong:#414C63;--grid:#1E2638;
--accent:#E8763A;--accent-text:#F08A52;--on-accent:#1A0E06;--focus:#E8763A;--correct:#7BC48A;--wrong:#F0857B}
.page{grid-template-columns:200px minmax(0,68ch) 1fr;column-gap:56px;padding-top:56px}
.toc{position:sticky;top:32px;align-self:start;padding-top:96px;font-size:13px}
.toc-h{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-muted);margin:0 0 12px}
.toc li{padding:5px 0 5px 12px;border-left:1px solid var(--rule);color:var(--ink-muted)}
.toc li.on{border-left:2px solid var(--accent);color:var(--ink);padding-left:11px}
h1{font-size:44px;line-height:1.12;letter-spacing:-.01em;margin:12px 0 16px}
.meta{padding-bottom:22px;border-bottom:1px solid var(--rule);margin-bottom:36px}
.secno{display:none}
h2{font-size:26px;margin:0 0 14px}
.note{position:absolute;left:calc(100% + 40px);top:4px;width:230px}
.eq{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:14px 0}
.myth{border-left:2px solid var(--accent);padding:4px 0 4px 22px}
.check{border-top:1px solid var(--rule)}
`,
  },
  b: {
    title: "B — Trading desk",
    fonts:
      "family=Source+Serif+4:ital,opsz,wght@0,8..60,400..600;1,8..60,400&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600",
    css: `
:root{--serif:"Source Serif 4",Georgia,serif;--sans:"IBM Plex Sans",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,monospace;
--maxw:1320px;--body:17.5px;--r:2px;
--bg:#F2F3F1;--surface:#FFFFFF;--bar-bg:#E8EAE6;--ink:#14181D;--ink-muted:#555D66;--rule:#D3D7D2;--rule-strong:#A9AFA8;--grid:#E3E6E1;
--accent:#E5620F;--accent-text:#B44A08;--on-accent:#140A02;--focus:#E5620F;--correct:#1F7A45;--wrong:#B3261E}
[data-theme=dark]{--bg:#0D1013;--surface:#13171B;--bar-bg:#090B0D;--ink:#DDE2E6;--ink-muted:#8A949E;--rule:#232A31;--rule-strong:#3A444E;--grid:#161C21;
--accent:#FF7A1A;--accent-text:#FF8C3A;--on-accent:#140A02;--focus:#FF7A1A;--correct:#4CC27F;--wrong:#FF6B5E}
body{background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:24px 24px;background-position:-1px -1px}
.topbar-in{height:44px}
.wordmark{font-family:var(--mono);font-size:13px;text-transform:uppercase;letter-spacing:.12em}
.mainnav{font-family:var(--mono);font-size:12px;text-transform:uppercase;letter-spacing:.06em;gap:20px}
.mainnav a{padding:13px 0}
.stats{font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.stats span{border:1px solid var(--rule);padding:3px 8px;background:var(--surface)}
.page{grid-template-columns:220px minmax(0,1fr) 260px;column-gap:0;padding-top:24px;max-width:1320px}
.toc{position:sticky;top:24px;align-self:start;border:1px solid var(--rule);background:var(--surface);padding:14px;font-size:13px;margin-right:24px}
.toc-h{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted);margin:0 0 10px}
.toc ol{counter-reset:t}
.toc li{counter-increment:t;padding:6px 0;color:var(--ink-muted);display:flex;gap:10px;border-top:1px solid var(--rule)}
.toc li:first-child{border-top:0}
.toc li::before{content:"0" counter(t);font-family:var(--mono);font-size:11px;color:var(--ink-muted)}
.toc li.on{color:var(--ink)}.toc li.on::before{color:var(--accent)}
.lesson{grid-column:2 / 4;display:grid;grid-template-columns:minmax(0,1fr) 260px;column-gap:0;background:var(--surface);border:1px solid var(--rule)}
.lesson > *{grid-column:1;padding-left:40px;padding-right:40px}
.lesson p.crumbs{text-transform:uppercase;font-size:10.5px;letter-spacing:.08em;padding-top:28px;margin:0}
h1{font-size:36px;line-height:1.15;margin:10px 0 14px}
.meta{font-family:var(--mono);font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;padding-bottom:18px;border-bottom:1px solid var(--rule);margin-bottom:28px}
.depth button{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.secno{font-family:var(--mono);font-size:11px;color:var(--accent-text);letter-spacing:.06em}
h2{font-size:24px;margin:4px 0 14px}
.note{position:absolute;left:calc(100% + 40px);top:0;width:220px;font-size:12.5px;border-top:1px solid var(--rule-strong);padding-top:8px}
.eq{background:var(--bg);border:1px solid var(--rule);padding:14px 20px}
.eq-no{right:16px}
.fig{border:1px solid var(--rule);padding:14px 16px}
.fig-label{font-family:var(--mono);font-weight:500;color:var(--accent-text)}
.myth{border:1px solid var(--rule);border-top:2px solid var(--wrong);padding:16px 20px;background:var(--bg)}
.myth-k,.check-k{font-family:var(--mono)!important;font-size:10.5px!important}
.check{border-top:1px solid var(--rule);margin-top:40px}
.btn{font-family:var(--mono);text-transform:uppercase;font-size:12px;letter-spacing:.06em}
.specimen{padding-bottom:28px}
@media (max-width:760px){.lesson{display:block;border-left:0;border-right:0;margin:0 -16px}.lesson > *{padding-left:16px;padding-right:16px}body{background-size:16px 16px}}
`,
  },
  c: {
    title: "C — Journal grid",
    fonts:
      "family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500",
    css: `
:root{--serif:"Literata",Georgia,serif;--sans:"Public Sans",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,monospace;
--maxw:1280px;--body:18px;--r:2px;
--bg:#FAFAF7;--surface:#FFFFFF;--ink:#111111;--ink-muted:#5A5A57;--rule:#DADAD4;--rule-strong:#111111;--grid:#ECECE7;
--accent:#D2361C;--accent-text:#B82E17;--on-accent:#FFFFFF;--focus:#D2361C;--correct:#22703A;--wrong:#B82E17}
[data-theme=dark]{--bg:#171717;--surface:#1E1E1E;--ink:#EDEDE8;--ink-muted:#A3A39D;--rule:#333331;--rule-strong:#EDEDE8;--grid:#262625;
--accent:#FF5A3C;--accent-text:#FF7458;--on-accent:#140504;--focus:#FF5A3C;--correct:#6CCB86;--wrong:#FF7458}
.topbar{border-bottom:2px solid var(--rule-strong)}
.wordmark{font-family:var(--serif);font-size:20px;font-weight:700;letter-spacing:-.01em}
.mainnav{font-weight:500}
.page{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:24px;padding-top:40px}
.toc{display:none}
.lesson{grid-column:1 / 13;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:24px}
.lesson > *{grid-column:3 / 9}
.lesson p.crumbs{grid-column:1 / 13;font-family:var(--sans);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin:0 0 18px}
.crumbs span{opacity:1;color:var(--accent)}
h1{grid-column:1 / 11;font-size:64px;line-height:1.02;letter-spacing:-.025em;font-weight:600;margin:0 0 24px}
.meta{grid-column:1 / 13;font-weight:500;border-top:1px solid var(--rule-strong);border-bottom:1px solid var(--rule);padding:12px 0;margin-bottom:48px}
.lvl-bars b{background:var(--accent)}
.sec{display:contents}
.sec > *{grid-column:3 / 9}
.secno{grid-column:1 / 3;grid-row:span 1;font-family:var(--mono);font-size:44px;line-height:1;color:var(--accent);font-weight:500;letter-spacing:-.03em}
h2{font-size:30px;font-weight:600;letter-spacing:-.01em;margin:0 0 16px}
.sec > .secno + h2{margin-top:0}
.note{position:absolute;left:calc(100% + 24px);top:6px;width:calc((100% - 120px) / 6 * 3 + 48px);max-width:280px;border-top:2px solid var(--rule-strong);padding-top:8px}
.eq{grid-column:3 / 11;padding:18px 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.eq-body{font-size:1.25em}
.fig{grid-column:3 / 11}
.fig-label{color:var(--accent-text)}
.myth{grid-column:3 / 11;background:var(--ink);color:var(--bg);padding:28px 32px}
.myth .myth-k{color:var(--accent)!important}
.myth blockquote{font-size:24px;font-style:normal;font-weight:500;line-height:1.3}
.myth .neg{color:var(--accent)}
.myth .link{color:var(--bg);border-bottom:2px solid var(--accent)}
.myth .katex{color:inherit}
.check{border-top:2px solid var(--rule-strong)}
.specimen{grid-column:3 / 11}
@media (max-width:760px){
  .page{display:block}.lesson{display:block}
  h1{font-size:38px}
  .secno{display:block;font-size:28px;margin-bottom:6px}
  .myth{padding:20px}
}
`,
  },
};

for (const [key, o] of Object.entries(options)) {
  const html = `<!doctype html>
<html lang="pl" data-theme="light">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${o.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${o.fonts}&display=swap&subset=latin-ext">
<link rel="stylesheet" href="${KATEX}/katex.min.css">
<script defer src="${KATEX}/katex.min.js"></script>
<script defer src="${KATEX}/contrib/auto-render.min.js"></script>
<style>${base}${o.css}</style>
</head>
<body>
${body.replace("<script>", '<script>document.addEventListener("DOMContentLoaded",function(){').replace(/<\/script>$/, "});</script>")}
</body>
</html>`;
  writeFileSync(join(here, `${key}.html`), html);
  console.log(`wrote ${key}.html`);
}
