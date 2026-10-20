// The clips, each one idea on the real floor. A clip drives the job through the same files the Manager
// writes, so what the camera sees is the floor doing its job. Timings in seconds from the first frame.
// Captions are burned in later by the video pipeline; `caption` is the one line on screen.
//
// Toolkit (see record.mjs): t.start(desk, task, model) -> agent, t.stop(desk, agent, {model, costUsd}),
// t.phase(name, round), t.state(patch), t.event({...}), t.click(sel), t.type(sel, text), t.wait(ms).

// Seats in state read as provider/tier, the way project.json names them. Stop events carry the model id.
const SONNET = 'anthropic/sonnet', HAIKU = 'anthropic/haiku', OPUS = 'anthropic/opus';
const ID = { 'anthropic/sonnet': 'claude-sonnet-5-5', 'anthropic/haiku': 'claude-haiku-5-5', 'anthropic/opus': 'claude-opus-5-5' };
// `fresh: true` starts a clip from an empty job (record.mjs resets the staffing, scores and live desks first).

import { fileURLToPath } from 'node:url';
const CONTROLS = fileURLToPath(new URL('./fixtures/controls', import.meta.url));
const NOTE = 'More air around the headline. One accent only.';
const isRough = d => /^rough\b/i.test(d.task || '');
// The controls job as it stood at a point: roughs on the board, then optionally the pick made, then the board at rest.
function seed(t, { pick = false } = {}) {
  const desks = t.final?.desks || [];
  t.phase('roughs', 0);
  desks.filter(isRough).forEach((d, i) => { const a = t.start(d.desk, d.task, d.model); t.stop(d.desk, a, t.realStop(d.desk)); t.reveal(`roughs/rough-${i + 1}`); });
  t.land('rough-*');
  if (pick) {
    const ad = desks.find(d => /^pick/i.test(d.task || ''));
    t.phase('pick', 0);
    const a = t.start(ad.desk, ad.task, ad.model); t.stop(ad.desk, a, t.realStop(ad.desk));
    t.state({ pick: t.final.pick });
    t.phase('polish', 1);
  }
}
const polish = (t, n) => (t.final?.desks || []).find(d => String(d.task || '').toLowerCase().startsWith('polish round ' + n));

export const CLIPS = [
  {
    name: 'floor-idle', seconds: 10, loop: true, about: 'The 42 desks, a lamp lighting as a desk starts work.',
    caption: 'Forty-two desks.',
    fresh: true, job: null,
    // An empty job on the floor, the camera on the grid, desks starting and stopping one after another.
    async before(t) { await t.scrollTo('#floor', 300); },
    async run(t) {
      const a = t.start('typographer', 'type scale', SONNET); await t.wait(1100);
      const b = t.start('icon-designer', 'mark on the grid', HAIKU); await t.wait(900);
      const c = t.start('copy-editor', 'read the headline', SONNET); await t.wait(1100);
      const d = t.start('motion-designer', 'lamp timing', HAIKU); await t.wait(900);
      t.stop('typographer', a, { model: ID[SONNET] }); const e = t.start('art-director', 'pick', OPUS); await t.wait(1200);
      const f = t.start('email-designer', 'dark set', HAIKU); await t.wait(900);
      t.stop('icon-designer', b); t.stop('copy-editor', c, { model: ID[SONNET] }); await t.wait(1000);
      const g = t.start('ui-designer', 'polish round', HAIKU); await t.wait(1000);
      t.stop('motion-designer', d); t.stop('art-director', e, { model: ID[OPUS] }); t.stop('email-designer', f); t.stop('ui-designer', g);
    },
  },
  {
    name: 'one-line', seconds: 8, loop: true, about: 'A line typed, the floor lights, three roughs, the pick, polish, the scorecard at the bar.',
    caption: 'One line. A studio.',
    fresh: true,
    // Replays the fixture's real job in order: its desks, renders, pick, proof, sign-off rounds and tier costs.
    // Nothing on screen is invented: each stop carries that desk's real model, tokens and cost from the fixture's log.
    async run(t) {
      const f = t.final || {};
      const desks = f.desks || [];
      const isRough = d => /^rough\b/i.test(d.task || '');
      const rest = desks.filter(d => !isRough(d));
      // The replay fits in the first 5.2s; the floor reads state once a second, so the last scorecard
      // shows by about 6.5s and its slabs finish filling (8 slabs, 60ms apart, 300ms each) before the clip ends.
      const step = Math.min(1200, 4600 / (1 + rest.length));
      t.phase('roughs', 0);
      const roughs = desks.filter(isRough).map(d => [d, t.start(d.desk, d.task, d.model)]);
      await t.wait(step);
      roughs.forEach(([d, a], i) => { t.stop(d.desk, a, t.realStop(d.desk)); t.reveal(`rough-${i + 1}`); });
      t.land('rough-*');
      await t.scrollTo('#board');
      for (const d of rest) {
        const task = d.task || '';
        const n = Number((/round (\d+)/i.exec(task) || [])[1]) || 0;
        if (/^pick/i.test(task)) t.phase('pick', 0);
        else if (/^polish/i.test(task)) t.phase('polish', n);
        else if (/^sign-?off/i.test(task)) t.phase('signoff', n);
        const a = t.start(d.desk, task, d.model);
        await t.wait(step);
        // The staffing list has grown since the first scroll, so the board is re-seated before the last scorecard lands.
        if (d === rest[rest.length - 1]) await t.scrollTo('#board', 400);
        t.stop(d.desk, a, t.realStop(d.desk));
        if (/^pick/i.test(task)) t.state({ pick: f.pick || null });
        if (/^polish/i.test(task)) { t.reveal(`round-${n}`); t.state(s => { s.proof = (f.proof || []).filter(p => p.round <= n); }); }
        if (/^sign-?off/i.test(task)) t.state(s => { s.scores = (f.scores || []).filter(x => x.round <= n); });
      }
      // The file lands with the sign-off, then the clip holds until the last scorecard has filled.
      t.land();
      t.state({ cost: f.cost || null, tokens: f.tokens || null, files: f.files || [], round: f.round ?? 0 });
      t.phase(f.phase || 'done', f.round ?? 0);
      t.finish();
      await t.until('.scores .fill-in', { then: 1100 });
    },
  },
  {
    name: 'the-pick', seconds: 6, about: "Three roughs side by side, the Art Director's reason lands, one gets the ring.",
    caption: 'The Art Director picks.',
    fresh: true,
    // The fixture's roughs are on the board from the first frame, so the poster reads as a still.
    async before(t) {
      const roughs = (t.final?.desks || []).filter(d => /^rough\b/i.test(d.task || ''));
      t.phase('roughs', 0);
      roughs.forEach((d, i) => { const a = t.start(d.desk, d.task, d.model); t.stop(d.desk, a, t.realStop(d.desk)); t.reveal(`rough-${i + 1}`); });
      t.land('rough-*');
      await t.until('figure.thumb img', { then: 400 });
      await t.scrollTo('#board', 400);
    },
    async run(t) {
      const ad = (t.final?.desks || []).find(d => /^pick/i.test(d.task || '')) || { desk: 'art-director', task: 'pick', model: OPUS };
      await t.wait(900);
      t.phase('pick', 0);
      const a = t.start(ad.desk, ad.task, ad.model);
      await t.wait(2200);
      t.stop(ad.desk, a, t.realStop(ad.desk));
      t.state({ pick: t.final?.pick || null });
    },
  },

  {
    name: 'pick-it-yourself', seconds: 7, about: 'Click a rough over the Art Director, who works from your pick.',
    caption: 'Pick it yourself.',
    zoomTall: 1.05, fresh: true, fixture: CONTROLS,
    async before(t) { seed(t); await t.until('figure.thumb img', { then: 500 }); await t.scrollTo('#board', 300); },
    async run(t) {
      await t.wait(1200);
      await t.click('button[data-act="pick"][data-n="2"]');
      await t.wait(1500);
      const ad = (t.final?.desks || []).find(d => /^pick/i.test(d.task || ''));
      t.phase('pick', 0);
      const a = t.start(ad.desk, ad.task, ad.model);
      await t.wait(1800);
      t.stop(ad.desk, a, t.realStop(ad.desk));
      t.state({ pick: t.final.pick });
    },
  },
  {
    name: 'swap-the-seat', seconds: 8, about: 'The builder seat moves to another model while the job holds, then the polish runs on it.',
    caption: 'Swap the seat.',
    zoomTall: 1.05, fresh: true, fixture: CONTROLS,
    async before(t) { seed(t, { pick: true }); t.state({ phase: 'paused' }); await t.wait(600); },
    async run(t) {
      await t.wait(900);
      await t.click('button[data-act="tier"][data-tier="builder"]');
      await t.wait(900);
      await t.page.selectOption('#modelSelect', 'anthropic/sonnet');
      await t.wait(800);
      await t.click('button[data-act="model"][data-scope="job"]');
      await t.wait(1200);
      await t.click('button[data-act="close"]');
      t.phase('polish', 1);
      const d = polish(t, 1);
      const a = t.start(d.desk, d.task, 'anthropic/sonnet');
      await t.wait(1500);
      t.stop(d.desk, a, t.realStop(d.desk));
    },
  },
  {
    name: 'note-to-the-desk', seconds: 9, about: 'A note typed to the UI Designer, then the next round.',
    caption: 'A note to the desk.',
    zoomTall: 1.05, fresh: true, fixture: CONTROLS,
    async before(t) { seed(t, { pick: true }); await t.until('figure.thumb img', { then: 400 }); },
    async run(t) {
      await t.wait(700);
      await t.click('button.desk[data-slug="ui-designer"]');
      await t.wait(800);
      await t.type('#noteText', NOTE, 45);
      await t.wait(600);
      await t.click('button[data-act="note"]');
      await t.wait(1000);
      await t.click('button[data-act="close"]');
      t.phase('polish', 1);
      const d = polish(t, 1);
      const a = t.start(d.desk, d.task, d.model);
      await t.wait(1500);
      t.stop(d.desk, a, t.realStop(d.desk));
      t.reveal('round-1');
      await t.until('.round img', { then: 300 });
      await t.scrollTo('.round', 600);
    },
  },
];
