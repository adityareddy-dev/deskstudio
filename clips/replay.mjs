// Replays a real job record at any moment of its run, through the same files the Manager writes.
// A record is a clip fixture (a .desk folder with events.jsonl and jobs/<id>/) or an eval golden (state.json and
// renders/ only, the events rebuilt from the desk runs in the state). at(record, T) gives the job as it stood at T:
// the desks that had started, the ones still working, the phase, the pick, proof, scores and cost reported by then.
// Nothing is invented: a figure shows only once the record has it, and a golden without per-desk prices shows no
// cost until the job's own total at the end.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const TIER_OF_MODEL = m => /opus|fable/.test(m) ? 'director' : /sonnet/.test(m) ? 'senior' : /haiku/.test(m) ? 'builder' : null;
const ms = t => Date.parse(t);
const readJson = f => JSON.parse(readFileSync(f, 'utf8'));
const readLines = f => existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];

// The phase a desk run belongs to, from its task, for records that have no job.phase events.
function phaseOfTask(task = '') {
  const t = task.toLowerCase();
  let m;
  if ((m = /polish round (\d+)/.exec(t))) return ['polish', Number(m[1])];
  if ((m = /sign-?off round (\d+)/.exec(t))) return ['signoff', Number(m[1])];
  if (/^pick|notes on|no pick/.test(t)) return ['pick', 0];
  if (/^rough|direction|brief|position|research|copy|outline|storyboard|structure|type|palette|mark|sting|motion|kit|compare|draft/.test(t)) return ['roughs', 0];
  return null;
}

export function loadRecord(dir, { job: wanted, skipControl = false } = {}) {
  let root, jobDir, state, events, rendersDir, outDir, extra = {};
  if (existsSync(join(dir, 'jobs'))) {
    const jobs = readdirSync(join(dir, 'jobs')).sort();
    const id = wanted || jobs[0];
    jobDir = join(dir, 'jobs', id);
    state = readJson(join(jobDir, 'state.json'));
    events = readLines(join(dir, 'events.jsonl'));
    rendersDir = join(jobDir, 'renders');
    outDir = join(dir, 'out', state.id || id);
    root = dir;
    for (const f of ['project.json', 'DESIGN.md', 'taste.md']) if (existsSync(join(dir, f))) extra[f] = readFileSync(join(dir, f));
    if (existsSync(join(jobDir, 'brief.md'))) extra.brief = readFileSync(join(jobDir, 'brief.md'));
  } else {
    state = readJson(join(dir, 'state.json'));
    rendersDir = join(dir, 'renders');
    outDir = null;
    root = dir;
    events = [];
  }
  const id = state.id;
  // Rebuild the event log from the desk runs when the record has none: a start and a stop per run, the phase changes
  // in between, and the pick, proof and score lines at the moments the state says they happened.
  if (!events.length) {
    const ev = [];
    ev.push({ t: state.startedAt, type: 'session.start', session: 'replay', source: 'replay' });
    ev.push({ t: state.startedAt, type: 'job.start', id, command: state.command, deliverable: state.deliverable });
    let agent = 0, last = null;
    const runs = [...(state.desks || [])].sort((a, b) => ms(a.startedAt) - ms(b.startedAt));
    for (const d of runs) {
      const p = phaseOfTask(d.task);
      if (p && (!last || p[0] !== last[0] || p[1] !== last[1])) { ev.push({ t: d.startedAt, type: 'job.phase', id, phase: p[0], round: p[1] }); last = p; }
      d._agent = `replay-${++agent}`;
      ev.push({ t: d.startedAt, type: 'desk.start', session: 'replay', desk: d.desk, agent: d._agent });
      if (d.status !== 'working') ev.push({ t: d.updatedAt, type: 'desk.stop', session: 'replay', desk: d.desk, agent: d._agent, model: d.model });
      const so = /sign-?off round (\d+)/i.exec(d.task || '');
      if (so) {
        const n = Number(so[1]);
        const pr = (state.proof || []).find(x => x.round === n);
        if (pr) ev.push({ t: d.startedAt, type: 'job.proof', id, round: n, pass: pr.pass, failures: pr.failures });
        const sc = (state.scores || []).find(x => x.round === n);
        if (sc) ev.push({ t: d.updatedAt, type: 'job.score', id, round: n, average: sc.average, pass: sc.pass });
      }
    }
    if (state.pick && state.pick.at) ev.push({ t: state.pick.at, type: 'job.pick', id, by: state.pick.by, rough: state.pick.rough });
    if (state.finishedAt) ev.push({ t: state.finishedAt, type: 'job.done', id });
    events = ev.sort((a, b) => ms(a.t) - ms(b.t));
  }
  events = events.filter(e => Number.isFinite(ms(e.t))).sort((a, b) => ms(a.t) - ms(b.t));
  // A clip that clicks the controls itself leaves the record's own control lines out, and starts the job on the
  // project's roles, the way it began.
  if (skipControl) {
    events = events.filter(e => !/^control\./.test(e.type) && !(e.type === 'job.phase' && e.phase === 'paused'));
    try { const p = JSON.parse(String(extra['project.json'])); if (p.models) state = { ...state, models: { director: p.models.director, senior: p.models.senior, builder: p.models.builder } }; } catch {}
  }
  // The state and the event log keep two clocks: the Manager writes a run into the state a few seconds before its
  // agent starts. The replay times each run by its agent's own start and stop lines, when the log has them.
  const claimed = new Set();
  for (const d of [...(state.desks || [])].sort((a, b) => ms(a.startedAt) - ms(b.startedAt))) {
    if (d._agent) continue;
    const start = events.find(e => e.type === 'desk.start' && e.desk === d.desk && !claimed.has(e) && ms(e.t) >= ms(d.startedAt) - 30000 && ms(e.t) <= ms(d.startedAt) + 120000);
    if (!start) continue;
    claimed.add(start);
    const stop = events.find(e => e.type === 'desk.stop' && e.agent && e.agent === start.agent);
    d.startedAt = start.t;
    if (stop && d.status !== 'working') d.updatedAt = stop.t;
  }
  // The renders the record holds, as rough-N and round-N folders.
  const renders = [];
  const scan = (base, rel) => { if (!existsSync(base)) return; for (const n of readdirSync(base)) { if (/^(rough|round)-\d+$/.test(n)) renders.push({ name: n, rel: rel ? `${rel}/${n}` : n, src: join(base, n) }); } };
  scan(rendersDir, ''); scan(join(rendersDir, 'roughs'), 'roughs');
  const out = outDir && existsSync(outDir) ? readdirSync(outDir).map(f => ({ name: f, src: join(outDir, f) })) : [];
  const t0 = Math.min(ms(state.startedAt), ...events.map(e => ms(e.t)));
  const t1 = Math.max(ms(state.finishedAt || state.updatedAt), ...events.map(e => ms(e.t)));
  return { root, id, final: state, events, renders, out, extra, t0, t1 };
}

// The job as it stood at T (ms since epoch, in the record's own time).
export function at(rec, T) {
  const F = rec.final;
  const done = F.finishedAt && T >= ms(F.finishedAt);
  const evs = rec.events.filter(e => ms(e.t) <= T);
  const runs = (F.desks || []).filter(d => ms(d.startedAt) <= T).map(d => {
    const fin = ms(d.updatedAt) <= T && d.status !== 'working';
    const { _agent, ...rest } = d;
    return fin ? rest : { ...rest, status: 'working', updatedAt: d.startedAt };
  });
  const lastT = evs.length ? evs.at(-1).t : F.startedAt;
  let phase = 'intake', round = 0;
  for (const e of evs) if (e.type === 'job.phase') { phase = e.phase; round = e.round ?? round; }
  if (done) { phase = F.phase; round = F.round; }
  const has = type => evs.filter(e => e.type === type);
  const proofRounds = new Set(has('job.proof').map(e => e.round));
  const scoreRounds = new Set(has('job.score').map(e => e.round));
  const picked = has('job.pick').length > 0 || done;
  // Cost and tokens by tier, the way the Manager adds them: from each priced desk.stop, by the model that ran.
  const stops = has('desk.stop');
  const priced = stops.some(e => typeof e.costUsd === 'number');
  let cost, tokens;
  if (done) { cost = F.cost; tokens = F.tokens; }
  else if (priced) {
    cost = { director: 0, senior: 0, builder: 0, total: 0, complete: true };
    tokens = { director: 0, senior: 0, builder: 0 };
    for (const e of stops) {
      const tier = TIER_OF_MODEL(String(e.model || ''));
      if (!tier || typeof e.costUsd !== 'number') continue;
      cost[tier] = Math.round((cost[tier] + e.costUsd) * 10000) / 10000;
      cost.total = Math.round((cost.total + e.costUsd) * 10000) / 10000;
      if (e.tokens && e.tokens.total) tokens[tier] += e.tokens.total;
    }
  }
  const state = {
    ...F, phase, round, desks: runs,
    pick: picked ? F.pick : null,
    proof: (F.proof || []).filter(p => done || proofRounds.has(p.round)),
    scores: (F.scores || []).filter(s => done || scoreRounds.has(s.round)),
    waitingOn: done ? F.waitingOn : null,
    cost, tokens,
    files: done ? F.files : {},
    updatedAt: done ? F.updatedAt : lastT
  };
  if (!done) delete state.finishedAt;
  if (cost === undefined) delete state.cost;
  if (tokens === undefined) delete state.tokens;
  // A rough shows once its run is done, a polish round once that round's polish is done.
  const finished = runs.filter(d => d.status !== 'working').map(d => String(d.task || '').toLowerCase());
  const roughDone = n => finished.some(t => new RegExp(`^rough ${n}\\b`).test(t)) || (picked && n <= 3) || done;
  const roundDone = n => finished.some(t => t.startsWith(`polish round ${n}`)) || done;
  const renders = rec.renders.filter(r => { const [, kind, n] = /^(rough|round)-(\d+)$/.exec(r.name); return kind === 'rough' ? roughDone(Number(n)) : roundDone(Number(n)); });
  const anyRough = renders.some(r => r.name.startsWith('rough'));
  const out = rec.out.filter(o => done || (/^rough-\d+\./.test(o.name) && anyRough));
  return { state, events: evs, renders, out };
}

// Shifts every time in the snapshot by `shift` ms, so the record's T reads as the page's now.
export function rebase(snap, shift) {
  const mv = t => { const v = ms(t); return Number.isFinite(v) ? new Date(v + shift).toISOString() : t; };
  const s = { ...snap.state };
  for (const k of ['startedAt', 'updatedAt', 'finishedAt']) if (s[k]) s[k] = mv(s[k]);
  s.desks = (s.desks || []).map(d => ({ ...d, startedAt: mv(d.startedAt), updatedAt: mv(d.updatedAt) }));
  if (s.pick && s.pick.at) s.pick = { ...s.pick, at: mv(s.pick.at) };
  return { ...snap, state: s, events: snap.events.map(e => ({ ...e, t: mv(e.t) })) };
}

// Writes a whole .desk folder for one snapshot.
export function writeDesk(desk, rec, snap) {
  const id = rec.id;
  mkdirSync(join(desk, 'jobs', id, 'renders'), { recursive: true });
  mkdirSync(join(desk, 'out', id), { recursive: true });
  for (const [f, buf] of Object.entries(rec.extra)) if (f !== 'brief') writeFileSync(join(desk, f), buf);
  if (rec.extra.brief) writeFileSync(join(desk, 'jobs', id, 'brief.md'), rec.extra.brief);
  writeFileSync(join(desk, 'jobs', id, 'state.json'), JSON.stringify(snap.state, null, 2));
  writeFileSync(join(desk, 'events.jsonl'), snap.events.map(e => JSON.stringify(e)).join('\n') + (snap.events.length ? '\n' : ''));
  for (const r of snap.renders) cpSync(r.src, join(desk, 'jobs', id, 'renders', r.rel), { recursive: true });
  for (const o of snap.out) cpSync(o.src, join(desk, 'out', id, o.name));
}

// Moves a .desk folder from one snapshot to the next: appends the new events, rewrites the state when it changed and
// lands the renders and files that became visible. Returns what changed.
export function advance(desk, rec, prev, snap) {
  const id = rec.id;
  const changed = { events: 0, state: false, renders: 0, out: 0 };
  const newEvents = snap.events.slice(prev.events.length);
  if (newEvents.length) { appendFileSync(join(desk, 'events.jsonl'), newEvents.map(e => JSON.stringify(e)).join('\n') + '\n'); changed.events = newEvents.length; }
  const a = JSON.stringify(prev.state), b = JSON.stringify(snap.state);
  if (a !== b) { writeFileSync(join(desk, 'jobs', id, 'state.json'), JSON.stringify(snap.state, null, 2)); changed.state = true; }
  const had = new Set(prev.renders.map(r => r.rel));
  for (const r of snap.renders) if (!had.has(r.rel)) { cpSync(r.src, join(desk, 'jobs', id, 'renders', r.rel), { recursive: true }); changed.renders++; }
  const hadOut = new Set(prev.out.map(o => o.name));
  for (const o of snap.out) if (!hadOut.has(o.name)) { cpSync(o.src, join(desk, 'out', id, o.name)); changed.out++; }
  return changed;
}

// Appends events to the log as they are.
export function appendEvents(desk, events) {
  if (events.length) appendFileSync(join(desk, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n') + '\n');
}
