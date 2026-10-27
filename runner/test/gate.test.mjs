import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runJob } from '../run.mjs';
import { makeFake } from '../providers/fake.mjs';
import { BRIEF, roughReply, polishReply, PICK, SCORES_FAIL, tempProject } from './fixtures.mjs';

const quiet = () => {};
const ASK = 'a LinkedIn card announcing Desk Studio. Copy: Your own design studio.';
const roughs = [roughReply(1, 'Editorial split'), roughReply(2, 'Full bleed with scrim'), roughReply(3, 'Type only')];

test('the gate at the cap ships the last round that passed proof, not the last round', { timeout: 120000 }, async () => {
  const dir = tempProject();
  // Round 1 passes proof and misses the bar; round 2 breaks contrast and the cap is reached.
  const fake = makeFake({ brief: BRIEF('linkedin'), roughs, pick: PICK, polish: [polishReply('', 'good'), polishReply('p{color:#3a3a3f}', 'bad')], scores: SCORES_FAIL('originality', 6) });
  const r = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 2, invoke: fake.runModel, log: quiet });
  assert.equal(r.code, 4);
  assert.deepEqual(r.state.proof.map(p => p.pass), [true, false]);
  assert.deepEqual(r.state.gate, { shipped: 'last passing round', round: 1, failedRound: 2 });
  const final = readFileSync(join(dir, r.state.files.final), 'utf8');
  assert.equal(final, readFileSync(join(dir, r.state.lastPass.file), 'utf8'), 'final.html is the round 1 file');
  assert.ok(final.includes('good') && !final.includes('#3a3a3f'));
  assert.match(r.state.waitingOn.text, /Shipped round 1, the last round that passed proof; round 2 failed it/);
  assert.match(r.handback, /Gate: shipped round 1, the last that passed proof \(round 2 failed it\)/);
});

test('the gate ships nothing when no round passed proof', { timeout: 120000 }, async () => {
  const dir = tempProject();
  const fake = makeFake({ brief: BRIEF('linkedin'), roughs, pick: PICK, polish: polishReply('p{color:#3a3a3f}', 'bad'), scores: SCORES_FAIL('originality', 6) });
  const r = await runJob({ command: 'design', ask: ASK, project: dir, rounds: 2, invoke: fake.runModel, log: quiet });
  assert.equal(r.code, 4);
  assert.deepEqual(r.state.proof.map(p => p.pass), [false, false]);
  assert.equal(r.state.gate.failed, true);
  assert.equal(r.state.gate.shipped, null);
  assert.ok(!existsSync(join(dir, r.state.files.final)), 'no final.html ships');
  assert.ok(existsSync(join(dir, r.state.gate.kept)));
  assert.match(r.handback, /Gate: no round passed proof, nothing shipped, job failed/);
});
