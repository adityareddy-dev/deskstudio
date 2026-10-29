// Desk Studio dashboard. Plain JS, no build step.
// Reads /api/state, /api/jobs/:id and the /api/events stream. Writes controls through /api/control/:id.
// The floor shows every desk as a small bot: asleep at rest, awake while an agent of that desk is working.
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
  // The rooms of the floor, one per tier, and the stations of the track a job moves along.
  const ROOMS = [
    ['manager', 'front', 'Front desk'],
    ['director', 'office', 'Directors’ office'],
    ['senior', 'seniors', 'Senior studio'],
    ['builder', 'workshop', 'Workshop']
  ];
  const STATIONS = ['Brief', 'Roughs', 'Pick', 'Polish', 'Proof', 'Sign-off', 'Done'];
  const STATION_OF = { intake: 0, brief: 0, roughs: 1, pick: 2, polish: 3, proof: 4, signoff: 5, 'sign-off': 5, handback: 6, done: 6 };
  const ICONS = [
    '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    '<rect x="3" y="7" width="10" height="13" rx="1.5"/><path d="M8 4h11.5a1.5 1.5 0 0 1 1.5 1.5V17"/>',
    '<path d="M5.5 9.5C7 4.5 17.5 3.5 19 9c1.4 5.2-4.5 10-9.8 8.6C4.9 16.4 3.6 12 6 9.2"/>',
    '<path d="M4 20l3.5-1 11-11-2.5-2.5-11 11zM14.5 5.5l2.5 2.5"/>',
    '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    '<path d="M9 4h6v5l3 3v3H6v-3l3-3zM5 19h14"/>',
    '<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>'
  ];
  const icon = i => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[i]}</svg>`;

  const S = {
    state: null, job: null, jobId: null,
    events: [], agents: new Map(), usage: [],
    conn: false, sheet: null, floorDrawn: false, showTools: false, round: null,
    renderAt: 0, renderTimer: null, refreshTimer: null, jobTimer: null
  };

  // A move (a bot waking, the ring drawing, the bars filling) starts once per key. Renders replace some markup, so
  // each render passes the move's age back as a negative delay and it carries on where it was.
  const MOVES = new Map();
  const clock = () => performance.now();
  function moveAge(key, fresh = true) {
    if (!MOVES.has(key)) MOVES.set(key, fresh ? clock() : -1e9);
    return clock() - MOVES.get(key);
  }
  // The pick ring: an open, slightly irregular hand-drawn oval round the picked box, clockwise from the top arc a
  // third in from the left, its last quarter drifting out so the end passes the start. Drawn in pixels.
  const RING_PAD = 24;
  const RING = '<svg class="ring" aria-hidden="true"><path pathLength="1"/></svg>';
  function ringPath(w, h) {
    const cx = w / 2 + RING_PAD, cy = h / 2 + RING_PAD, rx = w / 2 + 10, ry = h / 2 + 10;
    const a0 = -Math.PI / 2 - Math.atan2(w / 6, h / 2);
    const over = (w < 120 ? 8 : 12) / Math.max(rx, ry);
    const steps = 96, pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = a0 + t * (2 * Math.PI + over);
      const wob = 1 + 0.014 * Math.sin(3 * a + 1) + 0.009 * Math.sin(5 * a + 2);
      const drift = t > 0.75 ? (t - 0.75) / 0.25 * 9 : 0;
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

  // ---------- the bot ----------
  // Drawn by bots.js, styled by bots.css.
  const botHtml = (tier, state, seed) => window.DeskBots.html(tier, state, seed);
  const tierOf = slug => (S.state?.desks?.desks.find(d => d.slug === slug) || {}).tier || 'senior';

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
  const pickBy = by => by === 'user' ? 'you' : deskName(by || 'art-director');
  const safeColor = v => /^#[0-9a-f]{3,8}$/i.test(String(v)) || /^[a-z]{3,20}$/i.test(String(v)) ? String(v) : '';
  const tokensShort = n => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
  // Sets the markup only when it changed, so moves already running are left alone.
  const patch = (el, html) => { if (el._html !== html) { el._html = html; el.innerHTML = html; return true; } return false; };

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
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  // A figure that changes counts to its new value instead of jumping.
  function count(el, to, fmt) {
    const from = Number(el.dataset.v);
    el.dataset.v = to;
    if (!Number.isFinite(from) || from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
    const t0 = clock(), ms = 600;
    const step = () => {
      const k = Math.min(1, (clock() - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1 && Number(el.dataset.v) === to) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
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

  // Who is at work right now: a live agent from the event log, the Manager while the job is open, and a desk the
  // job's state still lists as working with no live agent behind it (shown half awake, marked as such).
  function whoIsWorking() {
    const live = liveByDesk();
    const st = S.job?.state;
    const working = new Map();
    for (const d of st?.desks || []) {
      if (d.status !== 'working') continue;
      if (!working.has(d.desk)) working.set(d.desk, []);
      working.get(d.desk).push(d);
    }
    const jobOpen = !!S.job && !CLOSED.has(st.phase) && !(S.job.control && S.job.control.paused) && st.phase !== 'paused';
    const out = new Map();
    for (const d of S.state.desks.desks) {
      const l = live.get(d.slug);
      const w = working.get(d.slug) || [];
      const isManager = d.tier === 'manager';
      const on = !!l || (isManager && jobOpen);
      const stale = !l && w.length > 0;
      let task = w.map(x => x.task).filter(Boolean).join(', ');
      if (!task && l) task = l.lastTool ? `using ${l.lastTool}` : 'working';
      if (!task && isManager && jobOpen) task = `running ${phaseWord(st.phase)}`;
      const since = l ? l.since : (isManager && jobOpen ? Date.parse(st.startedAt) : (stale ? Date.parse(w[0].startedAt) : 0));
      if (on || stale) out.set(d.slug, { on, stale: stale && !on, task, since, count: l ? l.count : w.length, tools: l ? l.tools : 0, lastTool: l ? l.lastTool : null });
    }
    return out;
  }
  const phaseWord = p => ({ intake: 'the brief', roughs: 'the roughs', pick: 'the pick', polish: 'the polish', proof: 'proof', signoff: 'the sign-off', handback: 'the handback' })[p] || p || 'the job';

  // ---------- render ----------

  function scheduleRender() {
    if (S.renderTimer) return;
    const wait = Math.max(0, 250 - (clock() - S.renderAt));
    S.renderTimer = setTimeout(() => { S.renderTimer = null; S.renderAt = clock(); render(); }, wait);
  }

  function render() {
    if (!S.state) return;
    renderHeader();
    renderBanner();
    renderJob();
    renderFloor();
    renderNow();
    renderFeed();
    renderBoard();
    renderLedger();
    renderMemory();
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
    if (!w || typeof w !== 'object') { el.hidden = true; patch(el, ''); return; }
    const c = S.job.control || {};
    patch(el, `<div class="tier-manager">${botHtml('manager', 'awake', 3)}</div><div class="say"><strong>${esc(WAITING[w.type] || 'Waiting on you.')}</strong>${w.text ? `<p>${esc(w.text)}</p>` : ''}
      ${c.approve ? '<p class="muted">You approved this. The Manager picks it up at the next step.</p>' : ''}
      ${c.sendBack ? '<p class="muted">You sent it back with notes. One more round follows.</p>' : ''}</div>
      <div class="banner-actions">
        <button class="go" data-act="approve" ${c.approve ? 'disabled' : ''}>${c.approve ? 'Approved' : 'Approve'}</button>
        <button class="ghost" data-act="sendback">Send back</button>
      </div>`);
    el.hidden = false;
  }

  // Where the job sits on the track. A paused or failed job keeps the station it stopped at.
  function stationOf(st) {
    let p = st.phase;
    if (p === 'paused' || p === 'failed' || p === 'stopped' || p === 'waiting' || p === 'cancelled' || !(p in STATION_OF)) {
      if (st.next && st.next in STATION_OF) p = st.next;
      else if (st.waitingOn?.type === 'pick') p = 'pick';
      else if (st.waitingOn?.type === 'approve_under_bar') p = 'signoff';
      else {
        const last = [...(st.desks || [])].reverse().find(d => d.task)?.task || '';
        p = /^rough/i.test(last) ? 'roughs' : /^pick/i.test(last) ? 'pick' : /^polish/i.test(last) ? 'polish' : /^sign/i.test(last) ? 'signoff' : 'intake';
      }
    }
    return STATION_OF[p] ?? 0;
  }

  function renderJob() {
    const el = $('#job');
    const job = S.job;
    if (!job) {
      el._built = false;
      patch(el, `<div class="empty-job tier-manager">${botHtml('manager', 'asleep', 1)}<div><h1>${S.state.jobs.length ? 'Pick a job above.' : 'No jobs yet.'}</h1><p class="muted">${S.state.jobs.length ? 'The floor shows the job you pick.' : 'Run /desk:design in this project and the floor fills in as the desks work.'}</p></div></div>`);
      return;
    }
    const st = job.state, c = job.control || {};
    const phase = st.phase || 'unknown';
    const closed = CLOSED.has(phase);
    const paused = !!c.paused || phase === 'paused';
    if (!el._built || el._jobId !== S.jobId) {
      el._built = true; el._jobId = S.jobId; el._html = null;
      el.innerHTML = `<div class="title"><h1 data-f="title"></h1><span class="id" data-f="id"></span><div class="controls" data-f="controls"></div></div>
        <div class="track" data-f="track"><div class="rail"></div><div class="rail-done"></div>
          ${STATIONS.map((s, i) => `<div class="station" style="--i:${i}"><span class="ico">${icon(i)}</span><span>${s}</span></div>`).join('')}
          <span class="ticket"><i></i><b data-f="ticket"></b></span></div>
        <div class="stats">
          <div class="stat"><span class="k">Round</span><span class="v" data-f="round"></span><span class="pips" data-f="pips"></span></div>
          <div class="stat score" data-f="scoreStat"><span class="k">Score</span><span class="v" data-f="score"></span><span class="s" data-f="scoreNote"></span></div>
          <div class="stat"><span class="k">Cost</span><span class="v" data-f="cost"></span><span class="minibar" data-f="minibar"><i class="director"></i><i class="senior"></i><i class="builder"></i></span></div>
          <div class="stat"><span class="k" data-f="timeK"></span><span class="v" data-f="time"></span><span class="s" data-f="updated"></span></div>
        </div>
        <ul class="held" data-f="held" hidden></ul>`;
    }
    const f = k => el.querySelector(`[data-f="${k}"]`);
    patch(f('title'), st.deliverable && st.deliverable !== st.command ? `${esc(st.command || 'job')} <span class="muted">${esc(st.deliverable)}</span>` : esc(st.command || st.deliverable || 'job'));
    f('id').textContent = st.id || S.jobId;
    patch(f('controls'), `${c.paused
      ? '<button class="go small" data-act="pause" data-v="false">Continue</button>'
      : `<button class="ghost small" data-act="pause" data-v="true" ${closed ? 'disabled' : ''}>Pause at next step</button>`}
      <button class="danger ghost small" data-act="stop" ${c.stop || closed ? 'disabled' : ''}>${c.stop ? 'Stop requested' : 'Stop job'}</button>`);

    // the track
    const track = f('track');
    const pos = stationOf(st);
    const flagged = phase === 'failed' || phase === 'stopped' || phase === 'cancelled';
    track.classList.toggle('closed', closed);
    track.classList.toggle('paused', paused);
    track.style.setProperty('--pos', pos);
    track.querySelectorAll('.station').forEach((s, i) => {
      s.classList.toggle('done', i < pos || (i === pos && phase === 'done'));
      s.classList.toggle('here', i === pos && phase !== 'done');
      s.classList.toggle('flag', i === pos && flagged);
    });
    const ticket = track.querySelector('.ticket');
    if (el._pos !== undefined && el._pos !== pos) { ticket.classList.remove('moving'); void ticket.offsetWidth; ticket.classList.add('moving'); }
    el._pos = pos;
    const label = paused ? 'paused' : flagged ? phase : phase === 'done' ? 'done' : st.round ? `round ${st.round}` : (st.deliverable || st.command || 'job');
    f('ticket').textContent = label;

    // the four numbers
    f('round').innerHTML = `${esc(st.round ?? 0)} <small>of ${esc(st.maxRounds ?? '?')}</small>`;
    const maxR = Math.min(12, Number(st.maxRounds) || 0), r = Number(st.round) || 0;
    patch(f('pips'), Array.from({ length: maxR }, (_, i) => `<i class="${i < r ? 'on' : ''}${i === r - 1 ? ' last' : ''}"></i>`).join(''));
    const scores = Array.isArray(st.scores) ? st.scores : [];
    const last = scores.length ? scores.reduce((a, b) => (b.round ?? 0) >= (a.round ?? 0) ? b : a) : null;
    const sv = f('score'), stat = f('scoreStat');
    stat.classList.toggle('pass', !!last && !!last.pass);
    stat.classList.toggle('under', !!last && !last.pass);
    if (last && Number.isFinite(Number(last.average))) count(sv, Number(last.average), v => v.toFixed(1));
    else { sv.textContent = '–'; delete sv.dataset.v; }
    f('scoreNote').textContent = last ? `round ${last.round}, ${last.pass ? 'at the bar' : 'under the bar'}` : 'not scored yet';
    const cost = st.cost || {};
    const total = Number(cost.total) || 0;
    const cv = f('cost');
    if (typeof cost.total === 'number') count(cv, total, v => money(v)); else { cv.textContent = '–'; delete cv.dataset.v; }
    const mb = f('minibar');
    for (const t of TIERS) mb.querySelector(`.${t}`).style.setProperty('--w', total > 0 ? `${((Number(cost[t]) || 0) / total * 100).toFixed(2)}%` : '0%');
    mb.title = TIERS.map(t => `${t} ${money(Number(cost[t]) || 0)}`).join(', ');
    const started = Date.parse(st.startedAt), ended = Date.parse(st.finishedAt || st.updatedAt);
    f('timeK').textContent = closed ? 'Took' : 'Running';
    const tv = f('time');
    if (started && !closed) tv.dataset.since = started; else delete tv.dataset.since;
    tv.textContent = started ? fmtElapsed((closed && ended ? ended : Date.now()) - started) : '–';
    f('updated').textContent = st.updatedAt ? `updated ${fmtTime(st.updatedAt)}` : '';

    const held = [];
    if (c.paused) held.push('Holding at the next step. Continue when ready.');
    if (c.stop) held.push('Stop requested. The job ends at the next step.');
    if (c.pick) held.push(`Your pick: rough ${c.pick}. It overrides the Art Director at the pick step.`);
    if (c.approve) held.push('Approved by you.');
    if (c.sendBack) held.push('Sent back with your notes for one more round.');
    if (c.models) held.push('Roles changed for this job. They apply at each desk’s next step.');
    if (job.controlError) held.push(`control.json cannot be read: ${job.controlError}`);
    const hl = f('held');
    hl.hidden = !held.length;
    patch(hl, held.map(h => `<li>${esc(h)}</li>`).join(''));

    // Confetti, once, when a job you are watching signs off at the bar.
    const key = `done:${S.jobId}`;
    if (phase === 'done' && last && last.pass) { if (!MOVES.has(key)) { MOVES.set(key, clock()); if (S.floorDrawn && el._seenOpen === S.jobId) confetti(); } }
    else if (!closed) el._seenOpen = S.jobId;
  }

  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = $('#confetti');
    const colours = ['#ffaa1c', '#009e73', '#cc79a7', '#0072b2', '#56b4e9', '#d55e00'];
    let html = '';
    for (let i = 0; i < 70; i++) {
      const x = (i * 37 % 100), dx = ((i * 53) % 160) - 80, r = 360 + (i * 47) % 540;
      html += `<i style="left:${x}%;--c:${colours[i % 6]};--x:${dx}px;--r:${r}deg;--d:${1400 + (i * 29) % 900}ms;--delay:${(i * 17) % 380}ms"></i>`;
    }
    box.innerHTML = html;
    setTimeout(() => { box.innerHTML = ''; }, 2800);
  }

  // The floor is drawn once per desk list and then updated in place, so a bot that is breathing keeps breathing.
  function buildFloor(el) {
    const desks = S.state.desks;
    const byTier = t => desks.desks.filter(d => d.tier === t);
    let seed = 0;
    const room = ([tier, cls, name]) => `<div class="room ${cls} tier-${tier}" data-tier="${tier}"><div class="room-sign"><b></b>${esc(name)} <span class="muted" data-f="sign-${tier}"></span>${tier !== 'manager' ? `<button class="ghost small" data-act="tier" data-tier="${tier}">Change</button>` : ''}</div>
      <div class="desks">${byTier(tier).map(d => `<button type="button" class="desk tier-${esc(d.tier)}" data-act="desk" data-slug="${esc(d.slug)}" title="${esc(`${d.name}${d.owns ? `: ${d.owns}` : ''}`)}">${botHtml(d.tier, 'asleep', seed++)}<span class="desk-name">${esc(d.name).replace(/\//g, '/<wbr>')}</span><span class="desk-meta"></span></button>`).join('')}</div></div>`;
    el.innerHTML = `<div class="panel-head"><h2>The floor <span class="muted" data-f="awake"></span></h2><span class="muted">Click a desk to change its model or leave it a note</span></div>
      <div class="rooms">${room(ROOMS[0])}${room(ROOMS[1])}<div class="room booth"><div class="room-sign"><b style="background:var(--amber)"></b>Proof booth <span class="muted">no model, checks the pixels</span></div><div class="booth-body" data-f="booth"></div></div>${room(ROOMS[2])}${room(ROOMS[3])}</div>`;
    el._desks = new Map([...el.querySelectorAll('.desk')].map(b => [b.dataset.slug, { b, wrap: b.querySelector('.bot-wrap'), meta: b.querySelector('.desk-meta'), state: '' }]));
    el._built = desks;
  }

  function renderFloor() {
    const el = $('#floor');
    const desks = S.state.desks;
    if (!desks) return;
    if (el._built !== desks) buildFloor(el);
    const who = whoIsWorking();
    const usage = usageByDesk();
    const M = modelsNow();
    let awake = 0;
    for (const d of desks.desks) {
      const ref = el._desks.get(d.slug);
      if (!ref) continue;
      const w = who.get(d.slug);
      const tier = desks.tiers.find(t => t.id === d.tier) || {};
      const isManager = d.tier === 'manager';
      const override = isManager ? null : M.desk(d.slug);
      const model = isManager ? 'session' : (override || M.tier(d.tier) || tier.model);
      const on = !!(w && w.on), stale = !!(w && w.stale);
      if (on) awake++;
      // A bot that wakes after the floor first drew hops; one already awake on the first draw just is.
      const want = on ? 'awake' : stale ? 'half' : 'asleep';
      if (ref.state !== want) {
        const wasAsleep = ref.state !== 'awake';
        ref.wrap.classList.remove('asleep', 'awake', 'half', 'waking');
        ref.wrap.classList.add(want);
        if (want === 'awake' && wasAsleep && S.floorDrawn) {
          ref.wrap.classList.add('waking');
          clearTimeout(ref.wakeT);
          ref.wakeT = setTimeout(() => ref.wrap.classList.remove('waking'), 560);
        }
        ref.state = want;
      }
      ref.b.classList.toggle('on', on);
      ref.b.classList.toggle('stale', stale);
      ref.b.setAttribute('aria-label', `${d.name}, ${tier.name || d.tier}${on ? ', working' : stale ? ', listed as working, no live agent' : ''}`);
      // the bubble says what the desk is on
      const text = w ? (stale ? `${w.task || 'working'} (no live agent)` : w.task) : '';
      let bubble = ref.b.querySelector('.bubble');
      if (text && !bubble) { bubble = document.createElement('span'); bubble.className = 'bubble'; ref.b.prepend(bubble); }
      if (bubble && !text) bubble.remove();
      if (bubble && bubble.textContent !== text) { bubble.textContent = text; bubble.title = text; }
      let cnt = ref.b.querySelector('.desk-count');
      const n = w && w.count > 1 ? `×${w.count}` : '';
      if (n && !cnt) { cnt = document.createElement('span'); cnt.className = 'desk-count'; ref.b.append(cnt); }
      if (cnt && !n) cnt.remove();
      if (cnt && cnt.textContent !== n) cnt.textContent = n;
      const u = usage.get(d.slug);
      const meta = on && w.since ? null : [override ? short(model) : '', u && u.priced && u.cost > 0 ? money(u.cost) : ''].filter(Boolean).join(' · ');
      if (meta === null) {
        if (ref.meta.dataset.since !== String(w.since)) { ref.meta.dataset.since = w.since; ref.meta.textContent = fmtElapsed(Date.now() - w.since); }
      } else { delete ref.meta.dataset.since; if (ref.meta.textContent !== meta) ref.meta.textContent = meta; }
      ref.meta.classList.toggle('override', !!override);
    }
    el.querySelector('[data-f="awake"]').textContent = `${awake} of ${desks.desks.length} at work`;
    for (const t of desks.tiers) {
      const sign = el.querySelector(`[data-f="sign-${t.id}"]`);
      if (!sign) continue;
      const n = desks.desks.filter(d => d.tier === t.id).length;
      const tm = t.id === 'manager' ? 'session' : short(M.tier(t.id) || t.model);
      sign.textContent = `${n} · ${tm}`;
      sign.title = t.id === 'manager' ? 'session model' : (M.tier(t.id) || t.model);
    }
    renderBooth(el.querySelector('[data-f="booth"]'));
    fitBubbles(el);
    S.floorDrawn = true;
  }

  // A bubble at the edge of a room slides in so it stays inside the room.
  function fitBubbles(el) {
    for (const b of el.querySelectorAll('.bubble')) {
      const room = b.closest('.room');
      if (!room) continue;
      const w = b.offsetWidth, cell = b.parentElement;
      const mid = cell.offsetLeft + cell.offsetWidth / 2;
      const left = mid - w / 2, right = mid + w / 2, max = room.clientWidth - 6;
      const dx = left < 6 ? 6 - left : right > max ? max - right : 0;
      const v = dx ? `${Math.round(dx)}px 0` : '';
      if (b.style.translate !== v) b.style.translate = v;
    }
  }

  // The proof booth: proof is a script on the rendered pixels, no model, so it gets a lens and no bot.
  function renderBooth(el) {
    const st = S.job?.state;
    const proof = Array.isArray(st?.proof) ? [...st.proof].sort((a, b) => (a.round ?? 0) - (b.round ?? 0)) : [];
    const last = proof.at(-1);
    const busy = st && st.phase === 'proof';
    const lens = `<svg class="lens-big${busy ? ' scanning' : ''}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="28" cy="28" r="20" fill="var(--lens)"/><circle cx="28" cy="28" r="13" fill="none" stroke="var(--amber)" stroke-width="5"/><circle cx="28" cy="28" r="6" fill="var(--pupil)"/><circle cx="33" cy="22.5" r="3" fill="#fff"/><path d="M43 43l13 13" stroke="var(--wheel)" stroke-width="7" stroke-linecap="round"/></svg>`;
    patch(el, !st ? `${lens}<p class="muted">Proof runs on every polished file.</p>`
      : busy ? `${lens}<div><p class="big">Checking round ${esc(st.round ?? '')}</p><p class="muted">contrast, overflow, safe zones, palette, type scale, copy</p></div>`
      : last ? `${lens}<div><p class="big ${last.pass ? 'ok' : 'bad'}">Round ${esc(last.round)}: ${last.pass ? 'passed' : `${esc(last.failures ?? '?')} failure${last.failures === 1 ? '' : 's'}`}</p><div class="booth-list">${proof.map(p => `<span class="chip ${p.pass ? 'green' : 'orange'}">R${esc(p.round)} ${p.pass ? 'pass' : `${esc(p.failures ?? '?')} fail`}</span>`).join('')}</div></div>`
      : `${lens}<div><p class="big muted">Not run yet</p><p class="muted">It runs on every polished file, not on the roughs.</p></div>`);
  }

  function renderNow() {
    const el = $('#now');
    const who = whoIsWorking();
    const rows = [...who].filter(([, w]) => w.on || w.stale).sort((a, b) => (a[1].since || 0) - (b[1].since || 0));
    if (!el._list) { el.innerHTML = '<div class="panel-head"><h2>At work now <span class="muted" data-f="n"></span></h2></div><div class="now-list"></div>'; el._list = el.querySelector('.now-list'); el._rows = new Map(); }
    el.querySelector('[data-f="n"]').textContent = rows.length ? String(rows.length) : '';
    const keep = new Set();
    for (const [slug, w] of rows) {
      keep.add(slug);
      let r = el._rows.get(slug);
      const tier = tierOf(slug);
      if (!r) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = `worker tier-${tier}`; b.dataset.act = 'desk'; b.dataset.slug = slug;
        b.innerHTML = `${botHtml(tier, 'awake', slug.length)}<strong>${esc(deskName(slug))}</strong><span class="when"></span><span class="task"></span><span class="tool"></span>`;
        el._list.append(b);
        r = { b, wrap: b.querySelector('.bot-wrap'), when: b.querySelector('.when'), task: b.querySelector('.task'), tool: b.querySelector('.tool') };
        el._rows.set(slug, r);
      }
      r.wrap.classList.toggle('awake', w.on); r.wrap.classList.toggle('half', !w.on);
      const task = (w.stale ? `${w.task || 'working'}, no live agent` : w.task) + (w.count > 1 ? ` · ×${w.count}` : '');
      if (r.task.textContent !== task) { r.task.textContent = task; r.task.title = task; }
      if (w.since) { if (r.when.dataset.since !== String(w.since)) { r.when.dataset.since = w.since; r.when.textContent = fmtElapsed(Date.now() - w.since); } }
      const tool = w.tools ? `${w.lastTool ? `${w.lastTool} · ` : ''}${w.tools} tool${w.tools === 1 ? '' : 's'}` : '';
      if (r.tool.textContent !== tool) r.tool.textContent = tool;
    }
    for (const [slug, r] of el._rows) if (!keep.has(slug)) { r.b.remove(); el._rows.delete(slug); }
    let nobody = el.querySelector('.nobody');
    if (!rows.length && !nobody) {
      nobody = document.createElement('div'); nobody.className = 'nobody tier-manager';
      el._list.append(nobody);
    }
    if (nobody) {
      if (rows.length) nobody.remove();
      else patch(nobody, `${botHtml('manager', 'asleep', 2)}<span>${S.job && CLOSED.has(S.job.state.phase) ? 'Nobody is working. The job is closed.' : S.job ? 'Nobody is working right now.' : 'Nobody is working. No job yet.'}</span>`);
    }
  }

  // ---------- chatter ----------

  function said(e) {
    const n = x => esc(deskName(x));
    const tk = e.tokens && typeof e.tokens === 'object' ? `${tokensShort(e.tokens.total || 0)} tok` : '';
    const price = typeof e.costUsd === 'number' ? money(e.costUsd) : '';
    switch (e.type) {
      case 'session.start': return ['Session started'];
      case 'session.end': return ['Session ended'];
      case 'turn.stop': return ['The Manager finished a turn', 'tool'];
      case 'job.start': return [`Job started: ${esc(e.command || 'job')} ${esc(e.deliverable || '')}`];
      case 'job.phase': return [e.phase === 'polish' ? `Polish, round ${esc(e.round)}` : e.phase === 'signoff' ? `Sign-off, round ${esc(e.round)}` : e.phase === 'proof' ? `Proof, round ${esc(e.round)}` : e.phase === 'paused' ? 'Holding' : `On to ${esc(phaseWord(e.phase))}`];
      case 'job.pick': return e.by === 'user' ? [`Your pick went in: rough ${esc(e.rough)}`, 'you'] : [`${n(e.by || 'art-director')} picked rough ${esc(e.rough)}`, 'pick'];
      case 'job.proof': return [`Proof round ${esc(e.round)}: ${e.pass ? 'passed' : `${esc(e.failures ?? '?')} failure${e.failures === 1 ? '' : 's'}`}`, e.pass ? 'score' : 'score under'];
      case 'job.score': return [`${n(e.by || 'creative-director')} scored round ${esc(e.round)}: ${esc(e.average)}, ${e.pass ? 'at the bar' : 'under the bar'}`, e.pass ? 'score' : 'score under'];
      case 'job.done': return ['Job done, files in .desk/out', 'score'];
      case 'desk.start': return [`${n(e.desk)} started`];
      case 'desk.stop': return [`${n(e.desk)} finished${tk || price ? ` <small>${[tk, price].filter(Boolean).join(', ')}</small>` : ''}`];
      case 'desk.tool': return [`${n(e.desk)} used ${esc(e.tool || 'a tool')}`, 'tool'];
      case 'control.pause': return [e.paused ? 'You paused the job' : 'You continued the job', 'you'];
      case 'control.stop': return ['You asked the job to stop', 'you'];
      case 'control.pick': return [`You picked rough ${esc(e.rough)}`, 'you'];
      case 'control.note': return [`You left ${n(e.desk)} a note <small>${esc(e.chars)} chars</small>`, 'you'];
      case 'control.approve': return ['You approved it under the bar', 'you'];
      case 'control.sendBack': return [`You sent it back with notes <small>${esc(e.chars)} chars</small>`, 'you'];
      case 'control.models': return [`You changed roles${e.scope === 'default' ? ' as the default' : ' for this job'} <small>${TIERS.filter(t => e[t]).map(t => `${t} ${esc(e[t])}`).concat(e.desks ? [`${esc(e.desks)} desk${e.desks === 1 ? '' : 's'}`] : []).join(', ')}</small>`, 'you'];
      default: return [`${esc(e.type)} <small>${esc(evDetail(e))}</small>`];
    }
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
    if (!el._list) {
      el.innerHTML = `<div class="panel-head"><h2>Studio log <span class="muted" data-f="n"></span></h2><label class="feed-tools"><input type="checkbox" id="showTools"> tool calls</label></div><ul class="events"></ul>`;
      el._list = el.querySelector('.events'); el._seen = new Set();
    }
    const all = S.events.map((e, i) => ({ e, i, s: said(e) }));
    const tools = all.filter(x => x.s[1] === 'tool').length;
    const list = all.filter(x => S.showTools || x.s[1] !== 'tool').slice(-40).reverse();
    el.querySelector('[data-f="n"]').textContent = `${S.events.length} events${tools && !S.showTools ? `, ${tools} tool calls hidden` : ''}`;
    const keyOf = x => `${x.e.t}|${x.e.type}|${x.e.agent || ''}|${x.i}`;
    const first = !el._seen.size;
    const html = list.map(x => {
      const k = keyOf(x);
      const fresh = !first && !el._seen.has(k);
      const tier = x.e.desk ? `tier-${tierOf(x.e.desk)}` : 'tier-manager';
      return `<li class="${tier} ${x.s[1] || ''}${fresh ? ' fresh' : ''}" data-k="${esc(k)}"><span class="t">${esc(fmtTime(x.e.t))}</span><i class="d"></i><span class="what">${x.s[0]}</span></li>`;
    }).join('') || '<li class="muted"><span></span><span></span><span>Nothing yet.</span></li>';
    if (patch(el._list, html)) for (const x of list) el._seen.add(keyOf(x));
  }

  // ---------- review board ----------

  function scoreHtml(s) {
    const axes = Object.entries(s.axes || {});
    // The bars fill left to right, 60ms apart, the first time this round's scorecard shows.
    const age = moveAge(`fill:${S.jobId}:${s.round}`);
    return `<div class="scores">
      <p>Sign-off by ${esc(deskName(s.by || 'creative-director'))}: average <strong>${esc(s.average ?? '?')}</strong>, ${s.pass ? '<span class="chip green">at the bar</span>' : '<span class="chip orange">under the bar</span>'}</p>
      ${axes.length ? `<div class="axes">${axes.map(([k, v], i) => {
        const n = Math.max(0, Math.min(10, Number(v) || 0));
        const delay = i * 60 - age;
        const filling = delay > -420;
        return `<div class="axis"><span class="axis-name">${esc(k)}</span><span class="bar"><span class="fill${n >= 8 ? '' : ' under'}${filling ? ' fill-in' : ''}" style="--v:${n / 10}${filling ? `;--age:${delay.toFixed(0)}ms` : ''}"></span></span><span class="axis-val${n >= 8 ? '' : ' bad'}">${esc(v)}</span></div>`;
      }).join('')}</div>` : ''}
      ${Array.isArray(s.notes) && s.notes.length ? `<ul class="notes">${s.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  // The averages round by round against the bar at 8.5.
  function chartHtml(scores) {
    if (scores.length < 2) return '';
    // The bar's label sits in its own gutter on the left, so no point can land on it.
    const W = 560, H = 128, GUT = 64, avgs = scores.map(s => Number(s.average) || 0);
    const lo = Math.min(8, Math.floor((Math.min(...avgs) - 0.3) * 2) / 2), hi = 10;
    const x = i => GUT + 18 + i * (W - GUT - 36) / (scores.length - 1);
    const y = v => 22 + (hi - v) / (hi - lo) * (H - 46);
    const pts = scores.map((s, i) => [x(i), y(Number(s.average) || lo)]);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Average by round: ${scores.map(s => `round ${s.round} ${s.average}`).join(', ')}, against the bar at 8.5">
      <line class="grid" x1="${GUT}" x2="${W}" y1="${y(10)}" y2="${y(10)}"/><text class="axis-t" x="${GUT - 8}" y="${y(10) + 4}" text-anchor="end">10</text>
      <line class="barline" x1="${GUT}" x2="${W}" y1="${y(8.5)}" y2="${y(8.5)}"/><text class="bar-t" x="${GUT - 8}" y="${y(8.5) + 4}" text-anchor="end">bar 8.5</text>
      <path class="path" d="M${pts.map(p => p.map(n => n.toFixed(1)).join(' ')).join('L')}"/>
      ${scores.map((s, i) => `<circle class="pt ${s.pass ? 'pass' : 'under'}" cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="5.5"/><text class="val ${s.pass ? 'pass' : 'under'}" x="${pts[i][0].toFixed(1)}" y="${(pts[i][1] - 11).toFixed(1)}" text-anchor="middle">${esc(s.average)}</text><text x="${pts[i][0].toFixed(1)}" y="${H - 4}" text-anchor="middle">R${esc(s.round)}</text>`).join('')}
    </svg>`;
  }

  function renderBoard() {
    const el = $('#board');
    const job = S.job;
    if (!job) { patch(el, '<div class="panel-head"><h2>Review board</h2></div><p class="muted">Nothing to review yet.</p>'); return; }
    const st = job.state;
    const roughs = job.renders.filter(r => r.kind === 'rough');
    const rounds = job.renders.filter(r => r.kind === 'round');
    const prefSize = (st.sizes || [])[0];
    const mainImg = r => r.files.find(f => f.size === prefSize) || r.files[0];
    const userPick = job.control && job.control.pick;
    const pickN = userPick || (st.pick && st.pick.rough);
    const proofBy = new Map((st.proof || []).map(p => [p.round, p]));
    const scoreBy = new Map((st.scores || []).map(s => [s.round, s]));
    const roundNs = [...new Set([...rounds.map(r => r.n), ...proofBy.keys(), ...scoreBy.keys()])].filter(n => Number.isFinite(n)).sort((a, b) => a - b);
    const sel = roundNs.includes(S.round) ? S.round : roundNs.at(-1);
    // Draw again only when something on the board changed, so images and moves are not reset every tick.
    const sig = JSON.stringify([S.jobId, job.renders, job.out, st.pick, st.proof, st.scores, st.sizes, userPick, sel, roundNs]);
    if (el._sig === sig) return;
    el._sig = sig;
    const sizesHtml = r => `<span class="sizes">${r.files.map(f => `<a href="${fileUrl(f.path)}" target="_blank" rel="noopener">${esc(f.size)}</a>`).join('')}</span>`;
    const imgHtml = (r, alt) => {
      const img = r && mainImg(r);
      return img ? `<a href="${fileUrl(img.path)}" target="_blank" rel="noopener"><img src="${fileUrl(img.path)}" alt="${esc(alt)} at ${esc(img.size)}" loading="lazy"></a>` : '<div class="thumb-empty">no render yet</div>';
    };
    let left = `<h3>Roughs</h3>`;
    if (!roughs.length) left += '<p class="muted">No roughs rendered yet. The UI Designer makes three directions first.</p>';
    else {
      const tilt = [-1.6, 1.1, -0.6, 1.4, -1.2, 0.8];
      left += '<div class="thumbs">';
      roughs.forEach((r, i) => {
        const picked = pickN === r.n;
        const file = job.out.find(o => o.name === `rough-${r.n}.html` || o.name === `rough-${r.n}.svg`);
        const ring = picked ? moveAge(`ring:${S.jobId}:${r.n}`) : -1;
        const drawing = ring >= 0 && ring < 600;
        left += `<figure class="thumb${picked ? ' picked' : ''}"><div class="frame" style="--tilt:${picked ? 0 : tilt[i % tilt.length]}deg">${imgHtml(r, `rough ${r.n}`)}${picked ? RING.replace('class="ring"', `class="ring${drawing ? ' draw' : ''}"${drawing ? ` style="--age:-${ring.toFixed(0)}ms"` : ''}`) : ''}</div>
          <figcaption><span class="row1"><strong>Rough ${r.n}</strong> ${picked ? `<span class="chip amber">picked by ${userPick ? 'you' : esc(pickBy(st.pick?.by))}</span>` : ''}</span>
          ${sizesHtml(r)}
          <span class="thumb-actions">${file ? `<a class="btn ghost small" href="${fileUrl(file.path)}" target="_blank" rel="noopener">Open file</a>` : ''}<button class="small${picked ? ' ghost' : ''}" data-act="pick" data-n="${r.n}" ${picked ? 'disabled' : ''}>Pick this</button></span>
          </figcaption></figure>`;
      });
      left += '</div>';
    }
    if (st.pick && typeof st.pick === 'object') {
      left += `<div class="pick-note tier-director">${botHtml('director', 'awake', 5)}<div><p><strong>Rough ${esc(st.pick.rough)}</strong>, picked by ${esc(pickBy(st.pick.by))}${st.pick.reason ? `: “${esc(st.pick.reason)}”` : ''}</p>
        ${Array.isArray(st.pick.notes) && st.pick.notes.length ? `<ul class="notes">${st.pick.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div></div>`;
    }
    if (userPick) left += `<p class="muted">You picked rough ${esc(userPick)}. The Manager records it as your call at the pick step.</p>`;

    let right = '<h3>Polish rounds</h3>';
    if (!roundNs.length) right += '<p class="muted">No polish rounds yet. Each round is a builder revision, a proof check and a sign-off score.</p>';
    else {
      right += `<div class="rounds-strip">${roundNs.map(n => {
        const s = scoreBy.get(n), p = proofBy.get(n);
        return `<button type="button" class="round-tab${n === sel ? ' sel' : ''}" data-act="round" data-n="${n}"><span class="n">Round ${n}</span><span class="avg ${s ? (s.pass ? 'pass' : 'under') : 'none'}">${s ? esc(s.average) : 'not scored'}</span><span class="pf">proof ${p ? (p.pass ? 'passed' : `${esc(p.failures ?? '?')} failed`) : 'not run'}</span></button>`;
      }).join('')}</div>`;
      right += chartHtml((st.scores || []).filter(s => Number.isFinite(Number(s.average))).sort((a, b) => a.round - b.round));
      const r = rounds.find(x => x.n === sel), p = proofBy.get(sel), s = scoreBy.get(sel);
      right += `<div class="round latest">
        <div class="round-img">${imgHtml(r, `round ${sel}`)}${r ? sizesHtml(r) : ''}</div>
        <div class="round-info"><h4>Round ${sel}${sel === roundNs.at(-1) ? ' <span class="chip">latest</span>' : ''}</h4>
          ${p ? `<p class="proof ${p.pass ? 'ok' : 'bad'}">Proof: ${p.pass ? 'passed' : `${p.failures ?? '?'} failure${p.failures === 1 ? '' : 's'}`}</p>` : '<p class="proof muted">Proof: not run</p>'}
          ${s ? scoreHtml(s) : '<p class="muted">Sign-off: not scored</p>'}
        </div></div>`;
    }
    if (job.out.length) right += `<h3>Files</h3><p class="files">${job.out.map(o => `<a href="${fileUrl(o.path)}" target="_blank" rel="noopener">${esc(o.name)}</a>`).join('')}</p><p class="outdir">In your project at <span class="mono">.desk/out/${esc(st.id || S.jobId)}/</span></p>`;
    el.innerHTML = `<div class="panel-head"><h2>Review board</h2><span class="muted">${roughs.length} rough${roughs.length === 1 ? '' : 's'}, ${rounds.length} polish round${rounds.length === 1 ? '' : 's'} rendered</span></div><div class="board-grid"><div>${left}</div><div>${right}</div></div>`;
    ringSizer?.disconnect();
    for (const f of el.querySelectorAll('.frame')) if (f.querySelector('.ring')) { sizeRing(f); ringSizer?.observe(f); }
  }

  // ---------- ledger: roles, cost, who did what ----------

  // The cost line: director, senior and builder as three segments of one line, measured against the next whole
  // dollar, so it grows as the desks report. A segment moves from where it was to where it is.
  const COSTLINE = new Map();
  function costLineHtml(cost) {
    const total = Number(cost.total) || 0;
    if (!(total > 0)) return '';
    const scale = Math.max(1, Math.ceil(total));
    const prev = COSTLINE.get(S.jobId) || {};
    const segs = TIERS.map(t => {
      const v = Number(cost[t]) || 0, from = prev[t] || 0;
      const age = v !== from ? moveAge(`cost:${S.jobId}:${t}:${v}`) : 1e9;
      const moving = age < 400;
      if (!moving) prev[t] = v;
      const pct = x => `${(x / scale * 100).toFixed(2)}%`;
      return `<span class="seg ${t}${moving ? ' grow' : ''}" style="--to:${pct(v)};--from:${pct(from)}${moving ? `;--age:-${age.toFixed(0)}ms` : ''}" title="${t} ${money(v)}"></span>`;
    });
    COSTLINE.set(S.jobId, prev);
    return `<div class="costline" aria-hidden="true">${segs.join('')}</div><div class="costline-scale"><span>$0</span><span>$${scale}</span></div>`;
  }

  function ganttHtml(st) {
    const runs = (st.desks || []).map(d => ({ d, a: Date.parse(d.startedAt), b: d.status === 'working' ? Date.now() : Date.parse(d.updatedAt) })).filter(x => x.a);
    if (!runs.length) return '<p class="muted">No desks staffed yet.</p>';
    const t0 = Math.min(...runs.map(x => x.a)), t1 = Math.max(...runs.map(x => x.b || x.a), t0 + 1000);
    const pct = v => `${((v - t0) / (t1 - t0) * 100).toFixed(2)}%`;
    return `<div class="gantt">${runs.map(({ d, a, b }) => {
      const tier = tierOf(d.desk);
      return `<div class="g-row tier-${tier} ${esc(d.status || 'queued')}" title="${esc(`${deskName(d.desk)}: ${d.task || ''} (${d.status || ''}, ${short(d.model)})`)}"><span class="who"><span class="tier-dot"></span>${esc(deskName(d.desk))} <span class="task">${esc(d.task || '')}</span></span><span class="lane"><span class="run" style="--l:${pct(a)};--w:${b ? `calc(${pct(b)} - ${pct(a)})` : '4px'}"></span></span><span class="dur"${d.status === 'working' ? ` data-since="${a}"` : ''}>${b ? fmtElapsed(b - a) : ''}</span></div>`;
    }).join('')}</div>`;
  }

  function renderLedger() {
    const el = $('#ledger');
    const job = S.job;
    if (!job) { patch(el, '<div class="panel-head"><h2>Roles and cost</h2></div><p class="muted">Pick a job to see its roles, cost and staffing.</p>'); return; }
    const st = job.state, M = modelsNow();
    const cost = st.cost || {};
    const overrides = M.overrides();
    const usage = usageByDesk();
    const working = (st.desks || []).some(d => d.status === 'working');
    const sig = JSON.stringify([S.jobId, st.models, job.control?.models, S.state.project?.models, cost, st.tokens, st.desks, job.inbox, job.brief, [...usage].map(([k, u]) => [k, u.runs, u.tokens, u.cost, u.priced])]);
    if (el._sig === sig && !working) return;
    if (el._sig === sig && working && clock() - (el._at || 0) < 1000) return;
    el._sig = sig; el._at = clock();
    patch(el, `<div class="panel-head"><h2>Roles and cost</h2><span class="muted">list prices, from what each desk reported</span></div>
      <table class="tiers-t">${TIERS.map(t => `<tr class="tier-${t}"><td><span class="tier-dot"></span>${t}</td><td class="mono">${esc(M.tier(t) || 'default')}</td><td>${money(cost[t]) || '<span class="faint">none reported</span>'}</td><td><button class="ghost small" data-act="tier" data-tier="${t}">Change</button></td></tr>`).join('')}
        <tr><td>total</td><td></td><td><strong>${money(cost.total) || '<span class="faint">none reported</span>'}</strong></td><td></td></tr></table>
      ${Object.keys(overrides).length ? `<p class="muted">Desk overrides: ${Object.entries(overrides).map(([k, v]) => `${esc(deskName(k))} on <span class="mono">${esc(v)}</span>`).join(', ')}</p>` : ''}
      ${costLineHtml(cost)}
      ${cost.complete === false ? '<p class="muted">Partial: some desks did not report usage, so this is a lower bound, not the total.</p>' : ''}
      ${st.tokens && typeof st.tokens === 'object' ? `<p class="muted">Tokens: ${Object.entries(st.tokens).map(([k, v]) => `${esc(k)} ${fmtNum(v)}`).join(', ')}</p>` : ''}
      ${usage.size ? `<h3>Per desk</h3><table class="bydesk">${[...usage].sort((a, b) => b[1].cost - a[1].cost).map(([slug, u]) => `<tr class="tier-${tierOf(slug)}"><td><span class="tier-dot"></span>${esc(deskName(slug))}<span class="faint"> ×${u.runs}</span></td><td class="mono muted">${tokensShort(u.tokens)}</td><td>${u.priced ? money(u.cost) : '<span class="faint">no price</span>'}</td></tr>`).join('')}</table>` : ''}
      <h3>Who did what</h3>${ganttHtml(st)}
      ${job.inbox && job.inbox.length ? `<p class="muted">Notes waiting for: ${job.inbox.map(deskName).map(esc).join(', ')}.</p>` : ''}
      ${job.brief ? `<details class="brief"><summary>Brief</summary><pre>${esc(job.brief)}</pre></details>` : ''}`);
  }

  function renderMemory() {
    const el = $('#memory');
    const s = S.state, b = s.brand, p = s.project;
    let html = '<div class="panel-head"><h2>Studio memory</h2><span class="muted">what every desk reads first</span></div><h3>Brand</h3>';
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
    else html += `<details><summary>${esc(p.quality || 'studio')} quality, ${esc(p.maxRounds ?? 8)} rounds max</summary><pre>${esc(JSON.stringify(p, null, 2))}</pre></details>`;
    if (s.taste) html += `<h3>Taste</h3><details><summary>taste.md</summary><pre>${esc(s.taste)}</pre></details>`;
    patch(el, html);
  }

  // ---------- sheet ----------

  function openSheet(kind, target) { S.sheet = { kind, target }; renderSheet(); }
  function closeSheet() { S.sheet = null; renderSheet(); }

  function modelForm(current, hasOverride) {
    const opts = modelOptions(current);
    return `<h3>Model</h3>
      <div class="row"><select id="modelSelect" aria-label="Model">${opts.map(m => `<option value="${esc(m)}" ${m === current ? 'selected' : ''}>${esc(m)}</option>`).join('')}<option value="__other">Other</option></select><input id="modelOther" type="text" placeholder="provider/model" hidden></div>
      <div class="row"><button data-act="model" data-scope="job" ${S.job ? '' : 'disabled'}>This job</button><button class="ghost" data-act="model" data-scope="default" ${S.job ? '' : 'disabled'}>Save as default</button>${hasOverride ? '<button class="ghost" data-act="model-clear">Use the tier model</button>' : ''}</div>
      <p class="muted">${S.job ? 'A running desk finishes its step first. The new model applies at the next step.' : 'Pick a job first. Without one there is nothing to write the change to.'}</p>`;
  }

  function renderSheet() {
    const el = $('#sheet');
    if (!S.sheet || !S.state) { el.hidden = true; el.innerHTML = ''; el._key = null; return; }
    const { kind, target } = S.sheet;
    const M = modelsNow();
    let title = '', body = '', avatar = '';
    if (kind === 'desk') {
      const d = S.state.desks.desks.find(x => x.slug === target);
      if (!d) return closeSheet();
      const tier = S.state.desks.tiers.find(t => t.id === d.tier) || {};
      const override = d.tier === 'manager' ? null : M.desk(d.slug);
      const current = d.tier === 'manager' ? 'session model' : (override || M.tier(d.tier) || tier.model);
      const w = whoIsWorking().get(d.slug);
      title = `${esc(d.name)} <span class="chip ${({ manager: 'amber', director: 'pink', senior: 'sky', builder: 'green' })[d.tier] || ''}">${esc(tier.name || d.tier)}</span>`;
      avatar = `<span class="tier-${esc(d.tier)}">${botHtml(d.tier, w && w.on ? 'awake' : 'asleep', 4)}</span>`;
      const u = usageByDesk().get(d.slug);
      body = `${d.owns ? `<p>Owns ${esc(d.owns)}.</p>` : ''}
        ${w && w.on ? `<p><span class="chip green">working</span> ${esc(w.task || '')}</p>` : ''}
        <p class="muted">Now on <span class="mono">${esc(current)}</span>${d.tier === 'manager' ? '' : override ? ' (set for this desk)' : ' (the tier model)'}.</p>
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
      title = `${esc(tier.name)} roles`;
      avatar = `<span class="tier-${esc(target)}">${botHtml(target, 'awake', 6)}</span>`;
      body = `<p class="muted">${esc(tier.note || '')} Now on <span class="mono">${esc(current)}</span>.</p>${modelForm(current, false)}`;
    } else if (kind === 'sendback') {
      title = 'Send back';
      avatar = `<span class="tier-director">${botHtml('director', 'awake', 7)}</span>`;
      body = `<p class="muted">The output goes back to the builder for one more round with these notes. Recorded as your call.</p>
        <textarea id="sendBackText" rows="5" placeholder="what to change"></textarea>
        <div class="row"><button data-act="sendback-go">Send back</button></div>`;
    }
    // Keep what was typed when the sheet redraws for the same desk.
    const key = `${kind}:${target}`;
    const keepNote = el._key === key ? $('#noteText')?.value : '';
    el.innerHTML = `<div class="sheet-head">${avatar}<h2>${title}</h2><button class="ghost small" data-act="close">Close</button></div><div class="sheet-body">${body}</div>`;
    if (keepNote && $('#noteText')) $('#noteText').value = keepNote;
    el._key = key;
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
        case 'round': S.round = Number(btn.dataset.n); renderBoard(); break;
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
      S.round = null;
      loadJob();
    } else if (e.target.id === 'showTools') {
      S.showTools = e.target.checked;
      renderFeed();
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
    el.querySelector('.live-text').textContent = on ? 'Live' : 'Offline';
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
