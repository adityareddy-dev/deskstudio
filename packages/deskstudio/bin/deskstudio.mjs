#!/usr/bin/env node
// deskstudio add: put Desk Studio in front of a coding agent other than Claude Code.
//
//   deskstudio add [--dir DIR] [--agent codex|gemini|cursor|copilot|windsurf|opencode|claude|all] [--force]
//
// Writes .desk/ seed files (never DESIGN.md, the first job finds the brand), copies the desk skill
// (Manager, roles, standards, procedures) to .agents/skills/desk/, and writes or updates one marked block
// (<!-- desk:start --> to <!-- desk:end -->) in each host's instruction file. Nothing outside the markers is touched.
// --agent claude prints the plugin install lines instead.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, realpathSync, renameSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveRoot } from './root.mjs';

const runnerRoot = resolveRoot();
const { chooseDefaults } = await import(pathToFileURL(join(runnerRoot, 'runner', 'models.mjs')).href);
const { detect } = await import(pathToFileURL(join(runnerRoot, 'runner', 'providers', 'index.mjs')).href);

export const AGENT_FILES = {
  codex:    { file: 'AGENTS.md', adapter: 'agents.md' },
  opencode: { file: 'AGENTS.md', adapter: 'opencode.md' },
  gemini:   { file: 'GEMINI.md', adapter: 'gemini.md' },
  copilot:  { file: join('.github', 'copilot-instructions.md'), adapter: 'copilot.md' },
  cursor:   { file: join('.cursor', 'rules', 'desk.mdc'), adapter: 'cursor.mdc' },
  windsurf: { file: join('.windsurf', 'rules', 'desk.md'), adapter: 'windsurf.md' },
};
export const ALL_AGENTS = Object.keys(AGENT_FILES);
const START = '<!-- desk:start -->';
const END = '<!-- desk:end -->';

const SEED_PROJECT = {
  quality: 'studio',
  presets: {
    studio:  { director: 'anthropic/opus',   senior: 'anthropic/sonnet', builder: 'anthropic/haiku' },
    best:    { director: 'anthropic/fable',  senior: 'anthropic/opus',   builder: 'anthropic/sonnet' },
    thrifty: { director: 'anthropic/sonnet', senior: 'anthropic/haiku',  builder: 'anthropic/haiku' },
  },
  maxRounds: 8,
  framework: null,
  constraints: {},
};

const SEED_TASTE = `# Taste

What the user approved and rejected, with the notes. The Creative Director reads this on top of the standards.
Add to it by hand or with the taste command.
`;

const SEED_GITIGNORE = `# Desk Studio: job state and the event log stay local. Finished files in out/ are yours to commit.
events.jsonl
jobs/
renders/
dashboard.json
`;

// Replaces the block between the markers, or appends one. Returns { text, changed, created, had }.
export function upsertBlock(existing, block) {
  const body = block.trim();
  if (existing == null) return { text: body + '\n', changed: true, created: true, had: false };
  const s = existing.indexOf(START);
  const e = existing.indexOf(END);
  if (s >= 0 && e > s) {
    const before = existing.slice(0, s);
    const after = existing.slice(e + END.length);
    const text = before + body + after;
    return { text, changed: text !== existing, created: false, had: true };
  }
  const sep = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  return { text: existing + sep + body + '\n', changed: true, created: false, had: false };
}

// The block proper, with any file frontmatter (cursor's .mdc) kept out of the markers.
function splitAdapter(text) {
  const s = text.indexOf(START);
  return { head: s > 0 ? text.slice(0, s) : '', block: s >= 0 ? text.slice(s) : text };
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function installedHashes(file) {
  // Before manifests, add wrote these exact bytes from npm 1.0.0.
  const source = existsSync(file) ? file : new URL('./installed-1.0.0.json', import.meta.url);
  const manifest = JSON.parse(readFileSync(source, 'utf8'));
  if (manifest?.version !== 1 || !manifest.skills || typeof manifest.skills !== 'object' || Array.isArray(manifest.skills)
      || Object.values(manifest.skills).some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error(`Invalid install manifest: ${file}`);
  }
  return manifest.skills;
}

function copyTree(src, dst, { force, rewrite, previous, installed, root = dst }, report) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name), d = join(dst, name);
    if (statSync(s).isDirectory()) { copyTree(s, d, { force, rewrite, previous, installed, root }, report); continue; }
    const key = relative(root, d).split('\\').join('/');
    const text = rewrite(readFileSync(s, 'utf8'));
    const hash = sha256(text);
    if (!existsSync(d)) { writeFileSync(d, text); report.written++; installed[key] = hash; continue; }
    const current = readFileSync(d);
    if (current.equals(Buffer.from(text))) { report.same++; installed[key] = hash; continue; }
    if (force || sha256(current) === previous[key]) {
      writeFileSync(d, text);
      report.replaced++;
      installed[key] = hash;
    } else {
      report.kept.push(key);
      // Keep the old baseline, never adopt the user's edit on a later run.
      if (previous[key]) installed[key] = previous[key];
    }
  }
}

export function add({ dir = process.cwd(), agents = ALL_AGENTS, force = false, log = s => process.stdout.write(s + '\n'), detectProviders = detect } = {}) {
  const target = resolve(dir);
  const root = resolveRoot(join('skills', 'desk', 'SKILL.md'));
  const adaptersDir = resolveRoot(join('adapters', 'agents.md')) + '/adapters';
  const out = { seeds: [], skills: null, blocks: [] };

  if (agents.includes('claude')) {
    log('For Claude Code, install the plugin instead:');
    log('  /plugin marketplace add adityareddy-dev/deskstudio');
    log('  /plugin install desk@deskstudio');
    agents = agents.filter(a => a !== 'claude');
    if (!agents.length) return out;
  }

  for (const agent of agents) {
    if (!AGENT_FILES[agent]) throw new Error(`Unknown agent "${agent}". Agents: ${ALL_AGENTS.join(', ')}, claude, all.`);
  }

  const manifestFile = join(target, '.desk', 'installed.json');
  const previous = installedHashes(manifestFile);

  // 1. .desk/ seeds. Never DESIGN.md, the first job finds the brand in the project.
  const desk = join(target, '.desk');
  let projectSeed;
  if (!existsSync(join(desk, 'project.json'))) {
    const chosen = chooseDefaults(detectProviders({ fresh: true }));
    if (!chosen.models) throw new Error('No model provider is ready. Sign in with `codex login`, `claude auth login` or `agy`, then rerun `deskstudio add`. Run `desk-run doctor` to check provider access.');
    // The runner selects the studio preset before the top-level model map.
    projectSeed = { ...SEED_PROJECT, models: chosen.models, presets: { ...SEED_PROJECT.presets, studio: { ...chosen.models } } };
    log(`Project models: ${Object.entries(chosen.models).map(([tier, spec]) => `${tier} ${spec}`).join(', ')} (${chosen.reason})`);
  }
  mkdirSync(desk, { recursive: true });
  for (const [name, text] of [['project.json', JSON.stringify(projectSeed, null, 2) + '\n'], ['taste.md', SEED_TASTE], ['.gitignore', SEED_GITIGNORE]]) {
    const f = join(desk, name);
    if (existsSync(f)) { out.seeds.push({ name, status: 'kept' }); continue; }
    writeFileSync(f, text);
    out.seeds.push({ name, status: 'written' });
  }
  log(`.desk/: ${out.seeds.map(s => `${s.name} ${s.status}`).join(', ')}`);

  // 2. The desk skill for agents that read .agents/skills/. Paths inside point at the copy.
  const skillsDst = join(target, '.agents', 'skills', 'desk');
  const report = { written: 0, same: 0, replaced: 0, kept: [] };
  const rewrite = text => text
    .replace(/node "\$\{CLAUDE_PLUGIN_ROOT\}\/proof\/cli\.mjs"/g, 'npx --package deskstudio desk-proof')
    .replace(/node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/emit-event\.mjs"/g, 'npx --package deskstudio desk-event')
    .replace(/\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/desk/g, '.agents/skills/desk')
    .replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, '.agents/skills/desk');
  const installed = {};
  copyTree(join(root, 'skills', 'desk'), skillsDst, { force, rewrite, previous, installed }, report);
  writeFileSync(manifestFile + '.tmp', JSON.stringify({ version: 1, skills: installed }, null, 2) + '\n');
  renameSync(manifestFile + '.tmp', manifestFile);
  out.skills = report;
  log(`.agents/skills/desk/: ${report.written} written, ${report.same} unchanged, ${report.replaced} replaced${report.kept.length ? `, ${report.kept.length} kept as edited (${report.kept.join(', ')}), use --force to replace them` : ''}`);

  // 3. One marked block per host file.
  const done = new Set();
  for (const agent of agents) {
    const spec = AGENT_FILES[agent];
    if (done.has(spec.file)) continue;
    done.add(spec.file);
    const adapter = readFileSync(join(adaptersDir, spec.adapter), 'utf8');
    const { head, block } = splitAdapter(adapter);
    const file = join(target, spec.file);
    const existing = existsSync(file) ? readFileSync(file, 'utf8') : null;
    const r = upsertBlock(existing, block);
    let text = r.text;
    if (head && r.created) text = head + text; // a fresh .mdc gets its frontmatter
    if (r.changed) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); }
    const status = r.created ? 'created' : r.changed ? (r.had ? 'block updated' : 'block added') : 'unchanged';
    out.blocks.push({ agent, file: spec.file, status });
    log(`${spec.file.split('\\').join('/')}: ${status}`);
  }
  return out;
}

function parseArgv(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const n = argv[i + 1]; if (n !== undefined && !n.startsWith('--')) { out.flags[k] = out.flags[k] ? `${out.flags[k]},${n}` : n; i++; } else out.flags[k] = true; }
    else out._.push(a);
  }
  return out;
}

function usage() {
  return `deskstudio: put Desk Studio in front of your coding agent.

  deskstudio add [--dir DIR] [--agent ${ALL_AGENTS.join('|')}|claude|all] [--force]

Writes .desk/ seed files, copies the desk skill to .agents/skills/desk/, and adds one marked block to the
agent's instruction file. Run it again any time, it only touches what sits between its markers.`;
}

export async function main(argv = process.argv.slice(2)) {
  const { _, flags } = parseArgv(argv);
  if (_[0] !== 'add' || flags.help) { process.stdout.write(usage() + '\n'); return _[0] === undefined || flags.help ? (flags.help ? 0 : 2) : 2; }
  const list = flags.agent && flags.agent !== true ? String(flags.agent).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : ['all'];
  const agents = list.includes('all') ? [...ALL_AGENTS, ...(list.includes('claude') ? ['claude'] : [])] : list;
  try {
    add({ dir: typeof flags.dir === 'string' ? flags.dir : process.cwd(), agents, force: !!flags.force });
    return 0;
  } catch (e) { process.stderr.write(`deskstudio: ${e.message}\n`); return 1; }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main().then(c => process.exit(c));
