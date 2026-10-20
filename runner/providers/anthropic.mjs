// Anthropic through the claude CLI on a Claude plan, or the Messages API when ANTHROPIC_API_KEY is set.
//
// CLI flags used (claude 2.1.x, read from `claude --help` on 2026-10-18):
//   -p --verbose --model <alias|id> --input-format stream-json --output-format stream-json
//   --max-turns 1 --tools "" --no-session-persistence --setting-sources "" --system-prompt-file <file>
// The user message goes in on stdin as one stream-json line with base64 image blocks, the result event
// carries total_cost_usd and usage.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { findOnPath, run, runSync, probeCli, scratch, firstLine, postJson } from './exec.mjs';

export const name = 'anthropic';

export function detect() {
  const cli = probeCli('claude');
  let signedIn = false, account = null;
  if (cli.works) {
    const r = runSync(cli.path, ['auth', 'status'], { timeoutMs: 20000, env: childEnv() });
    try {
      const j = JSON.parse(r.stdout);
      signedIn = !!j.loggedIn;
      account = j.subscriptionType ? `${j.authMethod || 'account'}, ${j.subscriptionType} plan` : j.authMethod || null;
    } catch {
      signedIn = existsSync(join(homedir(), '.claude', '.credentials.json'));
    }
  }
  const keyEnv = ['ANTHROPIC_API_KEY'].find(k => process.env[k]);
  return { cli: { ...cli, signedIn, account }, key: keyEnv || null, via: cli.works && signedIn ? 'cli' : keyEnv ? 'api' : null };
}

function childEnv() {
  // A claude started from inside a Claude Code session refuses to nest unless these are gone.
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}

function imageBlocks(images) {
  return (images || []).map(file => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: readFileSync(file).toString('base64') } }));
}

export async function runCli({ model, system, prompt, images, cwd, timeoutMs }) {
  const path = findOnPath('claude');
  if (!path) throw new Error('claude is not on PATH.');
  const tmp = scratch('anthropic');
  try {
    const sysFile = tmp.file('system.md', system || '');
    const args = ['-p', '--verbose', '--model', model.cli || model.id, '--input-format', 'stream-json', '--output-format', 'stream-json',
      '--max-turns', '1', '--tools', '', '--no-session-persistence', '--setting-sources', '', '--system-prompt-file', sysFile];
    const message = { type: 'user', message: { role: 'user', content: [...imageBlocks(images), { type: 'text', text: prompt }] } };
    let result = null, assistantText = '';
    const r = await run(path, args, {
      input: JSON.stringify(message) + '\n', cwd, env: childEnv(), timeoutMs,
      onLine(line) {
        if (!line.trim()) return;
        let ev; try { ev = JSON.parse(line); } catch { return; }
        if (ev.type === 'result') result = ev;
        if (ev.type === 'assistant' && Array.isArray(ev.message?.content)) {
          for (const b of ev.message.content) if (b.type === 'text') assistantText += b.text;
        }
      },
    });
    if (r.timedOut) throw new Error(`claude did not answer within ${Math.round(timeoutMs / 1000)}s.`);
    if (!result) throw new Error(`claude gave no result event (exit ${r.code}). ${firstLine(r.stderr) || firstLine(r.stdout)}`);
    if (result.is_error || result.subtype?.startsWith('error')) throw new Error(`claude: ${result.result || result.subtype || 'unknown error'}`);
    const text = typeof result.result === 'string' && result.result.trim() ? result.result : assistantText;
    const used = result.modelUsage ? Object.keys(result.modelUsage)[0] : null;
    const u = result.usage || {};
    return {
      text,
      usage: { input: u.input_tokens || 0, output: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0 },
      costUsd: typeof result.total_cost_usd === 'number' ? result.total_cost_usd : null,
      provider: name, model: used || model.id, via: 'cli',
    };
  } finally { tmp.remove(); }
}

export async function runApi({ model, system, prompt, images, timeoutMs }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set.');
  const base = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
  const body = {
    model: model.id,
    max_tokens: 16000,
    system: system || undefined,
    messages: [{ role: 'user', content: [...imageBlocks(images), { type: 'text', text: prompt }] }],
  };
  const json = await postJson(`${base}/v1/messages`, { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body, timeoutMs);
  if (json.stop_reason === 'refusal') throw new Error('The model declined this request (stop_reason refusal).');
  const text = (json.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const u = json.usage || {};
  return {
    text,
    usage: { input: u.input_tokens || 0, output: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0 },
    costUsd: null, // priced by the caller from models.json
    provider: name, model: json.model || model.id, via: 'api',
  };
}
