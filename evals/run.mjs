#!/usr/bin/env node
// Runs eval cases through the plugin headlessly and collects scores, rounds and cost.
//   node evals/run.mjs                     all cases
//   node evals/run.mjs --case design-card-northlight --quality thrifty --rounds 5
//   node evals/run.mjs --list
// Each case is evals/cases/<name>.json: { command, ask, brand, sizes, mustAppear, rounds, expect: { pass, minAverage } }
// Results land in evals/results/<timestamp>/ with a summary.json and summary.md, plus the final renders per case.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const casesDir = join(root, 'evals', 'cases');
const names = readdirSync(casesDir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
if (args.includes('--list')) { console.log(names.join('\n')); process.exit(0); }
const picked = flag('--case') ? [flag('--case')] : names;
const quality = flag('--quality') || 'studio';
const pluginDir = flag('--plugin-dir') || root;
const keep = args.includes('--keep');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = join(root, 'evals', 'results', `${stamp}-${quality}${flag('--case') ? '-' + flag('--case') : ''}`);
mkdirSync(outDir, { recursive: true });

const results = [];
for (const name of picked) {
  const c = JSON.parse(readFileSync(join(casesDir, `${name}.json`), 'utf8'));
  const proj = join(tmpdir(), `desk-eval-${name}-${Date.now()}`);
  mkdirSync(join(proj, '.desk'), { recursive: true });
  if (c.brand) cpSync(join(root, 'evals', 'brands', c.brand, 'DESIGN.md'), join(proj, '.desk', 'DESIGN.md'));
  for (const [dest, src] of Object.entries(c.files || {})) { mkdirSync(dirname(join(proj, dest)), { recursive: true }); cpSync(join(root, 'evals', src), join(proj, dest)); }
  // Files from a real project on this machine, so the brand is found in it rather than handed over.
  for (const [dest, src] of Object.entries(c.external || {})) { if (!existsSync(src)) { console.log(`skipping missing ${src}`); continue; } mkdirSync(dirname(join(proj, dest)), { recursive: true }); cpSync(src, join(proj, dest)); }
  writeFileSync(join(proj, 'package.json'), JSON.stringify({ name: `eval-${name}`, private: true }));
  const must = (c.mustAppear || []).map(s => `'${s}'`).join(' and ');
  const prompt = `/desk:${c.command} ${c.ask}${must ? ` Copy that must appear: ${must}.` : ''} --quality ${quality} --rounds ${c.rounds || 6}`;
  console.log(`\n== ${name} (${quality}) ==\n${prompt}`);
  const started = Date.now();
  const env = { ...process.env }; delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT;
  const claude = (args) => spawnSync('claude', [...args, '--plugin-dir', pluginDir, '--permission-mode', 'bypassPermissions', '--output-format', 'text'], { cwd: proj, env, encoding: 'utf8', shell: false, maxBuffer: 64 * 1024 * 1024 });
  let run = claude(['-p', prompt]);
  let transcript = (run.stdout || '') + (run.stderr ? `\n--- stderr ---\n${run.stderr}` : '');
  // A case can answer the Manager (a pick, an approval) with `then`: each line continues the same session.
  for (const answer of c.then || []) {
    if (run.status !== 0) break;
    console.log(`-> ${answer}`);
    run = claude(['-p', answer, '--continue']);
    transcript += `\n\n--- then: ${answer} ---\n` + (run.stdout || '') + (run.stderr ? `\n--- stderr ---\n${run.stderr}` : '');
  }
  const elapsed = Math.round((Date.now() - started) / 1000);
  const caseOut = join(outDir, name);
  mkdirSync(caseOut, { recursive: true });
  writeFileSync(join(caseOut, 'handback.txt'), transcript);
  const jobsDir = join(proj, '.desk', 'jobs');
  const jobs = existsSync(jobsDir) ? readdirSync(jobsDir).sort() : [];
  const job = jobs.at(-1);
  let state = null;
  if (job && existsSync(join(jobsDir, job, 'state.json'))) {
    // Roll up the cost even when the job stopped early (a pick, a cap), so the row is honest.
    spawnSync('node', [join(root, 'scripts', 'state.mjs'), join(jobsDir, job), 'cost'], { cwd: proj, encoding: 'utf8', shell: false });
    state = JSON.parse(readFileSync(join(jobsDir, job, 'state.json'), 'utf8'));
    const rounds = existsSync(join(jobsDir, job, 'renders')) ? readdirSync(join(jobsDir, job, 'renders'), { withFileTypes: true }).filter(d => d.isDirectory() && /^round-\d+$/.test(d.name)).map(d => d.name).sort((a, b) => Number(a.slice(6)) - Number(b.slice(6))) : [];
    const last = rounds.at(-1);
    if (last) cpSync(join(jobsDir, job, 'renders', last), join(caseOut, 'renders'), { recursive: true });
    // Every round's renders, the roughs and the event log too, so a run can be replayed on the floor as a clip fixture.
    if (existsSync(join(jobsDir, job, 'renders'))) cpSync(join(jobsDir, job, 'renders'), join(caseOut, 'rounds'), { recursive: true, filter: src => !/\.background\.png$/.test(src) });
    if (existsSync(join(proj, '.desk', 'events.jsonl'))) cpSync(join(proj, '.desk', 'events.jsonl'), join(caseOut, 'events.jsonl'));
    const finalHtml = join(proj, '.desk', 'out', job, 'final.html');
    if (existsSync(finalHtml)) cpSync(finalHtml, join(caseOut, 'final.html'));
    cpSync(join(jobsDir, job, 'state.json'), join(caseOut, 'state.json'));
  }
  const score = state?.scores?.at(-1) || null;
  const outFiles = job && existsSync(join(proj, '.desk', 'out', job)) ? readdirSync(join(proj, '.desk', 'out', job)) : [];
  // Keep the whole out folder: directions, slides, frames and clips live in subfolders.
  if (outFiles.length) cpSync(join(proj, '.desk', 'out', job), caseOut, { recursive: true, filter: src => !/\.background\.png$/.test(src) });
  for (const f of ['brief.md', 'art-director-notes.md', 'control.json']) if (existsSync(join(jobsDir, job, f))) cpSync(join(jobsDir, job, f), join(caseOut, `job-${f}`));
  const kind = c.expect?.kind || 'scored';
  const met = kind === 'report'
    ? run.status === 0 && outFiles.length > 0
    : !!score && score.pass === (c.expect?.pass ?? true) && (score.average ?? 0) >= (c.expect?.minAverage ?? 8.5);
  const row = {
    name, command: c.command, brand: c.brand, quality, exit: run.status, elapsed,
    job, phase: state?.phase || null, rounds: state?.round ?? null,
    pass: score?.pass ?? null, average: score?.average ?? null, axes: score?.axes || null,
    cost: state?.cost || null, tokens: state?.tokens || null, files: outFiles,
    expect: c.expect || null, kind, met,
  };
  results.push(row);
  console.log(`${row.met ? 'met' : 'MISSED'}: pass=${row.pass} average=${row.average} rounds=${row.rounds} cost=${row.cost?.total ?? '?'} elapsed=${elapsed}s`);
  if (!keep) rmSync(proj, { recursive: true, force: true }); else console.log(`kept ${proj}`);
}

writeFileSync(join(outDir, 'summary.json'), JSON.stringify(results, null, 2));
const md = ['| case | brand | pass | average | rounds | cost (list) | elapsed | met |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...results.map(r => `| ${r.name} | ${r.brand} | ${r.pass} | ${r.average ?? ''} | ${r.rounds ?? ''} | ${r.cost?.total ?? ''}${r.cost && !r.cost.complete ? ' (incomplete)' : ''} | ${r.elapsed}s | ${r.met ? 'yes' : 'no'} |`)];
writeFileSync(join(outDir, 'summary.md'), md.join('\n') + '\n');
console.log(`\n${md.join('\n')}\n\nresults: ${outDir}`);
process.exit(results.every(r => r.met) ? 0 : 1);
