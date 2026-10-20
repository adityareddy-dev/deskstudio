import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const bin = join(ROOT, 'packages', 'deskstudio', 'bin', 'deskstudio.mjs');
const quiet = () => {};

// The adapters must exist for the installer, the build step makes them.
if (!existsSync(join(ROOT, 'adapters', 'agents.md'))) {
  const { build } = await import(pathToFileURL(join(ROOT, 'scripts', 'build-adapters.mjs')).href);
  build({ log: quiet });
}
const { add, upsertBlock } = await import(pathToFileURL(bin).href);

const snapshot = dir => {
  const out = {};
  const walk = d => { for (const n of readdirSync(d, { withFileTypes: true })) { const f = join(d, n.name); if (n.isDirectory()) walk(f); else out[f.slice(dir.length)] = readFileSync(f, 'utf8'); } };
  walk(dir);
  return out;
};

test('upsertBlock keeps everything outside the markers', () => {
  const block = '<!-- desk:start -->\nnew\n<!-- desk:end -->';
  assert.equal(upsertBlock(null, block).text, block + '\n');
  const r = upsertBlock('# Mine\n\nkeep this\n', block);
  assert.equal(r.text, '# Mine\n\nkeep this\n\n' + block + '\n');
  const again = upsertBlock(r.text, block);
  assert.equal(again.changed, false);
  const updated = upsertBlock('top\n<!-- desk:start -->\nold stuff\n<!-- desk:end -->\nbottom\n', block);
  assert.equal(updated.text, 'top\n' + block + '\nbottom\n');
  assert.equal(updated.had, true);
});

test('add writes seeds, the skill copy and one block per host, and is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'desk-add-'));
  writeFileSync(join(dir, 'AGENTS.md'), '# My project\n\nRun the tests before you commit.\n');
  mkdirSync(join(dir, '.github'));
  writeFileSync(join(dir, '.github', 'copilot-instructions.md'), 'Use tabs.\n');
  const r = add({ dir, agents: ['codex', 'gemini', 'cursor', 'copilot', 'windsurf'], log: quiet });
  assert.deepEqual(r.seeds.map(s => `${s.name}:${s.status}`), ['project.json:written', 'taste.md:written', '.gitignore:written']);
  assert.ok(!existsSync(join(dir, '.desk', 'DESIGN.md')), 'no DESIGN.md placeholder');
  assert.ok(existsSync(join(dir, '.agents', 'skills', 'desk', 'SKILL.md')));
  assert.ok(existsSync(join(dir, '.agents', 'skills', 'desk', 'roles', 'art-director.md')));
  assert.ok(existsSync(join(dir, '.agents', 'skills', 'desk', 'standards', 'social-card.md')));
  const skill = readFileSync(join(dir, '.agents', 'skills', 'desk', 'SKILL.md'), 'utf8');
  assert.ok(!skill.includes('CLAUDE_PLUGIN_ROOT'), 'plugin paths rewritten for the copy');
  assert.ok(skill.includes('.agents/skills/desk/house-style.md'));
  assert.ok(skill.includes('npx --package deskstudio desk-proof'));
  const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
  assert.ok(agents.startsWith('# My project\n\nRun the tests before you commit.\n'), 'user content stays first');
  assert.equal((agents.match(/<!-- desk:start -->/g) || []).length, 1);
  assert.ok(agents.includes('npx --package deskstudio desk-run <command>'));
  const copilot = readFileSync(join(dir, '.github', 'copilot-instructions.md'), 'utf8');
  assert.ok(copilot.startsWith('Use tabs.\n'));
  assert.ok(copilot.includes('<!-- desk:end -->'));
  assert.ok(existsSync(join(dir, 'GEMINI.md')));
  const mdc = readFileSync(join(dir, '.cursor', 'rules', 'desk.mdc'), 'utf8');
  assert.ok(mdc.startsWith('---\ndescription:'), 'cursor rule has frontmatter');
  assert.ok(mdc.includes('alwaysApply: true'));
  assert.ok(existsSync(join(dir, '.windsurf', 'rules', 'desk.md')));
  for (const b of r.blocks) assert.ok(['created', 'block added'].includes(b.status), `${b.file} ${b.status}`);
  // second run changes nothing
  const before = snapshot(dir);
  const r2 = add({ dir, agents: ['codex', 'gemini', 'cursor', 'copilot', 'windsurf'], log: quiet });
  assert.deepEqual(snapshot(dir), before);
  assert.ok(r2.blocks.every(b => b.status === 'unchanged'));
  assert.ok(r2.seeds.every(s => s.status === 'kept'));
  assert.equal(r2.skills.written, 0);
  assert.equal(r2.skills.replaced, 0);
});

test('an edited copy of a brief is kept unless --force, and a stale block is updated in place', () => {
  const dir = mkdtempSync(join(tmpdir(), 'desk-add-'));
  writeFileSync(join(dir, 'GEMINI.md'), 'Mine above.\n<!-- desk:start -->\nold block\n<!-- desk:end -->\nMine below.\n');
  add({ dir, agents: ['gemini'], log: quiet });
  const gem = readFileSync(join(dir, 'GEMINI.md'), 'utf8');
  assert.ok(gem.startsWith('Mine above.\n<!-- desk:start -->\n## Desk Studio'));
  assert.ok(gem.endsWith('<!-- desk:end -->\nMine below.\n'));
  assert.ok(!gem.includes('old block'));
  const brief = join(dir, '.agents', 'skills', 'desk', 'roles', 'ui-designer.md');
  writeFileSync(brief, '# UI Designer\n\nmy edit\n');
  const r = add({ dir, agents: ['gemini'], log: quiet });
  assert.deepEqual(r.skills.kept, ['roles/ui-designer.md']);
  assert.equal(readFileSync(brief, 'utf8'), '# UI Designer\n\nmy edit\n');
  const f = add({ dir, agents: ['gemini'], force: true, log: quiet });
  assert.equal(f.skills.replaced, 1);
  assert.ok(readFileSync(brief, 'utf8').includes('## What you own'));
});

test('the CLI prints the plugin lines for claude and rejects an unknown agent', () => {
  const out = execFileSync(process.execPath, [bin, 'add', '--agent', 'claude', '--dir', mkdtempSync(join(tmpdir(), 'desk-add-'))], { encoding: 'utf8' });
  assert.ok(out.includes('/plugin marketplace add adityareddy-dev/deskstudio'));
  assert.ok(out.includes('/plugin install desk@deskstudio'));
  assert.throws(() => execFileSync(process.execPath, [bin, 'add', '--agent', 'nope', '--dir', mkdtempSync(join(tmpdir(), 'desk-add-'))], { encoding: 'utf8', stdio: 'pipe' }), /Unknown agent/);
});

test('the installer runs through an npm-style binary symlink', { skip: process.platform === 'win32' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'desk-npm-bin-'));
  const link = join(dir, 'deskstudio');
  const project = join(dir, 'project');
  symlinkSync(bin, link);
  const out = execFileSync(process.execPath, [link, 'add', '--agent', 'codex', '--dir', project], { encoding: 'utf8' });
  assert.ok(out.includes('AGENTS.md: created'));
  assert.ok(existsSync(join(project, '.desk', 'project.json')));
  assert.ok(existsSync(join(project, '.agents', 'skills', 'desk', 'roles', 'ui-designer.md')));
});
