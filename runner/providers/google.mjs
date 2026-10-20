// Google through Antigravity CLI, or the Gemini API when a key is set.
// agy 1.4.2 ignores plain stdin alongside --print. Stream-json carries the complete brief instead.
import { readFileSync, copyFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findOnPath, run, runSync, probeCli, scratch, firstLine, postJson } from './exec.mjs';

export const name = 'google';

export function detect() {
  const cli = probeCli('agy');
  // Ask the CLI, without reading or decrypting its credential store.
  const status = cli.works ? runSync(cli.path, ['models'], { timeoutMs: 20000 }) : null;
  const signedIn = status?.code === 0 && /^gemini-\S+/m.test(status.stdout);
  const keyEnv = ['GEMINI_API_KEY', 'GOOGLE_API_KEY'].find(k => process.env[k]);
  return {
    cli: { ...cli, signedIn, account: signedIn ? 'Antigravity account' : null },
    key: keyEnv || null,
    via: cli.works && signedIn ? 'cli' : keyEnv ? 'api' : null,
  };
}

export async function runCli({ model, system, prompt, images = [], timeoutMs = 15 * 60 * 1000 }) {
  const path = findOnPath('agy');
  if (!path) throw new Error('agy is not on PATH. Install Antigravity CLI and run agy to sign in.');
  const tmp = scratch('google');
  try {
    const copies = images.map((file, i) => {
      const dest = join(tmp.dir, `screenshot-${i + 1}.png`);
      copyFileSync(file, dest);
      return dest;
    });
    const refs = copies.map((file, i) => `Screenshot ${i + 1}: ${file}`).join('\n');
    let job = prompt;
    images.forEach((file, i) => {
      for (const source of new Set([file, file.split('\\').join('/')])) job = job.split(source).join(copies[i]);
    });
    const text = `# Your brief\n\n${system || ''}\n\n# The job\n\n${job}\n\nReturn every requested file in the response. Do not edit files, run commands, browse, or invoke other agents.`
      + (refs ? `\n\nThe only tool exception is view_file (or read_file): read every supplied screenshot before answering. These are image files, not text:\n${refs}` : '\n\nAnswer directly without tools.');
    const args = ['--input-format', 'stream-json', '--output-format', 'stream-json', '--model', model.cli || model.id,
      '--disable-slash-commands', '--print-timeout', `${timeoutMs}ms`];
    if (model.effort) args.push('--effort', model.effort);
    let result = null;
    const viewed = new Set();
    const imageKey = file => {
      let key = resolve(tmp.dir, file);
      try { key = realpathSync(key); } catch {}
      return process.platform === 'win32' ? key.toLowerCase() : key;
    };
    const r = await run(path, args, {
      input: JSON.stringify({ event: 'user', message: { content: text } }) + '\n', cwd: tmp.dir, timeoutMs,
      onLine(line) {
        let ev; try { ev = JSON.parse(line); } catch { return; }
        if (ev.event === 'result') result = ev.result;
        const step = ev.step_update;
        if (step?.state === 'DONE' && ['view_file', 'read_file'].includes(step.tool_name) && !step.tool_info?.error) {
          const file = step.tool_info?.parameters?.AbsolutePath || step.tool_info?.parameters?.Path;
          if (typeof file === 'string') viewed.add(imageKey(file));
        }
      },
    });
    if (r.timedOut) throw new Error(`agy did not answer within ${Math.round(timeoutMs / 1000)}s.`);
    if (!result) throw new Error(`agy gave no result event (exit ${r.code}): ${firstLine(r.stderr) || firstLine(r.stdout)}`);
    if (r.code !== 0) throw new Error(`agy failed (exit ${r.code}): ${result.error || firstLine(r.stderr) || result.status}`);
    if (result.status !== 'SUCCESS') throw new Error(`agy: ${result.error || result.status || 'unknown status'}`);
    if (copies.some(file => !viewed.has(imageKey(file)))) throw new Error('agy did not inspect every supplied screenshot. No visual sign-off was accepted.');
    const u = result.usage;
    return {
      text: String(result.response || ''),
      usage: u ? { input: u.input_tokens || 0, output: u.output_tokens || 0, cacheRead: u.cache_read_tokens || 0, cacheWrite: 0 } : null,
      costUsd: null, provider: name, model: model.cli || model.id, via: 'cli',
    };
  } finally { tmp.remove(); }
}

export async function runApi({ model, system, prompt, images, timeoutMs }) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set.');
  if (model.api === false) throw new Error(`${model.id} is an Antigravity model. For the Gemini API, choose google/pro or google/flash.`);
  const parts = [
    ...(images || []).map(f => ({ inline_data: { mime_type: 'image/png', data: readFileSync(f).toString('base64') } })),
    { text: prompt },
  ];
  const body = { contents: [{ role: 'user', parts }] };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.id)}:generateContent`;
  const json = await postJson(url, { 'x-goog-api-key': key }, body, timeoutMs);
  const cand = json.candidates?.[0];
  if (!cand) throw new Error(`gemini api returned no candidates${json.promptFeedback?.blockReason ? ` (${json.promptFeedback.blockReason})` : ''}.`);
  const text = (cand.content?.parts || []).filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('');
  const u = json.usageMetadata || {};
  const cached = u.cachedContentTokenCount || 0;
  return {
    text,
    usage: { input: Math.max(0, (u.promptTokenCount || 0) - cached), cacheRead: cached, cacheWrite: 0, output: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) },
    costUsd: null,
    provider: name, model: json.modelVersion || model.id, via: 'api',
  };
}
