import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, symlinkSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
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
const { add: install, upsertBlock } = await import(pathToFileURL(bin).href);
const anthropic = () => ({ anthropic: { via: 'cli' } });
const add = options => install({ detectProviders: anthropic, ...options });

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
  mkdirSync(join(project, '.desk'), { recursive: true });
  writeFileSync(join(project, '.desk', 'project.json'), '{}\n');
  symlinkSync(bin, link);
  const out = execFileSync(process.execPath, [link, 'add', '--agent', 'codex', '--dir', project], { encoding: 'utf8' });
  assert.ok(out.includes('AGENTS.md: created'));
  assert.ok(existsSync(join(project, '.desk', 'project.json')));
  assert.ok(existsSync(join(project, '.agents', 'skills', 'desk', 'roles', 'ui-designer.md')));
});

const legacyFiles = JSON.parse(gunzipSync(readFileSync(join(here, 'fixtures', 'installed-1.0.0.json.gz'))));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestAt = dir => join(dir, '.desk', 'installed.json');
const skillAt = (dir, name) => join(dir, '.agents', 'skills', 'desk', name);
const tempProject = t => {
  const dir = mkdtempSync(join(tmpdir(), 'desk-upgrade-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const installLegacy = dir => {
  writeFileSync(join(dir, 'AGENTS.md'), '# My project\n');
  for (const [name, text] of Object.entries(legacyFiles)) {
    const file = skillAt(dir, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
};

test('npm 1.0.0 migration replaces every untouched brief without --force', t => {
  const dir = tempProject(t);
  installLegacy(dir);
  assert.equal(existsSync(manifestAt(dir)), false);
  const baseline = JSON.parse(readFileSync(join(dirname(bin), 'installed-1.0.0.json'), 'utf8'));
  assert.equal(Object.keys(legacyFiles).length, 64);
  assert.deepEqual(baseline.skills, Object.fromEntries(Object.entries(legacyFiles).map(([name, text]) => [name, digest(text)])));
  const result = add({ dir, agents: ['codex'], log: quiet });
  assert.deepEqual(result.skills.kept, []);
  assert.ok(result.skills.replaced > 0, 'the fixture must contain older briefs');
  const fresh = tempProject(t);
  add({ dir: fresh, agents: ['codex'], log: quiet });
  assert.deepEqual(snapshot(skillAt(dir, '')), snapshot(skillAt(fresh, '')));
  assert.deepEqual(JSON.parse(readFileSync(manifestAt(dir))), JSON.parse(readFileSync(manifestAt(fresh))));
  const before = snapshot(dir);
  const again = add({ dir, agents: ['codex'], log: quiet });
  assert.deepEqual(again.skills.kept, []);
  assert.equal(again.skills.replaced, 0);
  assert.deepEqual(snapshot(dir), before);
});

test('migration preserves real edits across repeated runs and --force resets their baseline', t => {
  const dir = tempProject(t);
  installLegacy(dir);
  const name = 'roles/content-designer.md';
  const edit = legacyFiles[name] + '\nMy project brief.\n';
  writeFileSync(skillAt(dir, name), edit);
  for (let i = 0; i < 2; i++) {
    const result = add({ dir, agents: ['codex'], log: quiet });
    assert.deepEqual(result.skills.kept, [name]);
    assert.equal(readFileSync(skillAt(dir, name), 'utf8'), edit);
    assert.equal(JSON.parse(readFileSync(manifestAt(dir))).skills[name], digest(legacyFiles[name]));
  }
  const forced = add({ dir, agents: ['codex'], force: true, log: quiet });
  assert.equal(forced.skills.replaced, 1);
  assert.deepEqual(forced.skills.kept, []);
  assert.equal(JSON.parse(readFileSync(manifestAt(dir))).skills[name], digest(readFileSync(skillAt(dir, name))));
  assert.equal(add({ dir, agents: ['codex'], log: quiet }).skills.replaced, 0);
});

test('a later package updates tracked files, restores missing files and keeps edits and unknown copies', async t => {
  const dir = tempProject(t);
  const pkg = join(dir, 'package');
  // An isolated package lets the test change a release without touching repo sources.
  cpSync(dirname(bin), join(pkg, 'bin'), { recursive: true });
  cpSync(join(ROOT, 'skills'), join(pkg, 'skills'), { recursive: true });
  cpSync(join(ROOT, 'adapters'), join(pkg, 'adapters'), { recursive: true });
  cpSync(join(ROOT, 'runner'), join(pkg, 'runner'), { recursive: true });
  const { add: packageInstall } = await import(pathToFileURL(join(pkg, 'bin', 'deskstudio.mjs')).href);
  const install = options => packageInstall({ detectProviders: anthropic, ...options });
  const project = join(dir, 'project');
  install({ dir: project, agents: ['codex'], log: quiet });
  const changed = 'roles/content-designer.md';
  const edited = 'roles/ui-designer.md';
  const unknown = 'roles/art-director.md';
  const removed = 'standards/deck.md';
  const before = JSON.parse(readFileSync(manifestAt(project)));
  writeFileSync(join(pkg, 'skills', 'desk', changed), '# New release brief\n');
  writeFileSync(skillAt(project, edited), 'My edited brief\n');
  writeFileSync(skillAt(project, unknown), 'An untracked local copy\n');
  delete before.skills[unknown];
  writeFileSync(manifestAt(project), JSON.stringify(before));
  rmSync(skillAt(project, removed));
  const result = install({ dir: project, agents: ['codex'], log: quiet });
  assert.equal(result.skills.replaced, 1);
  assert.equal(result.skills.written, 1);
  assert.deepEqual(result.skills.kept.sort(), [edited, unknown].sort());
  assert.equal(readFileSync(skillAt(project, changed), 'utf8'), '# New release brief\n');
  const after = JSON.parse(readFileSync(manifestAt(project)));
  assert.equal(after.skills[changed], digest('# New release brief\n'));
  assert.equal(after.skills[edited], before.skills[edited]);
  assert.equal(Object.hasOwn(after.skills, unknown), false);
  assert.equal(readFileSync(skillAt(project, edited), 'utf8'), 'My edited brief\n');
  assert.equal(readFileSync(skillAt(project, unknown), 'utf8'), 'An untracked local copy\n');
  const again = install({ dir: project, agents: ['codex'], log: quiet });
  assert.equal(again.skills.replaced, 0);
  assert.equal(again.skills.written, 0);
  assert.deepEqual(again.skills.kept.sort(), [edited, unknown].sort());
});

test('invalid manifests stop before changing installed files', t => {
  const dir = tempProject(t);
  installLegacy(dir);
  mkdirSync(join(dir, '.desk'));
  for (const text of ['{broken', '{"version":2,"skills":{}}', '{"version":1,"skills":{"SKILL.md":"invalid"}}']) {
    writeFileSync(manifestAt(dir), text);
    const before = snapshot(dir);
    assert.throws(() => add({ dir, agents: ['codex'], log: quiet }));
    assert.deepEqual(snapshot(dir), before);
  }
});
