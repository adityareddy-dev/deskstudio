import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { add } from '../../packages/deskstudio/bin/deskstudio.mjs';
import { chooseDefaults, PRESETS } from '../models.mjs';
import { runJob } from '../run.mjs';

const quiet = () => {};
const temp = t => {
  const dir = mkdtempSync(join(tmpdir(), 'desk-install-models-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const projectFile = dir => join(dir, '.desk', 'project.json');

for (const [label, detected, expected] of [
  ['Codex and Antigravity, Claude signed out', { anthropic: { via: null }, openai: { via: 'cli' }, google: { via: 'cli' } },
    { director: 'openai/large', senior: 'openai/mini', builder: 'openai/nano' }],
  ['Antigravity alone', { google: { via: 'cli' } },
    { director: 'google/flash-high', senior: 'google/flash', builder: 'google/flash-low' }],
  ['Claude alone', { anthropic: { via: 'cli' } }, PRESETS.studio],
  ['Claude and Codex', { anthropic: { via: 'cli' }, openai: { via: 'cli' } }, PRESETS.studio],
]) {
  test(`fresh install uses doctor defaults at the first model call: ${label}`, async t => {
    const dir = temp(t);
    add({ dir, agents: ['codex'], log: quiet, detectProviders: options => {
      assert.equal(options.fresh, true);
      return detected;
    } });
    const cfg = JSON.parse(readFileSync(projectFile(dir), 'utf8'));
    assert.deepEqual(cfg.models, expected);
    assert.deepEqual(cfg.models, chooseDefaults(detected).models);
    assert.deepEqual(cfg.presets.studio, expected);
    assert.deepEqual(cfg.presets.best, PRESETS.best);
    assert.deepEqual(cfg.presets.thrifty, PRESETS.thrifty);
    const calls = [];
    const stop = new Error('stopped at the first model call');
    const result = await runJob({ command: 'design', ask: 'a launch card', project: dir, log: quiet,
      invoke: async ({ spec }) => { calls.push(spec); throw stop; } });
    assert.equal(result.error, stop);
    assert.deepEqual(result.state.models, expected, 'the active studio preset must not restore Anthropic');
    assert.deepEqual(calls, [expected.director]);
  });
}

test('existing explicit models and custom presets remain byte for byte, even with --force', t => {
  const dir = temp(t);
  mkdirSync(join(dir, '.desk'));
  const original = JSON.stringify({ quality: 'custom', models: { director: 'google/pro', senior: 'openai/mini', builder: 'google/flash' },
    presets: { custom: { director: 'openai/large', senior: 'google/flash', builder: 'openai/nano' } }, maxRounds: 3 }, null, 4) + '\n';
  writeFileSync(projectFile(dir), original);
  for (const force of [false, true]) {
    add({ dir, agents: ['codex'], force, log: quiet, detectProviders: () => { throw new Error('must not detect for an existing project'); } });
    assert.equal(readFileSync(projectFile(dir), 'utf8'), original);
  }
});

test('no provider stops before writing ready-to-run files and explains how to retry', t => {
  const dir = temp(t);
  assert.throws(() => add({ dir, agents: ['codex'], log: quiet, detectProviders: () => ({}) }),
    /No model provider is ready.*codex login.*rerun `deskstudio add`.*desk-run doctor/);
  assert.equal(existsSync(join(dir, '.desk')), false);
  assert.equal(existsSync(join(dir, 'AGENTS.md')), false);
});

test('the installer CLI detects a signed-in Codex without an API key', { skip: process.platform === 'win32' }, t => {
  const dir = temp(t);
  const tools = join(dir, 'bin');
  mkdirSync(tools);
  writeFileSync(join(tools, 'codex'), `#!${process.execPath}
if (process.argv[2] === '--version') console.log('codex-cli 0.163.0');
else if (process.argv.slice(2).join(' ') === 'login status') console.log('Logged in using ChatGPT');
else { console.error('unexpected model call'); process.exit(1); }
`, { mode: 0o755 });
  const env = { ...process.env, PATH: tools, HOME: dir, CODEX_HOME: dir };
  for (const name of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY']) delete env[name];
  const project = join(dir, 'project');
  const bin = new URL('../../packages/deskstudio/bin/deskstudio.mjs', import.meta.url);
  const out = execFileSync(process.execPath, [bin.pathname, 'add', '--agent', 'codex', '--dir', project], { env, encoding: 'utf8' });
  assert.match(out, /Project models: director openai\/large/);
  const cfg = JSON.parse(readFileSync(projectFile(project), 'utf8'));
  assert.deepEqual(cfg.models, { director: 'openai/large', senior: 'openai/mini', builder: 'openai/nano' });
  assert.deepEqual(cfg.presets.studio, cfg.models);
});
