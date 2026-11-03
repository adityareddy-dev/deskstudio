#!/usr/bin/env node
// Builds deskstudio.ai into site/dist from the repo's own records: the desk registry, the golden gallery, the launch
// card job, the models table, the brand kit and the recorded loops in site/media. Numbers come from those records, except the proof quote, which is copied from the quill card's handback.
//   node site/build.mjs [--out site/dist]
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDocs } from './docs.mjs';

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
// The studio's first brand kit and the card made on it show the retired lamp mark. They stay in evals/golden as
// records, and the site's gallery leaves them out.
const RETIRED = new Set(['brand-kit/desk-studio', 'social-card/desk-studio-floor']);
for (let i = goldens.length - 1; i >= 0; i--) if (RETIRED.has(`${goldens[i].deliverable}/${goldens[i].name}`)) goldens.splice(i, 1);

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
  return `<div class="screen-frame"><div class="bar" aria-hidden="true">${esc(cap(title))}</div>${content}</div>`;
}

// Loops: site/media/<name>.mp4, .webm and the .webp poster. The dashboard loops are recorded at 60 fps by
// clips/frames.mjs and published by site/media.mjs --frames.
const media = join(here, 'media');
const loop = (name, alt, label) => {
  const mp4 = join(media, `${name}.mp4`), webm = join(media, `${name}.webm`), jpg = join(media, `${name}.webp`);
  if (!existsSync(mp4)) return `<p class="muted">The ${esc(name)} loop is not recorded yet.</p>`;
  for (const f of [mp4, webm, jpg]) if (existsSync(f)) cpSync(f, join(dist, 'media', basename(f)));
  return frame(label || name, `<video class="loop" width="1920" height="1080" autoplay muted loop playsinline preload="metadata" ${existsSync(jpg) ? `poster="media/${name}.webp"` : ''} aria-label="${esc(alt)}"><source src="media/${name}.mp4" type="video/mp4">${existsSync(webm) ? `<source src="media/${name}.webm" type="video/webm">` : ''}</video>${existsSync(jpg) ? `<img class="poster" src="media/${name}.webp" width="1920" height="1080" alt="${esc(alt)}" loading="lazy" decoding="async">` : ''}`);
};
// The captioned walkthrough: plays when asked, with its poster and a captions track.
const walkthrough = () => {
  const files = ['walkthrough.mp4', 'walkthrough.webm', 'walkthrough.webp', 'walkthrough.vtt'];
  if (!existsSync(join(media, 'walkthrough.mp4'))) return '<p class="muted">The walkthrough is not recorded yet.</p>';
  for (const f of files) if (existsSync(join(media, f))) cpSync(join(media, f), join(dist, 'media', f));
  return `<video class="walk" controls playsinline preload="none" width="1920" height="1080" poster="media/walkthrough.webp" aria-label="A whole job on the dashboard, from the request to the sign-off and the files, with captions"><source src="media/walkthrough.mp4" type="video/mp4">${existsSync(join(media, 'walkthrough.webm')) ? '<source src="media/walkthrough.webm" type="video/webm">' : ''}<track kind="captions" src="media/walkthrough.vtt" srclang="en" label="English"></video>`;
};
// The studio bots, drawn by the dashboard's own bots.js, so the site's bots are the product's bots.
const bots = (() => { const g = {}; new Function('window', read('dashboard/public/bots.js'))(g); return g.DeskBots; })();
const botsCss = read('dashboard/public/bots.css');
const bot = (tier, state = 'awake', seed = 0) => `<span class="tier-${tier}">${bots.html(tier, state, seed)}</span>`;

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
for (const f of ['site.css', 'theme.js', 'home.css']) cpSync(join(here, f), join(dist, f));
cpSync(join(here, 'fonts', 'Bricolage-Variable.woff2'), join(dist, 'fonts', 'Bricolage-Variable.woff2'));
if (existsSync(join(media, 'og.png'))) cpSync(join(media, 'og.png'), join(dist, 'og.png'));

const INSTALL = '/plugin install desk --marketplace adityareddy-dev/deskstudio';
const REPO = 'https://github.com/adityareddy-dev/deskstudio';
// A command breaks between words, never inside one.
const cmd = t => String(t).split(' ').map(w => `<span class="nb">${esc(w)}</span>`).join(' ');
// The logo from brand/logo, inline so the header needs no extra request.
const mark = read('brand/logo/logo.svg').trim().replace(/^<svg[^>]*>/, '<svg class="mark" viewBox="0 0 512 512" aria-hidden="true">');

const sheet = (src, name, alt) => { const i = img(src, name, alt, '', false); return i ? `<div class="proof-sheet">${i}</div>` : ''; };
const themeIcons = '<svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg><svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const headLinks = `<a href="#watch">The dashboard</a><a href="#how">How it works</a><a href="#team">The studio</a><a href="/docs/">Docs</a><a href="${REPO}">GitHub</a>`;
const providerRows = Object.entries(models.providers).map(([key, p]) => `<tr><th>${esc(p.label)}</th><td class="mono">${esc(p.cli)}</td><td>${['director', 'senior', 'builder'].map(t => `${t} <span class="mono">${esc(p.tiers[t])}</span>`).join(', ')}</td></tr>`).join('');

const galleryHtml = goldens.map(g => `<figure class="proof">
  ${sheet(g.image, `${g.deliverable}-${g.name}`, `${g.deliverable} for ${g.brand || g.name}, signed off at ${g.average}`)}
  <figcaption class="proof-cap stack"><span class="cmd mono">/desk:${esc(g.command)}</span><span>${esc(cap(g.deliverable.replace(/-/g, ' ')))} for ${esc(cap(g.brand))}. Signed off at ${g.average.toFixed(1)} after ${g.rounds} round${g.rounds === 1 ? '' : 's'}, ${money(g.cost)} at list price.</span></figcaption>
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
<script src="/theme.js"></script>
<link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="icon" href="favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="canonical" href="https://deskstudio.ai/">
<link rel="preload" as="image" href="media/explainer-poster.png" fetchpriority="high">
<link rel="preload" as="font" type="font/woff2" href="/fonts/Bricolage-Variable.woff2" crossorigin>
<meta property="og:title" content="Your own design studio.">
<meta property="og:description" content="A full design studio inside the coding agent you already use. One command, free, nothing leaves your machine.">
<meta property="og:image" content="https://deskstudio.ai/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://deskstudio.ai/"><meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/site.css">
<link rel="stylesheet" href="/home.css">
<style>${botsCss}</style>
</head>
<body>
${bots.defs}
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-head">
  <nav class="wrap site-nav" aria-label="Main navigation">
    <a class="brand" href="#top" aria-label="Desk Studio">
      ${mark}
      <span>Desk Studio</span>
    </a>
    <div class="links">${headLinks}</div>
    <details class="nav-menu"><summary>Menu</summary><div class="links">${headLinks}</div></details>
    <button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch between light and dark">${themeIcons}</button>
    <a class="btn btn-secondary" href="#start">Get started</a>
  </nav>
</header>

<main id="main">
  <section class="band hero" id="top" aria-labelledby="hero-heading">
    <div class="wrap">
      <div class="hero-copy">
        <h1 id="hero-heading">Your own design studio.</h1>
        <p class="lead">A full design studio inside the coding agent you already use. One command, free, nothing leaves your machine but the model calls you already make.</p>
        <div class="actions"><a class="btn" href="#start">Get started</a><a href="${REPO}">Read the code</a></div>
        <code class="command">${cmd(INSTALL)}</code>
        <dl class="facts"><div><dt>Free, MIT</dt><dd>no account, no sign-up</dd></div><div><dt>${registry.desks.length} desks</dt><dd>each one a brief you can read</dd></div><div><dt>${goldens.length} pieces</dt><dd>signed off, with score and cost</dd></div><div><dt><a href="#contribute">${starters.length} jobs open</a></dt><dd>pick one</dd></div></dl>
      </div>
      <div class="crew crew-wake" aria-hidden="true">${bot('manager', 'awake', 1)}${bot('director', 'awake', 2)}${bot('senior', 'awake', 3)}${bot('builder', 'awake', 4)}${bot('builder', 'asleep', 5)}${bot('senior', 'asleep', 6)}</div>
      <figure class="screen-frame hero-media" aria-label="Desk Studio capabilities">
        <div class="bar" aria-hidden="true">Desk Studio</div>
        ${heroLoop('explainer', 'Desk Studio: roughs, pick, polish, proof and sign-off')}
      </figure>
    </div>
  </section>

  <section class="band ink" id="watch" aria-labelledby="watch-heading"><div class="wrap">
    <div class="band-head">
      <h2 id="watch-heading">Watch the studio work.</h2>
      <p>Every desk is a small bot at its own desk. It wakes up while its agent works and goes back to sleep when it is done. The job moves along a track from the brief to the sign-off, and every rough, pick and score lands on the board. It runs on your machine, on 127.0.0.1.</p>
    </div>
    <figure class="screen-frame walk-frame"><div class="bar" aria-hidden="true">A real job from this repo, replayed and sped up</div>${walkthrough()}</figure>
    <div class="walk-links"><a href="/docs/dashboard/">Read the dashboard guide</a><a href="#start">Open it in your project</a><span class="muted">50 seconds, with captions. Recorded at 60 frames a second from the real dashboard.</span></div>
    <div class="grid-2 loops">
      <figure>${loop('floor-idle', 'The floor of a real brand-kit job: desks wake as their agents start and sleep when they stop', 'the floor')}<figcaption><strong>Desks wake up when they work.</strong>A real brand-kit job at its busiest, ten agents at once. The badge counts agents working at the same desk.</figcaption></figure>
      <figure>${loop('the-pick', 'The Art Director wakes, then the ring draws round the picked rough on the review board', 'the pick')}<figcaption><strong>The Art Director picks.</strong>Three roughs on the board, then the ring goes round the one that reads first, with the reason under it.</figcaption></figure>
      <figure>${loop('before-after', 'Three polish rounds scored against the bar, 8.4, 8.5, then 8.9 at the bar', 'the rounds')}<figcaption><strong>Every round is scored.</strong>8.4 and 8.5 stay under the bar, round 3 signs off at 8.9 with every axis at 8 or above.</figcaption></figure>
      <figure>${loop('cost-meter', 'Round, score, cost and time counting up as the desks report', 'the numbers')}<figcaption><strong>Cost as it happens.</strong>Round, score, cost and time update as each desk reports, at list price.</figcaption></figure>
    </div>
  </div></section>

  <section class="band tint" id="control" aria-labelledby="control-heading"><div class="wrap">
    <div class="band-head">
      <h2 id="control-heading">Steer it while it runs.</h2>
      <p>Every control is a write to a file the Design Manager reads before its next step: pause, continue or stop, move a tier or one desk to another model, write a desk a note, pick a rough yourself, approve a sign-off under the bar or send it back.</p>
    </div>
    <div class="grid-2 control-grid">
      <figure>${loop('pick-it-yourself', 'Clicking Pick this on a rough, which then shows as picked by you with the ring', 'pick it yourself')}<figcaption><strong>Pick it yourself.</strong>Your pick overrides the Art Director and is recorded as your call.</figcaption></figure>
      <figure>${loop('swap-the-seat', 'The builder role moved to Sonnet for this job, then the next polish round runs on it', 'change the role')}<figcaption><strong>Change a role.</strong>The builder role moved from Haiku to Sonnet for this job. It applies at the next step.</figcaption></figure>
      <figure>${loop('note-to-the-desk', 'A note typed to the UI Designer, then the UI Designer starts the next round', 'a note to the desk')}<figcaption><strong>Leave a desk a note.</strong>It goes into that desk's next prompt. The log keeps only its length.</figcaption></figure>
      <div class="card control-list"><h3>Every control</h3><ul><li>Pause at the next step, continue, stop.</li><li>Move a tier or one desk to another model, for this job or as the default.</li><li>Write a desk a note for its next prompt.</li><li>Pick a rough yourself, over the Art Director.</li><li>Approve a sign-off under the bar, or send it back with notes.</li></ul><p>Nothing interrupts a desk in the middle of a step. <a href="/docs/dashboard/#what-each-control-does">What each control writes</a>.</p></div>
    </div>
  </div></section>

  <section class="band" aria-labelledby="real-run-heading"><div class="wrap">
    <h2 id="real-run-heading">What a run looks like</h2>
    <div class="screen-frame stack-top">${realRun()}</div>
  </div></section>

  <section class="band ink" id="how" aria-labelledby="how-heading">
    <div class="wrap">
      <div class="band-head">
        <h2 id="how-heading">How a job runs.</h2>
        <p>You type one line. The Design Manager staffs the job, three roughs come back, the Art Director picks one, a cheaper model polishes, proof checks the pixels, and the Creative Director signs it off or sends it back with notes.</p>
      </div>
      <ol class="steps">
        <li><span class="step-n">1</span><h3>Roughs</h3><p>Three directions from the brief and the brand.</p></li>
        <li><span class="step-n">2</span><h3>Pick</h3><p>The Art Director looks at the renders, picks one and writes the notes.</p></li>
        <li><span class="step-n">3</span><h3>Polish</h3><p>The builder desk revises with the notes and the screenshot.</p></li>
        <li><span class="step-n">4</span><h3>Proof</h3><p>Contrast on the rendered pixels, overflow, safe zones, palette, type scale, copy present.</p></li>
        <li><span class="step-n">5</span><h3>Sign-off</h3><p>Pass is every axis at 8 or above and the average at 8.5 or above.</p></li>
      </ol>
<details class="disclosure stack-top"><summary>The launch-card job, with its real numbers</summary><div class="body">
  <p class="lead">This is the launch card job, retold with its real numbers.</p>

  <div id="loop"></div><h2>Roughs, pick, polish, proof, sign-off.</h2>
  <p class="lead">Every visual job runs the way a studio runs. This is the launch card above, as it happened.</p>
  <div class="run-record">
    <div><h3>Roughs</h3><p>The UI Designer makes three directions at the senior model from the brief, the brand and the standard for the piece.</p>
      <div class="roughs">${[1, 2, 3].map(n => `<figure class="proof">${sheet(cardRender(`rough-${n}`), `card-rough-${n}`, `rough ${n}`)}<figcaption class="proof-cap"><strong>Rough ${n}</strong></figcaption></figure>`).join('')}</div></div>
    <div><h3>Pick</h3><blockquote><p>Rough ${card.pick.rough}: ${esc(card.pick.reason)}</p></blockquote></div>
    <div><h3>Polish</h3><p>Rounds are cheap, so this is where the iteration goes.</p>
      <p>${card.scores.map(s => `Round ${s.round}: ${s.average}`).join('. ')}.</p></div>
    <div><h3>Proof</h3><p>No model in the loop. A failure goes back to the builder with the screenshot. It runs on every polished file.</p></div>
    <div class="signoff"><div><h3>Sign-off</h3><p>The Creative Director scores eight axes.</p><p class="muted">Average ${cardFinal.average.toFixed(1)}, ${card.round} of ${card.maxRounds} rounds.</p></div>
      <div class="final"><figure class="proof">${sheet(cardRender(`round-${card.round}`), 'card-final', 'the signed-off launch card')}<figcaption class="proof-cap"><strong>The signed-off launch card</strong></figcaption></figure></div><div>${axesHtml(cardFinal.axes)}</div></div>
  </div></div></details>
    </div>
  </section>

  <section class="band tint" id="team" aria-labelledby="team-heading">
    <div class="wrap split">
      <div>
        <h2 id="team-heading">${registry.desks.length} desks.</h2>
        <p class="lead stack-top">Each desk is a written brief: what it owns, how it decides, its checklist and what it hands to the next desk. The Design Manager staffs them per job.</p>
      </div>
      <div class="rules">${TIERS.map(([t, label, does], i) => `<div class="rule-item tier"><span class="tier-bot" aria-hidden="true">${bot(t, 'awake', i + 2)}</span><h3>${label}</h3><p class="tier-description">${esc(cap(does))}.</p><div class="roles">${desksByTier(t).slice(0, 2).map(d => `<span>${esc(d.name)}</span>`).join('')}</div></div>`).join('')}</div>
    </div>
  <div class="wrap">  <div class="missing-desk"><p>Missing a desk? A desk is one written brief and one registry entry. Write it, or ask for it first and say what it should own.</p><div class="links"><a href="${REPO}/blob/main/CONTRIBUTING.md#add-a-desk">Add a desk</a><a href="${REPO}/issues/new?template=new-desk.md">Ask for one</a></div></div></div>
  <div class="wrap"><details class="disclosure stack-top"><summary>All desks and the dashboard</summary><div class="body">
  <p class="lead">The three roughs run side by side and the rest in turn. <a href="#watch">Watch the floor</a>.</p>
  <div class="tiers">${TIERS.map(([t, label, does]) => `<div class="tier"><h3>${label} <span class="muted">${desksByTier(t).length}</span></h3><p class="muted">${esc(does)}. Default model <span class="mono">${esc(registry.tiers[t].default)}</span>.</p><ul>${desksByTier(t).map(d => `<li>${esc(d.name)}<span>${esc(d.owns)}</span></li>`).join('')}</ul></div>`).join('')}</div>
  <p class="muted">The Design Manager runs in your session on whatever model you run, and the other ${registry.desks.length - 1} desks run as subagents.</p>

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
    <div><p class="lead">The loops are <a href="#control">above</a>, and every control is in <a href="/docs/dashboard/">the dashboard guide</a>.</p></div>
  </div>
  <p class="muted">One real job, run from the dashboard: paused after the roughs, the pick made by hand, the builder role moved from Haiku to Sonnet, and a note written to the UI Designer. It came back signed off at ${controls.average} in ${controls.rounds} rounds, ${money(controls.cost)} at list price.</p></div></details></div>
  </section>

  <section class="band" id="proof" aria-labelledby="evidence-heading">
    <div class="wrap">
      <div class="band-head">
        <h2 id="evidence-heading">Proof on real pixels.</h2>
        <p>Every polished file is rendered in Chrome at each size and checked on the pixels before the Creative Director scores it.</p>
      </div>
      <div class="evidence-layout">
        <figure class="proof" aria-label="Saved Desk Studio launch-card output">
          ${sheet(cardRender(`round-${card.round}`), 'card-final', 'The signed-off Desk Studio launch card, Your own design studio')}
          <figcaption class="proof-cap"><strong>Launch card</strong></figcaption>
        </figure>
        <div class="evidence-record">
          <h3>One launch card.</h3>
          <span class="stamp"><b class="score">${cardFinal.average.toFixed(1)}</b><span>signed off</span></span>
          <ul class="meta record-details"><li>${card.round} polish rounds</li><li>${money(card.cost.total)} at list price</li></ul>
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
<details class="disclosure stack-top"><summary>Proof checks and the cost record</summary><div class="body">
  <div id="prices"></div><div class="two flip">
    <div>${loop('proof', 'Proof flags a subline that is too dark, and the fixed file passes')}</div>
    <div><ul class="checks"><li>Text contrast against the pixels behind it</li><li>Safe zones per platform</li><li>Colours inside the brand palette</li><li>Type on the brand scale</li><li>Every line of copy present</li><li>Carousels consistent across slides</li><li>Reading time and flashes in motion</li></ul></div>
  </div>
  ${quill ? `<blockquote><p>From the ${esc(quill.brand)} card job: proof failed twice before passing. Round 1 failed on the type scale, a 248px headline off the brand scale, capped at 232px. Round 3 failed because the X card's headline sat inside the left safe zone, and round 4 fixed it. Signed off at ${quill.average}.</p></blockquote>` : ''}

  <div>
    <div><h2>Cheap models make. Strong models judge.</h2>
      <p class="lead">Roughs come from the senior roles, every polish round from the builder roles, and the pick, the notes and the sign-off from the director roles. The dashboard shows what each desk cost at list price.</p></div>
  </div>
  <div class="table-scroll" tabindex="0" role="region" aria-label="Technical details"><table><thead><tr><th>Tier</th><th>Default</th><th>Does</th></tr></thead><tbody>${TIERS.map(([t, , does]) => `<tr><th>${t}</th><td class="mono">${esc(registry.tiers[t].default)}</td><td>${esc(does)}</td></tr>`).join('')}</tbody></table></div>
  <h3>One launch card, ${money(card.cost.total)} at list price.</h3>
  <div class="costline" aria-hidden="true">${['director', 'senior', 'builder'].map(t => `<i class="${t}" style="width:${(card.cost[t] / scale * 100).toFixed(2)}%" title="${t} ${money(card.cost[t])}"></i>`).join('')}</div>
  <div class="costscale"><span>$0</span><span>$${scale}</span></div>
  <p>Director ${money(card.cost.director)}, senior ${money(card.cost.senior)}, builder ${money(card.cost.builder)}. ${judge}% went to judgment, ${100 - judge}% to making. ${card.desks.length} desk runs, ${card.round} polish rounds, signed off at ${cardFinal.average}.</p></div></details>
    </div>
  </section>

<section class="band tint" id="makes"><div class="wrap">
  <h2>Made by the studio.</h2>
  <p class="lead stack-top">${goldens.length} pieces for four made-up brands, one real site and the studio's own, each signed off by the Creative Director against the eight-axis rubric. The score and the cost under each one are from the run that made it. Scores come from the studio's model reviewers, they are not independent benchmarks.</p>
  <div class="gallery">${galleryHtml}</div></div></section>

  <section class="band ink" id="where" aria-labelledby="agents-heading">
    <div class="wrap split even">
      <div>
        <h2 id="agents-heading">Other agents.</h2>
        <p class="lead stack-top">The runner reaches each provider through the CLI you already have signed in, on the plan you already pay for.</p>
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
  <div class="wrap"><details class="disclosure stack-top"><summary>Agent support and provider models</summary><div class="body">
  <div class="table-scroll" tabindex="0" role="region" aria-label="Technical details"><table><thead><tr><th>Agent</th><th>What you get</th></tr></thead><tbody>
    <tr><th>Claude Code</th><td>Everything: the ${registry.desks.length - 1} desks as native subagents with the repo's tools, the Manager in your session, the loop, proof, the dashboard, video.</td></tr>
    <tr><th>Codex, Cursor, Gemini CLI, Copilot, Windsurf, OpenCode</th><td><span class="mono">npx deskstudio add</span> writes a rules block the agent reads and copies the desk briefs. The runner takes <span class="mono">design</span> for social cards, with the same loop, proof and dashboard, and desks return files rather than editing the repo. The other commands are Claude Code only for now. The installer is tested for each of these agents, and jobs have completed through the Claude, Codex and Antigravity CLIs.</td></tr>
  </tbody></table></div>

  <div id="models"></div><h2>Models per role.</h2>
  <p class="lead">API keys are the fallback. One provider is fine, and tiers can mix. Jobs have completed through the Anthropic, OpenAI and Google CLIs. Google uses Antigravity CLI.</p>
  <div class="table-scroll" tabindex="0" role="region" aria-label="Technical details"><table><thead><tr><th>Provider</th><th>CLI</th><th>Roles</th></tr></thead><tbody>${providerRows}</tbody></table></div>
  <pre class="codeblock keep"><code>{
  "models": {
    "director": "anthropic/opus",
    "senior": "anthropic/sonnet",
    "builder": "openai/nano"
  }
}</code></pre>
  <p class="muted small">Set once in <span class="mono">.desk/project.json</span>, or from the dashboard for one job.</p></div></details></div>
  </section>

  <section class="band tint" id="contribute" aria-labelledby="contribute-heading">
    <div class="wrap">
      <h2 id="contribute-heading">Make your first contribution.</h2>
      <p class="lead stack-top">${jobCount} jobs are open. The four small ones name the files to read and the check to run, and none of the checks need a model call. The two new desks are bigger.</p>
      <div class="starters">${starters.map(job => `<a class="card starter" href="${REPO}/issues/${job.number}"><span class="tag">${esc(job.tag)}</span><h3>${esc(job.title)}</h3><p>${esc(job.line)}</p></a>`).join('')}</div>
      <div class="actions ctas"><a class="btn" href="${REPO}/contribute">See every open job</a><a class="btn btn-secondary" href="${REPO}/blob/main/docs/first-contribution.md">Your first contribution</a></div>
      <p class="muted small stack-top">Check that a job is open and unclaimed, then comment with what you plan to change. A failed install helps too, <a href="${REPO}/issues/new/choose">report it with the host, version and exact command</a>. Remove private project content from logs.</p>
    </div>
  </section>

  <section class="band" id="start" aria-labelledby="start-heading">
    <div class="wrap" id="install">
      <h2 id="start-heading">From install to the dashboard.</h2>
      <ol class="steps three stack-top">
        <li><span class="step-n">1</span><h3>Install</h3><p>In Claude Code:</p><p class="command"><code>${cmd(INSTALL)}</code></p><p>In Codex, Cursor, Gemini CLI, Copilot, Windsurf or OpenCode, in the project:</p><p class="command"><code>${cmd('npx deskstudio add')}</code></p></li>
        <li><span class="step-n">2</span><h3>Run a first job</h3><p>Ask for something. In the other agents, plain words work too.</p><p class="command"><code>${cmd('/desk:design a launch card for LinkedIn')}</code></p><p>The files land in <span class="mono">.desk/out/&lt;job&gt;/</span>, with a note on who did what, the scores and the cost.</p></li>
        <li><span class="step-n">3</span><h3>Open the dashboard</h3><p>Once per project, then open the link it prints. Keep it open while the job runs.</p><p class="command"><code>${cmd('/desk:dashboard setup')}<br>${cmd('/desk:dashboard start')}</code></p><p>Outside Claude Code: <span class="mono">npx --package deskstudio desk-dashboard setup</span>, then <span class="mono">start</span>. How to read it is in <a href="/docs/dashboard/">the dashboard guide</a>.</p></li>
      </ol>
      <p class="start-more">All of it, with older Claude Code versions and the runner, is in <a href="/docs/install/">the install guide</a>.</p>
    </div>
    <div class="wrap split install-layout">
      <div>
        <h3>Every agent, step by step.</h3>
      </div>
      <div class="install-details">
  <p class="lead">Claude Code, one line.</p>
  <p class="command"><code>${cmd(INSTALL)}</code></p>
  <p class="muted small">On a Claude Code older than 2.1.275: <span class="mono">/plugin marketplace add adityareddy-dev/deskstudio</span>, then <span class="mono">/plugin install desk@deskstudio</span>.</p>
  <p class="lead">Then ask for something.</p>
  <p class="command"><code>${cmd('/desk:design a launch card for LinkedIn')}</code></p>
  <p class="lead">Other agents, one line in the project.</p><p>Codex, Cursor, Gemini CLI, Copilot, Windsurf or OpenCode: one line in the project.</p>
  <p class="command"><code>${cmd('npx deskstudio add')}</code></p>
  <p class="muted small">It writes <span class="mono">.desk/</span>, copies the desks to <span class="mono">.agents/skills/desk/</span> and puts one marked block in the agent's instruction file. Every agent by default, one with <span class="mono">--agent codex</span>. Run it again any time, it only touches what sits between its markers.</p>
  <div class="table-scroll" tabindex="0" role="region" aria-label="Agent installation paths"><table><thead><tr><th>Agent</th><th>Where the block goes</th></tr></thead><tbody>
    <tr><th>Codex</th><td class="mono">AGENTS.md</td></tr>
    <tr><th>OpenCode</th><td class="mono">AGENTS.md</td></tr>
    <tr><th>Gemini CLI</th><td class="mono">GEMINI.md</td></tr>
    <tr><th>Copilot</th><td class="mono">.github/copilot-instructions.md</td></tr>
    <tr><th>Cursor</th><td class="mono">.cursor/rules/desk.mdc</td></tr>
    <tr><th>Windsurf</th><td class="mono">.windsurf/rules/desk.md</td></tr>
  </tbody></table></div>
  <p class="lead">Then ask the agent in plain words, it reads the block and runs the studio.</p>
  <p class="command"><code>${cmd('design a launch card for LinkedIn')}</code></p>
  <p class="muted small">Or run it yourself: <span class="mono">npx --package deskstudio desk-run design "a launch card for LinkedIn"</span>. The desks call models through the CLI you are already signed in to (<span class="mono">claude</span>, <span class="mono">codex</span> or <span class="mono">agy</span>) or a key (<span class="mono">ANTHROPIC_API_KEY</span>, <span class="mono">OPENAI_API_KEY</span>, <span class="mono">GEMINI_API_KEY</span>). <span class="mono">npx --package deskstudio desk-run doctor</span> shows which path it will take without making a model call. Files land in <span class="mono">.desk/out/&lt;job&gt;/</span> either way.</p>
      </div>
    </div>
  </section>

  <section class="band tint" id="faq" aria-labelledby="faq-heading">
    <div class="wrap split">
      <h2 id="faq-heading">FAQ.</h2>
      <div class="rules">
        <div class="rule-item"><h3>Do I need another account?</h3><p>Open source, MIT. No account, no sign-up.</p></div>
        <div class="rule-item"><h3>What leaves my machine?</h3><p>Only the model calls the desks make and a few research lookups. Jobs, renders, scores and the brand file stay in your project folder.</p></div>
        <div class="rule-item"><h3>What does the score mean?</h3><p>Scores come from the studio's model reviewers, they are not independent benchmarks.</p></div>
        <div class="rule-item"><h3>Can I choose the rough?</h3><p>Yes. From the dashboard, pick a rough yourself, over the Art Director.</p></div>
        <div class="rule-item"><h3>Does it cost anything?</h3><p>Nothing. It is MIT and free. The desks call models through the CLI you already have signed in or a key you set, so the only cost is the model calls you already pay for.</p></div>
        <div class="rule-item"><h3>Which agents does it work in?</h3><p>Claude Code as a plugin, with the desks as native subagents. Codex, Cursor, Gemini CLI, Copilot, Windsurf and OpenCode through npx deskstudio add, which writes one rules block the agent reads.</p></div>
        <div class="rule-item"><h3>How do I add a desk?</h3><p>Copy an existing brief in skills/desk/roles, write the new one in the same shape, add it to skills/desk/desks.json and open a pull request. CONTRIBUTING.md walks through it.</p></div>
        <div class="rule-item"><h3>Why is it free?</h3><p>It's MIT and it runs on your machine, so there's no server to pay for. You pay for the model calls you already make, and every piece above shows what it cost. One person maintains it so far, and the open jobs above are listed by name. If a desk, an agent adapter or a check is missing, you can add it.</p></div>
      </div>
    </div>
  </section>
</main>

<footer class="site-foot"><div class="wrap">
  <a class="brand" href="#top">${mark}Desk Studio</a>
  <span class="muted">MIT. It runs on your machine. Only the model calls the desks make and a few research lookups leave it.</span>
  <nav aria-label="Footer"><a href="${REPO}">GitHub</a><a href="/docs/">Docs</a><a href="/docs/dashboard/">Dashboard guide</a><a href="${REPO}/discussions">Discussions</a><a href="${REPO}/blob/main/CONTRIBUTING.md">Contribute</a><a href="${REPO}/blob/main/CHANGELOG.md">Changelog</a><a href="${REPO}/blob/main/docs/privacy.md">Privacy</a></nav>
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
  // The 60 fps loops play only while they are on screen.
  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver(entries => { for (const e of entries) { if (motion.matches) continue; if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); } }, { rootMargin: '120px' });
    for (const v of [...document.querySelectorAll('video.loop')].filter(v => !v.closest('.hero-media'))) { v.removeAttribute('autoplay'); v.pause(); seen.observe(v); }
  }
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
buildDocs(dist);
const bytes = Buffer.byteLength(html);
console.log(`site/dist/index.html ${Math.round(bytes / 1024)} KB, ${goldens.length} goldens, ${registry.desks.length} desks`);
