// The dashboard clips that clips/frames.mjs records at 60 fps. Each replays a real record from this repo, sped up:
// `time` maps seconds of video to moments of the record, so every bot that wakes, every score and every cost on screen
// is the record's own. The clips where you act (pick, change a role, leave a note) click the real controls; the
// record's own control lines are left out of those replays so they are not shown twice.
//   camera: [from, to, selector or y]   scrolls the page    zoom: [from, to, {sel, w} or {x, y, w}]   frames a part of it
//   actions: [at, async tools => ...]    captions: [from, to, html]
// project: the folder name the dashboard shows in its header for the replayed project.
const CARD = 'clips/fixtures/card';
const CONTROLS = 'clips/fixtures/controls';
const HARBOR = 'evals/golden/brand-kit/harbor';
const t = iso => Date.parse(iso);
const first = (rec, test) => Date.parse(rec.events.find(test).t);
const run = (rec, re) => rec.final.desks.find(d => re.test(d.task || ''));
const FULL = { x: 0, y: 0, w: 1440 };

export const CLIPS = [
  {
    name: 'floor-idle', seconds: 10, loop: true, gif: {},
    about: 'The floor of a real brand-kit job: desks wake as their agents start and sleep when they stop.',
    record: HARBOR, project: 'harbor',
    time: () => [[0, t('2026-10-19T01:28:22Z')], [0.7, t('2026-10-19T01:28:36Z')], [3.1, t('2026-10-19T01:33:30Z')], [3.7, t('2026-10-19T01:34:03Z')], [8.6, t('2026-10-19T01:40:12Z')], [10, t('2026-10-19T01:40:30Z')]],
    posterAt: 4.4,
  },
  {
    name: 'the-pick', seconds: 7, gif: {},
    about: 'Three roughs on the board, the Art Director picks one and the ring draws round it.',
    record: CARD, project: 'deskstudio',
    time: rec => { const ad = run(rec, /^pick/); return [[0, t(ad.startedAt) - 4000], [1.2, t(ad.startedAt) + 1000], [4.4, first(rec, e => e.type === 'job.pick') - 500], [4.6, first(rec, e => e.type === 'job.pick') + 400], [7, first(rec, e => e.type === 'job.pick') + 2000]]; },
    camera: [[0, 0, '#floor'], [2.6, 3.6, '#board']],
    zoom: [[0, 0, { x: 0, y: 56, w: 1000 }]],
    posterAt: 6.5,
  },
  {
    name: 'before-after', seconds: 9, gif: {},
    about: 'Three polish rounds: proof, the score against the bar, again until it signs off.',
    record: CARD, project: 'deskstudio',
    time: rec => { const p1 = run(rec, /^polish round 1/); return [[0, t(p1.startedAt) - 2000], [2.6, first(rec, e => e.type === 'job.score' && e.round === 1) + 500], [5.2, first(rec, e => e.type === 'job.score' && e.round === 2) + 500], [8, rec.t1], [9, rec.t1 + 2000]]; },
    camera: [[0, 0, '#board']],
    zoom: [[0, 0, { x: 650, y: 100, w: 780 }]],
    posterAt: 8.7,
  },
  {
    name: 'cost-meter', seconds: 8, gif: {},
    about: 'Round, score, cost and time as the desks report, from the first rough to the sign-off.',
    record: CARD, project: 'deskstudio',
    time: rec => [[0, t(rec.final.startedAt) + 2000], [6, rec.t1], [8, rec.t1 + 3000]],
    zoom: [[0, 0, { x: 560, y: 56, w: 880 }]],
    posterAt: 7.8,
  },
  {
    name: 'pick-it-yourself', seconds: 8, gif: {},
    about: 'Pick a rough yourself, over the Art Director, then the Art Director starts on the pick.',
    record: CARD, project: 'deskstudio',
    time: rec => { const ad = run(rec, /^pick/); const r3 = Math.max(...rec.final.desks.filter(d => /^rough/.test(d.task)).map(d => t(d.updatedAt))); return [[0, r3 + 1500], [4.2, r3 + 1600], [8, t(ad.startedAt) + 50000]]; },
    camera: [[0, 0, '#board']],
    zoom: [[0, 0, { x: 0, y: 56, w: 1000 }]],
    actions: [[0.8, async k => { await k.point('#board button[data-act="pick"][data-n="2"]', 1.1); }], [2.0, async k => { await k.click('#board button[data-act="pick"][data-n="2"]'); }]],
    posterAt: 7.5,
  },
  {
    name: 'swap-the-seat', seconds: 9, gif: {},
    about: 'Move the builder role to another model for this job, then the next polish round runs on it.',
    record: CONTROLS, project: 'deskstudio', skipControl: true,
    time: rec => { const p = run(rec, /^polish round 1/); return [[0, t(p.startedAt) - 1200], [6.2, t(p.startedAt) - 1100], [9, t(p.startedAt) + 15000]]; },
    actions: [
      [0.5, async k => { await k.point('.room.workshop button[data-act="tier"]', 0.9); }],
      [1.5, async k => { await k.click('.room.workshop button[data-act="tier"]'); }],
      [2.4, async k => { await k.point('#modelSelect', 0.6); }],
      [3.1, async k => { await k.select('#modelSelect', 'anthropic/sonnet'); }],
      [3.6, async k => { await k.point('#sheet button[data-act="model"][data-scope="job"]', 0.5); }],
      [4.2, async k => { await k.click('#sheet button[data-act="model"][data-scope="job"]'); }],
      [5.2, async k => { await k.point('#sheet button[data-act="close"]', 0.4); }],
      [5.7, async k => { await k.click('#sheet button[data-act="close"]'); }],
    ],
    posterAt: 8.5,
  },
  {
    name: 'note-to-the-desk', seconds: 10, gif: {},
    about: 'A note typed to the UI Designer goes into its next prompt, then the next round starts.',
    record: CONTROLS, project: 'deskstudio', skipControl: true,
    time: rec => { const p = run(rec, /^polish round 1/); return [[0, t(p.startedAt) - 1200], [7.2, t(p.startedAt) - 1100], [10, t(p.startedAt) + 15000]]; },
    actions: [
      [0.5, async k => { await k.point('#floor button.desk[data-slug="ui-designer"]', 0.9); }],
      [1.5, async k => { await k.click('#floor button.desk[data-slug="ui-designer"]'); }],
      [2.2, async k => { await k.point('#noteText', 0.5); }],
      [2.8, async k => { await k.type('#noteText', 'More air around the headline. One accent only.', 3); }],
      [5.6, async k => { await k.point('#sheet button[data-act="note"]', 0.4); }],
      [6.1, async k => { await k.click('#sheet button[data-act="note"]'); }],
      [6.7, async k => { await k.click('#sheet button[data-act="close"]'); }],
    ],
    posterAt: 9.5,
  },
  {
    name: 'walkthrough', seconds: 50,
    about: 'A whole job on the dashboard, from the request to the sign-off and the files, with captions.',
    record: CARD, project: 'deskstudio',
    time: rec => [
      [0, t(rec.final.startedAt) - 9000], [2.2, t(rec.final.startedAt) - 1000], [2.8, t('2026-10-19T05:25:20Z')],
      [6.8, t('2026-10-19T05:26:00Z')], [9.6, t('2026-10-19T05:27:00Z')], [11, t('2026-10-19T05:27:24Z')],
      [14.2, t('2026-10-19T05:30:01Z')], [16.5, t('2026-10-19T05:30:10Z')], [22, t('2026-10-19T05:37:42Z')],
      [28, t('2026-10-19T05:53:21Z')], [32.5, rec.t1], [50, rec.t1 + 20000]
    ],
    camera: [[9.4, 10.4, '#board'], [15.2, 16.2, 0], [33.4, 34.6, '#board'], [37.3, 38.3, { sel: '#board .files', off: 470 }], [41.6, 42.8, '#ledger']],
    crf: 25,
    captions: [
      [0.3, 2.9, 'A real job from this repo, replayed and sped up'],
      [3.0, 6.6, 'You ask your agent for <code>/desk:design a launch card for LinkedIn</code>'],
      [6.8, 10.3, 'The Design Manager staffs it. Three UI Designer agents make three roughs'],
      [10.6, 15.0, 'The roughs land on the review board. The Art Director picks one and says why'],
      [16.4, 21.8, 'A cheap model polishes, proof checks the pixels, the Creative Director scores it'],
      [22.0, 27.6, '8.4 is under the bar of 8.5, so it goes round again'],
      [27.8, 32.4, '8.5, but originality is still under 8. One more round'],
      [32.6, 37.4, 'Signed off at 8.9, every axis at 8 or above'],
      [37.6, 41.4, 'The files are in <code>.desk/out/&lt;job&gt;/</code>, linked from the board'],
      [42.9, 49.6, 'What each desk did, and what it cost at list price'],
    ],
    posterAt: 33.2,
  },
];
