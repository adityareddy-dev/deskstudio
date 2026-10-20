import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runJob, resumeJob } from '../run.mjs';
import { makeFake } from '../providers/fake.mjs';
import { jobId, jobPaths, writeJson } from '../state.mjs';
import { BRIEF, roughReply, polishReply, PICK, SCORES_PASS, tempProject } from './fixtures.mjs';

const quiet = () => {};
const ASK = 'a LinkedIn card announcing Desk Studio';
const roughs = [roughReply(1, 'a'), roughReply(2, 'b'), roughReply(3, 'c')];
const answers = () => ({ brief: BRIEF('linkedin'), roughs, pick: PICK, polish: polishReply(), scores: SCORES_PASS });

test('paused before the first call holds with exit 3, resume finishes the job', { timeout: 120000 }, async () => {
  const dir = tempProject();
  const now = new Date(2026, 9, 18, 19, 0);
  const id = jobId(ASK, now);
  const paths = jobPaths(join(dir, '.desk'), id);
  writeJson(paths.controlFile, { paused: true });
  const fake = makeFake(answers());
  const held = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 3, invoke: fake.runModel, log: quiet, now });
  assert.equal(held.code, 3);
  assert.equal(held.state.phase, 'paused');
  assert.equal(held.state.next, 'intake');
  assert.equal(fake.calls.length, 0, 'no model call while paused');
  const r = await resumeJob({ id, project: dir, invoke: fake.runModel, log: quiet });
  assert.equal(r.code, 0, r.error?.message);
  assert.equal(JSON.parse(readFileSync(paths.controlFile, 'utf8')).paused, false, 'resume clears the pause');
  assert.ok(existsSync(paths.finalFile));
});

test('a pause written mid-job holds at the next desk call and resume picks up the same round', { timeout: 120000 }, async () => {
  const dir = tempProject();
  const now = new Date(2026, 9, 18, 19, 5);
  const id = jobId(ASK, now);
  const paths = jobPaths(join(dir, '.desk'), id);
  const a = answers();
  a.pick = () => { writeJson(paths.controlFile, { paused: true }); return PICK; }; // the floor pauses while the AD is picking
  const fake = makeFake(a);
  const held = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 3, invoke: fake.runModel, log: quiet, now });
  assert.equal(held.code, 3);
  assert.equal(held.state.next, 'polish');
  assert.equal(held.state.round, 1);
  assert.equal(held.state.pick.rough, 2, 'the pick finished before the hold');
  const r = await resumeJob({ id, project: dir, invoke: fake.runModel, log: quiet });
  assert.equal(r.code, 0, r.error?.message);
  assert.equal(r.state.round, 1);
  assert.equal(fake.calls.filter(c => c.desk === 'art-director').length, 1, 'the pick did not run twice');
  assert.match(r.handback, /^Done:/);
});

test('control.json models move a tier for the rest of the job, pick overrides the Art Director, inbox notes reach the desk', { timeout: 120000 }, async () => {
  const dir = tempProject();
  const now = new Date(2026, 9, 18, 19, 10);
  const id = jobId(ASK, now);
  const paths = jobPaths(join(dir, '.desk'), id);
  writeJson(paths.controlFile, { models: { builder: 'openai/nano' }, pick: 3 });
  mkdirSync(paths.inboxDir, { recursive: true });
  writeFileSync(join(paths.inboxDir, 'ui-designer.md'), 'keep the mark small');
  writeFileSync(join(paths.inboxDir, 'creative-director.md'), 'be hard on copy');
  const fake = makeFake(answers());
  const r = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 3, invoke: fake.runModel, log: quiet, now });
  assert.equal(r.code, 0, r.error?.message);
  assert.equal(r.state.models.builder, 'openai/nano');
  const polish = fake.calls.filter(c => c.desk === 'ui-designer')[3];
  assert.equal(polish.spec, 'openai/nano');
  assert.equal(r.state.pick.by, 'user');
  assert.equal(r.state.pick.rough, 3);
  assert.match(fake.calls.find(c => c.desk === 'art-director').prompt, /already picked rough 3/);
  assert.match(r.handback, /Pick: rough 3, type only \(the user's pick\)/i);
  const firstRough = fake.calls.find(c => c.desk === 'ui-designer');
  assert.match(firstRough.prompt, /^## Note from the user\n\nkeep the mark small/);
  assert.ok(!existsSync(join(paths.inboxDir, 'ui-designer.md')), 'the note is consumed');
  assert.match(fake.calls.find(c => c.desk === 'creative-director').prompt, /^## Note from the user\n\nbe hard on copy/);
  assert.equal(fake.calls.filter(c => c.desk === 'ui-designer')[1].prompt.startsWith('## Note'), false, 'one note, one desk, once');
});

test('a failed desk call marks the job failed with a resume hint, and resume retries that step', { timeout: 120000 }, async () => {
  const dir = tempProject();
  const now = new Date(2026, 9, 18, 19, 15);
  const id = jobId(ASK, now);
  let boom = true;
  const base = makeFake(answers());
  const invoke = async args => { if (boom && /^# Creative Director/m.test(args.system)) { boom = false; throw new Error('the CLI fell over'); } return base.runModel(args); };
  const r1 = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 3, invoke, log: quiet, now });
  assert.equal(r1.code, 1);
  assert.equal(r1.state.phase, 'failed');
  assert.equal(r1.state.next, 'signoff');
  assert.equal(r1.state.waitingOn.type, 'question');
  assert.equal(r1.state.desks.at(-1).status, 'failed');
  const r2 = await resumeJob({ id, project: dir, invoke, log: quiet });
  assert.equal(r2.code, 0, r2.error?.message);
  assert.equal(r2.state.scores.length, 1);
  assert.equal(r2.state.cost.complete, false, 'the failed request did not report its usage');
  assert.match(r2.handback, /some costs are unknown/);
});

test('a failed rough waits for its peers and resume reuses their completed files', { timeout: 120000 }, async () => {
  const dir = tempProject();
  const base = makeFake(answers());
  const roughCalls = [];
  let fail = true;
  const invoke = async args => {
    if (/Composition pattern for this rough/.test(args.prompt)) {
      const match = /rough-(\d)\.html/.exec(args.prompt);
      const n = Number(match[1]);
      roughCalls.push(n);
      if (n === 1 && fail) { fail = false; throw new Error('rough one failed'); }
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    return base.runModel(args);
  };
  const first = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 3, invoke, log: quiet });
  assert.equal(first.code, 1);
  assert.equal(first.state.next, 'roughs');
  const paths = jobPaths(join(dir, '.desk'), first.id);
  assert.equal(first.state.desks.filter(d => d.status === 'working').length, 0);
  assert.equal(first.state.desks.filter(d => d.status === 'done').length, 3, 'intake and both peer roughs finished');
  assert.ok(existsSync(join(paths.outDir, 'rough-2.html')) && existsSync(join(paths.outDir, 'rough-3.html')));
  const second = await resumeJob({ id: first.id, project: dir, invoke, log: quiet });
  assert.equal(second.code, 0, second.error?.message);
  assert.deepEqual(roughCalls, [1, 2, 3, 1], 'only the failed rough is requested again');
  assert.equal(second.state.desks.filter(d => d.status === 'working').length, 0);
  const legacy = JSON.parse(readFileSync(paths.stateFile, 'utf8'));
  legacy.desks[0].status = 'working';
  writeJson(paths.stateFile, legacy);
  await resumeJob({ id: first.id, project: dir, invoke, log: quiet });
  assert.equal(JSON.parse(readFileSync(paths.stateFile, 'utf8')).desks.filter(d => d.status === 'working').length, 0, 'legacy terminal snapshots cannot leave desks lit');
});
