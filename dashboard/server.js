#!/usr/bin/env node
// The floor: a local dashboard for Desk Studio. Zero dependencies.
//   setup | start | stop | status | disable | serve   [--project DIR] [--port N]
// Binds 127.0.0.1 only. Every API route needs the token printed at start.
// Reads .desk/events.jsonl and .desk/jobs/*/state.json. Writes control.json, inbox notes
// and control.* events. Never logs prompt text, copy or notes, only names and numbers.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  appendFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync,
  renameSync, statSync, unlinkSync, writeFileSync, closeSync, createReadStream
} from 'node:fs';
import { dirname, extname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseFrontMatter } from '../proof/brand.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, 'public');
const REGISTRY = join(here, '..', 'skills', 'desk', 'desks.json');
const TIER_ORDER = ['manager', 'director', 'senior', 'builder'];
const TIER_NOTES = {
  manager: 'Runs in the main session. Staffs and briefs, never judges.',
  director: 'The pick, the notes, the sign-off. Where the taste is.',
  senior: 'Roughs, research, strategy, specialists.',
  builder: 'Polish rounds and the making desks.'
};

// The one desk list is skills/desk/desks.json. The floor only needs slug, name, tier and owns.
export function loadDesks(file = REGISTRY) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const tiersIn = Array.isArray(raw.tiers) ? Object.fromEntries(raw.tiers.map(t => [t.id, t])) : (raw.tiers || {});
  const desks = (raw.desks || []).map(d => ({ slug: d.slug, name: d.name, tier: d.tier, owns: d.owns || '' }));
  const ids = [...TIER_ORDER, ...Object.keys(tiersIn), ...desks.map(d => d.tier)].filter((id, i, all) => id && all.indexOf(id) === i);
  const tiers = ids.filter(id => tiersIn[id] || desks.some(d => d.tier === id)).map(id => ({
    id, name: id[0].toUpperCase() + id.slice(1),
    model: tiersIn[id]?.default || tiersIn[id]?.model || 'inherit',
    note: TIER_NOTES[id] || '', color: tiersIn[id]?.color || null
  }));
  return { tiers, desks };
}
const DESKS = loadDesks();
export const DEFAULT_PORT = 7433;
const BACKLOG = 200;
const TIERS = ['director', 'senior', 'builder'];
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;
const MODEL_RE = /^[a-z0-9][a-z0-9._-]{0,40}\/[a-z0-9][a-z0-9._:-]{0,60}$/i;
const FILE_TYPES = { '.png': 'image/png', '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const STATIC_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const FONTS = join(here, '..', 'fonts');
const FONT_TYPES = { '.woff2': 'font/woff2' };
const CLOSED = new Set(['done', 'stopped', 'failed', 'cancelled']);

// ---------- project ----------

export function findProject(start, { create = false } = {}) {
  let dir = resolve(start || process.cwd());
  for (let i = 0; i <= 3; i++) {
    if (existsSync(join(dir, '.desk'))) return { root: dir, desk: join(dir, '.desk') };
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  if (create) {
    const root = resolve(start || process.cwd());
    mkdirSync(join(root, '.desk'), { recursive: true });
    return { root, desk: join(root, '.desk') };
  }
  return null;
}

function readJson(file, fallback = null) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (e) {
    if (e && e.code === 'ENOENT') return fallback;
    throw Object.assign(new Error(`${relative(process.cwd(), file) || file} is not valid JSON`), { code: 'BADJSON' });
  }
}

function writeJsonAtomic(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, file);
}

function appendEvent(desk, event) {
  appendFileSync(join(desk, 'events.jsonl'), JSON.stringify({ t: new Date().toISOString(), ...event }) + '\n');
}

function log(desk, line) {
  try { appendFileSync(join(desk, 'dashboard.log'), `${new Date().toISOString()} ${line}\n`); } catch {}
}

function under(base, target) {
  const rel = relative(base, target);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function readText(file, max = 64 * 1024) {
  try { const t = readFileSync(file, 'utf8'); return t.length > max ? t.slice(0, max) + '\n[cut]' : t; } catch { return null; }
}

// ---------- state readers ----------

function listJobs(desk) {
  const jobsDir = join(desk, 'jobs');
  if (!existsSync(jobsDir)) return [];
  const out = [];
  for (const name of readdirSync(jobsDir)) {
    const file = join(jobsDir, name, 'state.json');
    if (!existsSync(file)) continue;
    let state;
    try { state = readJson(file); } catch { state = { id: name, phase: 'unreadable' }; }
    if (!state || typeof state !== 'object') continue;
    out.push({
      id: state.id || name,
      dir: name,
      command: state.command ?? null,
      deliverable: state.deliverable ?? null,
      phase: state.phase ?? null,
      round: state.round ?? null,
      maxRounds: state.maxRounds ?? null,
      waitingOn: state.waitingOn ?? null,
      startedAt: state.startedAt ?? null,
      updatedAt: state.updatedAt ?? null,
      mtime: statSync(file).mtimeMs
    });
  }
  out.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '') || b.mtime - a.mtime);
  return out;
}

function activeJob(jobs) {
  const open = jobs.find(j => j.phase && !CLOSED.has(j.phase));
  return (open || jobs[0] || null)?.id ?? null;
}

function readBrandMeta(desk) {
  const file = join(desk, 'DESIGN.md');
  if (!existsSync(file)) return null;
  try { return parseFrontMatter(readFileSync(file, 'utf8')); } catch { return {}; }
}

function listRenders(desk, dir) {
  const rendersDir = join(desk, 'jobs', dir, 'renders');
  if (!existsSync(rendersDir)) return [];
  const out = [];
  // The runner keeps the roughs one level down, in renders/roughs/rough-N; the Manager keeps them beside the rounds.
  const scan = rel => {
    const base = rel ? join(rendersDir, rel) : rendersDir;
    for (const name of readdirSync(base)) {
      const m = /^(rough|round)-(\d+)$/.exec(name);
      if (!m) continue;
      const path = rel ? `${rel}/${name}` : name;
      let files = [];
      try {
        files = readdirSync(join(rendersDir, path))
          .filter(f => f.endsWith('.png') && !f.endsWith('.background.png'))
          .map(f => ({ size: f.replace(/\.png$/, ''), path: `jobs/${dir}/renders/${path}/${f}` }));
      } catch {}
      out.push({ name, kind: m[1], n: Number(m[2]), files });
    }
  };
  scan('');
  if (existsSync(join(rendersDir, 'roughs'))) scan('roughs');
  out.sort((a, b) => a.kind.localeCompare(b.kind) || a.n - b.n);
  return out;
}

function listOut(desk, id) {
  const outDir = join(desk, 'out', id);
  if (!existsSync(outDir)) return [];
  return readdirSync(outDir)
    .filter(f => /\.(html|svg|png|json)$/i.test(f))
    .map(f => ({ name: f, path: `out/${id}/${f}` }));
}

function listInbox(desk, dir) {
  const inbox = join(desk, 'jobs', dir, 'inbox');
  if (!existsSync(inbox)) return [];
  return readdirSync(inbox).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
}

function jobDir(desk, id) {
  if (!ID_RE.test(id)) return null;
  const dir = join(desk, 'jobs', id);
  if (existsSync(join(dir, 'state.json'))) return dir;
  const match = listJobs(desk).find(j => j.id === id);
  return match ? join(desk, 'jobs', match.dir) : null;
}

// ---------- event tail and state watch ----------

function makeTailer(desk, broadcast) {
  const file = join(desk, 'events.jsonl');
  let offset = 0, rest = '';
  try { offset = statSync(file).size; } catch { offset = 0; }
  const tick = () => {
    let size;
    try { size = statSync(file).size; } catch { offset = 0; rest = ''; return; }
    if (size < offset) { offset = size; rest = ''; return; }
    if (size === offset) return;
    const buf = Buffer.alloc(size - offset);
    const fd = openSync(file, 'r');
    try {
      let got = 0;
      while (got < buf.length) {
        const n = readSync(fd, buf, got, buf.length - got, offset + got);
        if (n <= 0) break;
        got += n;
      }
      const text = rest + buf.subarray(0, got).toString('utf8');
      const lines = text.split('\n');
      rest = lines.pop() || '';
      for (const line of lines) if (line.trim()) broadcast('message', line.trim());
      offset += got;
    } finally { closeSync(fd); }
  };
  const backlog = () => {
    try { return readFileSync(file, 'utf8').split('\n').filter(l => l.trim()).slice(-BACKLOG); } catch { return []; }
  };
  return { tick, backlog };
}

function makeStateWatcher(desk, broadcast) {
  let last = null;
  return () => {
    const jobs = listJobs(desk);
    const sig = jobs.map(j => `${j.dir}:${j.mtime}`).join('|');
    if (last === null) { last = sig; return; }
    if (sig !== last) {
      const changed = jobs.filter(j => !last.includes(`${j.dir}:${j.mtime}`)).map(j => j.id);
      last = sig;
      broadcast('state', JSON.stringify({ jobs: jobs.map(j => j.id), changed }));
    }
  };
}

// ---------- control ----------

function readControl(dir) {
  const current = readJson(join(dir, 'control.json'), {});
  if (!current || typeof current !== 'object' || Array.isArray(current)) throw Object.assign(new Error('control.json is not an object'), { code: 'BADJSON' });
  return current;
}

function cleanModels(models) {
  if (!models || typeof models !== 'object' || Array.isArray(models)) throw new Error('models must be an object');
  const out = {};
  for (const tier of TIERS) {
    if (models[tier] === undefined) continue;
    if (typeof models[tier] !== 'string' || !MODEL_RE.test(models[tier])) throw new Error(`models.${tier} must look like provider/model`);
    out[tier] = models[tier];
  }
  if (models.desks !== undefined) {
    if (!models.desks || typeof models.desks !== 'object' || Array.isArray(models.desks)) throw new Error('models.desks must be an object');
    out.desks = {};
    for (const [slug, model] of Object.entries(models.desks)) {
      if (!SLUG_RE.test(slug)) throw new Error(`bad desk name: ${slug}`);
      if (model === null || model === '') { out.desks[slug] = null; continue; }
      if (typeof model !== 'string' || !MODEL_RE.test(model)) throw new Error(`models.desks.${slug} must look like provider/model`);
      out.desks[slug] = model;
    }
  }
  if (!Object.keys(out).length) throw new Error('models has nothing to change');
  return out;
}

function mergeModels(target, models) {
  const next = { ...(target && typeof target === 'object' ? target : {}) };
  for (const tier of TIERS) if (models[tier] !== undefined) next[tier] = models[tier];
  if (models.desks) {
    next.desks = { ...(next.desks && typeof next.desks === 'object' ? next.desks : {}) };
    for (const [slug, model] of Object.entries(models.desks)) {
      if (model === null) delete next.desks[slug]; else next.desks[slug] = model;
    }
    if (!Object.keys(next.desks).length) delete next.desks;
  }
  return next;
}

export function applyControl(desk, id, body) {
  const dir = jobDir(desk, id);
  if (!dir) return { status: 404, error: `No job ${id}` };
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 400, error: 'Body must be a JSON object' };
  const keys = Object.keys(body).filter(k => k !== 'scope');
  if (keys.length !== 1) return { status: 400, error: 'Send exactly one of pause, stop, models, pick, note, approve, sendBack' };
  const kind = keys[0];
  const now = new Date().toISOString();
  let control;
  try { control = readControl(dir); } catch (e) { return { status: 409, error: `${e.message}. Fix or remove it, then try again.` }; }
  const event = { type: `control.${kind}`, id };
  const touch = () => { control.updatedAt = now; };

  switch (kind) {
    case 'pause': {
      if (typeof body.pause !== 'boolean') return { status: 400, error: 'pause must be true or false' };
      control.paused = body.pause; touch(); event.paused = body.pause; break;
    }
    case 'stop': {
      if (body.stop !== true) return { status: 400, error: 'stop must be true' };
      control.stop = true; touch(); break;
    }
    case 'models': {
      let models;
      try { models = cleanModels(body.models); } catch (e) { return { status: 400, error: e.message }; }
      const scope = body.scope === 'default' ? 'default' : 'job';
      control.models = mergeModels(control.models, models); touch();
      if (scope === 'default') {
        const projectFile = join(desk, 'project.json');
        let project;
        try { project = readJson(projectFile, {}); } catch (e) { return { status: 409, error: `${e.message}. Fix it, then try again.` }; }
        if (!project || typeof project !== 'object' || Array.isArray(project)) project = {};
        project.models = mergeModels(project.models, models);
        writeJsonAtomic(projectFile, project);
      }
      event.scope = scope;
      for (const tier of TIERS) if (models[tier]) event[tier] = models[tier];
      if (models.desks) event.desks = Object.keys(models.desks).length;
      break;
    }
    case 'pick': {
      const n = body.pick;
      if (!Number.isInteger(n) || n < 1 || n > 12) return { status: 400, error: 'pick must be a rough number' };
      control.pick = n; touch(); event.rough = n; break;
    }
    case 'note': {
      const note = body.note;
      if (!note || typeof note !== 'object' || !SLUG_RE.test(String(note.desk || '')) || typeof note.text !== 'string' || !note.text.trim())
        return { status: 400, error: 'note needs a desk and some text' };
      if (note.text.length > 20000) return { status: 400, error: 'note is too long' };
      const inbox = join(dir, 'inbox');
      mkdirSync(inbox, { recursive: true });
      appendFileSync(join(inbox, `${note.desk}.md`), note.text.trim() + '\n\n');
      event.desk = note.desk; event.chars = note.text.trim().length;
      appendEvent(desk, event);
      log(desk, `control.note ${id} ${note.desk} ${event.chars} chars`);
      return { status: 200, body: { ok: true, control, inbox: listInbox(desk, relative(join(desk, 'jobs'), dir)) } };
    }
    case 'approve': {
      if (body.approve !== true) return { status: 400, error: 'approve must be true' };
      control.approve = { at: now }; touch(); break;
    }
    case 'sendBack': {
      const sb = body.sendBack;
      if (!sb || typeof sb !== 'object' || typeof sb.notes !== 'string' || !sb.notes.trim()) return { status: 400, error: 'sendBack needs notes' };
      if (sb.notes.length > 20000) return { status: 400, error: 'notes are too long' };
      control.sendBack = { notes: sb.notes.trim(), at: now }; touch();
      event.chars = sb.notes.trim().length; break;
    }
    default:
      return { status: 400, error: `Unknown control: ${kind}` };
  }
  writeJsonAtomic(join(dir, 'control.json'), control);
  appendEvent(desk, event);
  log(desk, `${event.type} ${id}`);
  return { status: 200, body: { ok: true, control } };
}

// ---------- http ----------

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

function readBody(req, max = 64 * 1024) {
  return new Promise((done, fail) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > max) { fail(new Error('Body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

function tokenOk(req, url, token) {
  const given = req.headers['x-desk-token'] || url.searchParams.get('token') || '';
  const a = Buffer.from(String(given)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createFloor({ root, desk, token, port = DEFAULT_PORT, startedAt = new Date().toISOString() }) {
  const clients = new Set();
  const broadcast = (event, data) => {
    const frame = (event === 'message' ? '' : `event: ${event}\n`) + `data: ${data}\n\n`;
    for (const res of clients) res.write(frame);
  };
  const tailer = makeTailer(desk, broadcast);
  const watcher = makeStateWatcher(desk, broadcast);
  let timers = [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const path = url.pathname;
    try {
      if (path.startsWith('/api/')) {
        if (!tokenOk(req, url, token)) return sendJson(res, 401, { error: 'Token missing or wrong. Use the URL printed by start.' });
        if (req.method === 'GET' && path === '/api/health') {
          return sendJson(res, 200, { ok: true, pid: process.pid, port, startedAt, project: root });
        }
        if (req.method === 'GET' && path === '/api/state') {
          const jobs = listJobs(desk);
          let project = null, projectError = null;
          try { project = readJson(join(desk, 'project.json'), null); } catch (e) { projectError = e.message; }
          return sendJson(res, 200, {
            project, projectError, brand: readBrandMeta(desk), taste: readText(join(desk, 'taste.md'), 8000),
            jobs: jobs.map(({ mtime, ...j }) => j), active: activeJob(jobs), desks: DESKS,
            dashboard: readJson(join(desk, 'dashboard.json'), null), root, now: new Date().toISOString()
          });
        }
        let m;
        if (req.method === 'GET' && (m = /^\/api\/jobs\/([^/]+)$/.exec(path))) {
          const id = decodeURIComponent(m[1]);
          const dir = jobDir(desk, id);
          if (!dir) return sendJson(res, 404, { error: `No job ${id}` });
          const name = relative(join(desk, 'jobs'), dir);
          let state, control = null, controlError = null;
          try { state = readJson(join(dir, 'state.json')); } catch (e) { return sendJson(res, 500, { error: e.message }); }
          try { control = readJson(join(dir, 'control.json'), null); } catch (e) { controlError = e.message; }
          return sendJson(res, 200, {
            state, control, controlError, renders: listRenders(desk, name), out: listOut(desk, state.id || name),
            brief: readText(join(dir, 'brief.md'), 16000), inbox: listInbox(desk, name)
          });
        }
        if (req.method === 'POST' && (m = /^\/api\/control\/([^/]+)$/.exec(path))) {
          const id = decodeURIComponent(m[1]);
          if (!ID_RE.test(id)) return sendJson(res, 404, { error: 'Bad job id' });
          let body;
          try { body = JSON.parse((await readBody(req)) || '{}'); } catch { return sendJson(res, 400, { error: 'Body must be JSON' }); }
          const r = applyControl(desk, id, body);
          return sendJson(res, r.status, r.error ? { error: r.error } : r.body);
        }
        if (req.method === 'GET' && path === '/api/file') {
          const rel = String(url.searchParams.get('path') || '').replace(/\\/g, '/').replace(/^\.desk\//, '');
          if (!rel || rel.split('/').includes('..') || isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return sendJson(res, 400, { error: 'Bad path' });
          const full = resolve(desk, rel);
          const allowed = under(join(desk, 'out'), full) || under(join(desk, 'jobs'), full);
          const type = FILE_TYPES[extname(full).toLowerCase()];
          if (!allowed || !type) return sendJson(res, 403, { error: 'Only PNG, HTML, SVG and JSON under .desk/out and .desk/jobs' });
          if (!existsSync(full) || !statSync(full).isFile()) return sendJson(res, 404, { error: 'Not found' });
          const headers = { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
          if (type.startsWith('text/html') || type.startsWith('image/svg')) headers['Content-Security-Policy'] = 'sandbox';
          res.writeHead(200, headers);
          return createReadStream(full).on('error', () => res.end()).pipe(res);
        }
        if (req.method === 'GET' && path === '/api/events') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
          res.write(`event: hello\ndata: ${JSON.stringify({ now: new Date().toISOString(), pid: process.pid })}\n\n`);
          for (const line of tailer.backlog()) res.write(`data: ${line}\n\n`);
          res.write('event: ready\ndata: {}\n\n');
          clients.add(res);
          req.on('close', () => clients.delete(res));
          return;
        }
        return sendJson(res, 404, { error: 'No such route' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' });
      const file = path === '/' ? 'index.html' : decodeURIComponent(path.slice(1));
      if (file.split('/').includes('..')) return sendJson(res, 400, { error: 'Bad path' });
      // /fonts/ serves the plugin's bundled woff2 files, so the floor sets Inter without a network.
      const fromFonts = file.startsWith('fonts/');
      const base = fromFonts ? FONTS : PUBLIC;
      const full = resolve(base, fromFonts ? file.slice(6) : file);
      const type = (fromFonts ? FONT_TYPES : STATIC_TYPES)[extname(full).toLowerCase()];
      if (!under(base, full) || !type || !existsSync(full) || !statSync(full).isFile()) return sendJson(res, 404, { error: 'Not found' });
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
      if (req.method === 'HEAD') return res.end();
      createReadStream(full).on('error', () => res.end()).pipe(res);
    } catch (e) {
      log(desk, `error ${req.method} ${path}: ${e.message}`);
      if (!res.headersSent) sendJson(res, 500, { error: e.message }); else res.end();
    }
  });

  return {
    server,
    listen() {
      return new Promise((ok, fail) => {
        server.once('error', fail);
        server.listen(port, '127.0.0.1', () => {
          server.off('error', fail);
          timers = [
            setInterval(tailer.tick, 400),
            setInterval(watcher, 1000),
            setInterval(() => { for (const r of clients) r.write(': ping\n\n'); }, 15000)
          ];
          ok(server.address().port);
        });
      });
    },
    close() {
      for (const t of timers) clearInterval(t);
      for (const r of clients) { try { r.end(); } catch {} }
      clients.clear();
      return new Promise(ok => server.close(() => ok()));
    }
  };
}

// ---------- cli ----------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '--port') out[a.slice(2)] = argv[++i];
    else if (a.startsWith('--')) out[a.slice(2)] = true;
    else out._.push(a);
  }
  return out;
}

function health(port, token, timeout = 1500) {
  return new Promise(ok => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/health', headers: { 'X-Desk-Token': token }, timeout }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 401) return ok({ status: 401 });
        try { ok({ status: res.statusCode, ...JSON.parse(body) }); } catch { ok({ status: res.statusCode }); }
      });
    });
    req.on('timeout', () => { req.destroy(); ok(null); });
    req.on('error', () => ok(null));
  });
}

function portBusy(port) {
  return new Promise(ok => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 800 }, res => { res.resume(); ok(true); });
    req.on('timeout', () => { req.destroy(); ok(true); });
    req.on('error', e => ok(e.code !== 'ECONNREFUSED'));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const urlFor = (port, token) => `http://127.0.0.1:${port}/?token=${token}`;

function ensureGitignore(desk) {
  const file = join(desk, '.gitignore');
  const want = ['events.jsonl', 'jobs/', 'dashboard.runtime.json', 'dashboard.log'];
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const have = text.split(/\r?\n/).map(l => l.trim());
  const add = want.filter(w => !have.includes(w));
  if (add.length) appendFileSync(file, (text && !text.endsWith('\n') ? '\n' : '') + add.join('\n') + '\n');
  return add;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  const port = Number(args.port) || null;
  if (!['setup', 'start', 'stop', 'status', 'disable', 'serve'].includes(cmd)) {
    console.error('usage: node dashboard/server.js setup|start|stop|status|disable|serve [--project DIR] [--port N]');
    process.exit(2);
  }

  const found = findProject(args.project, { create: cmd === 'setup' });
  if (!found) {
    console.error(`No .desk/ found in ${resolve(args.project || process.cwd())} or three levels up. Run /desk:init first, or "setup" here.`);
    process.exit(1);
  }
  const { root, desk } = found;
  const configFile = join(desk, 'dashboard.json');
  const runtimeFile = join(desk, 'dashboard.runtime.json');
  const config = readJson(configFile, null);
  const runtime = readJson(runtimeFile, null);

  if (cmd === 'setup') {
    const next = { enabled: true, port: port || config?.port || DEFAULT_PORT };
    writeJsonAtomic(configFile, next);
    const added = ensureGitignore(desk);
    console.log(`Floor enabled for ${root} on port ${next.port}.`);
    console.log(`Wrote .desk/dashboard.json${added.length ? ` and added ${added.join(', ')} to .desk/.gitignore` : ''}.`);
    console.log('Logs desk names, models, rounds, scores, costs and file paths to .desk/events.jsonl, never prompt text.');
    console.log('Serves on 127.0.0.1 only, behind a token that changes on every start. Turn it off with "disable".');
    return;
  }

  if (cmd === 'disable') {
    writeJsonAtomic(configFile, { ...(config || {}), enabled: false, port: config?.port || DEFAULT_PORT });
    if (runtime?.pid && runtime?.token) {
      const h = await health(runtime.port, runtime.token);
      if (h?.ok && h.pid === runtime.pid) { try { process.kill(runtime.pid); } catch {} console.log(`Stopped the floor (pid ${runtime.pid}).`); }
      try { unlinkSync(runtimeFile); } catch {}
    }
    console.log('Floor disabled. The event log stays until you delete .desk/events.jsonl. "setup" turns it back on.');
    return;
  }

  if (cmd === 'status') {
    if (!config?.enabled) { console.log('Floor: not enabled. Run setup first.'); process.exit(3); }
    if (!runtime?.pid) { console.log(`Floor: enabled on port ${config.port}, not running. Run start.`); process.exit(3); }
    const h = await health(runtime.port, runtime.token);
    if (h?.ok && h.pid === runtime.pid) {
      console.log(`Floor: running, pid ${runtime.pid}, since ${runtime.startedAt}`);
      console.log(urlFor(runtime.port, runtime.token));
      return;
    }
    try { unlinkSync(runtimeFile); } catch {}
    console.log(`Floor: enabled on port ${config.port}, not running (stale record removed). Run start.`);
    process.exit(3);
  }

  if (cmd === 'stop') {
    if (!runtime?.pid) { console.log('Floor: not running.'); return; }
    const h = await health(runtime.port, runtime.token);
    if (!h) { try { unlinkSync(runtimeFile); } catch {} console.log('Floor: not running (stale record removed).'); return; }
    if (h.status === 401 || !h.ok) { console.error(`Something else answers on port ${runtime.port}. Not touching it. Remove .desk/dashboard.runtime.json by hand if the floor is gone.`); process.exit(1); }
    if (h.pid !== runtime.pid) { console.error(`Pid mismatch: record says ${runtime.pid}, server says ${h.pid}. Not killing. Remove .desk/dashboard.runtime.json by hand.`); process.exit(1); }
    try { process.kill(runtime.pid); } catch (e) { console.error(`Could not stop pid ${runtime.pid}: ${e.message}`); process.exit(1); }
    for (let i = 0; i < 20 && await health(runtime.port, runtime.token, 300); i++) await sleep(150);
    try { unlinkSync(runtimeFile); } catch {}
    console.log(`Floor stopped (pid ${runtime.pid}).`);
    return;
  }

  if (cmd === 'start') {
    if (!config?.enabled) { console.error('Floor is not enabled for this project. Run "setup" first (/desk:dashboard setup).'); process.exit(3); }
    const usePort = port || config.port || DEFAULT_PORT;
    if (runtime?.pid && runtime?.token) {
      const h = await health(runtime.port, runtime.token);
      if (h?.ok && h.pid === runtime.pid) { console.log(`Floor already running (pid ${runtime.pid}).`); console.log(urlFor(runtime.port, runtime.token)); return; }
      try { unlinkSync(runtimeFile); } catch {}
    }
    if (await portBusy(usePort)) { console.error(`Port ${usePort} is in use by something else. Pick another with --port N, or stop what is on it.`); process.exit(1); }
    const token = randomBytes(16).toString('hex');
    const logFd = openSync(join(desk, 'dashboard.log'), 'a');
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve', '--project', root, '--port', String(usePort)], {
      detached: true, stdio: ['ignore', logFd, logFd], windowsHide: true,
      env: { ...process.env, DESK_FLOOR_TOKEN: token }
    });
    let exited = null;
    child.on('exit', code => { exited = code ?? 'signal'; });
    child.unref();
    closeSync(logFd);
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const h = await health(usePort, token, 500);
      if (h?.ok && h.pid === child.pid) {
        console.log(`Floor started for ${root} (pid ${child.pid}).`);
        console.log(urlFor(usePort, token));
        return;
      }
      if (exited !== null) break;
      await sleep(150);
    }
    const tail = (readText(join(desk, 'dashboard.log'), 1e6) || '').trim().split('\n').slice(-5).join('\n');
    console.error(`The floor did not come up on port ${usePort}${exited !== null ? ` (exit ${exited})` : ''}. Last log lines:\n${tail}`);
    try { process.kill(child.pid); } catch {}
    process.exit(1);
  }

  if (cmd === 'serve') {
    const usePort = port || config?.port || DEFAULT_PORT;
    const token = process.env.DESK_FLOOR_TOKEN || randomBytes(16).toString('hex');
    const startedAt = new Date().toISOString();
    const floor = createFloor({ root, desk, token, port: usePort, startedAt });
    try { await floor.listen(); } catch (e) {
      console.error(e.code === 'EADDRINUSE' ? `Port ${usePort} is in use. Pick another with --port N.` : `Could not listen: ${e.message}`);
      process.exit(1);
    }
    writeJsonAtomic(runtimeFile, { pid: process.pid, port: usePort, token, startedAt, project: root });
    log(desk, `serve start pid ${process.pid} port ${usePort}`);
    // Spawned by start: the token is already printed there, keep it out of the log file.
    console.log(process.env.DESK_FLOOR_TOKEN ? `Floor serving ${root} on port ${usePort}` : `Floor serving ${root} on ${urlFor(usePort, token)}`);
    const bye = () => {
      log(desk, `serve stop pid ${process.pid}`);
      floor.close().then(() => { try { if (readJson(runtimeFile, {})?.pid === process.pid) unlinkSync(runtimeFile); } catch {} process.exit(0); });
    };
    process.on('SIGINT', bye); process.on('SIGTERM', bye);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main().catch(e => { console.error(e.message); process.exit(1); });
