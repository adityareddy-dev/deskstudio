// Desk Studio dashboard. Plain JS, no build step.
// Reads /api/state, /api/jobs/:id and the /api/events stream. Writes controls through /api/control/:id.
(() => {
  'use strict';

  const TOKEN = new URLSearchParams(location.search).get('token') || '';
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KNOWN_MODELS = [
    'anthropic/opus', 'anthropic/sonnet', 'anthropic/haiku', 'anthropic/fable',
    'openai/large', 'openai/mini', 'openai/nano',
    'google/pro', 'google/flash', 'google/flash-lite',
    'xai/grok-4', 'xai/grok-4-fast'
  ];
  const TIERS = ['director', 'senior', 'builder'];
  const CLOSED = new Set(['done', 'stopped', 'failed', 'cancelled']);
  const STALE_MS = 2 * 60 * 60 * 1000;
  const WAITING = {
    approve_under_bar: 'Under the bar. Your call.',
    pick: 'The studio needs your pick.',
    cost_cap: 'Cost cap reached. Continue or stop.',
    question: 'The studio has a question.'
  };

  const S = {
    state: null, job: null, jobId: null,
    events: [], agents: new Map(), usage: [],
    conn: false, sheet: null, floorDrawn: false,
    renderAt: 0, renderTimer: null, refreshTimer: null, jobTimer: null
  };

  // A move (a lamp lighting, the ring drawing, the slabs filling) starts once per key. Renders replace the
  // markup, so each render passes the move's age back as a negative delay and it carries on where it was.
  const MOVES = new Map();
  function moveAge(key, fresh = true) {
    if (!MOVES.has(key)) MOVES.set(key, fresh ? Date.now() : 0);
    return Date.now() - MOVES.get(key);
  }
  // The pick ring, direction 2's hand-drawn oval drawn to the picked box: open, slightly irregular, clockwise
  // from the top arc a third in from the left, its last quarter drifting out so the end passes the start with
  // one stroke width of clear space. Drawn in pixels so the stroke and the overrun stay the same at any size.
  const RING_PAD = 24;
  const RING = '<svg class="ring" aria-hidden="true"><path pathLength="1"/></svg>';
  function ringPath(w, h) {
    const cx = w / 2 + RING_PAD, cy = h / 2 + RING_PAD, rx = w / 2 + 8, ry = h / 2 + 8;
    const a0 = -Math.PI / 2 - Math.atan2(w / 6, h / 2);
    const over = (w < 120 ? 8 : 12) / Math.max(rx, ry);
    const steps = 96, pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = a0 + t * (2 * Math.PI + over);
      const wob = 1 + 0.012 * Math.sin(3 * a + 1) + 0.008 * Math.sin(5 * a + 2);
      const drift = t > 0.75 ? (t - 0.75) / 0.25 * 8 : 0;
      pts.push(`${(cx + (rx * wob + drift) * Math.cos(a)).toFixed(1)} ${(cy + (ry * wob + drift) * Math.sin(a)).toFixed(1)}`);
    }
    return `M${pts.join('L')}`;
  }
  const ringSizer = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => entries.forEach(e => sizeRing(e.target))) : null;
  function sizeRing(frame) {
    const svg = frame.querySelector('.ring');
    const w = frame.offsetWidth, h = frame.offsetHeight;
    if (!svg || !w || !h) return;
    const W = w + RING_PAD * 2, H = h + RING_PAD * 2;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.firstChild.setAttribute('d', ringPath(w, h));
  }

  // ---------- helpers ----------

  const fmtElapsed = ms => {
    if (!(ms >= 0)) return '';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
    return `${Math.floor(h / 24)}d`;
  };
  const fmtTime = iso => {
    const t = Date.parse(iso);
    if (!t) return '';
    const d = new Date(t);
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
  };
  const money = n => {
    if (typeof n !== 'number' || !isFinite(n)) return '';
    if (n === 0) return '$0.00';
    return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
  };
  const fmtNum = n => typeof n === 'number' ? n.toLocaleString() : esc(n);
  const short = m => String(m || '').split('/').pop();
  const deskName = slug => (S.state?.desks?.desks.find(d => d.slug === slug) || {}).name || slug;
  const safeColor = v => /^#[0-9a-f]{3,8}$/i.test(String(v)) || /^[a-z]{3,20}$/i.test(String(v)) ? String(v) : '';

  function api(path, opts = {}) {
    const headers = Object.assign({ 'X-Desk-Token': TOKEN }, opts.headers || {});
    return fetch(path, Object.assign({}, opts, { headers })).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
      return data;
    });
  }
  const fileUrl = p => `/api/file?path=${encodeURIComponent(p)}&token=${encodeURIComponent(TOKEN)}`;

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  // ---------- data ----------

  async function loadState() {
    S.state = await api('/api/state');
    if (!S.jobId || !S.state.jobs.some(j => j.id === S.jobId)) S.jobId = S.state.active;
    await loadJob();
  }

  async function loadJob() {
    if (!S.jobId) { S.job = null; scheduleRender(); return; }
    try { S.job = await api(`/api/jobs/${encodeURIComponent(S.jobId)}`); }
    catch (e) { S.job = null; toast(e.message); }
    scheduleRender();
  }

  function refreshSoon() {
    clearTimeout(S.refreshTimer);
    S.refreshTimer = setTimeout(() => loadState().catch(e => toast(e.message)), 250);
  }
  function refreshJobSoon() {
    clearTimeout(S.jobTimer);
    S.jobTimer = setTimeout(() => loadJob(), 250);
  }

  async function control(body) {
    if (!S.jobId) throw new Error('No job selected');
    const r = await api(`/api/control/${encodeURIComponent(S.jobId)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    await loadJob();
    if (body.scope === 'default') refreshSoon();
    return r;
  }

  // ---------- events ----------

  function applyEvent(ev) {
    switch (ev.type) {
      case 'desk.start':
        S.agents.set(ev.agent || `${ev.desk}:${ev.t}`, { desk: ev.desk, t: Date.parse(ev.t) || Date.now(), session: ev.session, tools: 0, lastTool: null });
        break;
      case 'desk.stop':
        if (ev.agent && S.agents.has(ev.agent)) S.agents.delete(ev.agent);
        else for (const [k, a] of S.agents) if (a.desk === ev.desk) { S.agents.delete(k); break; }
        if (ev.desk && (ev.tokens || typeof ev.costUsd === 'number'))
          S.usage.push({ desk: ev.desk, t: Date.parse(ev.t) || 0, model: ev.model, tokens: ev.tokens && ev.tokens.total || 0, cost: typeof ev.costUsd === 'number' ? ev.costUsd : null });
        break;
      case 'desk.tool': {
        const a = ev.agent && S.agents.get(ev.agent);
        if (a) { a.tools++; a.lastTool = ev.tool; }
        break;
      }
      case 'session.end':
        for (const [k, a] of S.agents) if (a.session && a.session === ev.session) S.agents.delete(k);
        break;
    }
  }

  function liveByDesk() {
    const now = Date.now();
    const m = new Map();
    for (const a of S.agents.values()) {
      if (now - a.t > STALE_MS) continue;
      const e = m.get(a.desk) || { count: 0, since: a.t, tools: 0, lastTool: null };
      e.count++;
      e.since = Math.min(e.since, a.t);
      e.tools += a.tools;
      if (a.lastTool) e.lastTool = a.lastTool;
      m.set(a.desk, e);
    }
    return m;
  }

  // desk.stop events carry tokens and a list-price cost. Events have no job id, so the window is the job's own time span.
  function usageByDesk() {
    const st = S.job?.state;
    const m = new Map();
    if (!st) return m;
    const from = Date.parse(st.startedAt) || 0;
    const to = CLOSED.has(st.phase) ? (Date.parse(st.finishedAt || st.updatedAt) || Infinity) + 60000 : Infinity;
    for (const u of S.usage) {
      if (u.t < from || u.t > to) continue;
      const e = m.get(u.desk) || { runs: 0, tokens: 0, cost: 0, priced: true, models: new Set() };
      e.runs++;
      e.tokens += u.tokens;
      if (u.cost === null) e.priced = false; else e.cost += u.cost;
      if (u.model) for (const x of [].concat(u.model)) e.models.add(x);
      m.set(u.desk, e);
    }
    return m;
  }
  const tokensShort = n => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

  function modelsNow() {
    const p = S.state?.project?.models || {};
    const st = S.job?.state?.models || {};
    const c = S.job?.control?.models || {};
    const tier = t => c[t] || st[t] || p[t] || null;
    const desk = slug => (c.desks && c.desks[slug]) || (st.desks && st.desks[slug]) || (p.desks && p.desks[slug]) || null;
    const overrides = () => Object.assign({}, p.desks || {}, st.desks || {}, c.desks || {});
    return { tier, desk, overrides };
  }

  function modelOptions(current) {
    const set = new Set(KNOWN_MODELS);
    const p = S.state?.project || {};
    const add = v => { if (typeof v === 'string' && v.includes('/')) set.add(v); };
    for (const group of [p.models, S.job?.state?.models, S.job?.control?.models]) {
      if (!group) continue;
      for (const t of TIERS) add(group[t]);
      for (const v of Object.values(group.desks || {})) add(v);
    }
    for (const preset of Object.values(p.presets || {})) for (const t of TIERS) add(preset && preset[t]);
    add(current);
    return [...set].sort();
  }

  // ---------- render ----------

  function scheduleRender() {
    if (S.renderTimer) return;
    const wait = Math.max(0, 250 - (Date.now() - S.renderAt));
    S.renderTimer = setTimeout(() => { S.renderTimer = null; S.renderAt = Date.now(); render(); }, wait);
  }

  function render() {
    if (!S.state) return;
    renderHeader();
    renderBanner();
    renderJob();
    renderFloor();
    renderBoard();
    renderMemory();
    renderFeed();
  }

  function renderHeader() {
    const root = String(S.state.root || '').replace(/[\\/]+$/, '');
    $('#projectName').textContent = root.split(/[\\/]/).pop() || '';
    const sel = $('#jobSelect');
    const jobs = S.state.jobs;
    const html = jobs.length
      ? jobs.map(j => `<option value="${esc(j.id)}" ${j.id === S.jobId ? 'selected' : ''}>${esc(j.id)}${j.phase ? ` (${esc(j.phase)})` : ''}</option>`).join('')
      : '<option value="">no jobs yet</option>';
    if (sel.innerHTML !== html) sel.innerHTML = html;
    sel.disabled = !jobs.length;
  }

  function renderBanner() {
    const el = $('#banner');
    const w = S.job?.state?.waitingOn;
    if (!w || typeof w !== 'object') { el.hidden = true; el.innerHTML = ''; return; }
    const c = S.job.control || {};
    el.innerHTML = `<div><strong>${esc(WAITING[w.type] || 'Waiting on you.')}</strong>${w.text ? `<p>${esc(w.text)}</p>` : ''}
      ${c.approve ? '<p class="muted">You approved this. The Manager picks it up at the next step.</p>' : ''}
      ${c.sendBack ? '<p class="muted">You sent it back with notes. One more round follows.</p>' : ''}</div>
      <div class="banner-actions">
        <button data-act="approve" ${c.approve ? 'disabled' : ''}>${c.approve ? 'Approved' : 'Approve'}</button>
        <button class="ghost" data-act="sendback">Send back</button>
      </div>`;
    el.hidden = false;
  }

  function renderJob() {
    const el = $('#job');
    const job = S.job;
    if (!job) {
      el.innerHTML = `<div class="panel-head"><h2>Job</h2></div><p class="muted">${S.state.jobs.length ? 'Pick a job above.' : 'No jobs yet. Run /desk:design in this project and the dashboard fills in as the desks work.'}</p>`;
      return;
    }
    const st = job.state, c = job.control || {}, M = modelsNow();
    const phase = st.phase || 'unknown';
    const closed = CLOSED.has(phase);
    const started = Date.parse(st.startedAt);
    const ended = Date.parse(st.finishedAt || st.updatedAt);
    const held = [];
    if (c.paused) held.push('Holding at the next step. Continue when ready.');
    if (c.stop) held.push('Stop requested. The job ends at the next step.');
    if (c.pick) held.push(`Your pick: rough ${c.pick}. It overrides the Art Director at the pick step.`);
    if (c.approve) held.push('Approved by you.');
    if (c.sendBack) held.push('Sent back with your notes for one more round.');
    if (c.models) held.push('Roles changed for this job. They apply at each desk\'s next step.');
    if (job.controlError) held.push(`control.json cannot be read: ${job.controlError}`);
    const cost = st.cost || {};
    const overrides = M.overrides();
    const usage = usageByDesk();
    el.innerHTML = `
      <div class="panel-head"><h2>${esc(st.command || 'job')} <span class="muted">${esc(st.deliverable || '')}</span></h2><span class="id">${esc(st.id || S.jobId)}</span></div>
      <div class="facts">
        <div><span class="k">Phase</span><span class="v pill phase-${esc(phase)}">${esc(phase)}</span></div>
        <div><span class="k">Round</span><span class="v">${esc(st.round ?? 0)} of ${esc(st.maxRounds ?? '?')}</span></div>
        <div><span class="k">Quality</span><span class="v">${esc(st.quality || S.state.project?.quality || 'studio')}</span></div>
        <div><span class="k">Sizes</span><span class="v">${esc((st.sizes || []).join(', ') || 'none')}</span></div>
        <div><span class="k">${closed ? 'Took' : 'Running'}</span><span class="v" ${started && !closed ? `data-since="${started}"` : ''}>${started ? fmtElapsed((closed && ended ? ended : Date.now()) - started) : ''}</span></div>
        <div><span class="k">Updated</span><span class="v">${esc(fmtTime(st.updatedAt))}</span></div>
      </div>
      ${held.length ? `<ul class="held">${held.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      <div class="controls">
        ${c.paused
          ? '<button data-act="pause" data-v="false">Continue</button>'
          : `<button data-act="pause" data-v="true" ${closed ? 'disabled' : ''}>Pause at next step</button>`}
        <button class="danger ghost" data-act="stop" ${c.stop || closed ? 'disabled' : ''}>${c.stop ? 'Stop requested' : 'Stop job'}</button>
      </div>
      <h3>Roles</h3>
      <table class="seats">${TIERS.map(t => `<tr><td>${t}</td><td class="mono">${esc(M.tier(t) || 'default')}</td><td><button class="ghost small" data-act="tier" data-tier="${t}">Change</button></td></tr>`).join('')}</table>
      ${Object.keys(overrides).length ? `<p class="muted">Desk overrides: ${Object.entries(overrides).map(([k, v]) => `${esc(deskName(k))} on <span class="mono">${esc(v)}</span>`).join(', ')}</p>` : ''}
      <h3>Cost so far</h3>
      <table class="cost">
        ${TIERS.map(t => `<tr><td>${t}</td><td>${money(cost[t]) || '<span class="muted">none reported</span>'}</td></tr>`).join('')}
        <tr><td>total</td><td><strong>${money(cost.total) || '<span class="muted">none reported</span>'}</strong></td></tr>
      </table>
      ${costLineHtml(cost)}
      ${cost.complete === false ? '<p class="muted">Partial: some desks did not report usage, so this is a lower bound, not the total.</p>' : ''}
      ${st.tokens && typeof st.tokens === 'object' ? `<p class="muted">Tokens: ${Object.entries(st.tokens).map(([k, v]) => `${esc(k)} ${fmtNum(v)}`).join(', ')}</p>` : ''}
      ${usage.size ? `<table class="bydesk">${[...usage].sort((a, b) => b[1].cost - a[1].cost).map(([slug, u]) => `<tr><td>${esc(deskName(slug))}<span class="muted"> x${u.runs}</span></td><td class="mono muted">${tokensShort(u.tokens)}</td><td>${u.priced ? money(u.cost) : '<span class="muted">no price</span>'}</td></tr>`).join('')}</table>
      <p class="muted">Per desk, at list price, from what each desk reported when it stopped.</p>` : ''}
      <h3>Staffing</h3>
      <ul class="staff">${(st.desks || []).map(d => {
        const t0 = Date.parse(d.startedAt), t1 = Date.parse(d.updatedAt);
        const when = d.status === 'working' && t0 ? `<span class="mono muted" data-since="${t0}">${fmtElapsed(Date.now() - t0)}</span>`
          : (d.status === 'done' || d.status === 'failed') && t0 && t1 ? `<span class="mono muted">${fmtElapsed(t1 - t0)}</span>` : '';
        return `<li class="status-${esc(d.status || 'queued')}"><span class="dot"></span><strong>${esc(deskName(d.desk))}</strong><span class="task">${esc(d.task || '')}</span>${when}<span class="mono muted">${esc(short(d.model))}</span><span class="pill">${esc(d.status || '')}</span></li>`;
      }).join('') || '<li class="muted">No desks staffed yet.</li>'}</ul>
      ${job.inbox && job.inbox.length ? `<p class="muted">Notes waiting for: ${job.inbox.map(deskName).map(esc).join(', ')}.</p>` : ''}
      ${job.brief ? `<details class="brief"><summary>Brief</summary><pre>${esc(job.brief)}</pre></details>` : ''}`;
  }

  function renderFloor() {
    const el = $('#floor');
    const desks = S.state.desks;
    if (!desks) return;
    const live = liveByDesk();
    const usage = usageByDesk();
    const M = modelsNow();
    const working = new Map();
    for (const d of S.job?.state?.desks || []) {
      if (d.status !== 'working') continue;
      if (!working.has(d.desk)) working.set(d.desk, []);
      working.get(d.desk).push(d);
    }
    const jobOpen = !!S.job && !CLOSED.has(S.job.state.phase) && !(S.job.control && S.job.control.paused);
    let lit = live.size + (jobOpen ? 1 : 0);
    let html = `<div class="panel-head"><h2>Dashboard</h2><span class="muted">${lit} of ${desks.desks.length} desks lit</span></div>`;
    // One 7 by 6 dashboard in tier order, with the tiers and their roles listed above it.
    html += `<div class="tiers">${desks.tiers.map(tier => {
      const n = desks.desks.filter(d => d.tier === tier.id).length;
      const tierModel = tier.id === 'manager' ? 'session model' : (M.tier(tier.id) || tier.model);
      return `<div class="tier tier-${esc(tier.id)}"><span class="tier-slab"></span><h3>${esc(tier.name)}</h3><span class="muted">${n}</span><span class="tier-model" title="${esc(tierModel)}">${esc(tier.id === 'manager' ? tierModel : short(tierModel))}</span>${tier.id !== 'manager' ? `<button class="ghost small" data-act="tier" data-tier="${esc(tier.id)}">Change</button>` : ''}</div>`;
    }).join('')}</div><div class="desks">`;
    for (const tier of desks.tiers) {
      const list = desks.desks.filter(d => d.tier === tier.id);
      for (const d of list) {
        const l = live.get(d.slug);
        const w = working.get(d.slug) || [];
        const isManager = d.tier === 'manager';
        const override = isManager ? null : M.desk(d.slug);
        const model = isManager ? 'session' : (override || M.tier(d.tier) || tier.model);
        const isLit = !!l || (isManager && jobOpen);
        const stale = !l && w.length > 0;
        let task = w.map(x => x.task).filter(Boolean).join(', ');
        if (!task && l) task = l.lastTool ? `using ${l.lastTool}` : 'working';
        if (!task && isManager && jobOpen) task = `running ${S.job.state.phase || 'the job'}`;
        if (stale) task += ' (no live agent)';
        const since = l ? l.since : (isManager && jobOpen ? Date.parse(S.job.state.startedAt) : 0);
        const u = usage.get(d.slug);
        // A lamp that lights after the dashboard first drew lights with the entrance move; the first draw shows what is already lit.
        let lamp = -1;
        if (isLit) lamp = moveAge(`lamp:${d.slug}`, S.floorDrawn);
        else MOVES.delete(`lamp:${d.slug}`);
        const lighting = lamp >= 0 && lamp < 300;
        html += `<button type="button" class="desk${isLit ? ' lit' : ''}${lighting ? ' lighting' : ''}${stale ? ' stale' : ''}" ${lighting ? `style="--age:-${lamp}ms"` : ''} data-act="desk" data-slug="${esc(d.slug)}" aria-label="${esc(`${d.name}, ${tier.name}${isLit ? ', working' : ''}`)}" title="${esc(`${d.name}, ${tier.name}${d.owns ? `: ${d.owns}` : ''}`)}">
          <span class="unit" aria-hidden="true"><i class="lamp"></i><i class="slab"></i></span>
          <span class="desk-name">${esc(d.name).replace(/\//g, '/<wbr>')}</span>
          <span class="desk-model${override ? ' override' : ''}">${esc(short(model))}</span>
          ${task ? `<span class="desk-task">${esc(task)}</span>` : ''}
          ${u ? `<span class="desk-cost">${u.priced ? money(u.cost) : ''} ${tokensShort(u.tokens)} tok${u.runs > 1 ? `, ${u.runs} runs` : ''}</span>` : ''}
          ${isLit && since ? `<span class="desk-elapsed" data-since="${since}">${fmtElapsed(Date.now() - since)}</span>` : ''}
          ${l && l.count > 1 ? `<span class="desk-count">x${l.count}</span>` : ''}
        </button>`;
      }
    }
    html += '</div>';
    el.innerHTML = html;
    S.floorDrawn = true;
  }

  // The cost line: director, senior and builder as three segments of one line, measured against the next whole
  // dollar, so it grows as the desks report. A segment moves from where it was to where it is with the settle
  // move; the value it got to is kept once the move has finished, so a re-render mid-move carries on from there.
  const COSTLINE = new Map();
  function costLineHtml(cost) {
    const total = Number(cost.total) || 0;
    if (!(total > 0)) return '';
    const scale = Math.max(1, Math.ceil(total));
    const prev = COSTLINE.get(S.jobId) || {};
    const segs = TIERS.map(t => {
      const v = Number(cost[t]) || 0, from = prev[t] || 0;
      const age = v !== from ? moveAge(`cost:${S.jobId}:${t}:${v}`) : 1e9;
      const moving = age < 300;
      if (!moving) prev[t] = v;
      const pct = x => `${(x / scale * 100).toFixed(2)}%`;
      return `<span class="seg ${t}${moving ? ' grow' : ''}" style="--to:${pct(v)};--from:${pct(from)}${moving ? `;--age:-${age}ms` : ''}" title="${t} ${money(v)}"></span>`;
    });
    COSTLINE.set(S.jobId, prev);
    return `<div class="costline" aria-hidden="true">${segs.join('')}</div><div class="costline-scale"><span>$0</span><span>$${scale}</span></div>`;
  }

  function scoreHtml(s) {
    const axes = Object.entries(s.axes || {});
    // The slabs fill left to right, 60ms apart, the first time this round's scorecard shows.
    const age = moveAge(`fill:${S.jobId}:${s.round}`);
    return `<div class="scores">
      <p>Sign-off by ${esc(s.by || 'creative-director')}: average ${esc(s.average ?? '?')}, ${s.pass ? '<span class="ok">at the bar</span>' : '<span class="bad">under the bar</span>'}</p>
      ${axes.length ? `<div class="axes">${axes.map(([k, v], i) => {
        const n = Math.max(0, Math.min(10, Number(v) || 0));
        const delay = i * 60 - age;
        const filling = delay > -300;
        return `<div class="axis"><span class="axis-name">${esc(k)}</span><span class="bar"><span class="fill${n >= 8 ? '' : ' under'}${filling ? ' fill-in' : ''}" style="--v:${n / 10}${filling ? `;--age:${delay}ms` : ''}"></span></span><span class="axis-val${n >= 8 ? '' : ' bad'}">${esc(v)}</span></div>`;
      }).join('')}</div>` : ''}
      ${Array.isArray(s.notes) && s.notes.length ? `<ul class="notes">${s.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  function renderBoard() {
    const el = $('#board');
    const job = S.job;
    if (!job) { el.innerHTML = '<div class="panel-head"><h2>Review board</h2></div><p class="muted">Nothing to review yet.</p>'; return; }
    const st = job.state;
    const roughs = job.renders.filter(r => r.kind === 'rough');
    const rounds = job.renders.filter(r => r.kind === 'round');
    const prefSize = (st.sizes || [])[0];
    const mainImg = r => r.files.find(f => f.size === prefSize) || r.files[0];
    const userPick = job.control && job.control.pick;
    const pickN = userPick || (st.pick && st.pick.rough);
    const sizesHtml = r => `<span class="sizes">${r.files.map(f => `<a href="${fileUrl(f.path)}" target="_blank" rel="noopener">${esc(f.size)}</a>`).join('')}</span>`;
    const imgHtml = (r, alt) => {
      const img = r && mainImg(r);
      return img ? `<a href="${fileUrl(img.path)}" target="_blank" rel="noopener"><img src="${fileUrl(img.path)}" alt="${esc(alt)} at ${esc(img.size)}" loading="lazy"></a>` : '<div class="thumb-empty">no render yet</div>';
    };
    let html = `<div class="panel-head"><h2>Review board</h2><span class="muted">${roughs.length} rough${roughs.length === 1 ? '' : 's'}, ${rounds.length} polish round${rounds.length === 1 ? '' : 's'} rendered</span></div>`;

    html += '<h3>Roughs</h3>';
    if (!roughs.length) html += '<p class="muted">No roughs rendered yet.</p>';
    else {
      html += '<div class="thumbs">';
      for (const r of roughs) {
        const picked = pickN === r.n;
        const file = job.out.find(o => o.name === `rough-${r.n}.html` || o.name === `rough-${r.n}.svg`);
        const ring = picked ? moveAge(`ring:${S.jobId}:${r.n}`) : -1;
        const drawing = ring >= 0 && ring < 400;
        html += `<figure class="thumb${picked ? ' picked' : ''}"><div class="frame">${imgHtml(r, `rough ${r.n}`)}${picked ? RING.replace('class="ring"', `class="ring${drawing ? ' draw' : ''}"${drawing ? ` style="--age:-${ring}ms"` : ''}`) : ''}</div>
          <figcaption><span><strong>Rough ${r.n}</strong> ${picked ? `<span class="pill accent">picked by ${userPick ? 'you' : esc(st.pick?.by || 'art-director')}</span>` : ''}</span>
          ${sizesHtml(r)}
          <span class="thumb-actions">${file ? `<a class="btn ghost small" href="${fileUrl(file.path)}" target="_blank" rel="noopener">Open file</a>` : ''}<button class="small${picked ? ' ghost' : ''}" data-act="pick" data-n="${r.n}" ${picked ? 'disabled' : ''}>Pick this</button></span>
          </figcaption></figure>`;
      }
      html += '</div>';
    }
    if (st.pick && typeof st.pick === 'object') {
      html += `<div class="pick"><h3>The pick</h3><p><strong>Rough ${esc(st.pick.rough)}</strong> by ${esc(st.pick.by || 'art-director')}${st.pick.reason ? `. ${esc(st.pick.reason)}` : ''}</p>
        ${Array.isArray(st.pick.notes) && st.pick.notes.length ? `<ul class="notes">${st.pick.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div>`;
    }
    if (userPick) html += `<p class="muted">You picked rough ${esc(userPick)}. The Manager records it as your call at the pick step.</p>`;

    html += '<h3>Polish rounds</h3>';
    const proofBy = new Map((st.proof || []).map(p => [p.round, p]));
    const scoreBy = new Map((st.scores || []).map(s => [s.round, s]));
    const roundNs = [...new Set([...rounds.map(r => r.n), ...proofBy.keys(), ...scoreBy.keys()])].filter(n => Number.isFinite(n)).sort((a, b) => b - a);
    if (!roundNs.length) html += '<p class="muted">No polish rounds yet.</p>';
    for (const n of roundNs) {
      const r = rounds.find(x => x.n === n), p = proofBy.get(n), s = scoreBy.get(n);
      html += `<div class="round${n === roundNs[0] ? ' latest' : ''}">
        <div class="round-img">${imgHtml(r, `round ${n}`)}${r ? sizesHtml(r) : ''}</div>
        <div class="round-info"><h4>Round ${n}${n === roundNs[0] ? ' <span class="pill">latest</span>' : ''}</h4>
          ${p ? `<p class="proof ${p.pass ? 'ok' : 'bad'}">Proof: ${p.pass ? 'passed' : `${p.failures ?? '?'} failure${p.failures === 1 ? '' : 's'}`}</p>` : '<p class="proof muted">Proof: not run</p>'}
          ${s ? scoreHtml(s) : '<p class="muted">Sign-off: not scored</p>'}
        </div></div>`;
    }
    if (job.out.length) html += `<h3>Files</h3><p class="files">${job.out.map(o => `<a href="${fileUrl(o.path)}" target="_blank" rel="noopener">${esc(o.name)}</a>`).join('')}</p>`;
    el.innerHTML = html;
    ringSizer?.disconnect();
    for (const f of el.querySelectorAll('.frame')) if (f.querySelector('.ring')) { sizeRing(f); ringSizer?.observe(f); }
  }

  function renderMemory() {
    const el = $('#memory');
    const s = S.state, b = s.brand, p = s.project;
    let html = '<div class="panel-head"><h2>Memory</h2></div><h3>Brand</h3>';
    if (!b) html += '<p class="muted">No .desk/DESIGN.md yet. /desk:init writes one.</p>';
    else {
      const colors = b.colors && typeof b.colors === 'object' ? Object.entries(b.colors) : [];
      html += `<p><strong>${esc(b.name || 'unnamed brand')}</strong>${b.type && b.type.family ? ` <span class="muted">${esc(b.type.family)}</span>` : ''}</p>`;
      if (colors.length) html += `<div class="swatches">${colors.map(([k, v]) => `<span class="swatch"><i style="background:${esc(safeColor(v))}"></i>${esc(k)} <span class="mono muted">${esc(v)}</span></span>`).join('')}</div>`;
      const rest = Object.fromEntries(Object.entries(b).filter(([k]) => k !== 'name' && k !== 'colors'));
      if (Object.keys(rest).length) html += `<details><summary>Front matter</summary><pre>${esc(JSON.stringify(rest, null, 2))}</pre></details>`;
    }
    html += '<h3>project.json</h3>';
    if (s.projectError) html += `<p class="bad">${esc(s.projectError)}</p>`;
    else if (!p) html += '<p class="muted">No project.json yet. The defaults apply.</p>';
    else html += `<details open><summary>${esc(p.quality || 'studio')} quality, ${esc(p.maxRounds ?? 8)} rounds max</summary><pre>${esc(JSON.stringify(p, null, 2))}</pre></details>`;
    if (s.taste) html += `<h3>Taste</h3><details><summary>taste.md</summary><pre>${esc(s.taste)}</pre></details>`;
    el.innerHTML = html;
  }

  function evDetail(e) {
    const parts = [];
    for (const k of ['desk', 'tool', 'phase', 'round', 'rough', 'by', 'pass', 'failures', 'average', 'scope', 'director', 'senior', 'builder', 'paused', 'chars', 'reason', 'source', 'rounds', 'desks'])
      if (e[k] !== undefined) parts.push(`${k} ${e[k]}`);
    if (e.tokens && typeof e.tokens === 'object') parts.push(`${tokensShort(e.tokens.total || 0)} tok`);
    if (typeof e.costUsd === 'number') parts.push(money(e.costUsd));
    if (e.id && !/^desk\./.test(e.type)) parts.push(String(e.id).slice(0, 24));
    return parts.join(', ');
  }

  function renderFeed() {
    const el = $('#feed');
    const list = S.events.slice(-40).reverse();
    el.innerHTML = `<div class="panel-head"><h2>Events</h2><span class="muted">${S.events.length} loaded, names and numbers only</span></div>
      <ul class="events">${list.map(e => `<li><span class="mono muted">${fmtTime(e.t)}</span><span class="ev-type${String(e.type).startsWith('control.') ? ' control' : ''}">${esc(e.type)}</span><span class="muted">${esc(evDetail(e))}</span></li>`).join('') || '<li class="muted">Nothing yet.</li>'}</ul>`;
  }

  // ---------- sheet ----------

  function openSheet(kind, target) { S.sheet = { kind, target }; renderSheet(); }
  function closeSheet() { S.sheet = null; renderSheet(); }

  function modelForm(current, hasOverride) {
    const opts = modelOptions(current);
    return `<h3>Model</h3>
      <div class="row"><select id="modelSelect" aria-label="Model">${opts.map(m => `<option value="${esc(m)}" ${m === current ? 'selected' : ''}>${esc(m)}</option>`).join('')}<option value="__other">Other</option></select><input id="modelOther" type="text" placeholder="provider/model" hidden></div>
      <div class="row"><button data-act="model" data-scope="job" ${S.job ? '' : 'disabled'}>This job</button><button class="ghost" data-act="model" data-scope="default" ${S.job ? '' : 'disabled'}>Save as default</button>${hasOverride ? '<button class="ghost" data-act="model-clear">Use the tier model</button>' : ''}</div>
      <p class="muted">${S.job ? 'A running desk finishes its step first. The new role applies at the next step.' : 'Pick a job first. Without one there is nothing to write the change to.'}</p>`;
  }

  function renderSheet() {
    const el = $('#sheet');
    if (!S.sheet || !S.state) { el.hidden = true; el.innerHTML = ''; return; }
    const { kind, target } = S.sheet;
    const M = modelsNow();
    let title = '', body = '';
    if (kind === 'desk') {
      const d = S.state.desks.desks.find(x => x.slug === target);
      if (!d) return closeSheet();
      const tier = S.state.desks.tiers.find(t => t.id === d.tier) || {};
      const override = d.tier === 'manager' ? null : M.desk(d.slug);
      const current = d.tier === 'manager' ? 'session model' : (override || M.tier(d.tier) || tier.model);
      title = d.name;
      const u = usageByDesk().get(d.slug);
      body = `${d.owns ? `<p>Owns ${esc(d.owns)}.</p>` : ''}
        <p class="muted">${esc(tier.name)} tier. Now on <span class="mono">${esc(current)}</span>${d.tier === 'manager' ? '' : override ? ' (set for this desk)' : ' (the tier model)'}.</p>
        ${u ? `<p class="muted">On this job: ${u.runs} run${u.runs === 1 ? '' : 's'}, ${tokensShort(u.tokens)} tokens${u.priced ? `, ${money(u.cost)} at list price` : ''}${u.models.size ? ` on <span class="mono">${esc([...u.models].join(', '))}</span>` : ''}.</p>` : ''}
        ${d.tier === 'manager'
          ? '<p class="muted">The Design Manager runs in your own session on whatever model the session uses, so it has no role to change.</p>'
          : modelForm(current, !!override)}
        <h3>Note to this desk</h3>
        <p class="muted">Goes into this desk's next prompt on the job. The log records only that a note was left and its length.</p>
        <textarea id="noteText" rows="4" placeholder="headline up 24px, cut the second gradient" ${S.job ? '' : 'disabled'}></textarea>
        <div class="row"><button data-act="note" data-slug="${esc(d.slug)}" ${S.job ? '' : 'disabled'}>Send note</button></div>`;
    } else if (kind === 'tier') {
      const tier = S.state.desks.tiers.find(t => t.id === target);
      if (!tier) return closeSheet();
      const current = M.tier(target) || tier.model;
      title = `${tier.name} roles`;
      body = `<p class="muted">${esc(tier.note || '')} Now on <span class="mono">${esc(current)}</span>.</p>${modelForm(current, false)}`;
    } else if (kind === 'sendback') {
      title = 'Send back';
      body = `<p class="muted">The output goes back to the builder for one more round with these notes. Recorded as your call.</p>
        <textarea id="sendBackText" rows="5" placeholder="what to change"></textarea>
        <div class="row"><button data-act="sendback-go">Send back</button></div>`;
    }
    el.innerHTML = `<div class="sheet-head"><h2>${esc(title)}</h2><button class="ghost small" data-act="close">Close</button></div><div class="sheet-body">${body}</div>`;
    el.hidden = false;
  }

  // ---------- actions ----------

  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.act;
    try {
      switch (act) {
        case 'desk': openSheet('desk', btn.dataset.slug); break;
        case 'tier': openSheet('tier', btn.dataset.tier); break;
        case 'close': closeSheet(); break;
        case 'pause': {
          const on = btn.dataset.v === 'true';
          await control({ pause: on });
          toast(on ? 'Pausing at the next step' : 'Continuing');
          break;
        }
        case 'stop':
          if (confirm('Stop this job at the next step?')) { await control({ stop: true }); toast('Stop requested'); }
          break;
        case 'pick': {
          const n = Number(btn.dataset.n);
          if (confirm(`Pick rough ${n} yourself? This overrides the Art Director at the pick step.`)) { await control({ pick: n }); toast(`Picked rough ${n}`); }
          break;
        }
        case 'approve':
          if (confirm('Approve this output under the bar? It is recorded as your call.')) { await control({ approve: true }); toast('Approved'); }
          break;
        case 'sendback': openSheet('sendback'); break;
        case 'sendback-go': {
          const t = $('#sendBackText').value.trim();
          if (!t) return toast('Write what to change first');
          await control({ sendBack: { notes: t } });
          closeSheet();
          toast('Sent back with notes');
          break;
        }
        case 'note': {
          const t = $('#noteText').value.trim();
          if (!t) return toast('Write the note first');
          await control({ note: { desk: btn.dataset.slug, text: t } });
          $('#noteText').value = '';
          toast(`Note left for ${deskName(btn.dataset.slug)}`);
          break;
        }
        case 'model': {
          const sel = $('#modelSelect');
          const m = sel.value === '__other' ? $('#modelOther').value.trim() : sel.value;
          if (!/^[^\s/]+\/[^\s/]+$/.test(m)) return toast('A model looks like provider/model, for example anthropic/sonnet');
          const scope = btn.dataset.scope === 'default' ? 'default' : 'job';
          const { kind, target } = S.sheet;
          const models = kind === 'tier' ? { [target]: m } : { desks: { [target]: m } };
          await control({ models, scope });
          toast(scope === 'default' ? `Saved ${m} as the default` : `${m} for this job`);
          renderSheet();
          break;
        }
        case 'model-clear': {
          await control({ models: { desks: { [S.sheet.target]: null } }, scope: 'job' });
          toast('Back on the tier model for this job');
          renderSheet();
          break;
        }
      }
    } catch (err) { toast(err.message); }
  });

  document.addEventListener('change', e => {
    if (e.target.id === 'modelSelect') {
      const other = $('#modelOther');
      other.hidden = e.target.value !== '__other';
      if (!other.hidden) other.focus();
    } else if (e.target.id === 'jobSelect') {
      S.jobId = e.target.value || null;
      loadJob();
    }
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.sheet) closeSheet(); });

  // ---------- scheme ----------

  function applyScheme(s) {
    document.documentElement.dataset.scheme = s;
    $('#scheme').textContent = s === 'light' ? 'Dark' : 'Light';
    try { localStorage.setItem('desk-floor-scheme', s); } catch {}
  }
  $('#scheme').addEventListener('click', () => applyScheme(document.documentElement.dataset.scheme === 'light' ? 'dark' : 'light'));
  (() => {
    let s = 'dark';
    try { s = localStorage.getItem('desk-floor-scheme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); } catch {}
    applyScheme(s);
  })();

  // ---------- live ----------

  function setConn(on) {
    S.conn = on;
    const el = $('#conn');
    el.classList.toggle('on', on);
    el.title = on ? 'Live' : 'Not connected, retrying';
  }

  function connect() {
    const es = new EventSource(`/api/events?token=${encodeURIComponent(TOKEN)}`);
    es.addEventListener('hello', () => { S.events = []; S.agents = new Map(); S.usage = []; setConn(true); });
    es.addEventListener('ready', () => { scheduleRender(); });
    es.addEventListener('state', () => { refreshSoon(); });
    es.onmessage = ev => {
      let e;
      try { e = JSON.parse(ev.data); } catch { return; }
      S.events.push(e);
      if (S.events.length > 600) S.events.splice(0, S.events.length - 600);
      applyEvent(e);
      if (/^(job|control)\./.test(String(e.type))) refreshJobSoon();
      scheduleRender();
    };
    es.onerror = () => setConn(false);
  }

  setInterval(() => {
    const now = Date.now();
    for (const el of document.querySelectorAll('[data-since]')) {
      const t = Number(el.dataset.since);
      if (t) el.textContent = fmtElapsed(now - t);
    }
  }, 1000);

  function showNotice(msg) {
    const main = $('main');
    const n = document.createElement('section');
    n.className = 'notice';
    n.innerHTML = `<h2>Cannot open the dashboard</h2><p>${esc(msg)}</p>`;
    main.prepend(n);
  }

  if (!TOKEN) {
    showNotice('This page needs the token from the URL that start printed. Run /desk:dashboard status to see it again.');
  } else {
    loadState().then(connect).catch(e => showNotice(e.message));
  }
})();
