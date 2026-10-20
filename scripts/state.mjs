#!/usr/bin/env node
// Keeps .desk/jobs/<id>/state.json current with one command per step, so the Manager never hand-edits JSON.
//   node state.mjs <jobdir> init command=design deliverable=social-card sizes=linkedin,ig-post quality=studio maxRounds=8 director=anthropic/opus senior=anthropic/sonnet builder=anthropic/haiku
//   node state.mjs <jobdir> set phase=polish round=2
//   node state.mjs <jobdir> desk ui-designer "polish round 1" working anthropic/haiku
//   node state.mjs <jobdir> desk ui-designer "polish round 1" done
//   node state.mjs <jobdir> pick art-director 2 "the only one that reads in two seconds"
//   node state.mjs <jobdir> proof 1 false 4
//   node state.mjs <jobdir> score 1 creative-director 8.1 false hierarchy=8 typography=7 ...
//   node state.mjs <jobdir> waiting approve_under_bar "Round 8 at 8.3, typography 7. Approve or send back?"   |  waiting none
//   node state.mjs <jobdir> file final=.desk/out/<id>/final.html
//   node state.mjs <jobdir> cost          (rolls up desk.stop events for this job into cost by tier)
//   node state.mjs <jobdir> done
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';

const [jobdirArg, cmd, ...rest] = process.argv.slice(2);
if (!jobdirArg || !cmd) { console.error('usage: state.mjs <jobdir> <init|set|desk|pick|proof|score|waiting|file|cost|done> ...'); process.exit(1); }
const jobdir = resolve(jobdirArg);
const file = join(jobdir, 'state.json');
const now = () => new Date().toISOString();
const num = v => (v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v);
const kv = args => Object.fromEntries(args.filter(a => a.includes('=')).map(a => { const i = a.indexOf('='); return [a.slice(0, i), num(a.slice(i + 1))]; }));

function load() {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}
function save(state) {
  state.updatedAt = now();
  mkdirSync(jobdir, { recursive: true });
  writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
}

let state = load();
if (cmd === 'init') {
  const o = kv(rest);
  state = {
    id: basename(jobdir), command: o.command || 'design', deliverable: o.deliverable || null,
    sizes: String(o.sizes || '').split(',').filter(Boolean), quality: o.quality || 'studio',
    models: { director: o.director || 'anthropic/opus', senior: o.senior || 'anthropic/sonnet', builder: o.builder || 'anthropic/haiku' },
    phase: 'intake', round: 0, maxRounds: Number(o.maxRounds) || 8,
    desks: [], pick: null, proof: [], scores: [], waitingOn: null,
    cost: { director: 0, senior: 0, builder: 0, total: 0, complete: true }, tokens: { director: 0, senior: 0, builder: 0 },
    files: {}, startedAt: now(),
  };
  save(state); console.log(`state: ${file}`); process.exit(0);
}
if (!state) { console.error(`no state at ${file}, run init first`); process.exit(1); }

switch (cmd) {
  case 'set': {
    for (const [k, v] of Object.entries(kv(rest))) state[k] = k === 'sizes' ? String(v).split(',') : v;
    break;
  }
  case 'desk': {
    const [desk, task, status, model] = rest;
    const existing = [...state.desks].reverse().find(d => d.desk === desk && d.task === task);
    if (existing) { if (status) existing.status = status; if (model) existing.model = model; existing.updatedAt = now(); }
    else state.desks.push({ desk, task, status: status || 'queued', model: model || null, startedAt: now() });
    break;
  }
  case 'pick': {
    const [by, rough, reason] = rest;
    state.pick = { by, rough: Number(rough), reason: reason || '', at: now() };
    break;
  }
  case 'proof': {
    const [round, pass, failures] = rest;
    state.proof.push({ round: Number(round), pass: pass === 'true', failures: Number(failures) || 0 });
    break;
  }
  case 'score': {
    const [round, by, average, pass, ...axes] = rest;
    state.scores.push({ round: Number(round), by, average: Number(average), pass: pass === 'true', axes: kv(axes) });
    break;
  }
  case 'waiting': {
    const [type, text] = rest;
    state.waitingOn = type === 'none' ? null : { type, text: text || '' };
    break;
  }
  case 'file': {
    Object.assign(state.files, kv(rest));
    break;
  }
  case 'cost': {
    // Roll up desk.stop events for this job: tokens and cost by tier, using the models in state.
    const deskFile = join(dirname(dirname(jobdir)), 'events.jsonl');
    // Match a run's model to a tier by family (opus, sonnet, haiku, fable, or a provider's own id), not by exact string.
    const family = m => { const s = String(m || '').toLowerCase(); for (const f of ['fable', 'opus', 'sonnet', 'haiku']) if (s.includes(f)) return f; return s.split('/').pop(); };
    const tierOf = {}; for (const [tier, m] of Object.entries(state.models)) if (typeof m === 'string') tierOf[family(m)] = tier;
    const tokens = { director: 0, senior: 0, builder: 0 }, cost = { director: 0, senior: 0, builder: 0 };
    let complete = true, seen = false;
    if (existsSync(deskFile)) {
      for (const line of readFileSync(deskFile, 'utf8').split('\n')) {
        let e; try { e = JSON.parse(line); } catch { continue; }
        if (e.type !== 'desk.stop' || !e.t || e.t < state.startedAt) continue;
        seen = true;
        if (!e.tokens) { complete = false; continue; }
        // Attribute by the model the desk ran on, mapped to the tier that uses it.
        const models = Array.isArray(e.model) ? e.model : [e.model];
        const tier = tierOf[family(models[0])] || e.tier || ({ 'creative-director': 'director', 'art-director': 'director', 'brand-strategist': 'director' })[e.desk] || 'builder';
        tokens[tier] += e.tokens.total || 0;
        if (typeof e.costUsd === 'number') cost[tier] += e.costUsd; else complete = false;
      }
    }
    state.tokens = tokens;
    state.cost = { ...cost, total: +(cost.director + cost.senior + cost.builder).toFixed(4), complete: complete && seen };
    for (const k of ['director', 'senior', 'builder']) state.cost[k] = +state.cost[k].toFixed(4);
    break;
  }
  case 'done': {
    state.phase = 'done'; state.waitingOn = null; state.finishedAt = now();
    break;
  }
  default:
    console.error(`unknown command ${cmd}`); process.exit(1);
}
save(state);
console.log(`${cmd}: ok`);
