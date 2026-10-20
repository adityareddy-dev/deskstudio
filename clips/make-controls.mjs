#!/usr/bin/env node
// Makes the clip fixture where the floor's controls are used for real, on a real job (runner mode, Anthropic seats).
//   node clips/make-controls.mjs [--out clips/fixtures/controls] [--rounds 4]
// The job runs in a temp project. As soon as the first rough starts, the driver pauses it from the floor's own control
// code. When the job holds before the pick, the driver picks a rough, moves the builder seat to Sonnet and writes the UI
// Designer a note, all through applyControl (the function behind the floor's buttons), then continues the job. The whole
// .desk folder is copied out when the job ends, so the clips can replay it.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyControl } from '../dashboard/server.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter(Boolean));
const out = resolve(args.out || join(here, 'fixtures', 'controls'));
const rounds = args.rounds || '4';
const ASK = "a LinkedIn card for Desk Studio. Headline 'You run the floor.' and 'deskstudio.ai'. Copy that must appear: 'You run the floor.' and 'deskstudio.ai'.";
const NOTE = 'More air around the headline. One accent only.';

const proj = mkdtempSync(join(tmpdir(), 'desk-controls-'));
const desk = join(proj, '.desk');
mkdirSync(desk, { recursive: true });
cpSync(join(root, 'brand', 'DESIGN.md'), join(desk, 'DESIGN.md'));
writeFileSync(join(desk, 'dashboard.json'), JSON.stringify({ enabled: true }));
const env = { ...process.env }; delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT;
const log = m => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const jobState = () => {
  const dir = join(desk, 'jobs');
  if (!existsSync(dir)) return null;
  const id = readdirSync(dir).sort().at(-1);
  if (!id) return null;
  try { return { id, ...JSON.parse(readFileSync(join(dir, id, 'state.json'), 'utf8')) }; } catch { return null; }
};
const run = a => new Promise(res => { const p = spawn(process.execPath, [join(root, 'bin', 'desk-run'), ...a], { cwd: proj, env, stdio: ['ignore', 'inherit', 'inherit'] }); p.on('exit', c => res(c)); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let id = null, paused = false;
const first = run(['design', ASK, '--project', proj, '--rounds', rounds]);
// Pause the moment the first rough has started.
while (!paused) {
  await sleep(700);
  const s = jobState();
  if (s && (s.desks || []).some(d => /^rough/.test(d.task || ''))) {
    id = s.id;
    const r = applyControl(desk, id, { pause: true });
    log(`paused from the floor: ${r.status}`);
    paused = true;
  }
}
const code = await first;
log(`first run exited ${code} (3 means holding)`);
if (code !== 3) { console.error('The job did not hold before the pick, so there is nothing to steer. Output kept in ' + proj); process.exit(1); }
for (const body of [{ pick: 2 }, { models: { builder: 'anthropic/sonnet' } }, { note: { desk: 'ui-designer', text: NOTE } }, { pause: false }]) {
  const r = applyControl(desk, id, body);
  log(`${Object.keys(body)[0]}: ${r.status}${r.error ? ' ' + r.error : ''}`);
  await sleep(1200);
}
const code2 = await run(['resume', id, '--project', proj]);
log(`resume exited ${code2}`);
rmSync(out, { recursive: true, force: true });
cpSync(desk, out, { recursive: true, filter: s => !/\.background\.png$/.test(s) && !/dashboard\.(log|runtime)/.test(s) });
log(`fixture written to ${out}`);
const s = jobState();
console.log(JSON.stringify({ id, phase: s?.phase, round: s?.round, scores: (s?.scores || []).map(x => [x.round, x.average]), pick: s?.pick, models: s?.models, cost: s?.cost, exit: code2 }));
