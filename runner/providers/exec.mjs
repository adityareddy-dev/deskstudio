// Finds a CLI on PATH and runs it with a prompt on stdin. Windows .cmd shims go through cmd.exe.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { delimiter, join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const WIN = process.platform === 'win32';

export function findOnPath(name) {
  const dirs = (process.env.PATH || '').split(delimiter).filter(Boolean);
  const exts = WIN ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').map(e => e.toLowerCase()) : [''];
  for (const dir of dirs) {
    for (const ext of WIN ? ['', ...exts] : exts) {
      const file = join(dir, name + ext);
      try {
        if (existsSync(file) && statSync(file).isFile()) {
          if (WIN && ext === '' && !exts.includes(extname(file).toLowerCase())) continue; // a bare sh shim, not runnable from node
          return file;
        }
      } catch {}
    }
  }
  return null;
}

function quoteForCmd(a) {
  if (a === '') return '""';
  return /[\s"&|<>^()]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a;
}

// How to spawn: a .cmd or .bat needs cmd.exe, an .exe runs directly.
export function spawnSpec(file, args) {
  const ext = extname(file).toLowerCase();
  if (WIN && (ext === '.cmd' || ext === '.bat')) {
    const line = [quoteForCmd(file), ...args.map(quoteForCmd)].join(' ');
    return { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`], options: { windowsVerbatimArguments: true } };
  }
  return { command: file, args, options: {} };
}

// Runs and collects stdout and stderr. Resolves { code, stdout, stderr, timedOut }.
export function run(file, args, { input = null, cwd, env, timeoutMs = 15 * 60 * 1000, onLine = null } = {}) {
  const spec = spawnSpec(file, args);
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(spec.command, spec.args, { cwd, env: env || process.env, stdio: ['pipe', 'pipe', 'pipe'], ...spec.options });
    } catch (e) { return reject(e); }
    let stdout = '', stderr = '', timedOut = false, buffer = '';
    const timer = setTimeout(() => { timedOut = true; try { child.kill(); } catch {} }, timeoutMs);
    child.stdout.on('data', d => {
      const s = d.toString();
      stdout += s;
      if (onLine) {
        buffer += s;
        let i;
        while ((i = buffer.indexOf('\n')) >= 0) { onLine(buffer.slice(0, i)); buffer = buffer.slice(i + 1); }
      }
    });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => { clearTimeout(timer); if (onLine && buffer) onLine(buffer); resolve({ code, stdout, stderr, timedOut }); });
    if (input != null) child.stdin.end(input); else child.stdin.end();
  });
}

export function runSync(file, args, { input = null, cwd, env, timeoutMs = 30000 } = {}) {
  const spec = spawnSpec(file, args);
  const r = spawnSync(spec.command, spec.args, { cwd, env: env || process.env, input: input ?? undefined, encoding: 'utf8', timeout: timeoutMs, ...spec.options });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error || null };
}

// `name --version` works: { found, path, version, error }
export function probeCli(name, versionArgs = ['--version']) {
  const path = findOnPath(name);
  if (!path) return { found: false, path: null, version: null, error: `${name} is not on PATH` };
  const r = runSync(path, versionArgs, { timeoutMs: 20000 });
  if (r.code !== 0 || r.error) {
    const all = (r.stderr || r.stdout || String(r.error?.message || '')).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const first = all.find(l => /error|cannot|not found|missing|denied/i.test(l)) || all[0] || 'no output';
    return { found: true, works: false, path, version: null, error: `${name} is on PATH but "${name} ${versionArgs.join(' ')}" failed: ${first}` };
  }
  const version = /\d+\.\d+(?:\.\d+)?/.exec(r.stdout || r.stderr)?.[0] || 'unknown version';
  return { found: true, works: true, path, version, error: null };
}

// A scratch dir for the prompt files one call needs. Caller removes it.
export function scratch(prefix) {
  const dir = mkdtempSync(join(tmpdir(), `desk-${prefix}-`));
  return {
    dir,
    file(name, text) { const f = join(dir, name); writeFileSync(f, text); return f; },
    remove() { try { rmSync(dir, { recursive: true, force: true }); } catch {} },
  };
}

export function firstLine(s) {
  return String(s || '').split(/\r?\n/).find(l => l.trim())?.trim() || '';
}

export async function postJson(url, headers, body, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}: ${(json?.error?.message || json?.error?.type || text).toString().slice(0, 300)}`);
    return json;
  } finally { clearTimeout(t); }
}
