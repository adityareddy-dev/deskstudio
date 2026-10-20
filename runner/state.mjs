// Job state on disk: .desk/, state.json, control.json, the inbox, project.json and the event log.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, renameSync, appendFileSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PRESETS, tierDefaults } from './models.mjs';

export const RUNNER_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT = dirname(RUNNER_DIR); // the plugin root (or the npm package root), holds skills/, proof/, scripts/

export const DEFAULT_PROJECT = {
  quality: 'studio',
  models: tierDefaults(),
  presets: { studio: { ...PRESETS.studio }, best: { ...PRESETS.best }, thrifty: { ...PRESETS.thrifty } },
  maxRounds: 8,
  framework: null,
  constraints: {},
};

// .desk/ in the directory or up to three parents, else created in the directory.
export function findDesk(start, { create = true } = {}) {
  let dir = resolve(start);
  for (let i = 0; i < 4; i++) {
    if (existsSync(join(dir, '.desk'))) return join(dir, '.desk');
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  if (!create) return null;
  const made = join(resolve(start), '.desk');
  mkdirSync(made, { recursive: true });
  return made;
}

export function readJson(file, fallback = null) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

// Written whole, through a temp file, so a reader never sees half a file.
export function writeJson(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, file);
}

export function readText(file, fallback = null) {
  try { return readFileSync(file, 'utf8'); } catch { return fallback; }
}

const STOP = new Set(['a', 'an', 'the', 'for', 'of', 'to', 'and', 'in', 'on', 'with', 'at', 'by', 'from', 'that', 'this', 'is', 'it', 'as', 'be', 'or', 'about', 'announcing', 'make', 'me', 'my', 'our', 'we', 'please', 'card']);

// <yyyymmdd-hhmm>-<slug>, slug three or four words from the ask.
export function jobId(ask, now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const words = String(ask).split(/copy\s*:/i)[0].toLowerCase().replace(/--\S+(\s+\S+)?/g, ' ').replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
  const slug = (words.slice(0, 4).length >= 3 ? words.slice(0, 4) : [...words, 'job', 'job', 'job'].slice(0, 3)).join('-');
  return `${stamp}-${slug}`;
}

export function jobPaths(deskDir, id) {
  const jobDir = join(deskDir, 'jobs', id);
  const outDir = join(deskDir, 'out', id);
  return {
    deskDir, jobDir, outDir,
    rendersDir: join(jobDir, 'renders'),
    inboxDir: join(jobDir, 'inbox'),
    stateFile: join(jobDir, 'state.json'),
    controlFile: join(jobDir, 'control.json'),
    briefFile: join(jobDir, 'brief.md'),
    brandFile: join(deskDir, 'DESIGN.md'),
    projectFile: join(deskDir, 'project.json'),
    tasteFile: join(deskDir, 'taste.md'),
    finalFile: join(outDir, 'final.html'),
    handbackFile: join(outDir, 'handback.md'),
  };
}

export function ensureJobDirs(paths) {
  for (const d of [paths.jobDir, paths.outDir, paths.rendersDir, paths.inboxDir]) mkdirSync(d, { recursive: true });
}

export function readProject(deskDir) {
  const file = join(deskDir, 'project.json');
  const existing = readJson(file);
  if (existing) return { ...DEFAULT_PROJECT, ...existing, models: { ...DEFAULT_PROJECT.models, ...(existing.models || {}) } };
  writeJson(file, DEFAULT_PROJECT);
  return { ...DEFAULT_PROJECT };
}

export function writeProject(deskDir, project) {
  writeJson(join(deskDir, 'project.json'), project);
}

export function readState(paths) {
  return readJson(paths.stateFile);
}

export function writeState(paths, state) {
  state.updatedAt = localIso();
  writeJson(paths.stateFile, state);
  return state;
}

// control.json: { paused, models, pick }. Missing file means nothing to do.
export function readControl(paths) {
  const c = readJson(paths.controlFile);
  return c && typeof c === 'object' ? c : {};
}

// A note from the user to one desk. Returned once, then deleted.
export function takeInbox(paths, desk) {
  const file = join(paths.inboxDir, `${desk}.md`);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8').trim();
  try { unlinkSync(file); } catch {}
  return text || null;
}

export function listInbox(paths) {
  try { return readdirSync(paths.inboxDir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')); } catch { return []; }
}

// Appends one event line through scripts/emit-event.mjs, the from-a-skill form. Names, numbers and paths only.
export function emit(projectDir, type, kv = {}) {
  const script = join(ROOT, 'scripts', 'emit-event.mjs');
  if (!existsSync(script)) return false;
  const args = [script, type, ...Object.entries(kv).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}=${v}`)];
  const r = spawnSync(process.execPath, args, { cwd: projectDir, env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir }, stdio: 'ignore', timeout: 10000 });
  return r.status === 0;
}

// Appends one event with nested fields (desk.stop carries tokens as an object), the same file and the same
// trim rule as scripts/emit-event.mjs, which only takes flat key=value pairs.
const EVENTS_MAX_BYTES = 5 * 1024 * 1024;
const EVENTS_KEEP_LINES = 2000;
export function emitRaw(projectDir, event) {
  const deskDir = findDesk(projectDir, { create: false });
  if (!deskDir) return false;
  const file = join(deskDir, 'events.jsonl');
  try {
    if (existsSync(file) && statSync(file).size > EVENTS_MAX_BYTES) {
      const lines = readFileSync(file, 'utf8').trim().split('\n');
      writeFileSync(file, lines.slice(-EVENTS_KEEP_LINES).join('\n') + '\n');
    }
  } catch {}
  appendFileSync(file, JSON.stringify({ t: new Date().toISOString(), ...event }) + '\n');
  return true;
}

// ISO with the local offset, the shape the skill uses.
export function localIso(d = new Date()) {
  const pad = n => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(off / 60))}:${pad(off % 60)}`;
}

export function rel(projectDir, file) {
  return relative(projectDir, file).split('\\').join('/');
}
