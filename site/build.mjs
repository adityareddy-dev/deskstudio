#!/usr/bin/env node
// Builds deskstudio.ai into site/dist from the repo's own records: the desk registry, the golden gallery, the launch
// card job, the models table, the brand kit and the recorded loops in site/media. Numbers come from those records, except the proof quote, which is copied from the quill card's handback.
//   node site/build.mjs [--out site/dist]
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter(Boolean));
const dist = resolve(args.out || join(here, 'dist'));
const read = f => readFileSync(join(root, f), 'utf8');
const json = f => JSON.parse(read(f));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = v => `$${(Math.round(v * 100) / 100).toFixed(2)}`;
const hasFfmpeg = (() => { try { return spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0; } catch { return false; } })();

// Empty the folder rather than removing it, so a server sitting in it keeps working.
mkdirSync(dist, { recursive: true });
for (const f of readdirSync(dist)) rmSync(join(dist, f), { recursive: true, force: true });
for (const d of ['media', 'gallery', 'fonts']) mkdirSync(join(dist, d), { recursive: true });

// ---------- records ----------
const registry = json('skills/desk/desks.json');
const TIERS = [['director', 'Directors', 'the pick, the notes, the sign-off'], ['senior', 'Seniors', 'the roughs, research, type, tokens, copy'], ['builder', 'Builders', 'every polish round, the making']];
const desksByTier = t => registry.desks.filter(d => d.tier === t);
const models = json('runner/models.json');

// The golden gallery: every signed-off output, its command from the eval case it came from, and one render.
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const avgOf = g => { const v = Object.values(g.axes || {}); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : g.average; };
const goldens = [];
for (const deliverable of readdirSync(join(root, 'evals', 'golden'))) {
  for (const name of readdirSync(join(root, 'evals', 'golden', deliverable))) {
    const dir = join(root, 'evals', 'golden', deliverable, name);
    if (!existsSync(join(dir, 'golden.json'))) continue;
    const g = JSON.parse(readFileSync(join(dir, 'golden.json'), 'utf8'));
    const caseName = basename(g.from || '');
    const c = existsSync(join(root, 'evals', 'cases', `${caseName}.json`)) ? JSON.parse(readFileSync(join(root, 'evals', 'cases', `${caseName}.json`), 'utf8')) : {};
    const st = existsSync(join(dir, 'state.json')) ? JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')) : {};
    const desks = [...new Set((st.desks || []).map(d => d.desk))].map(slug => registry.desks.find(d => d.slug === slug)?.name || slug);
    goldens.push({ deliverable, name, dir, command: g.command || c.command || deliverable, brand: g.brand || c.brand || name.split('-')[0], average: avgOf(g), rounds: g.rounds, cost: g.cost?.total, axes: g.axes, desks, image: pickRender(dir) });
  }
}
goldens.sort((a, b) => a.deliverable.localeCompare(b.deliverable) || a.name.localeCompare(b.name));

function pickRender(dir) {
  const r = join(dir, 'renders');
  if (!existsSync(r)) return null;
  const all = [];
  const walk = (d, depth) => { for (const f of readdirSync(d, { withFileTypes: true })) { if (f.isDirectory() && depth < 3) walk(join(d, f.name), depth + 1); else if (f.isFile() && /\.png$/.test(f.name) && !/background/.test(f.name)) all.push(join(d, f.name)); } };
  walk(r, 0);
  // The main state first: an empty, error or loading state render only when there is nothing else.
  const main = all.filter(f => !/(^|[\\/])(empty|error|loading)[\\/]/.test(f));
  const pool = main.length ? main : all;
  const prefer = [/slide-01[\\/]ig-post\.png$/, /email-600-light\.png$/, /held-00000\.png$/, /f-00000\.png$/, /[\\/]hero[\\/]desktop\.png$/, /[\\/]desktop\.png$/, /[\\/]linkedin\.png$/, /[\\/]x\.png$/, /ig-post\.png$/, /ig-square\.png$/, /\.png$/];
  for (const p of prefer) { const hit = pool.sort().find(f => p.test(f)); if (hit) return hit; }
  return null;
}

// The launch card job, the one the clips replay: roughs, the pick, the rounds, the final.
const cardJob = '20261019-0025-launch-card-desk-studio';
const cardDir = join(root, 'clips', 'fixtures', 'card');
const card = JSON.parse(readFileSync(join(cardDir, 'jobs', cardJob, 'state.json'), 'utf8'));
const cardRender = (round, size = 'linkedin') => join(cardDir, 'jobs', cardJob, 'renders', round, `${size}.png`);
const cardFinal = card.scores.find(s => s.round === card.round) || card.scores.at(-1);

// The controls job: a real run steered from the floor (clips/make-controls.mjs).
const ctlDir = join(root, 'clips', 'fixtures', 'controls', 'jobs');
const ctl = JSON.parse(readFileSync(join(ctlDir, readdirSync(ctlDir)[0], 'state.json'), 'utf8'));
const controls = { average: (Object.values((ctl.scores.at(-1) || {}).axes || {}).reduce((a, b) => a + b, 0) / 8).toFixed(1), rounds: ctl.round, cost: ctl.cost.total };

// A real proof failure, quoted from the handback of the quill card job that became a golden.
const quill = goldens.find(g => g.name === 'quill-drafts-launch');

// ---------- images ----------
// Gallery images go out as WebP at 960 wide when ffmpeg is here, else the PNG as it is.
function image(src, name) {
  if (!src || !existsSync(src)) return null;
  const outWebp = join(dist, 'gallery', `${name}.webp`), outPng = join(dist, 'gallery', `${name}.png`);
  if (hasFfmpeg && spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', 'scale=960:-2', '-c:v', 'libwebp', '-quality', '80', outWebp], { encoding: 'utf8' }).status === 0) return `gallery/${name}.webp`;
  cpSync(src, outPng);
  return `gallery/${name}.png`;
}
const size = f => { const b = readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const img = (src, name, alt, cls = '') => {
  const out = image(src, name);
  if (!out) return '';
  const { w, h } = size(src);
  return `<img class="${cls}" src="${out}" width="${w}" height="${h}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
};

// Loops: site/media/<name>.mp4 and .jpg, made by site/media.mjs from the recorded takes.
const media = join(here, 'media');
const loop = (name, alt) => {
  const mp4 = join(media, `${name}.mp4`), jpg = join(media, `${name}.webp`);
  if (!existsSync(mp4)) return `<p class="muted">The ${esc(name)} loop is not recorded yet.</p>`;
  cpSync(mp4, join(dist, 'media', `${name}.mp4`));
  if (existsSync(jpg)) cpSync(jpg, join(dist, 'media', `${name}.webp`));
  return `<video class="loop" width="1280" height="720" autoplay muted loop playsinline preload="metadata" ${existsSync(jpg) ? `poster="media/${name}.webp"` : ''} aria-label="${esc(alt)}"><source src="media/${name}.mp4" type="video/mp4"></video>${existsSync(jpg) ? `<img class="poster" src="media/${name}.webp" width="1280" height="720" alt="${esc(alt)}" loading="lazy" decoding="async">` : ''}`;
};

// ---------- the page ----------
for (const f of ['inter/Inter-Variable.woff2', 'geist/GeistMono-Variable.woff2']) cpSync(join(root, 'fonts', f), join(dist, 'fonts', basename(f)));
cpSync(join(root, 'brand', 'mark.svg'), join(dist, 'favicon.svg'));
if (existsSync(join(here, 'CNAME'))) cpSync(join(here, 'CNAME'), join(dist, 'CNAME'));
writeFileSync(join(dist, '.nojekyll'), '');
if (existsSync(join(media, 'og.png'))) cpSync(join(media, 'og.png'), join(dist, 'og.png'));

const palette = read('brand/palette.css');
const INSTALL = '/plugin install desk --marketplace adityareddy-dev/deskstudio';
const REPO = 'https://github.com/adityareddy-dev/deskstudio';
// A command breaks between words, never inside one.
const cmd = t => String(t).split(' ').map(w => `<span class="nb">${esc(w)}</span>`).join(' ');
const mark = `<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><rect x="0" y="18" width="24" height="6"/><circle cx="17" cy="10" r="4"/></svg>`;
const star = `<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>`;

const css = `
${palette}
@font-face { font-family: "Inter"; font-style: normal; font-weight: 100 900; font-display: swap; src: url("fonts/Inter-Variable.woff2") format("woff2"); }
@font-face { font-family: "Geist Mono"; font-style: normal; font-weight: 100 900; font-display: swap; src: url("fonts/GeistMono-Variable.woff2") format("woff2"); }
@font-face { font-family: "Inter Fallback"; src: local("Arial"); size-adjust: 107.4%; ascent-override: 90.2%; descent-override: 22.5%; line-gap-override: 0%; }
:root { color-scheme: light dark; }
:root { --background: #ffffff; --foreground: #17140f; --accent: #c27a00; --muted: #6b655b; --surface: #f6f3ec; --line: #d9d4c8; --danger: #c4281c; }
@media (prefers-color-scheme: dark) { :root { --background: #12110f; --foreground: #f4f0e8; --accent: #ffaa1c; --muted: #9a948a; --surface: #1c1a17; --line: #3b3830; --danger: #ff6b5e; } }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; }
body { background: var(--background); color: var(--foreground); font-family: "Inter", "Inter Fallback", ui-sans-serif, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 16px; line-height: 1.5; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
img, video, svg { max-width: 100%; height: auto; display: block; }
a { color: inherit; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--foreground); outline-offset: 4px; }
code, pre, .mono { font-family: "Geist Mono", ui-monospace, Menlo, Consolas, monospace; font-weight: 400; font-size: 1em; }
pre { white-space: pre-wrap; overflow-wrap: break-word; padding: 16px; background: var(--surface); border: 1px solid var(--line); line-height: 1.5; }
.wrap { width: 100%; max-width: 1168px; margin: 0 auto; padding: 0 24px; }
header.top { position: sticky; top: 0; z-index: 2; background: var(--background); border-bottom: 1px solid var(--line); }
header.top .wrap { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 600; letter-spacing: -0.02em; font-size: 20px; text-decoration: none; }
.mark { width: 24px; height: 24px; fill: var(--foreground); flex: none; }
.mark circle { fill: var(--accent); }
.nav { display: flex; gap: 24px; align-items: center; }
.nav a { min-height: 44px; display: inline-flex; align-items: center; }
section { padding: 96px 0; border-top: 1px solid var(--line); }
section.hero { border-top: 0; padding: 64px 0 96px; }
h1 { font-weight: 600; font-size: 76.5px; line-height: 1.05; letter-spacing: -0.025em; max-width: 12ch; }
h2 { font-weight: 600; font-size: 39px; line-height: 1.1; letter-spacing: -0.015em; max-width: 24ch; }
h3 { font-weight: 600; font-size: 25px; line-height: 1.2; }
h4 { font-weight: 600; font-size: 16px; line-height: 1.5; }
.lead { font-size: 20px; line-height: 1.45; max-width: 60ch; margin-top: 24px; }
p + p { margin-top: 12px; }
.muted { color: var(--muted); }
.small { font-size: 13px; line-height: 1.4; }
.two { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 48px; align-items: center; }
.two.flip > :first-child { order: 2; }
.cta { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 24px; margin-top: 32px; background: var(--foreground); color: var(--background); border: 2px solid var(--foreground); border-radius: 4px; font-weight: 600; text-decoration: none; }
.cta:hover { background: var(--background); color: var(--foreground); }
.ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.ctas .cta { margin-top: 0; }
.cta.ghost { background: transparent; color: var(--foreground); }
.cta.ghost:hover { background: var(--foreground); color: var(--background); }
.star { width: 16px; height: 16px; fill: currentColor; margin-right: 8px; flex: none; }
.nb { white-space: nowrap; }
.install { display: block; margin-top: 24px; color: var(--muted); }
.cmdblock { padding: 16px; background: var(--surface); border: 1px solid var(--line); line-height: 1.6; margin-top: 8px; }
.open a { white-space: nowrap; }
.open { margin-top: 16px; color: var(--muted); }
.open a { color: var(--foreground); margin-left: 12px; }
.loop { width: 100%; aspect-ratio: 16 / 9; border: 1px solid var(--line); background: var(--surface); }
.pair2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 24px; }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 32px 24px; margin-top: 48px; }
.gallery figure img { width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: contain; border: 1px solid var(--line); background: var(--surface); }
.gallery figcaption { margin-top: 12px; }
.gallery .cmd { display: block; }
.steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 24px; margin-top: 48px; counter-reset: step; }
.steps > div { border-top: 2px solid var(--foreground); padding-top: 16px; }
.steps h3::before { counter-increment: step; content: counter(step) ". "; }
.steps > .signoff { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; align-items: start; }
.axes { font-variant-numeric: tabular-nums lining-nums; }
.roughs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.roughs img, .final img { width: 100%; border: 1px solid var(--line); }
.axes { display: grid; grid-template-columns: 1fr auto; gap: 4px 16px; margin-top: 16px; max-width: 360px; font-variant-numeric: tabular-nums lining-nums; }
.axes .bar { grid-column: 1 / -1; height: 8px; background: var(--line); position: relative; }
.axes .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--foreground); }
.axes .bar b { position: absolute; left: 80%; top: -3px; bottom: -3px; width: 2px; background: var(--muted); }
.tiers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; margin-top: 48px; }
.tiers ul { list-style: none; margin-top: 12px; }
.tiers li { padding: 6px 0; border-top: 1px solid var(--line); }
.tiers li span { display: block; color: var(--muted); font-size: 13px; }
table { border-collapse: collapse; width: 100%; margin-top: 24px; }
th, td { text-align: left; padding: 10px 12px 10px 0; border-top: 1px solid var(--line); vertical-align: top; }
th { font-weight: 600; }
.costline { display: flex; height: 12px; background: var(--line); margin-top: 24px; }
.costline i { display: block; height: 100%; background: var(--foreground); }
.costline i.senior { opacity: 0.6; } .costline i.builder { opacity: 0.3; }
.costscale { display: flex; justify-content: space-between; color: var(--muted); font-size: 13px; margin-top: 4px; }
.controls { list-style: none; margin-top: 24px; display: grid; gap: 8px; }
.controls li { padding-left: 20px; position: relative; }
.controls li::before { content: ""; position: absolute; left: 0; top: 10px; width: 8px; height: 8px; background: var(--foreground); }
.checks { list-style: none; margin-top: 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px 24px; }
.checks li { border-top: 1px solid var(--line); padding-top: 8px; }
blockquote { margin-top: 24px; padding-left: 20px; border-left: 2px solid var(--foreground); max-width: 60ch; }
footer { padding: 48px 0; border-top: 1px solid var(--line); color: var(--muted); }
footer .wrap { display: flex; flex-wrap: wrap; gap: 16px 32px; align-items: center; justify-content: space-between; }
footer a { min-height: 44px; display: inline-flex; align-items: center; }
@media (max-width: 900px) {
  .two { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .two.flip > :first-child { order: 0; }
  .steps { grid-template-columns: minmax(0, 1fr); }
  .steps > .signoff { grid-template-columns: minmax(0, 1fr); }
  .tiers { grid-template-columns: minmax(0, 1fr); }
  section { padding: 64px 0; }
  h1 { font-size: 39px; line-height: 1.1; letter-spacing: -0.015em; }
  h2 { font-size: 25px; }
  .lead { font-size: 16px; margin-top: 16px; }
  .cta { display: flex; width: 100%; }
  .open a { display: block; margin: 8px 0 0; }
  .nav { gap: 16px; }
  .roughs { grid-template-columns: minmax(0, 1fr); }
  .pair2 { grid-template-columns: minmax(0, 1fr); }
  /* The gallery runs two across on a phone: seventeen full-width pieces is a very long scroll. */
  .gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 16px; margin-top: 32px; }
  .gallery figcaption { font-size: 13px; line-height: 1.4; }
  .gallery .cmd { font-size: 13px; overflow-wrap: anywhere; }
  th, td { padding: 8px 8px 8px 0; font-size: 13px; }
  /* On a phone the desks read as one line per tier; what each owns is in docs/roles.md. */
  .tiers ul { margin-top: 8px; line-height: 1.6; }
  .tiers li { display: inline; padding: 0; border: 0; }
  .tiers li + li::before { content: ", "; }
  .tiers li span { display: none; }
}
.poster { display: none; }
@media (prefers-reduced-motion: reduce) { .loop { display: none; } .poster { display: block; } }
`;

const providerRows = Object.entries(models.providers).map(([key, p]) => `<tr><th>${esc(p.label)}</th><td class="mono">${esc(p.cli)}</td><td>${['director', 'senior', 'builder'].map(t => `${t} <span class="mono">${esc(p.tiers[t])}</span>`).join(', ')}</td></tr>`).join('');

const galleryHtml = goldens.map(g => `<figure>
  ${img(g.image, `${g.deliverable}-${g.name}`, `${g.deliverable} for ${g.brand || g.name}, signed off at ${g.average}`)}
  <figcaption><span class="cmd mono">/desk:${esc(g.command)}</span><span>${esc(cap(g.deliverable.replace(/-/g, ' ')))} for ${esc(cap(g.brand))}. Signed off at ${g.average.toFixed(1)} after ${g.rounds} round${g.rounds === 1 ? '' : 's'}, ${money(g.cost)} at list price.</span></figcaption>
</figure>`).join('\n');

const axesHtml = axes => `<div class="axes">${Object.entries(axes).map(([k, v]) => `<span>${esc(k)}</span><span>${v}</span><span class="bar"><i style="width:${v * 10}%"></i><b></b></span>`).join('')}</div>`;
const scale = Math.max(1, Math.ceil(card.cost.total));
const judge = Math.round(card.cost.director / card.cost.total * 100);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Desk Studio</title>
<meta name="description" content="Your own design studio. A full design studio inside the coding agent you already use. One command, free, nothing leaves your machine but the model calls you already make.">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="canonical" href="https://deskstudio.ai/">
<link rel="preload" as="image" href="media/one-command.webp" fetchpriority="high">
<meta property="og:title" content="Your own design studio.">
<meta property="og:description" content="A full design studio inside the coding agent you already use. One command, free, nothing leaves your machine.">
<meta property="og:image" content="https://deskstudio.ai/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://deskstudio.ai/"><meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<style>${css}</style>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="#top">${mark}Desk Studio</a>
  <nav class="nav"><a href="#install">Install</a><a href="${REPO}">GitHub</a></nav>
</div></header>
<main id="top">

<section class="hero"><div class="wrap two">
  <div>
    <h1>Your own design studio.</h1>
    <p class="lead">A full design studio inside the coding agent you already use. One command, free, nothing leaves your machine but the model calls you already make.</p>
    <div class="ctas"><a class="cta" href="#install">Install the plugin</a><a class="cta ghost" href="${REPO}">${star}Star on GitHub</a></div>
    <code class="install">${cmd(INSTALL)}</code>
    <p class="open">Open source, MIT. No account, no sign-up.<a href="${REPO}">Read the code</a></p>
  </div>
  <div>${loop('one-command', 'One command typed in a terminal, then every piece the studio has signed off, then the line: your own design studio, at your desk')}</div>
</div></section>

<section id="makes"><div class="wrap">
  <h2>Made by the studio.</h2>
  <p class="lead">${goldens.length} pieces for four made-up brands, one real site and the studio's own, each signed off by the Creative Director against the eight-axis rubric. The score and the cost under each one are from the run that made it.</p>
  <div class="gallery">${galleryHtml}</div>
</div></section>

<section id="loop"><div class="wrap">
  <h2>Roughs, pick, polish, proof, sign-off.</h2>
  <p class="lead">Every visual job runs the way a studio runs. This is the launch card above, as it happened.</p>
  <div class="steps">
    <div><h3>Roughs</h3><p>The UI Designer makes three directions at the senior model from the brief, the brand and the standard for the piece.</p>
      <div class="roughs">${[1, 2, 3].map(n => img(cardRender(`rough-${n}`), `card-rough-${n}`, `rough ${n}`)).join('')}</div></div>
    <div><h3>Pick</h3><p>The Art Director looks at the renders, picks one and writes the notes.</p><blockquote><p>Rough ${card.pick.rough}: ${esc(card.pick.reason)}</p></blockquote></div>
    <div><h3>Polish</h3><p>The builder desk revises with the notes and the screenshot. Rounds are cheap, so this is where the iteration goes.</p>
      <p>${card.scores.map(s => `Round ${s.round}: ${s.average}`).join('. ')}.</p></div>
    <div><h3>Proof</h3><p>Contrast on the rendered pixels, overflow, safe zones, palette, type scale, copy present. No model in the loop. A failure goes back to the builder with the screenshot. It runs on every polished file.</p></div>
    <div class="signoff"><div><h3>Sign-off</h3><p>The Creative Director scores eight axes. Pass is every axis at 8 or above and the average at 8.5 or above.</p><p class="muted">Average ${cardFinal.average.toFixed(1)}, ${card.round} of ${card.maxRounds} rounds.</p></div>
      <div class="final">${img(cardRender(`round-${card.round}`), 'card-final', 'the signed-off launch card')}</div><div>${axesHtml(cardFinal.axes)}</div></div>
  </div>
  <div class="pair2" style="margin-top:48px"><div>${loop('the-pick', 'Three roughs on the board, the Art Director picks one and the ring draws round it')}</div><div>${loop('before-after', 'A rough becomes the signed-off render as the scorecard fills')}</div></div>
</div></section>

<section id="team"><div class="wrap">
  <div class="two">
    <div><h2>${registry.desks.length} desks.</h2><p class="lead">Each desk is a written brief: what it owns, how it decides, its checklist and what it hands to the next desk. The Design Manager staffs them per job. The three roughs run side by side and the rest in turn.</p></div>
    <div>${loop('floor-idle', 'The floor: forty-two desks, a lamp lighting when a desk starts')}</div>
  </div>
  <div class="tiers">${TIERS.map(([t, label, does]) => `<div class="tier"><h3>${label} <span class="muted">${desksByTier(t).length}</span></h3><p class="muted">${esc(does)}. Default seat <span class="mono">${esc(registry.tiers[t].default)}</span>.</p><ul>${desksByTier(t).map(d => `<li>${esc(d.name)}<span>${esc(d.owns)}</span></li>`).join('')}</ul></div>`).join('')}</div>
  <p class="muted" style="margin-top:24px">The Design Manager runs in your session on whatever model you run, and the other ${registry.desks.length - 1} desks run as subagents.</p>
</div></section>

<section id="prices"><div class="wrap">
  <div class="two flip">
    <div>${loop('cost-meter', 'The cost line filling by tier as each desk reports')}</div>
    <div><h2>Cheap models make. Strong models judge.</h2>
      <p class="lead">Roughs come from the senior seat, every polish round from the builder seat, and the pick, the notes and the sign-off from the director seat. The floor shows what each desk cost at list price.</p></div>
  </div>
  <table><thead><tr><th>Tier</th><th>Default</th><th>Does</th></tr></thead><tbody>${TIERS.map(([t, , does]) => `<tr><th>${t}</th><td class="mono">${esc(registry.tiers[t].default)}</td><td>${esc(does)}</td></tr>`).join('')}</tbody></table>
  <h3 style="margin-top:48px">One launch card, ${money(card.cost.total)} at list price.</h3>
  <div class="costline" aria-hidden="true">${['director', 'senior', 'builder'].map(t => `<i class="${t}" style="width:${(card.cost[t] / scale * 100).toFixed(2)}%" title="${t} ${money(card.cost[t])}"></i>`).join('')}</div>
  <div class="costscale"><span>$0</span><span>$${scale}</span></div>
  <p style="margin-top:16px">Director ${money(card.cost.director)}, senior ${money(card.cost.senior)}, builder ${money(card.cost.builder)}. ${judge}% went to judgment, ${100 - judge}% to making. ${card.desks.length} desk runs, ${card.round} polish rounds, signed off at ${cardFinal.average}.</p>
</div></section>

<section id="models"><div class="wrap">
  <h2>Models per seat.</h2>
  <p class="lead">The runner reaches each provider through the CLI you already have signed in, on the plan you already pay for. API keys are the fallback. One provider is fine, and tiers can mix. Jobs have completed through the Anthropic, OpenAI and Google CLIs. Google uses Antigravity CLI.</p>
  <table><thead><tr><th>Provider</th><th>CLI</th><th>Seats</th></tr></thead><tbody>${providerRows}</tbody></table>
  <pre><code>{
  "models": {
    "director": "anthropic/opus",
    "senior": "anthropic/sonnet",
    "builder": "openai/nano"
  }
}</code></pre>
  <p class="muted small" style="margin-top:12px">Set once in <span class="mono">.desk/project.json</span>, or from the floor for one job.</p>
</div></section>

<section id="floor"><div class="wrap">
  <div class="two">
    <div><h2>You run the floor.</h2>
      <p class="lead">A local page, nothing leaves your machine. Every control is a write to a file the Manager reads before its next step.</p>
      <ul class="controls">
        <li>Pause at the next step, continue, stop.</li>
        <li>Move a tier or one desk to another model, for this job or as the default.</li>
        <li>Write a desk a note. It goes into its next prompt.</li>
        <li>Pick a rough yourself, over the Art Director.</li>
        <li>Approve a sign-off under the bar, or send it back with notes.</li>
      </ul></div>
    <div>${loop('pick-it-yourself', 'Clicking a rough on the review board, which then shows as picked by you')}</div>
  </div>
  <p class="muted" style="margin-top:48px">One real job, run from the floor: paused after the roughs, the pick made by hand, the builder seat moved from Haiku to Sonnet, and a note written to the UI Designer. It came back signed off at ${controls.average} in ${controls.rounds} rounds, ${money(controls.cost)} at list price.</p>
  <div class="pair2"><div>${loop('swap-the-seat', 'The builder seat moved to another model while the job holds')}</div><div>${loop('note-to-the-desk', 'A note typed to the UI Designer, then the next round')}</div></div>
</div></section>

<section id="proof"><div class="wrap">
  <div class="two flip">
    <div>${loop('proof', 'Proof flags a subline that is too dark, and the fixed file passes')}</div>
    <div><h2>Proof on real pixels.</h2>
      <p class="lead">Every polished file is rendered in Chrome at each size and checked on the pixels before the Creative Director scores it.</p>
      <ul class="checks"><li>Text contrast against the pixels behind it</li><li>Overflow and clipping</li><li>Safe zones per platform</li><li>Colours inside the brand palette</li><li>Type on the brand scale</li><li>Every line of copy present</li><li>Carousels consistent across slides</li><li>Reading time and flashes in motion</li></ul></div>
  </div>
  ${quill ? `<blockquote><p>From the ${esc(quill.brand)} card job: proof failed twice before passing. Round 1 failed on the type scale, a 248px headline off the brand scale, capped at 232px. Round 3 failed because the X card's headline sat inside the left safe zone, and round 4 fixed it. Signed off at ${quill.average}.</p></blockquote>` : ''}
</div></section>

<section id="where"><div class="wrap">
  <h2>Other agents.</h2>
  <table><thead><tr><th>Agent</th><th>What you get</th></tr></thead><tbody>
    <tr><th>Claude Code</th><td>Everything: the ${registry.desks.length - 1} desks as native subagents with the repo's tools, the Manager in your session, the loop, proof, the floor, video.</td></tr>
    <tr><th>Codex, Cursor, Gemini CLI, Copilot, Windsurf, OpenCode</th><td><span class="mono">npx deskstudio add</span> writes a rules block the agent reads, and the agent runs jobs through <span class="mono">desk-run</span>: the same desks, loop, proof and floor, with desks returning files rather than editing the repo. The installer is tested for each of these agents, and jobs have completed through the Claude, Codex and Antigravity CLIs.</td></tr>
  </tbody></table>
</div></section>

<section id="install"><div class="wrap">
  <h2>Install.</h2>
  <p class="lead">Claude Code, one line.</p>
  <p class="cmdblock"><code>${cmd(INSTALL)}</code></p>
  <p class="muted small" style="margin-top:8px">On a Claude Code older than 2.1.275: <span class="mono">/plugin marketplace add adityareddy-dev/deskstudio</span>, then <span class="mono">/plugin install desk@deskstudio</span>.</p>
  <p class="lead">Then ask for something.</p>
  <p class="cmdblock"><code>${cmd('/desk:design a launch card for LinkedIn')}</code></p>
  <p class="lead">Codex, Cursor, Gemini CLI, Copilot, Windsurf or OpenCode: one line in the project.</p>
  <p class="cmdblock"><code>${cmd('npx deskstudio add')}</code></p>
  <p class="muted small" style="margin-top:8px">It writes <span class="mono">.desk/</span>, copies the desks to <span class="mono">.agents/skills/desk/</span> and puts one marked block in the agent's instruction file. Every agent by default, one with <span class="mono">--agent codex</span>. Run it again any time, it only touches what sits between its markers.</p>
  <table><thead><tr><th>Agent</th><th>Where the block goes</th></tr></thead><tbody>
    <tr><th>Codex</th><td class="mono">AGENTS.md</td></tr>
    <tr><th>OpenCode</th><td class="mono">AGENTS.md</td></tr>
    <tr><th>Gemini CLI</th><td class="mono">GEMINI.md</td></tr>
    <tr><th>Copilot</th><td class="mono">.github/copilot-instructions.md</td></tr>
    <tr><th>Cursor</th><td class="mono">.cursor/rules/desk.mdc</td></tr>
    <tr><th>Windsurf</th><td class="mono">.windsurf/rules/desk.md</td></tr>
  </tbody></table>
  <p class="lead">Then ask the agent in plain words, it reads the block and runs the studio.</p>
  <p class="cmdblock"><code>${cmd('design a launch card for LinkedIn')}</code></p>
  <p class="muted small" style="margin-top:8px">Or run it yourself: <span class="mono">npx desk-run design "a launch card for LinkedIn"</span>. The desks call models through the CLI you are already signed in to (<span class="mono">claude</span>, <span class="mono">codex</span> or <span class="mono">gemini</span>) or a key (<span class="mono">ANTHROPIC_API_KEY</span>, <span class="mono">OPENAI_API_KEY</span>, <span class="mono">GEMINI_API_KEY</span>). <span class="mono">npx desk-run doctor</span> shows which path it will take. Files land in <span class="mono">.desk/out/&lt;job&gt;/</span> either way.</p>
</div></section>

</main>
<footer><div class="wrap">
  <a class="brand" href="#top">${mark}Desk Studio</a>
  <span>MIT. It runs on your machine. Only the model calls the desks make and a few research lookups leave it.</span>
  <span><a href="${REPO}">GitHub</a> <a href="${REPO}/blob/main/docs/privacy.md" style="margin-left:24px">Privacy</a></span>
</div></footer>
<script>
if (matchMedia('(prefers-reduced-motion: reduce)').matches) for (const v of document.querySelectorAll('video')) { v.removeAttribute('autoplay'); v.pause(); }
</script>
</body>
</html>
`;
writeFileSync(join(dist, 'index.html'), html);
const bytes = Buffer.byteLength(html);
console.log(`site/dist/index.html ${Math.round(bytes / 1024)} KB, ${goldens.length} goldens, ${registry.desks.length} desks`);
