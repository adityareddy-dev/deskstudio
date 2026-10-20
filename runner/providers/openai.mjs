// OpenAI through the codex CLI on a ChatGPT plan, or the Responses API when OPENAI_API_KEY is set.
//
// CLI flags used (codex-cli 0.162.1, read from `codex exec --help` on 2026-10-18):
//   exec --json --skip-git-repo-check --ephemeral -s read-only -C <cwd> -m <model>
//   -c model_reasoning_effort="<level>" -o <file> [-i <png>]... -
// The prompt is read from stdin (the "-" argument). codex has no system prompt flag, so the brief goes
// first in the prompt under its own heading. --json prints JSONL: item.completed with an agent_message
// item carries the text, turn.completed carries usage {input_tokens, cached_input_tokens, output_tokens}.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { findOnPath, run, runSync, probeCli, scratch, firstLine, postJson } from './exec.mjs';

export const name = 'openai';

export function detect() {
  const cli = probeCli('codex');
  let signedIn = false, account = null;
  if (cli.works) {
    const r = runSync(cli.path, ['login', 'status'], { timeoutMs: 20000 });
    const out = (r.stdout + r.stderr).trim();
    signedIn = r.code === 0 && /logged in/i.test(out) && !/not logged in/i.test(out);
    account = signedIn ? firstLine(out) : null;
    if (!signedIn && existsSync(join(homedir(), '.codex', 'auth.json'))) account = 'auth.json present but login status says no';
  }
  const keyEnv = ['OPENAI_API_KEY'].find(k => process.env[k]);
  return { cli: { ...cli, signedIn, account }, key: keyEnv || null, via: cli.works && signedIn ? 'cli' : keyEnv ? 'api' : null };
}

export function composePrompt(system, prompt) {
  return system ? `# Your brief\n\n${system}\n\n# The job\n\n${prompt}` : prompt;
}

export async function runCli({ model, system, prompt, images, cwd, timeoutMs }) {
  const path = findOnPath('codex');
  if (!path) throw new Error('codex is not on PATH.');
  const tmp = scratch('openai');
  try {
    const lastFile = join(tmp.dir, 'last.md');
    const effort = process.env.DESK_OPENAI_EFFORT || 'medium';
    const args = ['exec', '--json', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-C', cwd || process.cwd(), '-m', model.cli || model.id,
      '-c', `model_reasoning_effort="${effort}"`, '-o', lastFile];
    for (const img of images || []) args.push('-i', img);
    args.push('-');
    let text = '', usage = null, failed = null;
    const r = await run(path, args, {
      input: composePrompt(system, prompt), cwd, timeoutMs,
      onLine(line) {
        if (!line.trim().startsWith('{')) return;
        let ev; try { ev = JSON.parse(line); } catch { return; }
        if (ev.type === 'item.completed' && ev.item?.type === 'agent_message' && typeof ev.item.text === 'string') text = ev.item.text;
        if (ev.type === 'turn.completed' && ev.usage) usage = ev.usage;
        if (ev.type === 'turn.failed') failed = ev.error?.message || 'turn failed';
      },
    });
    if (r.timedOut) throw new Error(`codex did not answer within ${Math.round(timeoutMs / 1000)}s.`);
    if (failed) throw new Error(`codex: ${failed}`);
    if (!text && existsSync(lastFile)) text = readFileSync(lastFile, 'utf8');
    if (!text) throw new Error(`codex gave no message (exit ${r.code}). ${firstLine(r.stderr)}`);
    // codex counts cached tokens inside input_tokens, so the uncached part is the difference.
    const cached = usage?.cached_input_tokens || 0;
    return {
      text,
      usage: usage ? { input: Math.max(0, (usage.input_tokens || 0) - cached), cacheRead: cached, cacheWrite: 0, output: (usage.output_tokens || 0) + (usage.reasoning_output_tokens || 0) } : null,
      costUsd: null, // priced by the caller from models.json
      provider: name, model: model.id, via: 'cli',
    };
  } finally { tmp.remove(); }
}

export async function runApi({ model, system, prompt, images, timeoutMs }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set.');
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const content = [
    ...(images || []).map(f => ({ type: 'input_image', image_url: `data:image/png;base64,${readFileSync(f).toString('base64')}` })),
    { type: 'input_text', text: prompt },
  ];
  const body = { model: model.id, instructions: system || undefined, input: [{ role: 'user', content }] };
  const json = await postJson(`${base}/responses`, { authorization: `Bearer ${key}` }, body, timeoutMs);
  let text = typeof json.output_text === 'string' ? json.output_text : '';
  if (!text) {
    for (const item of json.output || []) {
      if (item.type !== 'message') continue;
      for (const c of item.content || []) if (c.type === 'output_text' && c.text) text += c.text;
    }
  }
  const u = json.usage || {};
  const cached = u.input_tokens_details?.cached_tokens || 0;
  return {
    text,
    usage: { input: Math.max(0, (u.input_tokens || 0) - cached), cacheRead: cached, cacheWrite: 0, output: u.output_tokens || 0 },
    costUsd: null,
    provider: name, model: json.model || model.id, via: 'api',
  };
}
