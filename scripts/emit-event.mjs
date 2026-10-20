#!/usr/bin/env node
// Appends one event line to <project>/.desk/events.jsonl for the floor.
// Two ways in:
//   as a hook:    node emit-event.mjs --hook        (reads the hook JSON on stdin)
//   from a skill: node emit-event.mjs job.phase id=... phase=roughs round=0
// Only names, numbers and paths are recorded. Never prompt text, copy or notes.
// On SubagentStop it also reads the desk's own transcript to count tokens and price them at list price.
import { appendFileSync, existsSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 5 * 1024 * 1024;
const KEEP_LINES = 2000;
const here = dirname(fileURLToPath(import.meta.url));

function findDesk(start) {
  let dir = resolve(start);
  for (let i = 0; i < 4; i++) {
    if (existsSync(join(dir, '.desk'))) return join(dir, '.desk');
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

function append(deskDir, event) {
  const file = join(deskDir, 'events.jsonl');
  mkdirSync(deskDir, { recursive: true });
  try {
    if (existsSync(file) && statSync(file).size > MAX_BYTES) {
      const lines = readFileSync(file, 'utf8').trim().split('\n');
      writeFileSync(file, lines.slice(-KEEP_LINES).join('\n') + '\n');
    }
  } catch {}
  appendFileSync(file, JSON.stringify(event) + '\n');
}

function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function loadPrices() {
  try { return JSON.parse(readFileSync(join(here, 'prices.json'), 'utf8')); } catch { return null; }
}

function priceFor(prices, model) {
  if (!prices || !model) return null;
  if (prices.models[model]) return prices.models[model];
  const alias = prices.aliases?.[model];
  if (alias && prices.models[alias]) return prices.models[alias];
  const key = Object.keys(prices.models).find(k => model.startsWith(k));
  return key ? prices.models[key] : null;
}

// Sums usage from a subagent transcript, one count per message id, by model.
function usageFromTranscript(path) {
  if (!path || !existsSync(path)) return null;
  const byMessage = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    const m = e.message;
    if (!m || !m.usage || e.type !== 'assistant') continue;
    byMessage.set(m.id || `${e.uuid}`, { model: m.model, usage: m.usage });
  }
  const out = { byModel: {}, total: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  for (const { model, usage } of byMessage.values()) {
    const u = out.byModel[model] ??= { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
    u.input += usage.input_tokens || 0;
    u.cacheRead += usage.cache_read_input_tokens || 0;
    u.cacheWrite += usage.cache_creation_input_tokens || 0;
    u.output += usage.output_tokens || 0;
  }
  for (const u of Object.values(out.byModel)) {
    out.input += u.input; out.cacheRead += u.cacheRead; out.cacheWrite += u.cacheWrite; out.output += u.output;
  }
  out.total = out.input + out.cacheRead + out.cacheWrite + out.output;
  return byMessage.size ? out : null;
}

function costOf(tokens, prices) {
  if (!tokens || !prices) return null;
  let usd = 0;
  for (const [model, u] of Object.entries(tokens.byModel)) {
    const p = priceFor(prices, model);
    if (!p) return null;
    usd += (u.input * p.input + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite + u.output * p.output) / 1e6;
  }
  return +usd.toFixed(4);
}

function subagentTranscript(input) {
  if (input.agent_transcript_path && existsSync(input.agent_transcript_path)) return input.agent_transcript_path;
  const t = input.transcript_path;
  if (!t || !input.agent_id) return null;
  const candidates = [
    join(dirname(t), basename(t, '.jsonl'), 'subagents', `agent-${input.agent_id}.jsonl`),
    join(dirname(t), 'subagents', `agent-${input.agent_id}.jsonl`),
  ];
  return candidates.find(p => existsSync(p)) || null;
}

const args = process.argv.slice(2);
const now = new Date().toISOString();

if (args[0] === '--hook') {
  let input = {};
  try { input = JSON.parse(readStdin() || '{}'); } catch { process.exit(0); }
  const project = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const deskDir = findDesk(project);
  if (!deskDir) process.exit(0);
  const name = input.hook_event_name;
  const base = { t: now, session: input.session_id ? String(input.session_id).slice(0, 8) : undefined };
  const desk = () => String(input.agent_type || '').replace(/^desk:/, '');
  let event = null;
  switch (name) {
    case 'SessionStart':
      event = { ...base, type: 'session.start', source: input.source, agent: input.agent_type };
      break;
    case 'SessionEnd':
      event = { ...base, type: 'session.end', reason: input.reason };
      break;
    case 'SubagentStart':
      event = { ...base, type: 'desk.start', desk: desk(), agent: input.agent_id };
      break;
    case 'SubagentStop': {
      event = { ...base, type: 'desk.stop', desk: desk(), agent: input.agent_id };
      const tokens = usageFromTranscript(subagentTranscript(input));
      if (tokens) {
        const models = Object.keys(tokens.byModel);
        event.model = models.length === 1 ? models[0] : models;
        event.tokens = { total: tokens.total, input: tokens.input, cacheRead: tokens.cacheRead, cacheWrite: tokens.cacheWrite, output: tokens.output };
        const usd = costOf(tokens, loadPrices());
        if (usd !== null) event.costUsd = usd;
      }
      break;
    }
    case 'PreToolUse':
      if (!input.agent_type || !String(input.agent_type).startsWith('desk:')) process.exit(0);
      event = { ...base, type: 'desk.tool', desk: desk(), agent: input.agent_id, tool: input.tool_name };
      break;
    case 'Stop':
      event = { ...base, type: 'turn.stop' };
      break;
    default:
      process.exit(0);
  }
  append(deskDir, event);
  process.exit(0);
}

// From a skill: <type> key=value ...
const type = args[0];
if (!type) { console.error('usage: emit-event.mjs <type> key=value ...  |  --hook'); process.exit(1); }
const deskDir = findDesk(process.env.CLAUDE_PROJECT_DIR || process.cwd());
if (!deskDir) process.exit(0);
const event = { t: now, type };
for (const kv of args.slice(1)) {
  const i = kv.indexOf('=');
  if (i < 1) continue;
  const key = kv.slice(0, i);
  const raw = kv.slice(i + 1);
  event[key] = raw === 'true' ? true : raw === 'false' ? false : (raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw);
}
append(deskDir, event);
