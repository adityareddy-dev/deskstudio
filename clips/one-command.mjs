#!/usr/bin/env node
// The hero loop: one command typed in a terminal, then every piece the studio has signed off, then the line.
// Not a dashboard recording. Every frame is drawn from a fixed timeline, so every take comes out the same.
// The pieces are the gallery's own renders from evals/golden, picked the way site/build.mjs picks them.
//   node clips/one-command.mjs [--size 16:9|1:1|9:16|4:5] [--out clips/takes]
// Output: one-command-<WxH>.mp4 and the poster frame one-command-<WxH>.png.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../proof/browser.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter(Boolean));
const SIZES = { '16:9': [1920, 1080], '1:1': [1080, 1080], '9:16': [1080, 1920], '4:5': [1080, 1350] };
const [W, H] = SIZES[args.size || '16:9'] || SIZES['16:9'];
const out = resolve(args.out || join(here, 'takes'));
const FPS = 30, SECONDS = 11;
const COMMAND = '/desk:design a launch card for my app';
const LOOP = ['roughs', 'pick', 'polish', 'proof', 'sign-off'];

function pickRender(dir) {
  const r = join(dir, 'renders');
  if (!existsSync(r)) return null;
  const all = [];
  const walk = (d, depth) => { for (const f of readdirSync(d, { withFileTypes: true })) { if (f.isDirectory() && depth < 3) walk(join(d, f.name), depth + 1); else if (f.isFile() && /\.png$/.test(f.name) && !/background/.test(f.name)) all.push(join(d, f.name)); } };
  walk(r, 0);
  const main = all.filter(f => !/(^|[\\/])(empty|error|loading)[\\/]/.test(f));
  const pool = main.length ? main : all;
  const prefer = [/slide-01[\\/]ig-post\.png$/, /email-600-light\.png$/, /held-00000\.png$/, /f-00000\.png$/, /[\\/]hero[\\/]desktop\.png$/, /[\\/]desktop\.png$/, /[\\/]linkedin\.png$/, /[\\/]x\.png$/, /ig-post\.png$/, /ig-square\.png$/, /\.png$/];
  for (const p of prefer) { const hit = pool.sort().find(f => p.test(f)); if (hit) return hit; }
  return null;
}

const pieces = [];
for (const deliverable of readdirSync(join(root, 'evals', 'golden')).sort())
  for (const name of readdirSync(join(root, 'evals', 'golden', deliverable)).sort()) {
    const dir = join(root, 'evals', 'golden', deliverable, name);
    const image = existsSync(join(dir, 'golden.json')) && pickRender(dir);
    if (image) pieces.push(pathToFileURL(image).href);
  }
// Mix the kinds so no row is all social cards.
const mixed = [];
for (let i = 0; pieces.length; i = (i + 7) % pieces.length) mixed.push(pieces.splice(i, 1)[0]);

const square = W === H, vertical = H > W;
// The vertical take is the site's hero, cropped to the hero's height, so everything that matters sits in the middle.
const L = square ? { rows: 5, th: 168, gap: 16, termW: 900, cmdSize: 25, hook: 66, mark: 72 }
  : vertical ? { rows: 9, th: 190, gap: 16, termW: 960, cmdSize: 30, hook: 118, mark: 128 }
  : { rows: 4, th: 234, gap: 20, termW: 1120, cmdSize: 34, hook: 104, mark: 104 };

// The end card carries the logo from brand/logo. The iris of its lens starts cream and turns amber as the bot wakes.
const LOGO = readFileSync(join(root, 'brand', 'logo', 'logo.svg'), 'utf8').trim().replace(/^<svg[^>]*>/, '<svg id="logo" viewBox="0 0 512 512">').replace('fill="none" stroke="#ffaa1c"', 'id="logoS" fill="none" stroke="#f4f0e8"');
const font = f => pathToFileURL(join(root, 'fonts', f)).href;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 100 900; src: url("${font('inter/Inter-Variable.woff2')}") format("woff2"); }
@font-face { font-family: "Geist Mono"; font-weight: 100 900; src: url("${font('geist/GeistMono-Variable.woff2')}") format("woff2"); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #12110f; color: #f4f0e8; font-family: Inter, sans-serif; }
#stage { position: absolute; inset: 0; }
#wall { position: absolute; inset: 0; }
.tile { position: absolute; left: 0; top: 0; height: ${L.th}px; border: 1px solid #3b3830; border-radius: 6px; background: #1c1a17; overflow: hidden; will-change: transform, opacity; }
.tile img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
#shade { position: absolute; inset: 0; background: #12110f; opacity: 0; }
#term { position: absolute; left: 50%; top: 50%; width: ${L.termW}px; background: #1c1a17; border: 1px solid #3b3830; border-radius: 12px; box-shadow: 0 40px 120px rgba(0,0,0,.65); transform-origin: 50% 50%; }
#term .bar { height: ${square ? 40 : 48}px; border-bottom: 1px solid #3b3830; display: flex; align-items: center; gap: 10px; padding: 0 20px; }
#term .bar i { width: 12px; height: 12px; border-radius: 50%; background: #3b3830; }
#term .bar span { margin-left: 12px; font: 400 ${square ? 16 : 18}px "Geist Mono", monospace; color: #9a948a; }
#term .body { padding: ${square ? 28 : 36}px ${square ? 28 : 40}px; font: 400 ${L.cmdSize}px/1.5 "Geist Mono", monospace; min-height: ${square ? 150 : 190}px; }
#term .prompt { color: #ffaa1c; margin-right: .6em; }
#cursor { display: inline-block; width: .6em; height: 1.15em; background: #f4f0e8; vertical-align: -0.2em; margin-left: 2px; }
#status { margin-top: ${square ? 12 : 16}px; color: #9a948a; font-size: ${Math.round(L.cmdSize * 0.72)}px; white-space: nowrap; }
#status b { font-weight: 400; transition: none; }
#status b.on { color: #f4f0e8; }
#status .dot { display: inline-block; width: .55em; height: .55em; border-radius: 50%; background: #ffaa1c; margin-right: .7em; vertical-align: .05em; }
#hook { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; }
#hook svg { width: ${L.mark}px; height: ${L.mark}px; margin: 0 auto ${square ? 36 : 48}px; display: block; overflow: visible; }
#hook h1 { font-weight: 600; font-size: ${L.hook}px; line-height: 1.06; letter-spacing: -0.025em; }
#hook .url { margin-top: ${square ? 36 : 48}px; font: 400 ${square ? 26 : 32}px "Geist Mono", monospace; color: #9a948a; }
#fade { position: absolute; inset: 0; background: #12110f; opacity: 0; }
</style></head><body><div id="stage">
<div id="wall"></div>
<div id="shade"></div>
<div id="term"><div class="bar"><i></i><i></i><i></i><span>~/my-app</span></div>
  <div class="body"><div><span class="prompt">&gt;</span><span id="typed"></span><span id="cursor"></span></div>
  <div id="status"><span class="dot"></span>${LOOP.map(w => `<b>${w}</b>`).join('&nbsp;&nbsp;&nbsp;')}</div></div></div>
<div id="hook">${LOGO}
  <h1><span id="l1">Your own${vertical ? '<br>' : ' '}design studio.</span><br><span id="l2">At your desk.</span></h1><div class="url" id="url">deskstudio.ai</div></div>
<div id="fade"></div>
</div><script>
const W = ${W}, H = ${H}, L = ${JSON.stringify(L)}, PIECES = ${JSON.stringify(mixed)}, VERTICAL = ${vertical};
const COMMAND = ${JSON.stringify(COMMAND)}, END = ${SECONDS};
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (t, a, b) => clamp((t - a) / (b - a));
const outCubic = x => 1 - Math.pow(1 - x, 3);
const inOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const outBack = x => { const c = 1.3; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const $ = id => document.getElementById(id);
// Keystrokes: an even hand with a little unevenness that is the same every take.
const keys = []; { let k = 0.55; for (let i = 0; i < COMMAND.length; i++) { keys.push(k); k += 0.038 + ((i * 37) % 11) / 400 + (COMMAND[i] === ' ' ? 0.03 : 0); } }
const ENTER = keys[keys.length - 1] + 0.3, BURST = ENTER + 0.75, HOOK = 7.5;
const DRIFT = 30, home = [], delay = [];
// Each piece keeps its own shape at the row height (very tall pages show their top). Rows are balanced by width, then
// topped up with repeats so a drifting row never shows its end.
window.init = async () => {
  const imgs = await Promise.all(PIECES.map(src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; })));
  const items = imgs.filter(Boolean).map((i, n) => ({ n, src: i.src, w: Math.round(L.th * Math.min(2.2, Math.max(0.75, i.naturalWidth / i.naturalHeight))) }));
  const rows = Array.from({ length: L.rows }, () => ({ items: [], w: -L.gap }));
  for (const it of [...items].sort((a, b) => b.w - a.w)) { const r = rows.reduce((a, b) => (b.w < a.w ? b : a)); r.items.push(it); r.w += it.w + L.gap; }
  const need = W + 2 * DRIFT * END + 40, wallH = L.rows * L.th + (L.rows - 1) * L.gap;
  rows.forEach((row, r) => {
    row.items.sort((a, b) => a.n - b.n);
    const seq = [...row.items];
    // A vertical row holds about two pieces of its own, so it tops up from the whole set instead of repeating itself.
    const pool = VERTICAL ? items.filter(it => !row.items.includes(it)) : row.items;
    for (let k = 0; row.w < need; k++) { const it = pool[(VERTICAL ? r * 3 + k : k) % pool.length]; seq.push(it); row.w += it.w + L.gap; }
    let x = (W - row.w) / 2;
    const y = (H - wallH) / 2 + r * (L.th + L.gap);
    for (const it of seq) {
      const el = document.createElement('div');
      el.className = 'tile'; el.style.width = it.w + 'px'; el.innerHTML = '<img src="' + it.src + '" alt="">';
      $('wall').appendChild(el);
      home.push({ x, y, w: it.w, dir: r % 2 ? 1 : -1, el });
      x += it.w + L.gap;
    }
  });
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  home.map((h, i) => [Math.hypot(h.x + h.w / 2 - W / 2, (h.y + L.th / 2 - H / 2) * 1.6), i]).sort((a, b) => a[0] - b[0]).forEach(([, i], n) => delay[i] = Math.min(n, 22) * 0.04);
};
window.seek = t => {
  // Terminal: fades up, types, enters, the loop runs once, then it steps back into the middle of the wall.
  const typed = keys.filter(k => k <= t).length;
  $('typed').textContent = COMMAND.slice(0, typed);
  $('cursor').style.opacity = t < ENTER ? ((t < keys[0] || t > keys[keys.length - 1]) ? (Math.floor(t * 2.2) % 2 ? 0 : 1) : 1) : 0;
  const st = span(t, ENTER, ENTER + 0.2);
  $('status').style.opacity = st; $('status').style.transform = 'translateY(' + (1 - st) * 8 + 'px)';
  [...$('status').querySelectorAll('b')].forEach((b, i) => b.classList.toggle('on', t >= ENTER + 0.15 + i * 0.13));
  const back = inOut(span(t, BURST - 0.1, BURST + 0.7));
  const out = span(t, HOOK - 0.1, HOOK + 0.4);
  const tScale = 1 - back * 0.48 - out * 0.04;
  $('term').style.opacity = span(t, 0, 0.3) * (1 - out);
  $('term').style.transform = 'translate(-50%, -50%) scale(' + tScale + ')';
  // The wall: every piece flies out from the terminal to its place, nearest first, and the rows keep drifting.
  home.forEach((h, i) => {
    const p = span(t, BURST + delay[i], BURST + delay[i] + 0.85);
    const e = outBack(p), drift = h.dir * DRIFT * Math.max(0, t - BURST);
    const x = W / 2 - h.w / 2 + (h.x - (W / 2 - h.w / 2)) * e + drift;
    const y = H / 2 - L.th / 2 + (h.y - (H / 2 - L.th / 2)) * e;
    const el = h.el;
    el.style.opacity = p <= 0 ? 0 : Math.min(1, p * 3);
    el.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + (0.25 + 0.75 * outCubic(p)) + ')';
  });
  // The line: the wall goes quiet, the logo comes up, then the words, then its S lights.
  const sh = span(t, HOOK, HOOK + 0.6);
  $('shade').style.opacity = 0.9 * sh;
  $('wall').style.filter = sh > 0 ? 'blur(' + (sh * 5).toFixed(2) + 'px)' : 'none';
  const d = span(t, HOOK + 0.2, HOOK + 0.6);
  $('logo').style.opacity = Math.min(1, d * 3); $('logo').style.transform = 'scale(' + (0.6 + 0.4 * outBack(d)).toFixed(3) + ')';
  const lamp = span(t, HOOK + 1.75, HOOK + 1.95);
  $('logoS').setAttribute('stroke', lamp > 0.5 ? '#ffaa1c' : '#f4f0e8'); $('logoS').style.filter = lamp ? 'drop-shadow(0 0 ' + (14 * lamp).toFixed(1) + 'px rgba(255,170,28,.8))' : 'none';
  for (const [id, a] of [['l1', HOOK + 0.45], ['l2', HOOK + 1.05], ['url', HOOK + 1.7]]) {
    const p = outCubic(span(t, a, a + 0.5));
    $(id).style.opacity = p; $(id).style.display = 'inline-block'; $(id).style.transform = 'translateY(' + (1 - p) * 24 + 'px)';
  }
  $('url').style.display = 'block';
  // The last quarter second goes back to the empty dark, so the loop joins where it starts.
  $('fade').style.opacity = span(t, END - 0.3, END);
};
</script></body></html>`;

const work = mkdtempSync(join(tmpdir(), 'one-command-'));
mkdirSync(out, { recursive: true });
const page_ = join(work, 'index.html');
writeFileSync(page_, html);
const browser = await launch();
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(pathToFileURL(page_).href, { waitUntil: 'load' });
await page.evaluate(async () => { await document.fonts.ready; await window.init(); });
// --still 2,4.5,9 writes those moments as PNGs and stops, for checking a change without a full take.
if (args.still) {
  for (const t of String(args.still).split(',').map(Number)) {
    await page.evaluate(t => window.seek(t), t);
    await page.screenshot({ path: join(out, `one-command-${W}x${H}-at-${t}s.png`) });
  }
  await browser.close();
  rmSync(work, { recursive: true, force: true });
  process.exit(0);
}
const frames = join(work, 'frames');
mkdirSync(frames);
const total = FPS * SECONDS;
for (let i = 0; i < total; i++) {
  await page.evaluate(t => window.seek(t), i / FPS);
  await page.screenshot({ path: join(frames, `f-${String(i).padStart(4, '0')}.png`) });
}
// The poster is the moment the wall is full, before the line comes up.
await page.evaluate(t => window.seek(t), 6.6);
const name = `one-command-${W}x${H}`;
await page.screenshot({ path: join(out, `${name}.png`) });
await browser.close();
const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, 'f-%04d.png'), '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(out, `${name}.mp4`)], { encoding: 'utf8' });
rmSync(work, { recursive: true, force: true });
if (ff.status !== 0) { console.error(ff.stderr); process.exit(1); }
console.log(`${join(out, name)}.mp4  ${SECONDS}s at ${FPS} fps, ${mixed.length} signed-off pieces`);
