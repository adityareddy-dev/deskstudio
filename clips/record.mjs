#!/usr/bin/env node
// Records a clip of the real dashboard. A clip is a timeline in clips.mjs that drives a job through the
// same files the Manager writes (events.jsonl, state.json), while Chrome records the page.
//   node clips/record.mjs <clip> [--size 16:9|9:16|1:1|WxH] [--scheme dark|light] [--fixture DIR] [--out DIR]
//   node clips/record.mjs --list
// Output per take: <name>-<WxH>.webm, .mp4 when ffmpeg is on PATH, and the poster frame as .png.
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFloor } from '../dashboard/server.js';
import { launch } from '../proof/browser.mjs';
import { CLIPS } from './clips.mjs';
import { captionPng, overlayArgs } from './caption.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] };
// Each desk's tier from the registry, for the job's cost by tier.
const TIER_OF = Object.fromEntries(JSON.parse(readFileSync(join(root, 'skills', 'desk', 'desks.json'), 'utf8')).desks.map(d => [d.slug, d.tier]));

function parse(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); out[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
    else out._.push(a);
  }
  return out;
}

function sizeOf(arg) {
  const s = String(arg || '16:9');
  if (SIZES[s]) return { label: s, width: SIZES[s][0], height: SIZES[s][1] };
  const m = /^(\d+)x(\d+)$/.exec(s);
  if (!m) throw new Error(`Unknown size "${s}". Use 16:9, 9:16, 1:1 or WIDTHxHEIGHT.`);
  return { label: s, width: Number(m[1]), height: Number(m[2]) };
}

const hasFfmpeg = () => { try { return spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0; } catch { return false; } };

// What a clip's timeline can do. Every write goes through the same files the Manager uses.
function toolkit({ page, desk, job, final, finalEvents = [] }) {
  const stateFile = join(desk, 'jobs', job, 'state.json');
  const readState = () => JSON.parse(readFileSync(stateFile, 'utf8'));
  const writeState = s => { s.updatedAt = new Date().toISOString(); writeFileSync(stateFile, JSON.stringify(s, null, 2)); };
  let agentN = 100;
  const t = {
    page, desk, job,
    // The fixture's job as it really ended, for clips that replay it. Null when the clip starts from the fixture as is.
    final,
    // The next real desk.stop for this desk from the fixture's own log, so a replayed stop carries its real model, tokens and cost.
    realStop: slug => {
      const i = finalEvents.findIndex(e => e && e.type === 'desk.stop' && e.desk === slug);
      if (i < 0) return {};
      const e = finalEvents[i];
      finalEvents[i] = null;
      return { model: e.model, tokens: e.tokens && e.tokens.total, costUsd: e.costUsd };
    },
    // Puts one held render (rough-2, round-1) back where the dashboard reads it, so it appears when the replay reaches it.
    reveal: name => {
      const from = join(desk, 'jobs', job, 'renders.held', name), to = join(desk, 'jobs', job, 'renders', name);
      if (existsSync(from) && !existsSync(to)) { mkdirSync(dirname(to), { recursive: true }); renameSync(from, to); }
    },
    // Lands held output files (a name, or a prefix ending in *) in the job's out folder, so a file appears when it was made.
    land: (pattern = '*') => {
      const from = join(desk, 'out.held', job), to = join(desk, 'out', job);
      if (!existsSync(from)) return;
      mkdirSync(to, { recursive: true });
      const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : null;
      for (const f of readdirSync(from)) if (prefix === null ? f === pattern : f.startsWith(prefix)) renameSync(join(from, f), join(to, f));
    },
    wait: ms => page.waitForTimeout(ms),
    // Waits until the dashboard shows something (the dashboard reads state once a second), then a beat for its move to finish.
    until: async (sel, { timeout = 3000, then = 0 } = {}) => { await page.waitForSelector(sel, { timeout }).catch(() => {}); if (then) await page.waitForTimeout(then); },
    event: e => appendFileSync(join(desk, 'events.jsonl'), JSON.stringify({ t: new Date().toISOString(), session: 'clip', ...e }) + '\n'),
    state: patch => { const s = readState(); writeState(typeof patch === 'function' ? (patch(s) || s) : Object.assign(s, patch)); },
    // A desk starts: lights the card and adds the role to the job's staffing.
    start: (slug, task, model) => {
      const agent = `clip-${++agentN}`;
      t.event({ type: 'desk.start', desk: slug, agent });
      t.state(s => { s.desks.push({ desk: slug, task, status: 'working', model, startedAt: new Date().toISOString(), agent }); });
      return agent;
    },
    // The job ends: finishedAt is now and startedAt is as far back as the real run took, so 'Took' reads the record's time.
    finish: () => { const took = final ? (Date.parse(final.updatedAt) - Date.parse(final.startedAt)) : 0; t.state(s => { s.finishedAt = new Date().toISOString(); if (took > 0) s.startedAt = new Date(Date.now() - took).toISOString(); }); },
    // A desk stops. Tokens and cost go on the event only when the clip gives them, so the dashboard never shows a made-up
    // figure. A real cost is also added to the job's cost and tokens by the desk's tier, the way the Manager does, so
    // the cost line grows as the desks report.
    stop: (slug, agent, { model = 'claude-haiku-5-5', costUsd, tokens } = {}) => {
      t.event({ type: 'desk.stop', desk: slug, agent, model, ...(tokens ? { tokens: { total: tokens } } : {}), ...(typeof costUsd === 'number' ? { costUsd } : {}) });
      t.state(s => {
        const d = s.desks.find(x => x.agent === agent); if (d) { d.status = 'done'; d.updatedAt = new Date().toISOString(); }
        // By the model that ran, the way state.mjs attributes cost: a desk's role can be overridden for a step.
        const tier = /opus|fable/.test(model) ? 'director' : /sonnet/.test(model) ? 'senior' : /haiku/.test(model) ? 'builder' : TIER_OF[slug];
        if (tier && typeof costUsd === 'number') {
          s.cost = s.cost || { director: 0, senior: 0, builder: 0, total: 0, complete: true };
          s.cost[tier] = Math.round(((s.cost[tier] || 0) + costUsd) * 10000) / 10000;
          s.cost.total = Math.round(((s.cost.total || 0) + costUsd) * 10000) / 10000;
          if (tokens) { s.tokens = s.tokens || { director: 0, senior: 0, builder: 0 }; s.tokens[tier] = (s.tokens[tier] || 0) + tokens; }
        }
      });
    },
    phase: (phase, round = 0) => { t.event({ type: 'job.phase', id: job, phase, round }); t.state({ phase, round }); },
    // Scrolls the page smoothly so the element's top sits at the top of the frame.
    scrollTo: async (sel, ms = 600) => { await page.evaluate(q => document.querySelector(q)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), sel); await page.waitForTimeout(ms); },
    click: async sel => { await page.locator(sel).first().click(); },
    type: async (sel, text, delay = 40) => { await page.locator(sel).first().click(); await page.keyboard.type(text, { delay }); },
  };
  return t;
}

async function record(clip, { size, scheme, fixture, outDir }) {
  const projRoot = mkdtempSync(join(tmpdir(), 'desk-clip-'));
  const desk = join(projRoot, '.desk');
  cpSync(fixture, desk, { recursive: true });
  const job = clip.job || readFirstJob(desk);
  rebaseTimes(desk, job);
  const stateFile = join(desk, 'jobs', job, 'state.json');
  const final = clip.fresh && existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : null;
  const eventsFile = join(desk, 'events.jsonl');
  const finalEvents = clip.fresh && existsSync(eventsFile)
    ? readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } })
    : [];
  if (clip.fresh) freshJob(desk, job);
  const token = 'clip-' + Math.random().toString(36).slice(2, 12);
  const floor = createFloor({ root: projRoot, desk, token, port: 0 });
  const port = await floor.listen();
  const browser = await launch();
  const videoDir = join(projRoot, 'video');
  mkdirSync(videoDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  const base = `${clip.name}-${size.width}x${size.height}`;
  let tmpVideo = null, lead = 0;
  try {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, colorScheme: scheme,
      recordVideo: { dir: videoDir, size: { width: size.width, height: size.height } },
    });
    const opened = Date.now();
    const page = await context.newPage();
    // The dashboard asks to confirm a pick, a stop and an approval; the take says yes, the way the person watching would.
    page.on('dialog', d => d.accept());
    await page.goto(`http://127.0.0.1:${port}/?token=${token}${clip.query || ''}`, { waitUntil: 'load' });
    await page.waitForSelector('#floor .desk, #floor [data-desk]', { timeout: 10000 }).catch(() => {});
    // Zoom the page so the dashboard's text reads at the size a clip is watched at: the layout reflows at the smaller width.
    const zoom = size.width > size.height ? (clip.zoom ?? 1.5) : (clip.zoomTall ?? clip.zoom ?? 1.4);
    await page.addStyleTag({ content: `html { zoom: ${zoom}; }` });
    await page.waitForTimeout(clip.settle ?? 600);
    const t = toolkit({ page, desk, job, final, finalEvents });
    if (clip.before) await clip.before(t);
    // The recording runs from the page opening; the clip starts at the poster frame, so the lead is cut below.
    lead = (Date.now() - opened) / 1000;
    await page.screenshot({ path: join(outDir, `${base}.png`) });
    const started = Date.now();
    await clip.run(t);
    const left = clip.seconds * 1000 - (Date.now() - started);
    // The recorder drops the last few frames before the page closes, so the hold runs half a second past the clip.
    await page.waitForTimeout(Math.max(0, left) + 500);
    tmpVideo = await page.video()?.path();
    await context.close();
  } finally {
    await browser.close();
    await floor.close?.();
  }
  // The raw recording is cut to the clip, from the poster frame for the clip's seconds, as MP4 (H.264) and WebM (VP9),
  // with the clip's one caption burned into every frame and the poster.
  const raw = join(outDir, `${base}.recorded.webm`);
  if (tmpVideo && existsSync(tmpVideo)) renameSync(tmpVideo, raw);
  const poster = join(outDir, `${base}.png`);
  const webm = join(outDir, `${base}.webm`);
  let mp4 = null;
  if (existsSync(raw) && hasFfmpeg()) {
    // The dashboard's page is 1440 wide at most, centred, with its text 24px in from the column edge; the caption lines up with that.
    const left = Math.max(0, Math.round((size.width - 1440) / 2)) + 24;
    const cap = clip.caption ? await captionPng({ text: clip.caption, width: size.width, height: size.height, scheme, left, out: join(projRoot, 'caption.png') }) : null;
    const over = cap ? overlayArgs(cap) : [];
    const cut = ['-y', '-loglevel', 'error', '-ss', lead.toFixed(3), '-i', raw, ...over, '-t', String(clip.seconds), '-r', '30', '-an'];
    mp4 = join(outDir, `${base}.mp4`);
    if (spawnSync('ffmpeg', [...cut, '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { encoding: 'utf8' }).status !== 0) mp4 = null;
    if (spawnSync('ffmpeg', [...cut, '-c:v', 'libvpx-vp9', '-crf', '33', '-b:v', '0', '-row-mt', '1', '-pix_fmt', 'yuv420p', webm], { encoding: 'utf8' }).status === 0) rmSync(raw, { force: true });
    else rmSync(webm, { force: true });
    if (cap) {
      const captioned = join(projRoot, 'poster.png');
      if (spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', poster, ...over, '-frames:v', '1', captioned], { encoding: 'utf8' }).status === 0) renameSync(captioned, poster);
    }
  } else if (existsSync(raw)) renameSync(raw, webm);
  rmSync(projRoot, { recursive: true, force: true });
  return { name: clip.name, seconds: clip.seconds, size: `${size.width}x${size.height}`, caption: clip.caption || null, lead: Number(lead.toFixed(2)), poster, webm: existsSync(webm) ? webm : null, mp4 };
}

// A fixture is a real job from the past. Shift every timestamp so the dashboard shows it as happening now.
function rebaseTimes(desk, job) {
  const now = Date.now();
  const eventsFile = join(desk, 'events.jsonl');
  const lines = existsSync(eventsFile) ? readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean) : [];
  const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const last = Math.max(0, ...events.map(e => Date.parse(e.t) || 0));
  const shift = last ? now - 2000 - last : 0;
  const move = t => { const ms = Date.parse(t); return Number.isFinite(ms) ? new Date(ms + shift).toISOString() : t; };
  if (events.length) writeFileSync(eventsFile, events.map(e => JSON.stringify({ ...e, t: move(e.t) })).join('\n') + '\n');
  const stateFile = join(desk, 'jobs', job, 'state.json');
  if (!existsSync(stateFile)) return;
  const s = JSON.parse(readFileSync(stateFile, 'utf8'));
  for (const k of ['startedAt', 'updatedAt', 'finishedAt']) if (s[k]) s[k] = move(s[k]);
  for (const d of s.desks || []) for (const k of ['startedAt', 'updatedAt']) if (d[k]) d[k] = move(d[k]);
  writeFileSync(stateFile, JSON.stringify(s, null, 2));
}

// A clip that starts from an empty job: the staffing, scores, cost, tokens, files and live desks reset, the
// renders and output files are held until the timeline reveals or lands them, and the event log keeps only
// the session and job start lines. So the first frame is a job that has not started.
function freshJob(desk, job) {
  const stateFile = join(desk, 'jobs', job, 'state.json');
  const s = JSON.parse(readFileSync(stateFile, 'utf8'));
  Object.assign(s, { desks: [], scores: [], proof: [], pick: null, phase: 'intake', round: 0, waitingOn: null, cost: { director: 0, senior: 0, builder: 0, total: 0, complete: true }, tokens: { director: 0, senior: 0, builder: 0 }, files: [], startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  delete s.finishedAt;
  // The job as it began: the default roles, and none of the controls a person used on the way.
  s.models = { director: 'anthropic/opus', senior: 'anthropic/sonnet', builder: 'anthropic/haiku' };
  rmSync(join(desk, 'jobs', job, 'control.json'), { force: true });
  rmSync(join(desk, 'jobs', job, 'inbox'), { recursive: true, force: true });
  writeFileSync(stateFile, JSON.stringify(s, null, 2));
  // Renders wait in renders.held, output files in out.held, until the timeline reveals or lands them.
  const renders = join(desk, 'jobs', job, 'renders');
  if (existsSync(renders)) { renameSync(renders, join(desk, 'jobs', job, 'renders.held')); mkdirSync(renders); }
  const out = join(desk, 'out', job);
  if (existsSync(out)) { mkdirSync(join(desk, 'out.held'), { recursive: true }); renameSync(out, join(desk, 'out.held', job)); mkdirSync(out); }
  const eventsFile = join(desk, 'events.jsonl');
  const keep = (existsSync(eventsFile) ? readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean) : [])
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(e => e && (e.type === 'session.start' || (e.type === 'job.start' && e.id === job)));
  writeFileSync(eventsFile, keep.map(e => JSON.stringify(e)).join('\n') + (keep.length ? '\n' : ''));
}

function readFirstJob(desk) {
  const dir = join(desk, 'jobs');
  const jobs = existsSync(dir) ? readdirSync(dir).sort() : [];
  if (!jobs.length) throw new Error('The fixture has no job under .desk/jobs.');
  return jobs[0];
}

const args = parse(process.argv.slice(2));
if (args.list) { for (const c of CLIPS) console.log(`${c.name.padEnd(16)} ${String(c.seconds).padStart(3)}s  ${c.loop ? 'loop  ' : '      '}${c.about}`); process.exit(0); }
const name = args._[0];
const clip = CLIPS.find(c => c.name === name);
if (!clip) { console.error(`usage: node clips/record.mjs <clip> [--size 16:9|9:16|1:1] [--scheme dark|light] [--fixture DIR] [--out DIR]\nclips: ${CLIPS.map(c => c.name).join(', ')}`); process.exit(2); }
const size = sizeOf(args.size);
const scheme = args.scheme === 'light' ? 'light' : 'dark';
const fixture = resolve(args.fixture || clip.fixture || join(here, 'fixtures', 'card'));
if (!existsSync(fixture)) { console.error(`Fixture not found: ${fixture}`); process.exit(2); }
const outDir = resolve(args.out || join(here, 'takes'));
record(clip, { size, scheme, fixture, outDir }).then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e.stack || e.message); process.exit(1); });
