import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runJob } from '../run.mjs';
import { makeFake } from '../providers/fake.mjs';
import { BRIEF, BRAND, roughReply, polishReply, PICK, SCORES_PASS, SCORES_FAIL, PEN, tempProject } from './fixtures.mjs';

const quiet = () => {};
const ASK = 'a LinkedIn card announcing Desk Studio. Copy: Your own design studio.';
const roughs = [roughReply(1, 'Editorial split'), roughReply(2, 'Full bleed with scrim'), roughReply(3, 'Type only')];
const events = dir => readFileSync(join(dir, '.desk', 'events.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));

test('a job passes on round one and hands back with scores, cost and files', { timeout: 120000 }, async () => {
  const dir = tempProject();
  const fake = makeFake({ brief: BRIEF('linkedin'), roughs, pick: PICK, polish: polishReply(), scores: SCORES_PASS });
  const r = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 4, invoke: fake.runModel, log: quiet, now: new Date(2026, 9, 18, 18, 30) });
  assert.equal(r.code, 0, r.error?.message);
  assert.match(r.id, /^20261018-1830-linkedin-desk-studio$/);
  const out = join(dir, '.desk', 'out', r.id);
  assert.ok(existsSync(join(out, 'final.html')));
  assert.ok(existsSync(join(out, 'rough-1.html')) && existsSync(join(out, 'rough-3.html')));
  assert.ok(existsSync(join(out, 'handback.md')));
  const state = JSON.parse(readFileSync(join(dir, '.desk', 'jobs', r.id, 'state.json'), 'utf8'));
  assert.equal(state.phase, 'done');
  assert.equal(state.round, 1);
  assert.equal(state.pick.rough, 2);
  assert.equal(state.pick.by, 'art-director');
  assert.equal(state.scores.length, 1);
  assert.equal(state.scores[0].average, 8.75);
  assert.equal(state.proof[0].pass, true);
  assert.equal(state.cost.complete, true);
  assert.ok(state.cost.total > 0 && state.cost.director > 0 && state.cost.senior > 0 && state.cost.builder > 0);
  assert.ok(!JSON.stringify(state).includes('Desk Studio'), 'the ask never lands in state');
  assert.match(r.handback, /^Done: social-card for a LinkedIn card announcing Desk, \d+ files in/);
  assert.match(r.handback, /Scores: hierarchy 9, .*average 8.75, pass/);
  assert.match(r.handback, /Rounds: 1 of 4\. Proof: passed on round 1\./);
  assert.match(r.handback, /Cost: director 0\.0\d, senior 0\.0\d, builder 0\.01, total 0\.0\d \(list prices, from the CLI\)$/m);
  assert.match(r.handback, /Open: none/);
  assert.match(r.handback, /<!-- desk:memory/);
  const brief = readFileSync(join(dir, '.desk', 'jobs', r.id, 'brief.md'), 'utf8');
  assert.match(brief, /^<!-- ask: a LinkedIn card announcing Desk -->\n- \*\*Deliverable/);
  // the desks saw what they should
  const calls = fake.calls;
  assert.equal(calls.filter(c => c.desk === 'ui-designer').length, 4, 'three roughs and one polish');
  assert.equal(calls.filter(c => c.desk === 'art-director')[0].images, 3, 'pick sees one screenshot per rough per size');
  assert.equal(calls.filter(c => c.desk === 'creative-director')[0].images, 1);
  assert.ok(calls.find(c => c.desk === 'art-director').prompt.includes('rough 1 editorial split'));
  const polish = calls.filter(c => c.desk === 'ui-designer')[3];
  assert.match(polish.prompt, /Notes to apply, in order:\n1\. Headline from 56px/);
  assert.match(polish.prompt, /## Current final\.html/);
  assert.equal(calls.filter(c => c.desk === 'ui-designer' && c.spec === 'anthropic/sonnet').length, 3, 'roughs at the senior model');
  assert.equal(polish.spec, 'anthropic/haiku');
  const types = events(dir).map(e => e.type);
  for (const t of ['job.start', 'job.phase', 'desk.start', 'desk.stop', 'job.pick', 'job.proof', 'job.score', 'job.done']) assert.ok(types.includes(t), `event ${t}`);
  const stop = events(dir).find(e => e.type === 'desk.stop' && e.desk === 'creative-director');
  assert.deepEqual(stop.tokens, { input: 1000, output: 500, cacheRead: 200, cacheWrite: 100, total: 1800 }, 'desk.stop carries tokens like the native hook');
  assert.equal(stop.costUsd, 0.01);
  assert.equal(stop.model, 'anthropic/opus');
  assert.equal(stop.tier, 'director');
  assert.deepEqual(state.tokens, { director: 1800 * 3, senior: 1800 * 3, builder: 1800 }, 'tokens roll up by tier');
  assert.ok(state.desks.every(d => d.startedAt && d.updatedAt && ['done', 'failed'].includes(d.status)));
  assert.ok(state.finishedAt && state.pick.at);
  assert.ok(!readFileSync(join(dir, '.desk', 'events.jsonl'), 'utf8').includes('Your own design studio'), 'no copy in the event log');
  const project = JSON.parse(readFileSync(join(dir, '.desk', 'project.json'), 'utf8'));
  assert.match(project.decisions[0], /Full bleed with scrim works for this brand's social-card/);
});

test('under the bar sends the notes back and passes on round two', { timeout: 120000 }, async () => {
  const dir = tempProject();
  const fake = makeFake({ brief: BRIEF('linkedin'), roughs, pick: PICK, polish: polishReply(), scores: [SCORES_FAIL('hierarchy', 7), SCORES_PASS] });
  const r = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 4, invoke: fake.runModel, log: quiet });
  assert.equal(r.code, 0, r.error?.message);
  assert.equal(r.state.round, 2);
  assert.equal(r.state.scores.length, 2);
  const second = fake.calls.filter(c => c.desk === 'ui-designer')[4];
  assert.match(second.prompt, /Polish round 2 of 4/);
  assert.match(second.prompt, /1\. hierarchy: headline up 24px/);
  assert.match(r.handback, /Rounds: 2 of 4/);
});

test('a proof failure goes back to the builder, never to the director', { timeout: 120000 }, async () => {
  const dir = tempProject();
  const fake = makeFake({ brief: BRIEF('linkedin'), roughs, pick: PICK, polish: [polishReply('p{color:#3a3a3f}', 'bad'), polishReply('', 'good')], scores: SCORES_PASS });
  const r = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 4, invoke: fake.runModel, log: quiet });
  assert.equal(r.code, 0, r.error?.message);
  assert.deepEqual(r.state.proof.map(p => p.pass), [false, true]);
  assert.equal(r.state.scores.length, 1, 'the director saw only the round that passed proof');
  const second = fake.calls.filter(c => c.desk === 'ui-designer')[4];
  assert.match(second.prompt, /proof contrast at linkedin/);
  assert.match(r.handback, /Proof: passed on round 2 after 1 fix\./);
});

test('plain copy from a Markdown intake is enforced before sign-off', { timeout: 120000 }, async () => {
  const dir = tempProject();
  const brief = '## Deliverable\nA social card.\n## Sizes\n`linkedin`\n## Copy\nYour own design studio.\n\nPreserve this sentence verbatim.\n## Brand\nUse DESIGN.md.\n';
  const missing = polishReply().replace('Your own design studio.', 'A different headline.');
  const fake = makeFake({ brief, roughs, pick: PICK, polish: [missing, polishReply()], scores: SCORES_PASS });
  const r = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 3, invoke: fake.runModel, log: quiet });
  assert.equal(r.code, 0, r.error?.message);
  assert.deepEqual(r.state.sizes, ['linkedin']);
  assert.deepEqual(r.state.proof.map(p => p.pass), [false, true]);
  const revised = fake.calls.filter(c => c.desk === 'ui-designer')[4];
  assert.match(revised.prompt, /proof copy at linkedin/);
  assert.equal(r.state.scores.length, 1);
});

test('the cap hands back under the bar with waitingOn set and exit 4', { timeout: 120000 }, async () => {
  const dir = tempProject();
  const fake = makeFake({ brief: BRIEF('linkedin'), roughs, pick: PICK, polish: polishReply(), scores: SCORES_FAIL('originality', 6) });
  const r = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 2, invoke: fake.runModel, log: quiet });
  assert.equal(r.code, 4);
  assert.equal(r.state.phase, 'done');
  assert.equal(r.state.waitingOn.type, 'approve_under_bar');
  assert.match(r.handback, /Scores: .*under the bar/);
  assert.match(r.handback, /Open: originality under 8, originality: headline up 24px/);
  assert.ok(!r.handback.includes('desk:memory'), 'no decision saved for an under-bar job');
  assert.ok(events(dir).some(e => e.type === 'job.waiting' && e.type === 'job.waiting'), 'job.waiting event');
});

test('escalation: three misses move the pen to the senior, then the Art Director, then back', { timeout: 180000 }, async () => {
  const dir = tempProject();
  const fail = SCORES_FAIL('composition', 6);
  const fake = makeFake({ brief: BRIEF('linkedin'), roughs, pick: PICK, polish: polishReply(), pen: PEN, scores: [fail, fail, fail, fail, fail, fail, fail, SCORES_PASS] });
  const r = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 8, invoke: fake.runModel, log: quiet });
  assert.equal(r.code, 0, r.error?.message);
  const polishCalls = fake.calls.filter(c => (c.desk === 'ui-designer' && /Polish round/.test(c.prompt)) || (c.desk === 'art-director' && /take the pen/.test(c.prompt)));
  const seats = polishCalls.map(c => `${c.desk}@${c.spec}`);
  assert.deepEqual(seats.slice(0, 3), ['ui-designer@anthropic/haiku', 'ui-designer@anthropic/haiku', 'ui-designer@anthropic/haiku']);
  assert.deepEqual(seats.slice(3, 6), ['ui-designer@anthropic/sonnet', 'ui-designer@anthropic/sonnet', 'ui-designer@anthropic/sonnet']);
  assert.equal(seats[6], 'art-director@anthropic/opus');
  assert.equal(seats[7], 'ui-designer@anthropic/haiku');
  assert.match(r.handback, /UI Designer polish x3 escalated \(sonnet\), Art Director pen x1 \(opus\)/);
});

test('no DESIGN.md: the brand step writes one from the project before intake', { timeout: 120000 }, async () => {
  const dir = tempProject({ withBrand: false });
  const fake = makeFake({ brand: BRAND, brief: BRIEF('linkedin'), roughs, pick: PICK, polish: polishReply(), scores: SCORES_PASS });
  const r = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 2, invoke: fake.runModel, log: quiet, brand: '#0f62fe' });
  assert.equal(r.code, 0, r.error?.message);
  assert.ok(existsSync(join(dir, '.desk', 'DESIGN.md')));
  const brandCall = fake.calls.find(c => c.desk === 'brand');
  assert.match(brandCall.prompt, /One colour for the brand: #0f62fe/);
  assert.match(brandCall.prompt, /### package.json/);
  assert.equal(brandCall.spec, 'anthropic/opus');
});

test('two sizes render and reach the pick and the sign-off', { timeout: 180000 }, async () => {
  const dir = tempProject();
  const fake = makeFake({ brief: BRIEF('linkedin, ig-post'), roughs, pick: PICK, polish: polishReply(), scores: SCORES_PASS });
  const r = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 2, invoke: fake.runModel, log: quiet, models: { builder: 'google/flash' } });
  assert.equal(r.code, 0, r.error?.message);
  assert.deepEqual(r.state.sizes, ['linkedin', 'ig-post']);
  assert.equal(fake.calls.find(c => c.desk === 'art-director').images, 6);
  assert.equal(fake.calls.find(c => c.desk === 'creative-director').images, 2);
  assert.equal(fake.calls.filter(c => c.desk === 'ui-designer')[3].spec, 'google/flash');
  assert.match(r.handback, /renders at linkedin and ig-post/);
  assert.match(r.handback, /UI Designer polish x1 \(flash\)/);
});

test('a bundled brand font is spliced by the runner into every file and proof sees it', { timeout: 180000 }, async () => {
  const dir = tempProject();
  const geistBrand = BRAND.replace('family: "Arial"', 'family: "Geist, Inter, Arial, sans-serif"');
  writeFileSync(join(dir, '.desk', 'DESIGN.md'), geistBrand);
  const geistCard = extra => polishReply(extra, 'geist').replace('font-family:Arial,sans-serif', 'font-family:"Geist", "Inter", Arial, sans-serif');
  const geistRoughs = roughs.map(r => r.replace('font-family:Arial,sans-serif', 'font-family:"Geist", "Inter", Arial, sans-serif'));
  const fake = makeFake({ brief: BRIEF('linkedin'), roughs: geistRoughs, pick: PICK, polish: geistCard(''), scores: SCORES_PASS });
  const r = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 2, invoke: fake.runModel, log: quiet });
  assert.equal(r.code, 0, r.error?.message || r.handback);
  const out = join(dir, '.desk', 'out', r.id);
  const final = readFileSync(join(out, 'final.html'), 'utf8');
  assert.ok(final.includes('/* desk:font start */') && final.includes('font-family: "Geist"') && final.includes('data:font/woff2;base64,'), 'the block is in final.html');
  assert.ok(readFileSync(join(out, 'rough-1.html'), 'utf8').includes('/* desk:font start */'), 'and in every rough');
  assert.ok(existsSync(join(out, 'fonts-geist.css')));
  assert.equal(r.state.proof[0].pass, true, 'proof passes its font check');
  const polish = fake.calls.filter(c => c.desk === 'ui-designer')[3];
  assert.match(polish.prompt, /The brand font Geist is inlined by the runner/);
  assert.ok(!polish.prompt.includes('data:font/woff2'), 'the data URI never reaches a prompt');
  assert.match(fake.calls.find(c => c.desk === 'ui-designer').prompt, /font-family: "Geist", "Inter", Arial, sans-serif/);
});
