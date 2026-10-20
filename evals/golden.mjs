#!/usr/bin/env node
// Marks an eval result as golden: the signed-off output the gallery and the site show.
//   node evals/golden.mjs add evals/results/<run>/<case> [--as <deliverable>/<name>]
//   node evals/golden.mjs list
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const goldenDir = join(root, 'evals', 'golden');
const [cmd, src, ...rest] = process.argv.slice(2);

if (cmd === 'list') {
  if (!existsSync(goldenDir)) { console.log('no golden outputs yet'); process.exit(0); }
  for (const d of readdirSync(goldenDir)) for (const n of readdirSync(join(goldenDir, d))) {
    const meta = JSON.parse(readFileSync(join(goldenDir, d, n, 'golden.json'), 'utf8'));
    console.log(`${d}/${n}  average ${meta.average}  cost ${meta.cost?.total ?? '?'}  from ${meta.from}`);
  }
  process.exit(0);
}
if (cmd !== 'add' || !src) { console.error('usage: golden.mjs add <result case dir> [--as deliverable/name] | list'); process.exit(1); }

const from = resolve(src);
const state = JSON.parse(readFileSync(join(from, 'state.json'), 'utf8'));
const score = state.scores?.at(-1);
if (!score?.pass) { console.error('refusing: the last score is not a pass'); process.exit(1); }
const flagVal = f => { const i = rest.indexOf(f); return i >= 0 ? rest[i + 1] : null; };
const asIdx = rest.indexOf('--as');
const target = asIdx >= 0 ? rest[asIdx + 1] : `${state.deliverable || 'unknown'}/${basename(from)}`;
const dest = join(goldenDir, target);
mkdirSync(dest, { recursive: true });
for (const f of ['final.html', 'state.json']) if (existsSync(join(from, f))) cpSync(join(from, f), join(dest, f));
if (existsSync(join(from, 'renders'))) cpSync(join(from, 'renders'), join(dest, 'renders'), { recursive: true });
writeFileSync(join(dest, 'golden.json'), JSON.stringify({ from: src, markedAt: new Date().toISOString(), deliverable: state.deliverable, sizes: state.sizes, quality: state.quality, models: state.models, rounds: state.round, average: score.average, axes: score.axes, cost: state.cost, ...(flagVal('--command') ? { command: flagVal('--command') } : {}), ...(flagVal('--brand') ? { brand: flagVal('--brand') } : {}), ...(flagVal('--note') ? { note: flagVal('--note') } : {}) }, null, 2) + '\n');
console.log(`golden: ${dest}`);
