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
const starters = json('site/starters.json');
const jobCount = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][starters.length] || String(starters.length);

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

// The controls job: a real run steered from the dashboard (clips/make-controls.mjs).
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
const img = (src, name, alt, cls = '', framed = true) => {
  const out = image(src, name);
  if (!out) return '';
  const { w, h } = size(src);
  const content = `<img class="${cls}" src="${out}" width="${w}" height="${h}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  return framed ? frame(alt, content) : content;
};

function frame(title, content) {
  return `<div class="media-frame"><div class="frame-bar" aria-hidden="true">${esc(title)}</div>${content}</div>`;
}

// Loops: site/media/<name>.mp4 and .jpg, made by site/media.mjs from the recorded takes.
const media = join(here, 'media');
const loop = (name, alt) => {
  const mp4 = join(media, `${name}.mp4`), jpg = join(media, `${name}.webp`);
  if (!existsSync(mp4)) return `<p class="muted">The ${esc(name)} loop is not recorded yet.</p>`;
  cpSync(mp4, join(dist, 'media', `${name}.mp4`));
  if (existsSync(jpg)) cpSync(jpg, join(dist, 'media', `${name}.webp`));
  return frame(({ 'floor-idle': 'dashboard', 'swap-the-seat': 'change-role' })[name] || name, `<video class="loop" width="1280" height="720" autoplay muted loop playsinline preload="metadata" ${existsSync(jpg) ? `poster="media/${name}.webp"` : ''} aria-label="${esc(alt)}"><source src="media/${name}.mp4" type="video/mp4"></video>${existsSync(jpg) ? `<img class="poster" src="media/${name}.webp" width="1280" height="720" alt="${esc(alt)}" loading="lazy" decoding="async">` : ''}`);
};

const heroLoop = (name, alt) => {
  for (const file of [`${name}.mp4`, `${name}.webm`, `${name}-poster.png`, `${name}.vtt`]) cpSync(join(media, file), join(dist, 'media', file));
  return `<video class="loop" autoplay muted loop playsinline preload="metadata" width="1920" height="1080" poster="media/${name}-poster.png" aria-label="${esc(alt)}"><source src="media/${name}.webm" type="video/webm"><source src="media/${name}.mp4" type="video/mp4"><track kind="captions" src="media/${name}.vtt" srclang="en" label="English"></video><img class="poster" src="media/${name}-poster.png" width="1920" height="1080" alt="${esc(alt)}"><div class="hero-video-controls"><button type="button" data-video-toggle aria-pressed="false">Pause video</button><a href="media/${name}.mp4">Open video</a></div>`;
};

const realRun = () => {
  for (const ext of ['mp4', 'png']) cpSync(join(media, `real-run.${ext}`), join(dist, 'media', `real-run.${ext}`));
  return `<video controls muted playsinline preload="none" width="1920" height="1080" poster="media/real-run.png" aria-label="Eight seconds captured from a fresh Desk Studio CLI job"><source src="media/real-run.mp4" type="video/mp4"></video>`;
};

// ---------- the page ----------
for (const f of ['inter/Inter-Variable.woff2', 'geist/GeistMono-Variable.woff2']) cpSync(join(root, 'fonts', f), join(dist, 'fonts', basename(f)));
cpSync(join(root, 'brand', 'logo', 'logo.svg'), join(dist, 'favicon.svg'));
cpSync(join(root, 'brand', 'logo', 'favicon.ico'), join(dist, 'favicon.ico'));
cpSync(join(root, 'brand', 'logo', 'logo-180.png'), join(dist, 'apple-touch-icon.png'));
if (existsSync(join(here, 'CNAME'))) cpSync(join(here, 'CNAME'), join(dist, 'CNAME'));
writeFileSync(join(dist, '.nojekyll'), '');
if (existsSync(join(media, 'og.png'))) cpSync(join(media, 'og.png'), join(dist, 'og.png'));

const INSTALL = '/plugin install desk --marketplace adityareddy-dev/deskstudio';
const REPO = 'https://github.com/adityareddy-dev/deskstudio';
// A command breaks between words, never inside one.
const cmd = t => String(t).split(' ').map(w => `<span class="nb">${esc(w)}</span>`).join(' ');
// The logo from brand/logo, inline so the header needs no extra request.
const mark = read('brand/logo/logo.svg').trim().replace(/^<svg[^>]*>/, '<svg class="mark" viewBox="0 0 512 512" aria-hidden="true">');

const css = `
@font-face { font-family: "Inter"; font-style: normal; font-weight: 100 900; font-display: swap; src: url("fonts/Inter-Variable.woff2") format("woff2"); }
@font-face { font-family: "Geist Mono"; font-style: normal; font-weight: 100 900; font-display: swap; src: url("fonts/GeistMono-Variable.woff2") format("woff2"); }
@font-face { font-family: "Inter Fallback"; src: local("Arial"); size-adjust: 107.4%; ascent-override: 90.2%; descent-override: 22.5%; line-gap-override: 0%; }



:root {
  color-scheme:light;
  --white:#ffffff;
  --ink:#17140f;
  --cream:#f6f3ec;
  --muted:#6b655b;
  --line:#d9d4c8;
  --dark:#12110f;
  --warm:#f4f0e8;
  --panel:#1c1a17;
  --dark-muted:#9a948a;
  --dark-line:#3b3830;
  --gold:#8f5a00;
  --bright-gold:#ffaa1c;
}
* { box-sizing:border-box; }
html { scroll-padding-top:104px; }
body {
  margin:0;
  background:var(--white);
  color:var(--ink);
  font-family:"Inter",Arial,sans-serif;
  font-size:20px;
  font-weight:400;
  line-height:1.6;
  -webkit-font-smoothing:antialiased;
}
h1,h2,h3,p,ol,ul,figure { margin:0; }
h1,h2,h3 { font-weight:600; }
h1 { font-size:76.5px; line-height:1.05; letter-spacing:-.02em; }
h2 { font-size:39px; line-height:1.16; letter-spacing:-.02em; }
h3 { font-size:20px; line-height:1.4; }
a { color:inherit; text-underline-offset:4px; }
a:focus-visible,
a[data-state="focus"] {
  outline:3px solid currentColor;
  outline-offset:4px;
}
a:hover,
a[data-state="hover"] { text-decoration-thickness:2px; }
.wrap { width:calc(100% - 96px); max-width:1200px; margin-inline:auto; }
.band { padding-block:96px; }
.cream { background:var(--cream); }
.dark {
  background:var(--dark);
  color:var(--warm);
  --muted:var(--dark-muted);
  --line:var(--dark-line);
  --gold:var(--bright-gold);
}
.eyebrow {
  margin-bottom:24px;
  color:var(--gold);
  font-size:13px;
  line-height:1.6;
  font-weight:600;
  letter-spacing:.08em;
}
.intro { max-width:640px; }
.intro > p:last-child { margin-top:24px; }
.muted { color:var(--muted); }
.small { font-size:16px; line-height:1.5; }
.button {
  display:inline-flex;
  justify-content:center;
  align-items:center;
  min-height:48px;
  padding:8px 24px;
  border:1px solid var(--ink);
  border-radius:4px;
  background:var(--ink);
  color:var(--white);
  font-size:16px;
  font-weight:600;
  line-height:1.5;
  text-decoration:none;
}
.button:hover,
.button[data-state="hover"] { background:var(--panel); text-decoration:underline; }
.button:focus-visible,
.button[data-state="focus"] { outline-color:var(--ink); }
.topbar {
  position:sticky;
  top:0;
  z-index:10;
  background:var(--white);
  border-bottom:1px solid var(--line);
}
.nav {
  display:flex;
  align-items:center;
  gap:32px;
  min-height:80px;
  font-size:16px;
}
.brand {
  display:inline-flex;
  align-items:center;
  gap:16px;
  flex-shrink:0;
  font-weight:600;
  text-decoration:none;
}
[data-ds-logo] { display:inline-flex; align-items:center; width:40px; height:40px; }
[data-ds-logo] svg,
[data-ds-logo] img { display:block; width:100%; height:auto; max-height:40px; }
.navlinks { display:flex; align-items:center; gap:32px; margin-left:auto; }
.navlinks a { text-decoration:none; }
.navlinks a:hover,
.navlinks a[data-state="hover"] { text-decoration:underline; }
.nav .github { color:var(--muted); }
.hero { padding-top:64px; padding-bottom:96px; }
.hero-copy { text-align:center; }
.hero h1 { max-width:100%; margin-inline:auto; }
.hero .description {
  max-width:640px;
  margin:24px auto 0;
  text-align:left;
}
.hero-action { margin-top:32px; }
.hero .support { margin-top:16px; }
.command {
  display:block;
  min-width:0;
  max-width:100%;
  margin:0;
  padding:24px;
  background:var(--cream);
  border:1px solid var(--line);
  border-radius:4px;
  color:var(--ink);
  text-align:left;
  font-family:"Geist Mono",monospace;
  font-size:16px;
  font-weight:400;
  line-height:24px;
  white-space:pre-wrap;
  overflow-wrap:anywhere;
  word-break:normal;
}
.hero .command { width:fit-content; max-width:100%; margin:24px auto 0; padding:16px 24px; }
.media-frame {
  overflow:hidden;
  border:1px solid var(--line);
  border-radius:8px;
  background:var(--cream);
  box-shadow:0 16px 32px #17140f14;
}
.hero-media { margin-top:48px; }
.frame-bar {
  display:flex;
  align-items:center;
  min-height:40px;
  padding:8px 16px;
  border-bottom:1px solid var(--line);
  background:var(--cream);
  color:var(--muted);
  font-size:13px;
  line-height:1.6;
}
[data-ds-clip], [data-ds-proof] { display:block; width:100%; }
[data-ds-clip] { aspect-ratio:16 / 9; background:var(--dark); }
[data-ds-proof] { background:var(--cream); }
[data-ds-clip] video,
[data-ds-clip] img,
[data-ds-proof] img,
[data-ds-proof] svg {
  display:block;
  width:100%;
  max-width:100%;
  height:auto;
  object-fit:contain;
}
[data-ds-clip] video { aspect-ratio:16 / 9; }
.process-head {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:64px;
  align-items:start;
}
.process-head > p { max-width:640px; font-size:16px; line-height:24px; }
.steps {
  position:relative;
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  align-items:stretch;
  gap:24px;
  margin-top:64px;
  padding:24px 0 0;
  list-style:none;
}
.steps::before {
  content:"";
  position:absolute;
  top:0;
  left:0;
  right:0;
  height:1px;
  background:var(--line);
}
.steps li {
  min-width:0;
  display:flex;
  flex-direction:column;
  gap:24px;
}
.step-number {
  display:block;
  color:var(--warm);
  font-size:39px;
  font-weight:400;
  line-height:1;
  font-variant-numeric:tabular-nums;
}
.steps h3 { margin-bottom:16px; }
.steps p { color:var(--muted); font-size:16px; line-height:24px; }
.studio-layout {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:96px;
  align-items:start;
}
.tiers { border-top:1px solid var(--line); }
.tier { padding:24px 0; border-bottom:1px solid var(--line); }
.tier-description { margin-top:8px; font-size:16px; line-height:24px; color:var(--muted); }
.roles { display:flex; flex-wrap:wrap; gap:8px 24px; margin-top:16px; font-size:16px; }
.evidence-head { display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:start; }
.evidence-head > p { max-width:640px; }
.evidence-layout {
  display:grid;
  grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);
  gap:64px;
  align-items:start;
  margin-top:48px;
}
.evidence-record h3 { margin-bottom:16px; }
.score { font-size:76.5px; font-weight:600; line-height:1.05; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
.record-details { display:flex; flex-wrap:wrap; gap:8px 24px; margin-top:16px; font-size:16px; font-variant-numeric:tabular-nums; }
.caveat { max-width:640px; margin-top:24px; color:var(--muted); font-size:16px; line-height:24px; }
.checks {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:0 24px;
  list-style:none;
  padding:0;
  margin-top:32px;
  font-size:16px;
}
.checks li { padding:16px 0; border-top:1px solid var(--line); }
.agents-layout { display:grid; grid-template-columns:1fr 1fr; gap:96px; }
.agents {
  display:flex;
  flex-wrap:wrap;
  gap:16px 32px;
  list-style:none;
  padding:0;
  margin-bottom:32px;
  font-size:25px;
  font-weight:600;
  line-height:1.4;
}
.dark .command { background:var(--panel); color:var(--warm); }
.qualification { max-width:640px; margin-top:24px; color:var(--muted); font-size:16px; line-height:24px; }

.facts { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:24px; margin:24px auto 0; max-width:800px; }
.facts dt { font-weight:600; }
.facts dd { font-size:13px; color:var(--muted); }
.starters { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); gap:24px; margin-top:32px; }
.starter { display:flex; flex-direction:column; gap:12px; padding:24px; border:1px solid var(--line); text-decoration:none; min-width:0; }
.starter:hover { border-color:var(--ink); }
.starter h3 { font-size:20px; text-decoration:underline; text-underline-offset:4px; }
.starter .tag { font:12px "Geist Mono",monospace; color:var(--muted); }
.missing-desk { margin-top:32px; }
.missing-desk .links,.footer-links { display:flex; flex-wrap:wrap; gap:12px 24px; }
.missing-desk .links { margin-top:16px; }

.contribute-layout { display:grid; grid-template-columns:1fr 1fr; gap:96px; }
.contribute-links { display:flex; flex-direction:column; align-items:flex-start; gap:24px; padding-top:48px; }
.contribute-links > a { font-weight:600; }
.contribute-links p { max-width:640px; }
.install-layout { display:grid; grid-template-columns:1fr 2fr; gap:96px; }
.install-layout > div { min-width:0; }
.install-step + .install-step { margin-top:32px; }
.install-step p { margin-bottom:16px; font-size:16px; line-height:24px; }
.faq-layout { display:grid; grid-template-columns:1fr 2fr; gap:96px; }
.faq-list { border-top:1px solid var(--line); }
.faq-item { padding:24px 0; border-bottom:1px solid var(--line); }
.faq-item p { margin-top:8px; max-width:640px; color:var(--muted); font-size:16px; line-height:24px; }
footer { background:var(--cream); }
.footer-inner {
  display:flex;
  gap:24px;
  align-items:center;
  padding-block:32px;
  border-top:1px solid var(--line);
  font-size:16px;
}
.footer-inner strong { font-weight:600; margin-right:auto; }
.footer-inner > span { color:var(--muted); }

/* Only JavaScript adds this class, once a lower section enters view.
   The subtle fade never makes text invisible, including during capture. */
.section-reveal {
  animation:section-reveal 300ms cubic-bezier(0.16,1,0.3,1);
}
@keyframes section-reveal {
  from { opacity:.85; transform:translateY(8px); }
  to { opacity:1; transform:translateY(0); }
}
@media (min-width:1440px) {
  .wrap { width:calc(100% - 192px); }
}
@media (max-width:1100px) {
  .nav { gap:24px; }
  .navlinks { gap:24px; }
  .navlinks .github { display:none; }
  .hero h1 { max-width:960px; }
  .studio-layout,.agents-layout,.contribute-layout,.install-layout,.faq-layout { gap:48px; }
  .evidence-layout,.evidence-head,.process-head { gap:32px; }
  .steps {
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:32px 24px;
  }
  .steps li:last-child {
    grid-column:1 / -1;
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    grid-template-rows:auto 1fr;
    column-gap:24px;
    row-gap:16px;
  }
  .steps li:last-child .step-number { grid-column:1; grid-row:1; }
  .steps li:last-child .step-description { display:contents; }
  .steps li:last-child h3 { grid-column:1; grid-row:2; margin-bottom:0; }
  .steps li:last-child p { grid-column:2; grid-row:1 / 3; align-self:center; }
}
@media (max-width:900px) {
  .navlinks { display:none; }
  .nav > .button { margin-left:auto; }
  .hero h1 { max-width:640px; }
  .process-head,.evidence-head { grid-template-columns:1fr; }
  .studio-layout,.agents-layout,.contribute-layout { grid-template-columns:1fr; gap:48px; }
  .evidence-layout { grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:32px; }
  .install-layout,.faq-layout { grid-template-columns:1fr; gap:48px; }
  .contribute-links { padding-top:0; }
}
@media (max-width:767px) {
  .hero-copy { text-align:left; }
  .hero h1 { margin-inline:0; }
  .hero .description { margin-inline:0; }
  .hero-action .button { width:100%; }
  .hero .command { margin-inline:0; }
  .steps {
    grid-template-columns:1fr;
    grid-auto-rows:1fr;
    gap:24px;
    padding:0 0 0 24px;
  }
  .steps::before {
    top:0;
    bottom:0;
    left:0;
    right:auto;
    width:1px;
    height:auto;
  }
  .steps li,
  .steps li:last-child {
    display:grid;
    grid-template-columns:48px minmax(0,1fr);
    grid-template-rows:auto;
    align-items:start;
    gap:24px;
    grid-column:auto;
  }
  .steps li:last-child .step-number { grid-column:auto; grid-row:auto; }
  .steps li:last-child .step-description { display:block; }
  .steps li:last-child h3 { margin-bottom:16px; }
  .steps li:last-child p { align-self:auto; }
}
@media (max-width:599px) {
  html { scroll-padding-top:96px; }
  body { font-size:16px; line-height:24px; }
  .wrap { width:calc(100% - 48px); }
  .band { padding-block:64px; }
  h1 { font-size:39px; line-height:1.08; }
  h2 { font-size:31.25px; font-weight:600; line-height:1.1; }
  h3 { font-size:20px; }
  .nav { min-height:80px; gap:16px; }
  .brand { gap:8px; font-size:16px; }
  [data-ds-logo] { width:32px; height:32px; }
  [data-ds-logo] svg,[data-ds-logo] img { max-height:32px; }
  .nav .button { font-size:13px; padding:8px 16px; }
  .hero { padding-top:64px; padding-bottom:64px; }
  .hero .description { margin-top:24px; }
  .hero-action { margin-top:24px; }
  .hero .support { font-size:13px; }
  .hero .command { padding:16px; }
  .hero-media { margin-top:32px; }
  .eyebrow { margin-bottom:16px; }
  .process-head { gap:24px; }
  .steps { margin-top:40px; }
  .steps h3,
  .steps li:last-child h3 { margin-bottom:8px; }
  .studio-layout,.agents-layout,.contribute-layout,.install-layout,.faq-layout { gap:32px; }
  .evidence-head { gap:24px; }
  .evidence-layout { grid-template-columns:1fr; gap:32px; margin-top:32px; }
  .score { font-size:39px; }
  .record-details { gap:8px 16px; }
  .checks { gap:0 16px; margin-top:24px; }
  .agents { font-size:20px; gap:16px 24px; }
  .command { padding:16px; }
  .contribute-links > a { display:flex; align-items:center; min-height:48px; }
  .contribute-links { gap:16px; }
  .footer-inner { gap:16px; }
}
@media (prefers-reduced-motion:reduce) {
  html { scroll-behavior:auto; }
  *,*::before,*::after { animation:none !important; transition:none !important; }
  .section-reveal { opacity:1; transform:none; }
}

.mark { width:40px; height:40px; flex:none; }
.nb { white-space:nowrap; }
.read-code { display:inline-block; margin-left:16px; }
code, .mono { font-family:"Geist Mono",monospace; font-size:16px; }
code { overflow-wrap:anywhere; }
img, video { max-width:100%; }
.media-frame img, .media-frame video { display:block; width:100%; height:auto; object-fit:contain; }
.media-frame video { background:var(--dark); }
.hero-video-controls { display:flex; align-items:center; gap:24px; padding:16px; }
.hero-video-controls button { font:inherit; color:inherit; border:1px solid currentColor; border-radius:4px; background:transparent; padding:8px 16px; cursor:pointer; }
.media-frame .poster { display:none; }
.gallery { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:48px 24px; margin-top:48px; }
.gallery figure { min-width:0; }
.gallery img { aspect-ratio:4 / 3; object-fit:contain; background:var(--cream); }
.gallery figcaption { margin-top:16px; font-size:16px; line-height:24px; }
.gallery .cmd { display:block; overflow-wrap:anywhere; margin-bottom:8px; }
.record { margin-top:48px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); font-size:16px; line-height:24px; }
.record summary { cursor:pointer; min-height:48px; padding:16px 0; font-weight:600; }
.record summary:focus-visible { outline:3px solid currentColor; outline-offset:4px; }
.record-body { padding:24px 0; }
.record-body > * + *, .record-body .lead, .record-body p + p { margin-top:24px; }
.record-body h2 { font-size:25px; margin-bottom:24px; }
.record-body h3 { margin:24px 0 16px; }
.record-body .two { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:32px; align-items:start; }
.record-body .two.flip > :first-child { order:2; }
.record-body .tiers { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:24px; border:0; margin-top:32px; }
.record-body .tiers ul { padding:0; list-style:none; }
.record-body .tiers li { border-top:1px solid var(--line); padding:8px 0; }
.record-body .tiers li span { display:block; color:var(--muted); }
.run-record { display:grid; gap:32px; margin-top:32px; }
.run-record .signoff, .roughs { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:24px; }
.pair2 { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px; margin-top:24px; }
blockquote { border-left:2px solid var(--line); padding-left:24px; margin:24px 0; }
.axes { display:grid; grid-template-columns:1fr auto; gap:4px 16px; font-variant-numeric:tabular-nums; }
.axes .bar { grid-column:1 / -1; height:8px; background:var(--line); position:relative; }
.axes .bar i { position:absolute; inset:0 auto 0 0; background:currentColor; }
.axes .bar b { position:absolute; left:80%; top:-3px; bottom:-3px; width:2px; background:var(--muted); }
table { border-collapse:collapse; width:100%; margin-top:24px; font-size:16px; line-height:24px; }
th,td { border-top:1px solid var(--line); padding:12px 16px 12px 0; text-align:left; vertical-align:top; overflow-wrap:anywhere; }
.table-scroll { overflow-x:auto; max-width:100%; }
.table-scroll:focus-visible { outline:3px solid currentColor; outline-offset:4px; }
pre { white-space:pre-wrap; overflow-wrap:anywhere; font-size:16px; }
.cmdblock { margin-top:8px; padding:16px; border:1px solid var(--line); background:var(--cream); }
.install-details > p { margin-bottom:16px; }
.install-details .lead { margin-top:32px; }
.costline { display:flex; height:12px; background:var(--line); margin-top:24px; }
.costline i { background:currentColor; }
.costline .senior { opacity:.6; } .costline .builder { opacity:.3; }
.costscale { display:flex; justify-content:space-between; color:var(--muted); }
.controls { padding-left:24px; }
.dark .media-frame, .dark .frame-bar { background:var(--panel); }
.footer-inner { flex-wrap:wrap; }
.footer-inner .brand { margin-right:auto; }
.footer-inner a { min-height:48px; display:inline-flex; align-items:center; }
@media (min-width:901px) { .steps { grid-auto-rows:1fr; } }
@media (max-width:1100px) { .nav { gap:24px; } }
@media (max-width:900px) {
 .gallery { grid-template-columns:repeat(2,minmax(0,1fr)); }
 .record-body .tiers, .run-record .signoff { grid-template-columns:1fr; }
}
@media (max-width:599px) {
 .mark { width:32px; height:32px; }
 .nav .button { max-width:160px; }
 .steps li,.steps li:last-child { grid-template-columns:40px minmax(0,1fr); gap:16px; }
 .steps { padding-left:16px; }
 .gallery { grid-template-columns:1fr; gap:32px; margin-top:32px; }
 .record-body .two,.pair2,.roughs { grid-template-columns:1fr; }
 .record-body .two.flip > :first-child { order:0; }
 .evidence-layout { gap:40px; }
 th,td { padding-right:12px; }
}
@media (prefers-reduced-motion:reduce) {
 video.loop { display:none; }
 .media-frame .poster { display:block; }
 .hero-video-controls button { display:none; }
}

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
<link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="icon" href="favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="canonical" href="https://deskstudio.ai/">
<link rel="preload" as="image" href="media/explainer-poster.png" fetchpriority="high">
<meta property="og:title" content="Your own design studio.">
<meta property="og:description" content="A full design studio inside the coding agent you already use. One command, free, nothing leaves your machine.">
<meta property="og:image" content="https://deskstudio.ai/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://deskstudio.ai/"><meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<style>${css}</style>
</head>
<body>
<header class="topbar">
  <nav class="nav wrap" aria-label="Main navigation">
    <a class="brand" href="#top" aria-label="Desk Studio">
      ${mark}
      <span>Desk Studio</span>
    </a>
    <div class="navlinks">
      <a href="#how">How it works</a>
      <a href="#team">The studio</a>
      <a href="#contribute">Contribute</a>
      <a class="github" href="https://github.com/adityareddy-dev/deskstudio">GitHub</a>
    </div>
    <a class="button" href="#install">Install the plugin</a>
  </nav>
</header>

<main id="top">
  <section class="hero" aria-labelledby="hero-heading">
    <div class="wrap">
      <div class="hero-copy">
        <p class="eyebrow">DESIGN, AT YOUR DESK</p>
        <h1 id="hero-heading">Your own design studio.</h1>
        <p class="description">A full design studio inside the coding agent you already use. One command, free, nothing leaves your machine but the model calls you already make.</p>
        <div class="hero-action"><a class="button" href="#install">Install the plugin</a></div>
        <p class="support small muted"><a href="${REPO}" class="read-code">Read the code</a></p>
        <code class="command">/plugin install desk --marketplace adityareddy-dev/deskstudio</code>
    <dl class="facts"><div><dt>Free, MIT</dt><dd>no account, no sign-up</dd></div><div><dt>${registry.desks.length} desks</dt><dd>each one a brief you can read</dd></div><div><dt>${goldens.length} pieces</dt><dd>signed off, with score and cost</dd></div><div><dt><a href="#contribute">${starters.length} jobs open</a></dt><dd>pick one</dd></div></dl>
      </div>
      <figure class="media-frame hero-media" aria-label="Desk Studio capabilities">
        <div class="frame-bar" aria-hidden="true">Desk Studio</div>
        ${heroLoop('explainer', 'Desk Studio: roughs, pick, polish, proof and sign-off')}
      </figure>
    </div>
  </section>

  <section class="band" aria-labelledby="real-run-heading"><div class="wrap">
    <h2 id="real-run-heading">What a run looks like</h2>
    <div class="media-frame" style="margin-top:32px">${realRun()}</div>
  </div></section>

  <section class="band dark" id="how" aria-labelledby="how-heading">
    <div class="wrap">
      <div class="process-head">
        <div>
          <p class="eyebrow">THE PROCESS</p>
          <h2 id="how-heading">How a job runs.</h2>
        </div>
        <p>You type one line. The Design Manager staffs the job, three roughs come back, the Art Director picks one, a cheaper model polishes, proof checks the pixels, and the Creative Director signs it off or sends it back with notes.</p>
      </div>
      <ol class="steps">
        <li>
          <span class="step-number">01</span>
          <div class="step-description">
            <h3>Roughs</h3>
            <p>Three directions from the brief and the brand.</p>
          </div>
        </li>
        <li>
          <span class="step-number">02</span>
          <div class="step-description">
            <h3>Pick</h3>
            <p>The Art Director looks at the renders, picks one and writes the notes.</p>
          </div>
        </li>
        <li>
          <span class="step-number">03</span>
          <div class="step-description">
            <h3>Polish</h3>
            <p>The builder desk revises with the notes and the screenshot.</p>
          </div>
        </li>
        <li>
          <span class="step-number">04</span>
          <div class="step-description">
            <h3>Proof</h3>
            <p>Contrast on the rendered pixels, overflow, safe zones, palette, type scale, copy present.</p>
          </div>
        </li>
        <li>
          <span class="step-number">05</span>
          <div class="step-description">
            <h3>Sign-off</h3>
            <p>Pass is every axis at 8 or above and the average at 8.5 or above.</p>
          </div>
        </li>
      </ol>
<details class="record"><summary>The launch-card job, with its real numbers</summary><div class="record-body">
  <p class="lead">This is the launch card job, retold with its real numbers.</p>

  <div id="loop"></div><h2>Roughs, pick, polish, proof, sign-off.</h2>
  <p class="lead">Every visual job runs the way a studio runs. This is the launch card above, as it happened.</p>
  <div class="run-record">
    <div><h3>Roughs</h3><p>The UI Designer makes three directions at the senior model from the brief, the brand and the standard for the piece.</p>
      <div class="roughs">${[1, 2, 3].map(n => img(cardRender(`rough-${n}`), `card-rough-${n}`, `rough ${n}`)).join('')}</div></div>
    <div><h3>Pick</h3><blockquote><p>Rough ${card.pick.rough}: ${esc(card.pick.reason)}</p></blockquote></div>
    <div><h3>Polish</h3><p>Rounds are cheap, so this is where the iteration goes.</p>
      <p>${card.scores.map(s => `Round ${s.round}: ${s.average}`).join('. ')}.</p></div>
    <div><h3>Proof</h3><p>No model in the loop. A failure goes back to the builder with the screenshot. It runs on every polished file.</p></div>
    <div class="signoff"><div><h3>Sign-off</h3><p>The Creative Director scores eight axes.</p><p class="muted">Average ${cardFinal.average.toFixed(1)}, ${card.round} of ${card.maxRounds} rounds.</p></div>
      <div class="final">${img(cardRender(`round-${card.round}`), 'card-final', 'the signed-off launch card')}</div><div>${axesHtml(cardFinal.axes)}</div></div>
  </div>
  <div class="pair2" style="margin-top:48px"><div>${loop('the-pick', 'Three roughs on the board, the Art Director picks one and the ring draws round it')}</div><div>${loop('before-after', 'A rough becomes the signed-off render as the scorecard fills')}</div></div></div></details>
    </div>
  </section>

  <section class="band cream" id="team" aria-labelledby="team-heading">
    <div class="wrap studio-layout">
      <div class="intro">
        <p class="eyebrow">THE STUDIO</p>
        <h2 id="team-heading">${registry.desks.length} desks.</h2>
        <p>Each desk is a written brief: what it owns, how it decides, its checklist and what it hands to the next desk. The Design Manager staffs them per job.</p>
      </div>
      <div class="tiers">${TIERS.map(([t, label, does]) => `<div class="tier"><h3>${label}</h3><p class="tier-description">${esc(cap(does))}.</p><div class="roles">${desksByTier(t).slice(0, 2).map(d => `<span>${esc(d.name)}</span>`).join('')}</div></div>`).join('')}</div>
    </div>
  <div class="wrap">  <div class="missing-desk"><p>Missing a desk? A desk is one written brief and one registry entry. Write it, or ask for it first and say what it should own.</p><div class="links"><a href="${REPO}/blob/main/CONTRIBUTING.md#add-a-desk">Add a desk</a><a href="${REPO}/issues/new?template=new-desk.md">Ask for one</a></div></div></div>
  <div class="wrap"><details class="record"><summary>All desks and the dashboard</summary><div class="record-body">
  <div class="two">
    <div><p class="lead">The three roughs run side by side and the rest in turn.</p></div>
    <div>${loop('floor-idle', 'The dashboard: forty-two desks, a lamp lighting when a desk starts')}</div>
  </div>
  <div class="tiers">${TIERS.map(([t, label, does]) => `<div class="tier"><h3>${label} <span class="muted">${desksByTier(t).length}</span></h3><p class="muted">${esc(does)}. Default model <span class="mono">${esc(registry.tiers[t].default)}</span>.</p><ul>${desksByTier(t).map(d => `<li>${esc(d.name)}<span>${esc(d.owns)}</span></li>`).join('')}</ul></div>`).join('')}</div>
  <p class="muted" style="margin-top:24px">The Design Manager runs in your session on whatever model you run, and the other ${registry.desks.length - 1} desks run as subagents.</p>

  <div class="two">
    <div id="dashboard"><h2>You run it from the dashboard.</h2>
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
  <p class="muted" style="margin-top:48px">One real job, run from the dashboard: paused after the roughs, the pick made by hand, the builder role moved from Haiku to Sonnet, and a note written to the UI Designer. It came back signed off at ${controls.average} in ${controls.rounds} rounds, ${money(controls.cost)} at list price.</p>
  <div class="pair2"><div>${loop('swap-the-seat', 'The builder role moved to another model while the job holds')}</div><div>${loop('note-to-the-desk', 'A note typed to the UI Designer, then the next round')}</div></div></div></details></div>
  </section>

  <section class="band" id="proof" aria-labelledby="evidence-heading">
    <div class="wrap">
      <div class="evidence-head">
        <div>
          <p class="eyebrow">THE EVIDENCE</p>
          <h2 id="evidence-heading">Proof on real pixels.</h2>
        </div>
        <p>Every polished file is rendered in Chrome at each size and checked on the pixels before the Creative Director scores it.</p>
      </div>
      <div class="evidence-layout">
        <figure class="media-frame" aria-label="Saved Desk Studio launch-card output">
          <div class="frame-bar" aria-hidden="true"></div>
          ${img(cardRender(`round-${card.round}`), 'card-final', 'The signed-off Desk Studio launch card, Your own design studio', '', false)}
        </figure>
        <div class="evidence-record">
          <h3>One launch card.</h3>
          <p class="score">${cardFinal.average.toFixed(1)}</p>
          <div class="record-details"><span>${card.round} polish rounds</span><span>${money(card.cost.total)} at list price</span></div>
          <p class="caveat">Scores come from the studio's model reviewers, they are not independent benchmarks.</p>
          <ul class="checks">
            <li>Text contrast</li>
            <li>Overflow and clipping</li>
            <li>Safe zones</li>
            <li>Brand palette</li>
            <li>Type scale</li>
            <li>Copy present</li>
          </ul>
        </div>
      </div>
<details class="record"><summary>Proof checks and the cost record</summary><div class="record-body">
  <div id="prices"></div><div class="two flip">
    <div>${loop('proof', 'Proof flags a subline that is too dark, and the fixed file passes')}</div>
    <div><ul class="checks"><li>Text contrast against the pixels behind it</li><li>Safe zones per platform</li><li>Colours inside the brand palette</li><li>Type on the brand scale</li><li>Every line of copy present</li><li>Carousels consistent across slides</li><li>Reading time and flashes in motion</li></ul></div>
  </div>
  ${quill ? `<blockquote><p>From the ${esc(quill.brand)} card job: proof failed twice before passing. Round 1 failed on the type scale, a 248px headline off the brand scale, capped at 232px. Round 3 failed because the X card's headline sat inside the left safe zone, and round 4 fixed it. Signed off at ${quill.average}.</p></blockquote>` : ''}

  <div class="two flip">
    <div>${loop('cost-meter', 'The cost line filling by tier as each desk reports')}</div>
    <div><h2>Cheap models make. Strong models judge.</h2>
      <p class="lead">Roughs come from the senior roles, every polish round from the builder roles, and the pick, the notes and the sign-off from the director roles. The dashboard shows what each desk cost at list price.</p></div>
  </div>
  <div class="table-scroll" tabindex="0" role="region" aria-label="Technical details"><table><thead><tr><th>Tier</th><th>Default</th><th>Does</th></tr></thead><tbody>${TIERS.map(([t, , does]) => `<tr><th>${t}</th><td class="mono">${esc(registry.tiers[t].default)}</td><td>${esc(does)}</td></tr>`).join('')}</tbody></table></div>
  <h3 style="margin-top:48px">One launch card, ${money(card.cost.total)} at list price.</h3>
  <div class="costline" aria-hidden="true">${['director', 'senior', 'builder'].map(t => `<i class="${t}" style="width:${(card.cost[t] / scale * 100).toFixed(2)}%" title="${t} ${money(card.cost[t])}"></i>`).join('')}</div>
  <div class="costscale"><span>$0</span><span>$${scale}</span></div>
  <p style="margin-top:16px">Director ${money(card.cost.director)}, senior ${money(card.cost.senior)}, builder ${money(card.cost.builder)}. ${judge}% went to judgment, ${100 - judge}% to making. ${card.desks.length} desk runs, ${card.round} polish rounds, signed off at ${cardFinal.average}.</p></div></details>
    </div>
  </section>

<section class="band cream" id="makes"><div class="wrap">
  <h2>Made by the studio.</h2>
  <p class="lead">${goldens.length} pieces for four made-up brands, one real site and the studio's own, each signed off by the Creative Director against the eight-axis rubric. The score and the cost under each one are from the run that made it. Scores come from the studio's model reviewers, they are not independent benchmarks.</p>
  <div class="gallery">${galleryHtml}</div></div></section>

  <section class="band dark" id="where" aria-labelledby="agents-heading">
    <div class="wrap agents-layout">
      <div class="intro">
        <p class="eyebrow">YOUR EXISTING TOOLS</p>
        <h2 id="agents-heading">Other agents.</h2>
        <p>The runner reaches each provider through the CLI you already have signed in, on the plan you already pay for.</p>
      </div>
      <div>
        <ul class="agents">
          <li><a href="${REPO}/blob/main/README.md#install">Claude Code</a></li>
          <li><a href="${REPO}/blob/main/adapters/agents.md">Codex</a></li>
          <li><a href="${REPO}/blob/main/adapters/cursor.mdc">Cursor</a></li>
          <li><a href="${REPO}/blob/main/adapters/gemini.md">Gemini CLI</a></li>
          <li><a href="${REPO}/blob/main/adapters/copilot.md">Copilot</a></li>
          <li><a href="${REPO}/blob/main/adapters/windsurf.md">Windsurf</a></li>
          <li><a href="${REPO}/blob/main/adapters/opencode.md">OpenCode</a></li>
        </ul>
        <code class="command">npx deskstudio add</code>
        <p class="qualification">The runner takes design for social cards. For design work inside the codebase the agent plays the Design Manager from the briefs.</p>
      </div>
    </div>
  <div class="wrap"><details class="record"><summary>Agent support and provider models</summary><div class="record-body">
  <div class="table-scroll" tabindex="0" role="region" aria-label="Technical details"><table><thead><tr><th>Agent</th><th>What you get</th></tr></thead><tbody>
    <tr><th>Claude Code</th><td>Everything: the ${registry.desks.length - 1} desks as native subagents with the repo's tools, the Manager in your session, the loop, proof, the dashboard, video.</td></tr>
    <tr><th>Codex, Cursor, Gemini CLI, Copilot, Windsurf, OpenCode</th><td><span class="mono">npx deskstudio add</span> writes a rules block the agent reads and copies the desk briefs. The runner takes <span class="mono">design</span> for social cards, with the same loop, proof and dashboard, and desks return files rather than editing the repo. The other commands are Claude Code only for now. The installer is tested for each of these agents, and jobs have completed through the Claude, Codex and Antigravity CLIs.</td></tr>
  </tbody></table></div>

  <div id="models"></div><h2>Models per role.</h2>
  <p class="lead">API keys are the fallback. One provider is fine, and tiers can mix. Jobs have completed through the Anthropic, OpenAI and Google CLIs. Google uses Antigravity CLI.</p>
  <div class="table-scroll" tabindex="0" role="region" aria-label="Technical details"><table><thead><tr><th>Provider</th><th>CLI</th><th>Roles</th></tr></thead><tbody>${providerRows}</tbody></table></div>
  <pre><code>{
  "models": {
    "director": "anthropic/opus",
    "senior": "anthropic/sonnet",
    "builder": "openai/nano"
  }
}</code></pre>
  <p class="muted small" style="margin-top:12px">Set once in <span class="mono">.desk/project.json</span>, or from the dashboard for one job.</p></div></details></div>
  </section>

  <section class="band cream" id="contribute" aria-labelledby="contribute-heading">
    <div class="wrap contribute-layout">
      <div class="intro">
        <p class="eyebrow">OPEN SOURCE</p>
        <h2 id="contribute-heading">Make your first contribution.</h2>
      </div>
    </div>
    <div class="wrap">
  <p class="lead">${jobCount} jobs are open. The four small ones name the files to read and the check to run, and none of the checks need a model call. The two new desks are bigger.</p>
  <div class="starters">${starters.map(job => `<a class="starter" href="${REPO}/issues/${job.number}"><span class="tag">${esc(job.tag)}</span><h3>${esc(job.title)}</h3><p>${esc(job.line)}</p></a>`).join('')}</div>
  <div class="ctas"><a class="button" href="${REPO}/contribute">See every open job</a><a class="button" href="${REPO}/blob/main/docs/first-contribution.md">Your first contribution</a></div>
  <p class="muted small" style="margin-top:16px">Check that a job is open and unclaimed, then comment with what you plan to change. A failed install helps too, <a href="${REPO}/issues/new/choose">report it with the host, version and exact command</a>. Remove private project content from logs.</p>
    </div>
  </section>

  <section class="band" id="install" aria-labelledby="install-heading">
    <div class="wrap install-layout">
      <div>
        <p class="eyebrow">GET STARTED</p>
        <h2 id="install-heading">Install.</h2>
      </div>
      <div class="install-details">
  <p class="lead">Claude Code, one line.</p>
  <p class="cmdblock"><code>${cmd(INSTALL)}</code></p>
  <p class="muted small" style="margin-top:8px">On a Claude Code older than 2.1.275: <span class="mono">/plugin marketplace add adityareddy-dev/deskstudio</span>, then <span class="mono">/plugin install desk@deskstudio</span>.</p>
  <p class="lead">Then ask for something.</p>
  <p class="cmdblock"><code>${cmd('/desk:design a launch card for LinkedIn')}</code></p>
  <p class="lead">Other agents, one line in the project.</p><p>Codex, Cursor, Gemini CLI, Copilot, Windsurf or OpenCode: one line in the project.</p>
  <p class="cmdblock"><code>${cmd('npx deskstudio add')}</code></p>
  <p class="muted small" style="margin-top:8px">It writes <span class="mono">.desk/</span>, copies the desks to <span class="mono">.agents/skills/desk/</span> and puts one marked block in the agent's instruction file. Every agent by default, one with <span class="mono">--agent codex</span>. Run it again any time, it only touches what sits between its markers.</p>
  <div class="table-scroll" tabindex="0" role="region" aria-label="Agent installation paths"><table><thead><tr><th>Agent</th><th>Where the block goes</th></tr></thead><tbody>
    <tr><th>Codex</th><td class="mono">AGENTS.md</td></tr>
    <tr><th>OpenCode</th><td class="mono">AGENTS.md</td></tr>
    <tr><th>Gemini CLI</th><td class="mono">GEMINI.md</td></tr>
    <tr><th>Copilot</th><td class="mono">.github/copilot-instructions.md</td></tr>
    <tr><th>Cursor</th><td class="mono">.cursor/rules/desk.mdc</td></tr>
    <tr><th>Windsurf</th><td class="mono">.windsurf/rules/desk.md</td></tr>
  </tbody></table></div>
  <p class="lead">Then ask the agent in plain words, it reads the block and runs the studio.</p>
  <p class="cmdblock"><code>${cmd('design a launch card for LinkedIn')}</code></p>
  <p class="muted small" style="margin-top:8px">Or run it yourself: <span class="mono">npx --package deskstudio desk-run design "a launch card for LinkedIn"</span>. The desks call models through the CLI you are already signed in to (<span class="mono">claude</span>, <span class="mono">codex</span> or <span class="mono">agy</span>) or a key (<span class="mono">ANTHROPIC_API_KEY</span>, <span class="mono">OPENAI_API_KEY</span>, <span class="mono">GEMINI_API_KEY</span>). <span class="mono">npx --package deskstudio desk-run doctor</span> shows which path it will take without making a model call. Files land in <span class="mono">.desk/out/&lt;job&gt;/</span> either way.</p>
      </div>
    </div>
  </section>

  <section class="band cream" id="faq" aria-labelledby="faq-heading">
    <div class="wrap faq-layout">
      <div>
        <p class="eyebrow">GOOD QUESTIONS</p>
        <h2 id="faq-heading">FAQ.</h2>
      </div>
      <div class="faq-list">
        <div class="faq-item">
          <h3>Do I need another account?</h3>
          <p>Open source, MIT. No account, no sign-up.</p>
        </div>
        <div class="faq-item">
          <h3>What leaves my machine?</h3>
          <p>Only the model calls the desks make and a few research lookups. Jobs, renders, scores and the brand file stay in your project folder.</p>
        </div>
        <div class="faq-item">
          <h3>What does the score mean?</h3>
          <p>Scores come from the studio's model reviewers, they are not independent benchmarks.</p>
        </div>
        <div class="faq-item">
          <h3>Can I choose the rough?</h3>
          <p>Yes. From the dashboard, pick a rough yourself, over the Art Director.</p>
        </div>
        <div class="faq-item"><h3>Does it cost anything?</h3><p>Nothing. It is MIT and free. The desks call models through the CLI you already have signed in or a key you set, so the only cost is the model calls you already pay for.</p></div>
        <div class="faq-item"><h3>Which agents does it work in?</h3><p>Claude Code as a plugin, with the desks as native subagents. Codex, Cursor, Gemini CLI, Copilot, Windsurf and OpenCode through npx deskstudio add, which writes one rules block the agent reads.</p></div>
        <div class="faq-item"><h3>How do I add a desk?</h3><p>Copy an existing brief in skills/desk/roles, write the new one in the same shape, add it to skills/desk/desks.json and open a pull request. CONTRIBUTING.md walks through it.</p></div>
        <div class="faq-item"><h3>Why is it free?</h3><p>It's MIT and it runs on your machine, so there's no server to pay for. You pay for the model calls you already make, and every piece above shows what it cost. One person maintains it so far, and the open jobs above are listed by name. If a desk, an agent adapter or a check is missing, you can add it.</p></div>
      </div>
    </div>
  </section>
</main>

<footer><div class="wrap footer-inner">
  <a class="brand" href="#top">${mark}Desk Studio</a>
  <span>MIT. It runs on your machine. Only the model calls the desks make and a few research lookups leave it.</span>
  <nav class="footer-links"><a href="${REPO}">GitHub</a><a href="${REPO}/tree/main/docs">Docs</a><a href="${REPO}/discussions">Discussions</a><a href="${REPO}/blob/main/CONTRIBUTING.md">Contribute</a><a href="${REPO}/blob/main/CHANGELOG.md">Changelog</a><a href="${REPO}/blob/main/docs/privacy.md">Privacy</a></nav>
</div></footer>
<script>
(() => {
  const revealAnchor = () => {
    const id = location.hash.slice(1);
    let target;
    try { target = id && document.getElementById(decodeURIComponent(id)); } catch { return; }
    if (!target) return;
    for (let p = target.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
    target.scrollIntoView();
  };
  addEventListener('hashchange', revealAnchor);
  if (location.hash) revealAnchor();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.querySelector('[data-video-toggle]');
  const heroVideo = document.querySelector('.hero-media video');
  const syncToggle = () => {
    toggle.textContent = heroVideo.paused ? 'Play video' : 'Pause video';
    toggle.setAttribute('aria-pressed', String(heroVideo.paused));
  };
  toggle.addEventListener('click', () => { if (heroVideo.paused) heroVideo.play().catch(syncToggle); else heroVideo.pause(); });
  heroVideo.addEventListener('play', syncToggle);
  heroVideo.addEventListener('pause', syncToggle);
  const pause = () => { if (motion.matches) for (const v of document.querySelectorAll('video')) v.pause(); syncToggle(); };
  pause();
  motion.addEventListener('change', pause);
})();

(() => {
  if (!("IntersectionObserver" in window) || !window.matchMedia) return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.matches) return;

  const pending = new Set();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      pending.delete(entry.target);
      if (motion.matches) continue;

      const content = entry.target.querySelector(".wrap");
      if (!content) continue;
      content.classList.add("section-reveal");
      content.addEventListener("animationend", () => {
        content.classList.remove("section-reveal");
      }, { once:true });
    }
    if (!pending.size) observer.disconnect();
  }, { threshold:0 });

  // Sections already in view remain still. Only lower sections are observed.
  document.querySelectorAll("main > section.band").forEach(section => {
    if (section.getBoundingClientRect().top >= window.innerHeight) {
      pending.add(section);
      observer.observe(section);
    }
  });

  const disableMotion = event => {
    if (!event.matches) return;
    observer.disconnect();
    pending.clear();
    document.querySelectorAll(".section-reveal").forEach(content => {
      content.classList.remove("section-reveal");
    });
  };

  if (motion.addEventListener) {
    motion.addEventListener("change", disableMotion);
  } else if (motion.addListener) {
    motion.addListener(disableMotion);
  }
})();
</script>
</body>
</html>
`;
writeFileSync(join(dist, 'index.html'), html);
const bytes = Buffer.byteLength(html);
console.log(`site/dist/index.html ${Math.round(bytes / 1024)} KB, ${goldens.length} goldens, ${registry.desks.length} desks`);
