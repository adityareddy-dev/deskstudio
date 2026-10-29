#!/usr/bin/env node
// Records the real dashboard at an exact frame rate. The page runs on a virtual clock: its timers, animation frames
// and CSS animations move one frame at a time, Chrome takes one screenshot per frame, and ffmpeg encodes them. So a
// clip is smooth at 60 fps however long a frame takes to draw. The job on screen is a real record replayed through the
// same files the Manager writes (replay.mjs), sped up; each change waits for the dashboard to read it before the
// clock moves on.
//   node clips/frames.mjs <clip>... [--out DIR] [--fps 60] [--scheme dark|light] [--from S] [--seconds S]
//   node clips/frames.mjs --list
// Output per clip: <name>.mp4 (H.264), <name>.webm (VP9), <name>.png (the poster, its first frame unless the clip
// names another) and, for clips with gif set, <name>.gif. Encoding runs on the CPU only, and Chrome runs without the GPU.
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createFloor } from '../dashboard/server.js';
import * as R from './replay.mjs';
import { CLIPS } from './studio.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = (() => { const o = { _: [] }; const a = process.argv.slice(2); for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) { const k = a[i].slice(2); o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } else o._.push(a[i]); } return o; })();
const FPS = Number(args.fps) || 60;
const OUT = resolve(args.out || join(here, 'takes', 'frames'));
const W = 1920, H = 1080;
const ms = t => Date.parse(t);
const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

// The page's clock. Installed before any page script runs.
const CLOCK = () => {
  const realPerf = performance.now.bind(performance);
  const P0 = realPerf();
  const vc = window.__vc = { v: 0, d: Date.now(), inflight: 0, msgs: 0, states: 0 };
  performance.now = () => P0 + vc.v;
  const RealDate = Date;
  class VDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(vc.d); } static now() { return vc.d; } }
  window.Date = VDate;
  const timers = new Map(); let next = 1;
  window.setTimeout = (fn, t = 0, ...a) => { const id = next++; timers.set(id, { fn, at: vc.v + Math.max(0, Number(t) || 0), a }); return id; };
  window.setInterval = (fn, t = 0, ...a) => { const id = next++; const every = Math.max(1, Number(t) || 0); timers.set(id, { fn, at: vc.v + every, every, a }); return id; };
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  const rafs = new Map(); let rid = 1;
  window.requestAnimationFrame = fn => { const id = rid++; rafs.set(id, fn); return id; };
  window.cancelAnimationFrame = id => rafs.delete(id);
  const realFetch = window.fetch.bind(window);
  window.fetch = (...a) => { vc.inflight++; return realFetch(...a).finally(() => { vc.inflight--; }); };
  const RealES = window.EventSource;
  window.EventSource = class extends RealES {
    constructor(...a) { super(...a); this.addEventListener('message', () => { vc.msgs++; }); this.addEventListener('state', () => { vc.states++; }); }
  };
  // One frame: run the timers that fall due in order, then the animation frames, then put every CSS animation at its
  // time on the virtual clock.
  window.__step = (dv, d) => {
    const target = vc.v + dv;
    for (let guard = 0; guard < 10000; guard++) {
      let best = null;
      for (const [id, t] of timers) if (t.at <= target && (!best || t.at < best[1].at)) best = [id, t];
      if (!best) break;
      const [id, t] = best;
      vc.v = Math.max(vc.v, t.at);
      if (t.every) t.at += t.every; else timers.delete(id);
      try { t.fn(...t.a); } catch (e) { console.error(e); }
    }
    vc.v = target;
    if (d !== undefined) vc.d = d;
    const fns = [...rafs.values()]; rafs.clear();
    for (const f of fns) { try { f(P0 + target); } catch (e) { console.error(e); } }
    for (const a of document.getAnimations()) {
      if (a.__v0 === undefined) { a.__v0 = target; a.pause(); }
      a.currentTime = Math.max(0, target - a.__v0);
    }
  };
  window.__settled = () => {
    if (vc.inflight > 0) return false;
    for (const i of document.images) {
      const r = i.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight && r.width > 0 && !i.complete) return false;
    }
    return true;
  };
};

// What the camera adds on top of the page: a caption, a pointer, and the scroll position.
const OVERLAY = `
#__cap { position: fixed; left: 50%; bottom: 34px; transform: translateX(-50%); z-index: 2147483647; pointer-events: none;
  max-width: 88vw; padding: 12px 24px; border-radius: 999px; background: rgba(21, 16, 11, 0.92); color: #fcf3e4;
  font: 650 22px/1.3 Inter, "Inter Fallback", sans-serif; letter-spacing: -0.01em; text-align: center;
  box-shadow: 0 10px 30px rgba(0,0,0,.35), inset 0 0 0 1.5px rgba(255,170,28,.55); opacity: 0; }
#__cap code { font: 500 19px "Geist Mono", monospace; color: #ffbf52; }
#__ptr { position: fixed; left: 0; top: 0; z-index: 2147483647; width: 30px; height: 30px; pointer-events: none; opacity: 0; filter: drop-shadow(0 3px 4px rgba(0,0,0,.4)); }
#__ptr .ring { position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #ffaa1c; opacity: 0; }
`;

async function record(clip, opts) {
  const rec = R.loadRecord(join(root, clip.record), { job: clip.job, skipControl: !!clip.skipControl });
  const keys = clip.time(rec);
  const seconds = Number(opts.seconds) || clip.seconds;
  const from = Number(opts.from) || 0;
  const frames = Math.round(seconds * FPS);
  const T = v => { for (let i = 1; i < keys.length; i++) if (v <= keys[i][0]) { const [v0, t0] = keys[i - 1], [v1, t1] = keys[i]; return t0 + (t1 - t0) * Math.min(1, Math.max(0, (v - v0) / (v1 - v0 || 1))); } return keys.at(-1)[1]; };
  const tmpRoot = mkdtempSync(join(tmpdir(), 'desk-frames-'));
  const projRoot = join(tmpRoot, clip.project || 'my-project');
  const desk = join(projRoot, '.desk');
  const shift = Date.now() - T(from) + 5000;
  const jobStart = ms(rec.final.startedAt);
  let prev = R.rebase(R.at(rec, T(from)), shift);
  let jobWritten = T(from) >= jobStart;
  R.writeDesk(desk, rec, jobWritten ? prev : { ...prev, renders: [], out: [] });
  if (!jobWritten) rmSync(join(desk, 'jobs', rec.id, 'state.json'), { force: true });
  if (clip.prepare) clip.prepare(desk, rec);
  const floor = createFloor({ root: projRoot, desk, token: 'clip', port: 0, tailMs: 40, watchMs: 80 });
  const port = await floor.listen();
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--disable-gpu-compositing', '--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none'] });
  const [vw, vh] = clip.viewport || [1440, 810];
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, colorScheme: opts.scheme || clip.scheme || 'dark', reducedMotion: 'no-preference' });
  await ctx.addInitScript(CLOCK);
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => console.error('page:', e.message));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`http://127.0.0.1:${port}/?token=clip`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: OVERLAY + (clip.css || '') });
  await page.evaluate(() => {
    const c = document.createElement('div'); c.id = '__cap'; document.body.append(c);
    const p = document.createElement('div'); p.id = '__ptr';
    p.innerHTML = '<span class="ring"></span><svg viewBox="0 0 24 24" width="30" height="30"><path d="M3 2l17 9.5-7.4 1.6L9 20z" fill="#fff" stroke="#15100b" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.append(p);
  });
  // Let the page load its state and the event backlog before the first frame.
  const settle = async (minMsgs = 0, minStates = 0) => {
    const t0 = Date.now();
    for (;;) {
      const ok = await page.evaluate(([m, s]) => window.__vc.msgs >= m && window.__vc.states >= s && window.__settled(), [minMsgs, minStates]);
      if (ok) return true;
      if (Date.now() - t0 > 6000) { console.error(`  settle timed out at msgs ${minMsgs} states ${minStates}`); return false; }
      await new Promise(r => setTimeout(r, 12));
    }
  };
  let expectMsgs = prev.events.length, expectStates = 0;
  await page.waitForFunction(n => window.__vc.msgs >= n, expectMsgs, { timeout: 10000 }).catch(() => {});
  for (let i = 0; i < 40; i++) { await page.evaluate(([d]) => window.__step(50, d), [T(from) + shift]); await settle(); }

  // the camera
  const cam = { y: 0, from: null, zoom: null };
  // A camera target is a y, a selector to put under the header, or { sel, off } to put an element off pixels down.
  const yOf = async target => typeof target === 'number' ? target : page.evaluate(([sel, off]) => { const el = document.querySelector(sel); return el ? Math.max(0, el.getBoundingClientRect().top + scrollY - off) : scrollY; }, typeof target === 'object' ? [target.sel, target.off] : [target, clip.camOffset ?? 66]);
  const zoomOf = async z => {
    if (!z) return { x: 0, y: 0, w: vw };
    if (typeof z.sel === 'string') return page.evaluate(([sel, w, pad]) => { const r = document.querySelector(sel).getBoundingClientRect(); const h = w * 9 / 16; return { x: Math.max(0, Math.min(innerWidth - w, r.left + r.width / 2 - w / 2)), y: Math.max(0, Math.min(innerHeight - h, r.top + r.height / 2 - h / 2 + pad)), w }; }, [z.sel, z.w, z.dy || 0]);
    return { x: z.x, y: z.y, w: z.w };
  };
  const moves = (clip.camera || []).map(([a, b, target]) => ({ a, b, target, y0: null, y1: null }));
  const zooms = (clip.zoom || []).map(([a, b, z]) => ({ a, b, z, r0: null, r1: null }));
  let zoomNow = { x: 0, y: 0, w: vw };
  const ptr = { x: vw * 0.7, y: vh * 0.75, shown: 0 };
  const acts = (clip.actions || []).map(([at, fn]) => ({ at, fn, done: false }));
  const captions = clip.captions || (clip.caption ? [[0.2, seconds - 0.2, clip.caption]] : []);
  // the tools a clip's actions get
  const tools = {
    page, rec,
    point: async (sel, dur = 0.6) => {
      const r = await page.evaluate(s => { const el = document.querySelector(s); if (!el) return null; el.scrollIntoView({ block: 'nearest' }); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
      if (r) pointer.push({ from: { x: ptr.x, y: ptr.y }, to: r, a: vNow, b: vNow + dur });
      return r;
    },
    click: async sel => { await page.locator(sel).first().click({ noWaitAfter: true }); ptr.pulse = vNow; },
    type: async (sel, text, perChar = 2) => { await page.locator(sel).first().focus(); typing.push({ text, perChar, i: 0, f: 0 }); },
    select: async (sel, value) => { await page.selectOption(sel, value); },
  };
  const pointer = [];
  const typing = [];
  let vNow = from;

  mkdirSync(OUT, { recursive: true });
  const base = join(OUT, clip.name);
  const master = `${base}.master.mp4`;
  const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-threads', '8', master], { stdio: ['pipe', 'inherit', 'inherit'] });
  const started = Date.now();
  for (let f = 0; f < frames; f++) {
    const v = from + f / FPS;
    vNow = v;
    const t = T(v);
    // the job as it stood at t
    if (!jobWritten && t >= jobStart) { jobWritten = true; R.writeDesk(desk, rec, R.rebase(R.at(rec, t), shift)); prev = R.rebase(R.at(rec, t), shift); expectMsgs = prev.events.length; expectStates++; await settle(expectMsgs, expectStates); }
    else if (jobWritten) {
      const snap = R.rebase(R.at(rec, t), shift);
      const ch = R.advance(desk, rec, prev, snap);
      prev = snap;
      if (ch.events) expectMsgs += ch.events;
      if (ch.state) expectStates++;
      if (ch.events || ch.state) await settle(expectMsgs, expectStates);
    } else {
      const snap = R.rebase(R.at(rec, t), shift);
      const extra = snap.events.slice(prev.events.length).filter(e => !e.id || e.id !== rec.id);
      if (extra.length) { R.appendEvents(desk, extra); expectMsgs += extra.length; await settle(expectMsgs, expectStates); }
      prev = { ...prev, events: snap.events };
    }
    for (const a of acts) if (!a.done && v >= a.at) { a.done = true; await a.fn(tools); await settle(expectMsgs, expectStates); }
    for (const ty of typing) { if (ty.i < ty.text.length && ty.f++ % ty.perChar === 0) { await page.keyboard.type(ty.text[ty.i++]); } }
    // camera
    // The latest move that has started steers the camera. Once it lands it keeps following its target, so a panel that
    // grows above the target does not push it out of frame.
    const m = moves.filter(x => v >= x.a).at(-1);
    if (m) {
      if (m.y0 === null) { m.y0 = cam.y; m.y1 = await yOf(m.target); }
      const k = ease(Math.min(1, (v - m.a) / Math.max(1e-6, m.b - m.a)));
      if (k >= 1 && typeof m.target !== 'number') m.y1 = await yOf(m.target);
      cam.y = m.y0 + (m.y1 - m.y0) * k;
    }
    for (const z of zooms) {
      if (v < z.a) continue;
      if (z.r0 === null) { z.r0 = { ...zoomNow }; z.r1 = await zoomOf(z.z); }
      const k = ease(Math.min(1, (v - z.a) / Math.max(1e-6, z.b - z.a)));
      zoomNow = { x: z.r0.x + (z.r1.x - z.r0.x) * k, y: z.r0.y + (z.r1.y - z.r0.y) * k, w: z.r0.w + (z.r1.w - z.r0.w) * k };
    }
    for (const p of pointer) if (v >= p.a) { const k = ease(Math.min(1, (v - p.a) / (p.b - p.a))); ptr.x = p.from.x + (p.to.x - p.from.x) * k; ptr.y = p.from.y + (p.to.y - p.from.y) * k; ptr.shown = 1; }
    const capNow = captions.find(([a, b]) => v >= a && v < b);
    const capOp = capNow ? Math.min(1, (v - capNow[0]) / 0.25, (capNow[1] - v) / 0.25) : 0;
    const pulse = ptr.pulse !== undefined && v - ptr.pulse < 0.45 ? (v - ptr.pulse) / 0.45 : -1;
    const sy = await page.evaluate(([dv, d, y, cap, op, px, py, pshow, pulse]) => {
      window.scrollTo(0, y);
      const c = document.getElementById('__cap');
      if (c.dataset.t !== cap) { c.dataset.t = cap; c.innerHTML = cap; }
      c.style.opacity = op; c.style.transform = `translateX(-50%) translateY(${(1 - op) * 10}px)`;
      const p = document.getElementById('__ptr');
      p.style.opacity = pshow; p.style.transform = `translate(${px}px, ${py}px)`;
      const ring = p.firstChild; ring.style.opacity = pulse >= 0 ? 1 - pulse : 0; ring.style.transform = `scale(${pulse >= 0 ? 0.6 + pulse * 1.2 : 1})`;
      window.__step(dv, d);
      return window.scrollY;
    }, [f === 0 ? 0 : 1000 / FPS, t + shift, cam.y, capNow ? capNow[2] : '', capOp, ptr.x, ptr.y, ptr.shown, pulse]);
    await settle(expectMsgs, expectStates);
    const scale = W / zoomNow.w;
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, clip: { x: zoomNow.x, y: zoomNow.y + sy, width: zoomNow.w, height: zoomNow.w * 9 / 16, scale } });
    const buf = Buffer.from(shot.data, 'base64');
    if (f === Math.round((clip.posterAt ?? 0) * FPS)) writeFileSync(`${base}.poster.jpg`, buf);
    if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r));
    if (f % 60 === 0) process.stdout.write(`\r  ${clip.name} ${f}/${frames} frames, ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  enc.stdin.end();
  await new Promise(r => enc.on('close', r));
  process.stdout.write('\n');
  await browser.close();
  await floor.close();
  rmSync(tmpRoot, { recursive: true, force: true });
  return finish(clip, base, master, seconds);
}

const ff = a => spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { encoding: 'utf8' });
const kb = f => existsSync(f) ? `${Math.round(statSync(f).size / 1024)} KB` : 'missing';
// The published files from the master: H.264 and VP9 at the clip's frame rate, the poster, and a light GIF.
function finish(clip, base, master, seconds) {
  const loopFade = clip.loop ? Math.min(0.6, seconds / 8) : 0;
  let src = master;
  if (loopFade) {
    // A seamless loop: the last moments cross-fade into the first, so the cut back to the start does not show.
    const looped = `${base}.loop.mp4`;
    const d = loopFade, len = seconds - d;
    ff(['-i', master, '-filter_complex', `[0]split[a][b];[a]trim=start=${d},setpts=PTS-STARTPTS[body];[b]trim=end=${d},setpts=PTS-STARTPTS[head];[body][head]xfade=transition=fade:duration=${d}:offset=${(len - d).toFixed(3)}[v]`, '-map', '[v]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-threads', '8', looped]);
    if (existsSync(looped)) src = looped;
  }
  const mp4 = `${base}.mp4`, webm = `${base}.webm`, png = `${base}.png`, gif = `${base}.gif`;
  ff(['-i', src, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(clip.crf ?? 23), '-tune', 'animation', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2), '-movflags', '+faststart', '-an', '-threads', '8', mp4]);
  ff(['-i', src, '-c:v', 'libvpx-vp9', '-crf', String(clip.vp9crf ?? 36), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', '-threads', '8', webm]);
  ff(['-i', `${base}.poster.jpg`, png]);
  rmSync(`${base}.poster.jpg`, { force: true });
  if (clip.gif) {
    // 25 fps is an exact 4/100 s frame delay, and ordered dithering keeps a GIF of moving bots light.
    const [gw, gfps, colors] = [clip.gif.width || 640, clip.gif.fps || 25, clip.gif.colors || 96];
    const pal = `${base}.palette.png`;
    ff(['-i', src, '-vf', `fps=${gfps},scale=${gw}:-1:flags=lanczos,palettegen=max_colors=${colors}:stats_mode=diff`, pal]);
    ff(['-i', src, '-i', pal, '-lavfi', `fps=${gfps},scale=${gw}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`, '-loop', '0', gif]);
    rmSync(pal, { force: true });
  }
  if (!args.keep) { rmSync(master, { force: true }); rmSync(`${base}.loop.mp4`, { force: true }); }
  const row = { name: clip.name, seconds, fps: FPS, mp4: kb(mp4), webm: kb(webm), poster: kb(png), gif: clip.gif ? kb(gif) : null };
  console.log(JSON.stringify(row));
  return row;
}

if (args.list) { for (const c of CLIPS) console.log(`${c.name.padEnd(20)} ${String(c.seconds).padStart(3)}s  ${c.about}`); process.exit(0); }
const names = args.all ? CLIPS.map(c => c.name) : args._;
if (!names.length) { console.error(`usage: node clips/frames.mjs <clip>... | --all [--out DIR] [--fps 60]\nclips: ${CLIPS.map(c => c.name).join(', ')}`); process.exit(2); }
if (spawnSync('ffmpeg', ['-version']).status !== 0) { console.error('ffmpeg is not on PATH.'); process.exit(1); }
for (const n of names) {
  const clip = CLIPS.find(c => c.name === n);
  if (!clip) { console.error(`No clip ${n}`); process.exit(2); }
  await record(clip, { scheme: args.scheme, seconds: args.seconds, from: args.from });
}
