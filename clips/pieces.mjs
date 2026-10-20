#!/usr/bin/env node
// Motion pieces: clips built as HTML on the brand, from real renders and real figures, exported through the
// studio's own motion proof (checks, then frame-accurate MP4 and WebM at each size).
//   node clips/pieces.mjs <piece|all> [--sizes slide,ig-story,ig-square] [--out DIR]
//   node clips/pieces.mjs --list
// Each piece writes clips/pieces/<name>.html (self-contained, fonts and images inline) and then
// <name>-<WxH>.mp4, .webm and .png (the poster) into the out folder, the same names the floor recorder uses.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSizes } from '../proof/sizes.mjs';
import { recordMotion, exportFrames } from '../proof/motion.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const fixture = join(here, 'fixtures', 'card');
const job = '20261019-0025-launch-card-desk-studio';

const inter = () => spawnSync(process.execPath, [join(root, 'scripts', 'font.mjs'), 'css', 'Inter'], { encoding: 'utf8' }).stdout || '';
const dataUri = file => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
const state = () => JSON.parse(readFileSync(join(fixture, 'jobs', job, 'state.json'), 'utf8'));
const render = (round, size) => join(fixture, 'jobs', job, 'renders', round, `${size}.png`);

// The brand, from brand/DESIGN.md, dark set.
const BRAND = `
:root { --background: #12110f; --foreground: #f4f0e8; --accent: #ffaa1c; --muted: #9a948a; --surface: #1c1a17; --line: #3b3830;
  --entrance: cubic-bezier(0.16, 1, 0.3, 1); --exit: cubic-bezier(0.7, 0, 0.84, 0); --move: cubic-bezier(0.65, 0, 0.35, 1); }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; background: var(--background); overflow: hidden; }
main { position: relative; width: 100vw; height: 100vh; background: var(--background); color: var(--foreground);
  font-family: "Inter", "Inter Fallback", ui-sans-serif, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  font-variant-numeric: tabular-nums lining-nums; font-weight: 600; letter-spacing: -0.01em; }
.muted { color: var(--muted); }
[data-caption] { position: absolute; line-height: 1.3; }
.land { opacity: 0; animation: land 300ms var(--entrance) var(--t, 0ms) both; }
.in { opacity: 0; animation: fade-in 150ms linear var(--t, 0ms) both; }
@keyframes land { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .land, .in { animation: fade-in 150ms linear 0ms both; } }
`;

const doc = ({ title, duration, loop = false, css, body }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>${inter()}${BRAND}${css}</style></head>
<body><main data-clip data-duration="${duration}" data-loop="${loop ? 'true' : 'false'}">${body}</main></body></html>`;

// Two captions in turn: the first from the start, the second from `at` to the end, 150ms linear crossfade.
const twoCaps = (a, b, at, end) => ({
  css: `.cap1 { animation: fade-out 150ms linear ${at - 150}ms forwards; } .cap2 { opacity: 0; animation: fade-in 150ms linear ${at}ms both; }
@media (prefers-reduced-motion: reduce) { .cap1 { animation: none; opacity: 0; } .cap2 { animation: none; opacity: 1; } }`,
  html: `<p class="cap1" data-caption data-start="0" data-end="${at}">${a}</p><p class="cap2" data-caption data-start="${at}" data-end="${end}">${b}</p>`,
});

const registry = JSON.parse(readFileSync(join(root, 'skills', 'desk', 'desks.json'), 'utf8'));
const TIER_OF = Object.fromEntries(registry.desks.map(d => [d.slug, d.tier]));
const NAME_OF = Object.fromEntries(JSON.parse(readFileSync(join(root, 'skills', 'desk', 'desks.json'), 'utf8')).desks.map(d => [d.slug, d.name]));
const money = v => `$${(Math.round(v * 100) / 100).toFixed(2)}`;
const money3 = v => `$${(Math.round(v * 1000) / 1000).toFixed(3)}`;
const tokens = n => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
// The fixture's desk stops with a cost, in order, each with its tier.
const stops = () => readFileSync(join(fixture, 'events.jsonl'), 'utf8').split('\n').filter(Boolean)
  .map(l => { try { return JSON.parse(l); } catch { return null; } })
  .filter(e => e && e.type === 'desk.stop' && typeof e.costUsd === 'number')
  .map(e => ({ desk: e.desk, tier: tierOf(e.model, e.desk), model: e.model, cost: e.costUsd, tokens: e.tokens && e.tokens.total || 0 }));
// Cost is attributed by the model that ran, the way state.mjs does: a desk's seat can be overridden for a step.
const tierOf = (model, desk) => /opus|fable|large|pro/.test(model || '') ? 'director' : /sonnet|mini|flash(?!-lite)/.test(model || '') ? 'senior' : /haiku|nano|lite/.test(model || '') ? 'builder' : TIER_OF[desk];
// Keyframes for one segment of the cost line: holds, then moves to each new value over 300ms; `end` shrinks it back for a loop.
function segFrames(name, steps, total, scale, { end = null } = {}) {
  const pct = t => `${(t / total * 100).toFixed(3)}%`, w = v => `${(v / scale * 100).toFixed(3)}%`;
  const out = [`0% { width: 0% }`];
  let v = 0;
  for (const s of steps) { out.push(`${pct(s.t)} { width: ${w(v)}; animation-timing-function: var(--move) }`); v = s.v; out.push(`${pct(s.t + 300)} { width: ${w(v)} }`); }
  if (end) { out.push(`${pct(end)} { width: ${w(v)}; animation-timing-function: var(--exit) }`, `${pct(end + 200)} { width: 0% }`); }
  out.push(`100% { width: ${end ? '0%' : w(v)} }`);
  return `@keyframes ${name} { ${out.join(' ')} }`;
}
// The 42-desk floor from the sting, lamps lighting in reading order 20ms apart from `from`.
// `ran` is the set of registry indexes that did the job: the sting lights every lamp, then the others dim at `dimAt`.
const floorHtml = (from = 200, { ran = null, dimAt = 4000 } = {}) => `<div class="floor" aria-hidden="true">${Array.from({ length: 42 }, (_, i) => `<div class="desk${ran && !ran.has(i) ? ' idle' : ''}" style="--t: ${from + i * 20}ms;--d: ${dimAt}ms"><div class="slab"></div><div class="lamp"></div></div>`).join('')}</div>`;
const FLOOR_CSS = `
.floor { position: absolute; display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(6, 1fr); }
.desk { position: relative; }
.slab { position: absolute; left: 0; right: 0; bottom: 0; height: 25%; background: var(--foreground); }
.lamp { position: absolute; left: 54.17%; top: 25%; width: 33.33%; aspect-ratio: 1; border-radius: 50%; background: var(--muted); animation: light 300ms var(--entrance) var(--t) both; }
@keyframes light { from { background-color: var(--muted); } to { background-color: var(--accent); } }
.desk.idle .lamp { animation: light 300ms var(--entrance) var(--t) both, dim 200ms var(--exit) var(--d) forwards; }
@keyframes dim { to { background-color: var(--muted); } }
.lockup { position: absolute; color: var(--foreground); }
.lockup text { font-family: "Inter", "Inter Fallback", ui-sans-serif, Arial, sans-serif; font-weight: 600; letter-spacing: -0.02em; }
@media (prefers-reduced-motion: reduce) { .lamp { background: var(--accent); animation: none; } }`;
const LOCKUP = `<svg class="lockup" viewBox="0 5.7 167.6 18.6" fill="currentColor" role="img" aria-label="Desk Studio"><rect x="0" y="18" width="24" height="6" fill="currentColor"/><circle cx="17" cy="10" r="4" fill="#ffaa1c"/><text x="34.3" y="24" font-size="24">Desk Studio</text></svg>`;

export const PIECES = {
  // A rough becomes the signed-off render while the scorecard fills, then back, so it loops.
  'before-after': {
    seconds: 5, loop: true, about: 'Rough 2 becomes the signed-off round 3 render as the scorecard fills.',
    html() {
      const s = state();
      const score = s.scores.find(x => x.round === s.round) || s.scores[s.scores.length - 1];
      const pick = s.pick || {};
      const axes = Object.entries(score.axes);
      const img = { roughW: dataUri(render(`rough-${pick.rough}`, 'linkedin')), finalW: dataUri(render(`round-${score.round}`, 'linkedin')), roughT: dataUri(render(`rough-${pick.rough}`, 'ig-post')), finalT: dataUri(render(`round-${score.round}`, 'ig-post')) };
      const rows = axes.map(([k, v], i) => `<div class="axis" style="--i:${i};--v:${v / 10}"><span class="name">${k}</span><span class="track"><span class="slab${v < 8 ? ' under' : ''}"></span><span class="pass"></span></span><span class="fig${v < 8 ? ' bad' : ''}">${v}</span></div>`).join('');
      return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Desk Studio, before and after</title>
<style>${inter()}${BRAND}
/* Timings in ms from zero, 5000 total: hold 0 to 1300, cross 1300 to 1800, slabs 2000 to 2720, hold, back 4300 to 4800, hold. */
.frame { position: absolute; overflow: hidden; background: var(--surface); }
.frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.frame .final { opacity: 0; animation: cross 5000ms linear infinite; }
@keyframes cross { 0%, 29% { opacity: 0; } 35%, 86% { opacity: 1; } 89%, 100% { opacity: 0; } }
@keyframes rough-out { 0%, 26% { opacity: 1; } 29%, 89% { opacity: 0; } 95%, 100% { opacity: 1; } }
.frame .rough { animation: rough-out 5000ms linear infinite; }
.frame .tall { display: none; }
.label { position: absolute; }
.label .after { position: absolute; left: 0; top: 0; white-space: nowrap; opacity: 0; animation: cross 5000ms linear infinite; }
.label .before { white-space: nowrap; opacity: 1; animation: uncross 5000ms linear infinite; }
@keyframes uncross { 0%, 26% { opacity: 1; } 29%, 89% { opacity: 0; } 95%, 100% { opacity: 1; } }
.card { position: absolute; display: grid; align-content: start; }
.axis { display: grid; grid-template-columns: var(--namew) minmax(0, 1fr) var(--figw); align-items: center; gap: var(--gap); }
.name { color: var(--muted); }
.track { position: relative; display: block; height: var(--slab); background: var(--line); }
.slab { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: var(--foreground); transform: scaleX(0); transform-origin: left center;
  animation: slab-in 300ms var(--entrance) calc(2000ms + var(--i) * 60ms) both, slab-out 200ms var(--exit) calc(4400ms + var(--i) * 20ms) forwards; }
.slab.under { background: var(--muted); }
.pass { position: absolute; left: 80%; top: -3px; bottom: -3px; width: 2px; background: var(--muted); }
.fig { text-align: right; opacity: 0; animation: fig-in 150ms linear calc(2250ms + var(--i) * 60ms) both, fig-out 150ms linear 4400ms forwards; }
.fig.bad { color: #ff6b5e; }
@keyframes slab-in { from { transform: scaleX(0); } to { transform: scaleX(var(--v)); } }
@keyframes slab-out { from { transform: scaleX(var(--v)); } to { transform: scaleX(0); } }
@keyframes fig-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fig-out { from { opacity: 1; } to { opacity: 0; } }
.avg { position: absolute; opacity: 0; animation: avg-in 300ms var(--entrance) 2800ms both, fig-out 200ms linear 4500ms forwards; }
@keyframes avg-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
.cap1 { animation: cap1 5000ms linear infinite; }
.cap2 { opacity: 0; animation: cap2 5000ms linear infinite; }
@keyframes cap1 { 0%, 26% { opacity: 1; } 29%, 89% { opacity: 0; } 95%, 100% { opacity: 1; } }
@keyframes cap2 { 0%, 29% { opacity: 0; } 35%, 86% { opacity: 1; } 89%, 100% { opacity: 0; } }

/* 1920 by 1080, safe 5%: the render left, the card right, the caption bottom left. */
.frame { left: 96px; top: 200px; width: 1000px; height: 523px; }
.label { left: 96px; top: 140px; font-size: 24px; }
.card { left: 1160px; top: 200px; width: 664px; gap: 16px; --namew: 160px; --figw: 48px; --gap: 16px; --slab: 12px; font-size: 24px; }
.avg { left: 1160px; top: 560px; font-size: 32px; }
[data-caption] { left: 96px; bottom: 54px; font-size: 56px; max-width: 1728px; }
/* 1080 by 1920, safe 15% top and bottom: the portrait render, the card under it. */
@media (max-aspect-ratio: 3/4) {
  .frame .wide { display: none; } .frame .tall { display: block; }
  .frame { left: 100px; top: 352px; width: 760px; height: 950px; }
  .label { left: 100px; top: 296px; font-size: 28px; }
  .card { left: 100px; top: 1340px; width: 880px; gap: 10px; --namew: 180px; --figw: 48px; --gap: 16px; --slab: 12px; font-size: 24px; }
  .avg { left: 100px; top: 1300px; font-size: 32px; display: none; }
  [data-caption] { left: 100px; bottom: 288px; font-size: 72px; max-width: 880px; top: auto; }
  .card { top: 1340px; }
  [data-caption] { bottom: 96px; }
}
/* 1080 by 1080, safe 6%: the render on top, the card under it. */
@media (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3) {
  .frame { left: 65px; top: 150px; width: 950px; height: 496px; }
  .label { left: 65px; top: 100px; font-size: 24px; }
  .card { left: 65px; top: 690px; width: 950px; gap: 8px; --namew: 160px; --figw: 40px; --gap: 12px; --slab: 10px; font-size: 20px; }
  .avg { display: none; }
  [data-caption] { left: 65px; bottom: 65px; font-size: 54px; max-width: 950px; }
}
@media (prefers-reduced-motion: reduce) {
  .frame .final, .label .after, .fig, .avg, .cap2 { animation: none; opacity: 1; }
  .label .before, .cap1 { animation: none; opacity: 0; }
  .slab { animation: none; transform: scaleX(var(--v)); }
}
</style></head>
<body><main data-clip data-duration="5000" data-loop="true">
  <div class="label"><span class="before muted">Rough ${pick.rough}</span><span class="after">Round ${score.round}</span></div>
  <div class="frame">
    <img class="rough wide" src="${img.roughW}" alt="rough ${pick.rough}"><img class="final wide" src="${img.finalW}" alt="round ${score.round}">
    <img class="rough tall" src="${img.roughT}" alt="rough ${pick.rough}"><img class="final tall" src="${img.finalT}" alt="round ${score.round}">
  </div>
  <div class="card">${rows}</div>
  <p class="avg">Average ${score.average}, at the bar</p>
  <p class="cap1" data-caption data-start="0" data-end="1300">A rough.</p>
  <p class="cap2" data-caption data-start="1750" data-end="4300">Signed off at ${score.average}.</p>
</main></body></html>`;
    },
  },

  // The cost line filling by tier as the desks of the launch card job report, then the share that went to judgment.
  'cost-meter': {
    seconds: 8, loop: true, about: 'The cost line fills by tier as each desk reports, judgment share against making share.',
    html() {
      const s = state(), st = stops();
      // The track is the card's whole cost. Director, senior, builder fill left to right in tier order, 900ms each from
      // 400, 1500 and 2600, labels landing as each finishes, the share at 3800, everything out at 7300, loop at 8000.
      const total = s.cost.total, scale = total;
      const BEGIN = { director: 400, senior: 1500, builder: 2600 }, DUR = 900;
      const lastAt = Object.fromEntries(Object.entries(BEGIN).map(([t, b]) => [t, b + DUR]));
      const judge = Math.round(s.cost.director / total * 100), make = 100 - judge;
      const pc = ms => `${(ms / 8000 * 100).toFixed(3)}%`;
      const frames = ['director', 'senior', 'builder'].map(t => { const w = `${(s.cost[t] / scale * 100).toFixed(3)}%`; return `@keyframes seg-${t} { 0%, ${pc(BEGIN[t])} { width: 0%; animation-timing-function: var(--entrance) } ${pc(BEGIN[t] + DUR)}, ${pc(7300)} { width: ${w}; animation-timing-function: var(--exit) } ${pc(7500)}, 100% { width: 0% } }`; }).join(' ');
      const start = { director: 0, senior: s.cost.director, builder: s.cost.director + s.cost.senior };
      const labels = ['director', 'senior', 'builder'].map(t => `<div class="tier land" style="--t:${lastAt[t]}ms;--x:${(start[t] / scale * 100).toFixed(2)}%"><span class="muted">${t}</span> ${money(s.cost[t])}</div>`).join('');
      return doc({
        title: 'Desk Studio, the cost line', duration: 8000, loop: true,
        css: `${frames}
.title { position: absolute; color: var(--muted); }
.total { position: absolute; letter-spacing: -0.03em; line-height: 1; }
.line { position: absolute; display: flex; background: var(--line); }
.seg { display: block; height: 100%; background: var(--foreground); flex: none; }
.seg.director { animation: seg-director 8000ms linear infinite; }
.seg.senior { opacity: 0.6; animation: seg-senior 8000ms linear infinite; }
.seg.builder { opacity: 0.3; animation: seg-builder 8000ms linear infinite; }
.tiers { position: absolute; }
.tier { position: absolute; left: var(--x); top: 0; white-space: nowrap; }
.tier, .share { animation-name: land, fade-out; animation-duration: 300ms, 200ms; animation-timing-function: var(--entrance), var(--exit); animation-delay: var(--t), 7300ms; animation-fill-mode: both, forwards; }
.share { position: absolute; }
.title { font-size: 32px; left: 96px; top: 160px; }
.total { font-size: 120px; left: 96px; top: 220px; }
.line { left: 96px; top: 520px; width: 1728px; height: 24px; }
.tiers { left: 96px; top: 568px; width: 1728px; height: 40px; font-size: 28px; }
.share { font-size: 32px; left: 96px; top: 640px; }
[data-caption] { left: 96px; bottom: 54px; font-size: 56px; max-width: 1728px; }
@media (max-aspect-ratio: 3/4) {
  .title { font-size: 32px; left: 100px; top: 320px; }
  .total { font-size: 112px; left: 100px; top: 380px; }
  .line { left: 100px; top: 760px; width: 880px; height: 24px; }
  .tiers { left: 100px; top: 808px; width: 880px; font-size: 24px; }
  .tier:nth-child(2) { top: 36px; } .tier:nth-child(3) { top: 72px; }
  .share { font-size: 32px; left: 100px; top: 960px; }
  [data-caption] { left: 100px; bottom: 288px; font-size: 72px; max-width: 880px; }
}
@media (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3) {
  .title { font-size: 28px; left: 65px; top: 100px; }
  .total { font-size: 104px; left: 65px; top: 150px; }
  .line { left: 65px; top: 440px; width: 950px; height: 20px; }
  .tiers { left: 65px; top: 484px; width: 950px; font-size: 24px; }
  .share { font-size: 28px; left: 65px; top: 560px; }
  [data-caption] { left: 65px; bottom: 65px; font-size: 54px; max-width: 950px; }
}
@media (prefers-reduced-motion: reduce) { .seg { animation: none; } .seg.director { width: ${(s.cost.director / scale * 100).toFixed(2)}%; } .seg.senior { width: ${(s.cost.senior / scale * 100).toFixed(2)}%; } .seg.builder { width: ${(s.cost.builder / scale * 100).toFixed(2)}%; } .total, .tier, .share { animation: none; opacity: 1; } }`,
        body: `<p class="title">One launch card, ${st.length} desk runs, at list price.</p>
<p class="total">${money(total)}</p>
<div class="line" aria-hidden="true"><span class="seg director"></span><span class="seg senior"></span><span class="seg builder"></span></div>
<div class="tiers">${labels}</div>
<p class="share" style="--t:3800ms">${judge}% went to judgment, ${make}% to making.</p>
<p data-caption data-start="0" data-end="8000">${judge}% judgment, ${make}% making.</p>`,
      });
    },
  },

  // A builder desk's three polish rounds, each with its model, tokens and cost, then the whole card's cost line by tier.
  'builder-prices': {
    seconds: 7, loop: false, about: 'A builder desk shows its model and cost, the polish rounds flip, then the cost line by tier.',
    html() {
      const s = state(), st = stops();
      const polish = st.filter(x => x.tier === 'builder');
      const rounds = polish.map((x, i) => ({ n: i + 1, ...x }));
      const at = n => 800 + (n - 1) * 1500;
      const imgs = rounds.map(r => ({ wide: dataUri(render(`round-${r.n}`, 'linkedin')), tall: dataUri(render(`round-${r.n}`, 'ig-post')) }));
      const total = s.cost.total, scale = Math.max(1, Math.ceil(total));
      const frames = ['director', 'senior', 'builder'].map(t => segFrames(`seg-${t}`, [{ t: 5000, v: s.cost[t] }], 7000, scale)).join('\n');
      const start = { director: 0, senior: s.cost.director, builder: s.cost.director + s.cost.senior };
      const labels = ['director', 'senior', 'builder'].map(t => `<div class="tier land" style="--t:5300ms;--x:${(start[t] / scale * 100).toFixed(2)}%"><span class="muted">${t}</span> ${money(s.cost[t])}</div>`).join('');
      const builderTotal = polish.reduce((a, x) => a + x.cost, 0);
      const caps = twoCaps('Three polish rounds on the builder seat.', `${money(builderTotal)} of ${money(total)}.`, 4800, 7000);
      return doc({
        title: 'Desk Studio, builder prices', duration: 7000,
        css: `${frames}${caps.css}
.card { position: absolute; display: grid; gap: 8px; align-content: start; }
.unit { position: relative; width: 48px; height: 36px; }
.unit .slab { position: absolute; left: 0; bottom: 0; width: 48px; height: 12px; background: var(--foreground); }
.unit .lamp { position: absolute; left: 26px; top: 0; width: 16px; height: 16px; border-radius: 50%; background: var(--muted); animation: light 300ms var(--entrance) 300ms both; }
@keyframes light { from { background-color: var(--muted); } to { background-color: var(--accent); } }
.name { font-size: 40px; letter-spacing: -0.02em; } .model { color: var(--muted); font-size: 28px; }
.rounds { position: absolute; display: grid; }
.round { white-space: nowrap; } .round .muted { margin-left: 0.5em; }
.frame { position: absolute; overflow: hidden; background: var(--surface); }
.frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; animation: fade-in 300ms var(--entrance) var(--t) both; }
.frame img.first { animation: none; opacity: 1; }
.frame .tall { display: none; }
.line { position: absolute; display: flex; background: var(--line); }
.seg { display: block; height: 100%; background: var(--foreground); flex: none; }
.seg.director { animation: seg-director 7000ms linear both; } .seg.senior { opacity: 0.6; animation: seg-senior 7000ms linear both; } .seg.builder { opacity: 0.3; animation: seg-builder 7000ms linear both; }
.tiers { position: absolute; } .tier { position: absolute; left: var(--x); top: 0; white-space: nowrap; }
.card { left: 96px; top: 160px; width: 560px; }
.rounds { left: 96px; top: 340px; width: 560px; gap: 20px; font-size: 28px; }
.frame { left: 720px; top: 160px; width: 1104px; height: 577px; }
.line { left: 96px; top: 800px; width: 1728px; height: 20px; }
.tiers { left: 96px; top: 836px; width: 1728px; font-size: 24px; }
[data-caption] { left: 96px; bottom: 54px; font-size: 56px; max-width: 1728px; }
@media (max-aspect-ratio: 3/4) {
  .frame .wide { display: none; } .frame .tall { display: block; }
  .card { left: 100px; top: 320px; width: 880px; }
  .rounds { left: 100px; top: 460px; width: 880px; gap: 12px; font-size: 26px; }
  .frame { left: 260px; top: 640px; width: 560px; height: 700px; }
  .line { left: 100px; top: 1380px; width: 880px; height: 20px; }
  .tiers { left: 100px; top: 1412px; width: 880px; font-size: 22px; }
  .tier:nth-child(2) { top: 30px; } .tier:nth-child(3) { top: 60px; }
  [data-caption] { left: 100px; bottom: 288px; font-size: 64px; max-width: 880px; }
}
@media (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3) {
  .card { left: 65px; top: 80px; width: 480px; } .name { font-size: 32px; } .model { font-size: 22px; }
  .rounds { left: 560px; top: 90px; width: 455px; gap: 12px; font-size: 22px; }
  .frame { left: 160px; top: 350px; width: 760px; height: 397px; }
  .line { left: 65px; top: 780px; width: 950px; height: 16px; }
  .tiers { left: 65px; top: 808px; width: 950px; font-size: 22px; }
  [data-caption] { left: 65px; bottom: 65px; font-size: 48px; max-width: 950px; }
}
@media (prefers-reduced-motion: reduce) { .frame img { animation: none; opacity: 1; } .frame img:not(:last-of-type) { display: none; } .seg { animation: none; } .seg.director { width: ${(s.cost.director / scale * 100).toFixed(2)}%; } .seg.senior { width: ${(s.cost.senior / scale * 100).toFixed(2)}%; } .seg.builder { width: ${(s.cost.builder / scale * 100).toFixed(2)}%; } .unit .lamp { background: var(--accent); animation: none; } }`,
        body: `<div class="card"><div class="unit"><div class="slab"></div><div class="lamp"></div></div><p class="name">${NAME_OF[polish[0].desk]}</p><p class="model">${polish[0].model}</p></div>
<div class="rounds">${rounds.map(r => `<p class="round${r.n > 1 ? ' land' : ''}" style="--t:${at(r.n)}ms">polish round ${r.n}<span class="muted">${tokens(r.tokens)} tokens, ${money3(r.cost)}</span></p>`).join('')}</div>
<div class="frame">${rounds.map((r, i) => `<img class="wide${r.n === 1 ? ' first' : ''}" src="${imgs[i].wide}" alt="round ${r.n}" style="--t:${at(r.n)}ms"><img class="tall${r.n === 1 ? ' first' : ''}" src="${imgs[i].tall}" alt="round ${r.n}" style="--t:${at(r.n)}ms">`).join('')}</div>
<div class="line" aria-hidden="true"><span class="seg director"></span><span class="seg senior"></span><span class="seg builder"></span></div>
<div class="tiers">${labels}</div>
${caps.html}`,
      });
    },
  },

  // The brand sting, then the receipt: the desks that made the kit, the rounds, the score and the cost.
  'made-by-the-studio': {
    seconds: 10, loop: false, about: 'The brand sting the studio made for itself, then the desks that made it, the rounds, the score and the cost.',
    html() {
      const b = JSON.parse(readFileSync(join(here, 'fixtures', 'brand', 'state.json'), 'utf8'));
      const counts = new Map();
      for (const d of b.desks) counts.set(d.desk, (counts.get(d.desk) || 0) + 1);
      const order = ['brand-strategist', 'creative-director', 'art-director', 'typographer', 'design-system-lead', 'icon-designer', 'motion-designer', 'ui-designer'].filter(k => counts.has(k));
      for (const k of counts.keys()) if (!order.includes(k)) order.push(k);
      const score = b.scores.find(x => x.round === b.round) || b.scores[b.scores.length - 1];
      const list = order.map((k, i) => `<p class="row land" style="--t:${4300 + (i < 4 ? i * 80 : 600 + (i - 4) * 80)}ms">${NAME_OF[k] || k}<span class="muted">${counts.get(k)} run${counts.get(k) === 1 ? '' : 's'}</span></p>`).join('');
      return doc({
        title: 'Desk Studio, made by the studio', duration: 10000,
        css: `${FLOOR_CSS}
.line { position: absolute; margin: 0; line-height: 1; letter-spacing: -0.03em; white-space: nowrap; animation: land 300ms var(--entrance) 1333ms both, fade-out 200ms var(--exit) 4000ms forwards; }
.head { position: absolute; letter-spacing: -0.03em; line-height: 1; }
.list { position: absolute; display: grid; }
.row { white-space: nowrap; } .row .muted { margin-left: 0.5em; }
.sum { position: absolute; display: grid; }
.floor { left: 1024px; top: 296px; width: 704px; height: 488px; gap: 32px; }
.line { left: 192px; top: 296px; font-size: 95.5px; }
.lockup { left: 192px; top: 747.4px; width: 335.2px; height: 37.2px; }
.head { left: 192px; top: 296px; font-size: 64px; }
.list { left: 192px; top: 392px; gap: 8px; font-size: 28px; line-height: 32px; }
.sum { left: 640px; top: 392px; gap: 16px; font-size: 32px; }
@media (max-aspect-ratio: 3/4) {
  .floor { left: 100px; top: 296px; width: 880px; height: 748px; gap: 32px; }
  .line { left: 100px; top: 1100px; font-size: 72px; white-space: normal; width: 880px; }
  .lockup { left: 100px; top: 1580px; width: 335.2px; height: 37.2px; }
  .head { left: 100px; top: 1100px; font-size: 56px; }
  .list { left: 100px; top: 1180px; gap: 2px; font-size: 26px; line-height: 32px; }
  .sum { left: 560px; top: 1180px; gap: 8px; font-size: 26px; }
}
@media (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3) {
  .floor { left: 560px; top: 65px; width: 455px; height: 386px; gap: 16px; }
  .line { left: 65px; top: 65px; font-size: 56px; white-space: normal; width: 460px; }
  .lockup { left: 65px; top: 975px; width: 268px; height: 29.8px; }
  .head { left: 65px; top: 65px; font-size: 48px; }
  .list { left: 65px; top: 140px; gap: 2px; font-size: 22px; line-height: 28px; }
  .sum { left: 65px; top: 500px; gap: 8px; font-size: 26px; }
  .floor { top: 500px; left: 560px; }
}
@media (prefers-reduced-motion: reduce) { .line { animation: none; opacity: 0; } }`,
        body: `${floorHtml(200, { ran: new Set(order.map(k => registry.desks.findIndex(d => d.slug === k)).filter(i => i >= 0)) })}
<p class="line" data-caption data-start="1333" data-end="4000">Your own<br>design studio.</p>
<p class="head land" style="--t:4300ms" data-caption data-start="4300" data-end="10000">Made by the studio.</p>
<div class="list">${list}</div>
<div class="sum"><p class="land" style="--t:5600ms">${b.round} of ${b.maxRounds} rounds.</p><p class="land" style="--t:5750ms">Signed off at ${score.average}.</p><p class="land" style="--t:5900ms">${money(b.cost.total)} at list price.</p></div>
${LOCKUP}`,
      });
    },
  },

  // A real proof run on a flawed copy of the launch card (clips/fixtures/proof): the failure it reports, then the fixed file passing.
  proof: {
    seconds: 7, loop: false, about: 'Proof finds a contrast failure on the pixels, the fix passes.',
    html() {
      const work = join(here, 'pieces', 'work', 'proof');
      rmSync(work, { recursive: true, force: true });
      const run = (name) => {
        const outDir = join(work, name);
        const r = spawnSync(process.execPath, [join(root, 'proof', 'cli.mjs'), 'check', join(here, 'fixtures', 'proof', `${name}.html`), '--brand', join(root, 'brand', 'DESIGN.md'), '--sizes', 'linkedin,ig-post', '--out', outDir], { encoding: 'utf8' });
        return { result: JSON.parse(r.stdout), dir: outDir };
      };
      const bad = run('flawed'), good = run('fixed');
      const fail = bad.result.renders.find(r => r.size === 'linkedin').failures.find(f => f.check === 'contrast');
      const m = /^([\d.]+):1 .*needs ([\d.]+):1/.exec(fail.reason);
      const box = size => { const d = JSON.parse(readFileSync(join(bad.dir, `${size}.dom.json`), 'utf8')); const bs = d.boxes.filter(x => /^(A full design|the coding agent)/.test(x.text)); const x0 = Math.min(...bs.map(x => x.x)), y0 = Math.min(...bs.map(x => x.y)), x1 = Math.max(...bs.map(x => x.x + x.width)), y1 = Math.max(...bs.map(x => x.y + x.height)); return { l: x0 / d.width * 100, t: y0 / d.height * 100, w: (x1 - x0) / d.width * 100, h: (y1 - y0) / d.height * 100 }; };
      const bw = box('linkedin'), bt = box('ig-post');
      const img = (d, size) => dataUri(join(d, `${size}.png`));
      const caps = twoCaps('Proof finds it.', 'Proof passes it.', 4000, 7000);
      const boxStyle = b => `left:${b.l.toFixed(2)}%;top:${b.t.toFixed(2)}%;width:${b.w.toFixed(2)}%;height:${b.h.toFixed(2)}%`;
      return doc({
        title: 'Desk Studio, proof', duration: 7000,
        css: `${caps.css}
.frame { position: absolute; overflow: hidden; background: var(--surface); }
.frame img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; object-fit: cover; }
.frame .good { opacity: 0; animation: good-in 150ms linear 4000ms both; }
.frame .bad { animation: bad-out 150ms linear 4000ms forwards; }
@keyframes good-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes bad-out { from { opacity: 1; } to { opacity: 0; } }
.frame .tall { display: none; }
.box { position: absolute; border: 3px solid #ff6b5e; margin: -3px; animation: bad-out 150ms linear 4000ms forwards; }
.frame .tall ~ .box.t { }
.box.t { display: none; }
.say { position: absolute; display: grid; }
.say .k { color: var(--muted); display: block; }
.say .fail, .say .pass { grid-column: 1; grid-row: 2; }
.say .fail { animation: bad-out 150ms linear 3850ms forwards; }
.say .pass { opacity: 0; animation: good-in 300ms var(--entrance) 4300ms both; }
.frame { left: 96px; top: 160px; width: 1000px; height: 523px; }
.say { left: 1160px; top: 200px; width: 664px; font-size: 40px; line-height: 1.25; letter-spacing: -0.02em; }
.say .k { font-size: 24px; letter-spacing: 0; margin-bottom: 12px; }
[data-caption] { left: 96px; bottom: 54px; font-size: 56px; max-width: 1728px; }
@media (max-aspect-ratio: 3/4) {
  .frame .wide, .box.w { display: none; } .frame .tall { display: block; } .box.t { display: block; }
  .frame { left: 160px; top: 330px; width: 760px; height: 950px; }
  .say { left: 100px; top: 1330px; width: 880px; font-size: 40px; }
  [data-caption] { left: 100px; bottom: 288px; font-size: 64px; max-width: 880px; }
}
@media (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3) {
  .frame { left: 65px; top: 120px; width: 700px; height: 366px; }
  .say { left: 65px; top: 560px; width: 950px; font-size: 36px; }
  [data-caption] { left: 65px; bottom: 65px; font-size: 54px; max-width: 950px; }
}
@media (prefers-reduced-motion: reduce) { .frame .good, .say .pass { animation: none; opacity: 1; } .frame .bad, .box, .say .fail { display: none; } }`,
        body: `<div class="frame">
  <img class="bad wide" src="${img(bad.dir, 'linkedin')}" alt="the card with its subline too dark"><img class="bad tall" src="${img(bad.dir, 'ig-post')}" alt="the card with its subline too dark">
  <img class="good wide" src="${img(good.dir, 'linkedin')}" alt="the card fixed"><img class="good tall" src="${img(good.dir, 'ig-post')}" alt="the card fixed">
  <div class="box w" style="${boxStyle(bw)}"></div><div class="box t" style="${boxStyle(bt)}"></div>
</div>
<div class="say"><span class="k">proof, contrast</span><span class="fail"><span class="land" style="--t:600ms">${m[1]}:1 against the pixels behind it. Needs ${m[2]}:1.</span></span><span class="pass">Passed.</span></div>
${caps.html}`,
      });
    },
  },

  // The ten slides of the signed-off carousel landing one by one, two groups of five.
  carousel: {
    seconds: 8, loop: false, about: 'Ten slides land one by one, same type, same palette.',
    html() {
      const dir = join(root, 'evals', 'golden', 'carousel', 'quill-drafts-beat-versions');
      const g = JSON.parse(readFileSync(join(dir, 'golden.json'), 'utf8'));
      const slides = Array.from({ length: 10 }, (_, i) => join(dir, 'renders', `slide-${String(i + 1).padStart(2, '0')}`, 'ig-post.png')).filter(existsSync);
      const at = i => 300 + (i - 5) * 80;
      const caps = twoCaps('Ten slides, one system.', `Signed off at ${g.average}.`, 4000, 8000);
      return doc({
        title: 'Desk Studio, a carousel', duration: 8000,
        css: `${caps.css}
.set { position: absolute; display: grid; }
.set img { display: block; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; background: var(--surface); }
.set { left: 96px; top: 60px; width: 1596px; grid-template-columns: repeat(5, 300px); gap: 24px; }
[data-caption] { left: 96px; bottom: 54px; font-size: 56px; max-width: 1728px; }
@media (max-aspect-ratio: 3/4) {
  .set { left: 156px; top: 288px; width: 768px; grid-template-columns: repeat(3, 240px); gap: 24px; }
  .set img:last-child { grid-column: 2; }
  [data-caption] { left: 100px; bottom: 288px; font-size: 56px; max-width: 880px; }
}
@media (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3) {
  .set { left: 65px; top: 150px; width: 950px; grid-template-columns: repeat(5, 170px); gap: 25px; }
  [data-caption] { left: 65px; bottom: 65px; font-size: 48px; max-width: 950px; }
}`,
        // The first row is on the first frame, the second row lands after it.
        body: `<div class="set">${slides.map((f, i) => `<img${i >= 5 ? ` class="land" style="--t:${at(i)}ms"` : ''} src="${dataUri(f)}" alt="slide ${i + 1}">`).join('')}</div>${caps.html}`,
      });
    },
  },

  // The ten slides of the signed-off pitch deck, one cut at a time on one system.
  deck: {
    seconds: 7, loop: false, about: 'Ten slides of the pitch deck, cut one after another.',
    html() {
      const dir = join(root, 'evals', 'golden', 'deck', 'northlight-pitch');
      const g = JSON.parse(readFileSync(join(dir, 'golden.json'), 'utf8'));
      const avg = Math.round(Object.values(g.axes).reduce((a, b) => a + b, 0) / Object.values(g.axes).length * 10) / 10;
      const files = Array.from({ length: 10 }, (_, i) => join(dir, 'renders', `slide-${String(i + 1).padStart(2, '0')}.png`)).filter(existsSync);
      const each = 450, start = 100;
      const caps = twoCaps('Ten slides, one system.', `Signed off at ${avg.toFixed(1)}.`, 4800, 7000);
      return doc({
        title: 'Desk Studio, a deck', duration: 7000,
        css: `${caps.css}
.stack { position: absolute; background: var(--surface); border: 1px solid var(--line); }
.stack img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; opacity: 0; animation: show ${each}ms steps(1, end) var(--t) forwards; }
.stack img:first-child { opacity: 1; }
@keyframes show { from { opacity: 1; } to { opacity: 1; } }
.stack { left: 210px; top: 50px; width: 1500px; height: 844px; }
[data-caption] { left: 96px; bottom: 54px; font-size: 56px; max-width: 1728px; }
@media (max-aspect-ratio: 3/4) {
  .stack { left: 100px; top: 560px; width: 880px; height: 495px; }
  [data-caption] { left: 100px; bottom: 288px; font-size: 64px; max-width: 880px; }
}
@media (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3) {
  .stack { left: 65px; top: 140px; width: 950px; height: 534px; }
  [data-caption] { left: 65px; bottom: 65px; font-size: 54px; max-width: 950px; }
}`,
        body: `<div class="stack">${files.map((f, i) => `<img${i ? ` style="--t:${start + i * each}ms"` : ''} src="${dataUri(f)}" alt="slide ${i + 1}">`).join('')}</div>${caps.html}`,
      });
    },
  },

  // The signed-off email in light and dark, from one file.
  email: {
    seconds: 6, loop: false, about: 'One email, light and dark, from one file.',
    html() {
      const dir = join(root, 'evals', 'golden', 'email', 'ferro-welcome');
      const g = JSON.parse(readFileSync(join(dir, 'golden.json'), 'utf8'));
      const light = dataUri(join(dir, 'renders', 'email-600-light.png')), dark = dataUri(join(dir, 'renders', 'email-600-dark.png'));
      const caps = twoCaps('One file, light and dark.', `Signed off at ${g.average}.`, 3000, 6000);
      return doc({
        title: 'Desk Studio, an email', duration: 6000,
        css: `${caps.css}
.pair { position: absolute; display: grid; grid-template-columns: 1fr 1fr; }
.pair img { display: block; width: 100%; aspect-ratio: 3 / 4; object-fit: cover; object-position: top; background: var(--surface); border: 1px solid var(--line); }
.pair { left: 396px; top: 54px; width: 1128px; gap: 48px; }
[data-caption] { left: 96px; bottom: 54px; font-size: 56px; max-width: 1728px; }
@media (max-aspect-ratio: 3/4) {
  .pair { left: 78px; top: 288px; width: 924px; gap: 24px; }
  [data-caption] { left: 100px; bottom: 288px; font-size: 64px; max-width: 880px; }
}
@media (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3) {
  .pair { left: 108px; top: 65px; width: 864px; gap: 24px; }
  [data-caption] { left: 65px; bottom: 65px; font-size: 48px; max-width: 950px; }
}`,
        // Light is on the first frame, dark lands beside it.
        body: `<div class="pair"><img src="${light}" alt="the email, light"><img class="land" style="--t:500ms" src="${dark}" alt="the email, dark"></div>${caps.html}`,
      });
    },
  },
};

function parse(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); out[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
    else out._.push(a);
  }
  return out;
}

export async function buildPiece(name, { sizes, outDir }) {
  const piece = PIECES[name];
  if (!piece) throw new Error(`No piece "${name}". Pieces: ${Object.keys(PIECES).join(', ')}`);
  const dir = join(here, 'pieces');
  mkdirSync(dir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  const file = join(dir, `${name}.html`);
  writeFileSync(file, piece.html());
  const results = [];
  for (const size of sizes) {
    const work = join(dir, 'work', `${name}-${size.name}`);
    rmSync(work, { recursive: true, force: true });
    const r = await recordMotion({ file, size, seconds: piece.seconds, outDir: work, name });
    const e = await exportFrames({ file, size, seconds: piece.seconds, fps: 30, outDir: work, name });
    const base = `${name}-${size.width}x${size.height}`;
    const out = { name, size: base, pass: r.pass, failures: r.failures || [], mp4: null, webm: null, poster: null };
    if (e.mp4 && existsSync(e.mp4)) { out.mp4 = join(outDir, `${base}.mp4`); copyFileSync(e.mp4, out.mp4); }
    if (e.webm && existsSync(e.webm)) { out.webm = join(outDir, `${base}.webm`); copyFileSync(e.webm, out.webm); }
    const first = e.framesDir && join(e.framesDir, 'f-00000.png');
    if (first && existsSync(first)) { out.poster = join(outDir, `${base}.png`); copyFileSync(first, out.poster); }
    results.push(out);
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parse(process.argv.slice(2));
  if (args.list) { for (const [k, p] of Object.entries(PIECES)) console.log(`${k.padEnd(18)} ${String(p.seconds).padStart(3)}s  ${p.loop ? 'loop  ' : '      '}${p.about}`); process.exit(0); }
  const names = args._[0] === 'all' || !args._[0] ? Object.keys(PIECES) : [args._[0]];
  const sizes = resolveSizes(args.sizes || 'slide,ig-story,ig-square');
  const outDir = resolve(args.out || join(here, 'takes'));
  const all = [];
  for (const n of names) all.push(...await buildPiece(n, { sizes, outDir }));
  console.log(JSON.stringify(all, null, 2));
  process.exit(all.every(r => r.pass) ? 0 : 1);
}
