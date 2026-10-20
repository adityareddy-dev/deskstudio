#!/usr/bin/env node
// Turns a job's .desk/events.jsonl into one OpenTelemetry trace and prints it as OTLP/JSON or posts it to a collector.
//
// Spans follow the GenAI semantic conventions at open-telemetry/semantic-conventions-genai 547934a (2026-10-18),
// which are in Development. Cost has no attribute there, so it goes in deskstudio.cost.usd.
//
//   node runner/otel.mjs [--project DIR | --events FILE] [--job ID | --all] [--endpoint URL]
//
// With no --endpoint and no OTEL_EXPORTER_OTLP_ENDPOINT the request body goes to stdout.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { resolveModel } from './models.mjs';
import { findDesk, ROOT } from './state.mjs';

const INTERNAL = 1, CLIENT = 3;
const OK = 1, ERROR = 2;
const PROVIDERS = { anthropic: 'anthropic', openai: 'openai', google: 'gcp.gemini' };

export function readEvents(file) {
  if (!existsSync(file)) return [];
  const out = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch {}
  }
  return out;
}

// Job ids in the order they started.
export function jobIds(events) {
  return [...new Set(events.filter(e => e.type === 'job.start' && e.id).map(e => e.id))];
}

// The events for one job. desk-run tags its desk events with the job id. In Claude Code the hooks don't
// know the job, so a desk belongs to the job whose start and done it falls between, in the same session.
export function jobEvents(events, id) {
  const start = events.find(e => e.type === 'job.start' && e.id === id);
  if (!start) return [];
  const t0 = Date.parse(start.t);
  const done = events.find(e => e.type === 'job.done' && e.id === id);
  const next = events.find(e => e.type === 'job.start' && e.id !== id && Date.parse(e.t) > t0);
  const t1 = done ? Date.parse(done.t) : next ? Date.parse(next.t) : Infinity;
  const sessions = new Set(events.filter(e => e.id === id && e.session).map(e => e.session));
  return events.filter(e => {
    if (e.id === id) return true;
    if (e.id || !e.agent) return false;
    const t = Date.parse(e.t);
    if (t < t0 || t > t1) return false;
    return !sessions.size || !e.session || sessions.has(e.session);
  });
}

function hex(seed, len) { return createHash('sha256').update(seed).digest('hex').slice(0, len); }
function nanos(ms) { return (BigInt(Math.round(ms)) * 1000000n).toString(); }

function attr(key, value) {
  if (typeof value === 'boolean') return { key, value: { boolValue: value } };
  if (typeof value === 'number') return Number.isInteger(value) ? { key, value: { intValue: String(value) } } : { key, value: { doubleValue: value } };
  return { key, value: { stringValue: String(value) } };
}

function attrs(obj) {
  return Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => attr(k, v));
}

function provider(spec, modelId) {
  const p = typeof spec === 'string' && spec.includes('/') ? spec.split('/')[0] : null;
  if (p) return PROVIDERS[p] || p;
  return /^claude/.test(String(modelId || '')) ? 'anthropic' : undefined;
}

function usd(v) { return typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : undefined; }

function requestModel(spec) {
  try { return resolveModel(spec).id; } catch { return spec || undefined; }
}

// Cache reads and writes count inside gen_ai.usage.input_tokens, as the conventions ask.
function usage(tokens) {
  if (!tokens) return {};
  const cacheRead = tokens.cacheRead || 0, cacheWrite = tokens.cacheWrite || 0;
  return {
    'gen_ai.usage.input_tokens': (tokens.input || 0) + cacheRead + cacheWrite,
    'gen_ai.usage.output_tokens': tokens.output || 0,
    'gen_ai.usage.cache_read.input_tokens': cacheRead || undefined,
    'gen_ai.usage.cache_write.input_tokens': cacheWrite || undefined,
  };
}

// One job, one trace: invoke_workflow at the root, invoke_agent per desk, a chat span per model call in
// desk-run, execute_tool per tool call in Claude Code and for the runner's proof pass.
export function buildTrace(events, id) {
  const evs = jobEvents(events, id).slice().sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  if (!evs.length) return null;
  const traceId = hex(`deskstudio:${id}`, 32);
  const spans = [];
  let n = 0;
  const span = (name, kind, parent, start, end, attributes, failed) => {
    const s = {
      traceId, spanId: hex(`${id}:${n++}`, 16), name, kind,
      startTimeUnixNano: nanos(start), endTimeUnixNano: nanos(Math.max(start, end)),
      attributes: attrs(attributes), status: failed ? { code: ERROR } : { code: OK },
    };
    if (parent) s.parentSpanId = parent.spanId;
    spans.push(s);
    return s;
  };

  const start = evs.find(e => e.type === 'job.start');
  const done = evs.find(e => e.type === 'job.done');
  const last = evs[evs.length - 1];
  const root = span(`invoke_workflow ${start.command || 'job'}`, INTERNAL, null, Date.parse(start.t), Date.parse((done || last).t), {
    'gen_ai.operation.name': 'invoke_workflow',
    'gen_ai.workflow.name': start.command,
    'deskstudio.job.id': id,
    'deskstudio.job.deliverable': start.deliverable,
    'deskstudio.job.rounds': done?.rounds,
    'deskstudio.job.pass': done?.pass,
  });
  if (!done) root.status = { code: 0 }; // still running or held, so unset

  const native = evs.some(e => e.type === 'desk.start' && e.agent);
  const totals = {};
  const count = (desk, tokens, costUsd) => {
    const t = totals[desk] ??= { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, costComplete: true };
    t.calls++;
    if (tokens) { t.input += tokens.input || 0; t.output += tokens.output || 0; t.cacheRead += tokens.cacheRead || 0; t.cacheWrite += tokens.cacheWrite || 0; }
    if (typeof costUsd === 'number') t.costUsd = usd(t.costUsd + costUsd); else t.costComplete = false;
  };

  if (native) {
    for (const stop of evs.filter(e => e.type === 'desk.stop' && e.agent)) {
      const begin = evs.find(e => e.type === 'desk.start' && e.agent === stop.agent);
      const t0 = Date.parse((begin || stop).t), t1 = Date.parse(stop.t);
      const model = Array.isArray(stop.model) ? stop.model[0] : stop.model;
      const agent = span(`invoke_agent ${stop.desk}`, INTERNAL, root, t0, t1, {
        'gen_ai.operation.name': 'invoke_agent',
        'gen_ai.agent.name': stop.desk,
        'gen_ai.agent.id': stop.agent,
        'gen_ai.provider.name': provider(null, model),
        'gen_ai.request.model': model,
        'gen_ai.conversation.id': stop.session,
        ...usage(stop.tokens),
        'deskstudio.cost.usd': usd(stop.costUsd),
      });
      count(stop.desk, stop.tokens, stop.costUsd);
      // PreToolUse is the only tool hook, so a tool span runs until the desk's next event.
      const mine = evs.filter(e => e.agent === stop.agent);
      mine.forEach((e, i) => {
        if (e.type !== 'desk.tool') return;
        const after = mine[i + 1];
        span(`execute_tool ${e.tool}`, INTERNAL, agent, Date.parse(e.t), Date.parse((after || e).t), {
          'gen_ai.operation.name': 'execute_tool',
          'gen_ai.tool.name': e.tool,
          'gen_ai.tool.type': 'function',
          'gen_ai.agent.name': e.desk,
          'gen_ai.conversation.id': e.session,
        });
      });
    }
  } else {
    const starts = evs.filter(e => e.type === 'desk.start');
    const used = new Set();
    for (const stop of evs.filter(e => e.type === 'desk.stop')) {
      const t1 = Date.parse(stop.t);
      const t0 = typeof stop.seconds === 'number' ? t1 - stop.seconds * 1000 : t1;
      // Parallel roughs share a desk name and start together, and seconds is rounded, so take the unused start
      // closest to where this call began and leave the task off when two starts are equally close.
      const near = starts.filter(s => s.desk === stop.desk && !used.has(s) && Date.parse(s.t) <= t1)
        .map(s => ({ s, d: Math.abs(Date.parse(s.t) - t0) })).sort((a, b) => a.d - b.d);
      const begin = near[0]?.s;
      const sure = near.length < 2 || near[1].d - near[0].d > 1000;
      if (begin) used.add(begin);
      const from = begin ? Date.parse(begin.t) : t0;
      const failed = stop.status === 'failed';
      const spec = stop.model || begin?.model;
      const reqModel = requestModel(spec);
      const agentName = stop.desk;
      const agent = span(`invoke_agent ${agentName}`, INTERNAL, root, from, t1, {
        'gen_ai.operation.name': 'invoke_agent',
        'gen_ai.agent.name': agentName,
        'gen_ai.request.model': reqModel,
        'deskstudio.desk.tier': stop.tier,
        'deskstudio.desk.task': sure ? begin?.task : undefined,
        'error.type': failed ? '_OTHER' : undefined,
      }, failed);
      span(`chat ${reqModel}`, CLIENT, agent, from, t1, {
        'gen_ai.operation.name': 'chat',
        'gen_ai.provider.name': provider(spec),
        'gen_ai.request.model': reqModel,
        'gen_ai.response.model': stop.modelId,
        'gen_ai.agent.name': agentName,
        ...usage(stop.tokens),
        'deskstudio.cost.usd': usd(stop.costUsd),
        'error.type': failed ? '_OTHER' : undefined,
      }, failed);
      count(agentName, stop.tokens, stop.costUsd);
    }
    // The briefs tell a desk to run proof and desk-run runs it for them after the reply.
    let proofFrom = null;
    for (const e of evs) {
      if (e.type === 'job.phase' && e.phase === 'proof') proofFrom = Date.parse(e.t);
      if (e.type === 'job.proof') {
        const t1 = Date.parse(e.t);
        span('execute_tool proof', INTERNAL, root, proofFrom ?? t1, t1, {
          'gen_ai.operation.name': 'execute_tool',
          'gen_ai.tool.name': 'proof',
          'gen_ai.tool.type': 'function',
          'deskstudio.proof.round': e.round,
          'deskstudio.proof.failures': e.failures,
        });
        proofFrom = null;
      }
    }
  }
  return { traceId, spans, desks: totals };
}

function packageVersion() {
  try { return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version; } catch { return undefined; }
}

// OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES apply as they would with an SDK.
export function resource(env = process.env) {
  const extra = {};
  for (const pair of String(env.OTEL_RESOURCE_ATTRIBUTES || '').split(',')) {
    const i = pair.indexOf('=');
    if (i > 0) extra[decodeURIComponent(pair.slice(0, i).trim())] = decodeURIComponent(pair.slice(i + 1).trim());
  }
  return { attributes: attrs({ 'service.version': packageVersion(), ...extra, 'service.name': env.OTEL_SERVICE_NAME || extra['service.name'] || 'deskstudio' }) };
}

export function toOtlp(traces, env = process.env) {
  return {
    resourceSpans: [{
      resource: resource(env),
      scopeSpans: [{ scope: { name: 'deskstudio', version: packageVersion() }, spans: traces.flatMap(t => t.spans) }],
    }],
  };
}

function endpoint(flag, env) {
  if (typeof flag === 'string') return flag;
  if (env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) return env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) return env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '') + '/v1/traces';
  return null;
}

function headers(env) {
  const out = { 'content-type': 'application/json' };
  for (const pair of String(env.OTEL_EXPORTER_OTLP_TRACES_HEADERS || env.OTEL_EXPORTER_OTLP_HEADERS || '').split(',')) {
    const i = pair.indexOf('=');
    if (i > 0) out[decodeURIComponent(pair.slice(0, i).trim())] = decodeURIComponent(pair.slice(i + 1).trim());
  }
  return out;
}

export async function main(argv = process.argv.slice(2), env = process.env, out = s => process.stdout.write(s + '\n')) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { flags[argv[i].slice(2)] = next; i++; } else flags[argv[i].slice(2)] = true;
  }
  const file = typeof flags.events === 'string' ? resolve(flags.events) : null;
  const deskDir = file ? null : findDesk(resolve(typeof flags.project === 'string' ? flags.project : process.cwd()), { create: false });
  if (!file && !deskDir) { process.stderr.write('No .desk/ here or above. Pass --project DIR or --events FILE.\n'); return 2; }
  const events = readEvents(file || join(deskDir, 'events.jsonl'));
  const ids = jobIds(events);
  const pick = flags.all ? ids : typeof flags.job === 'string' ? [flags.job] : ids.slice(-1);
  const traces = pick.map(id => buildTrace(events, id)).filter(Boolean);
  if (!traces.length) { process.stderr.write(`No job ${pick[0] || ''} in ${file || join(deskDir, 'events.jsonl')}.\n`); return 1; }
  const body = toOtlp(traces, env);
  const url = endpoint(flags.endpoint, env);
  if (!url) { out(JSON.stringify(body, null, 2)); return 0; }
  const res = await fetch(url, { method: 'POST', headers: headers(env), body: JSON.stringify(body) });
  if (!res.ok) { process.stderr.write(`${url} answered ${res.status}: ${(await res.text()).slice(0, 300)}\n`); return 1; }
  process.stderr.write(`${traces.reduce((n, t) => n + t.spans.length, 0)} spans in ${traces.length} trace${traces.length > 1 ? 's' : ''} sent to ${url}\n`);
  return 0;
}

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main().then(code => process.exit(code)).catch(e => { process.stderr.write(`otel: ${e.message}\n`); process.exit(1); });
}
