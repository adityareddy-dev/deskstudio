#!/usr/bin/env node
// desk-run: the Design Manager's loop as a program, so the same desks work in any coding agent.
// Mirrors skills/desk/SKILL.md: intake, roughs, pick, polish, proof, sign-off, escalation, cap, handback.
//
//   desk-run <command> "<ask>" [--project DIR] [--quality studio|best|thrifty] [--rounds N]
//            [--models director=anthropic/opus,builder=google/flash] [--brand #hex|path] [--timeout MIN]
//   desk-run resume <id> [--project DIR]
//   desk-run doctor [--probe]
//   desk-run providers
//
// Exit codes: 0 done at the bar, 4 handed back under the bar, 3 holding (paused), 1 failed, 2 usage.
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, basename, extname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getCommand, COMMANDS } from './commands.mjs';
import { PRESETS, TIERS, resolveModel, parseModelsFlag, chooseDefaults, loadModels, providerDefaults, deskInfo, deskName, normalizeUsage } from './models.mjs';
import { parsePick, parseScores, parseEscalation, parseBuilderReturn, extractHtml, parseBrief, parsePatterns, AXES } from './parse.mjs';
import * as S from './state.mjs';
import { run as execRun } from './providers/exec.mjs';
import { loadBrandFont, injectFont, stripFont } from './fonts.mjs';

const ROOT = S.ROOT;
const SKILL_DIR = join(ROOT, 'skills', 'desk');
const PROOF_CLI = join(ROOT, 'proof', 'cli.mjs');

const RUNNER_NOTE = `## Runner note

You are working through desk-run, Desk Studio's runner, not inside a coding agent. You have no tools and no file access. Everything your brief tells you to read is in the message below, in full. Where the brief says to write a file, return the whole file as one fenced block tagged html and the runner writes it to the path named. Where it says to run proof, skip that, the runner runs proof after you return. Where it says to look at a screenshot, the screenshots are attached to the message in the order the message lists them. Return the shape your brief defines and nothing else around it.`;

class Hold extends Error { constructor(phase) { super(`holding at ${phase}`); this.phase = phase; this.hold = true; } }

// ---------- texts ----------

function skillText(relPath) {
  const file = join(SKILL_DIR, relPath);
  if (!existsSync(file)) throw new Error(`Missing ${file}. The runner needs skills/desk next to it.`);
  return readFileSync(file, 'utf8').replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, ROOT.split('\\').join('/'));
}

function loadTexts(cmd) {
  const roles = {};
  for (const desk of cmd.desks) roles[desk] = skillText(join('roles', `${desk}.md`));
  return {
    skill: skillText('SKILL.md'),
    houseStyle: skillText('house-style.md'),
    rubric: skillText('rubric.md'),
    standard: skillText(join('standards', `${cmd.standard}.md`)),
    sizesDoc: skillText(join('procedures', 'sizes.md')),
    handbackDoc: skillText(join('procedures', 'handback.md')),
    brandProc: skillText(join('procedures', 'brand-from-project.md')),
    roles,
  };
}

function knownSizes(texts) {
  return [...texts.sizesDoc.matchAll(/^\|\s*([a-z0-9-]+)\s*\|\s*\d+x/gm)].map(m => m[1]);
}

function section(title, body) {
  return `\n## ${title}\n\n${String(body ?? '(none)').trim()}\n`;
}

function fiveWords(ask) {
  return String(ask).split(/copy\s*:/i)[0].replace(/--\S+(\s+\S+)?/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 5).join(' ');
}

// ---------- the job ----------

export function parseAskFlags(ask) {
  const out = { ask: String(ask || '') };
  out.ask = out.ask.replace(/\s--quality\s+(studio|best|thrifty)\b/i, (_, q) => { out.quality = q.toLowerCase(); return ''; });
  out.ask = out.ask.replace(/\s--rounds\s+(\d{1,2})\b/i, (_, n) => { out.rounds = Number(n); return ''; });
  out.ask = out.ask.trim();
  return out;
}

function makeCtx({ project, invoke, log, timeoutMs }) {
  const projectDir = resolve(project || process.cwd());
  const deskDir = S.findDesk(projectDir);
  return { projectDir, deskDir, invoke, log: log || (m => process.stderr.write(`[desk] ${m}\n`)), timeoutMs: timeoutMs || 15 * 60 * 1000 };
}

function tierModels(projectCfg, quality, overrides) {
  const base = quality && projectCfg.presets?.[quality] ? projectCfg.presets[quality] : PRESETS[quality] || projectCfg.models;
  const models = { ...projectCfg.models, ...base, ...(overrides || {}) };
  for (const tier of TIERS) resolveModel(models[tier]);
  return { director: models.director, senior: models.senior, builder: models.builder };
}

// Starts a job. Returns { code, id, state, handback }.
export async function runJob({ command, ask, project, quality, rounds, models, brand, invoke, log, timeoutMs, now }) {
  const ctx = makeCtx({ project, invoke, log, timeoutMs });
  const cmd = getCommand(command);
  for (const desk of cmd.desks) if (!deskInfo(desk)) throw new Error(`Command ${cmd.name} staffs "${desk}", which is not in skills/desk/desks.json.`);
  const flags = parseAskFlags(ask);
  if (!flags.ask) throw new Error('Give the ask in quotes, for example desk-run design "a launch card for LinkedIn".');
  const projectCfg = S.readProject(ctx.deskDir);
  quality = quality || flags.quality || projectCfg.quality || 'studio';
  const maxRounds = Math.min(12, Math.max(1, Number(rounds || flags.rounds || projectCfg.maxRounds || 8)));
  const tiers = tierModels(projectCfg, quality, models);
  const id = S.jobId(flags.ask, now);
  const paths = S.jobPaths(ctx.deskDir, id);
  S.ensureJobDirs(paths);
  ctx.paths = paths; ctx.cmd = cmd; ctx.texts = loadTexts(cmd); ctx.brandHint = brand || null; ctx.ask = flags.ask;
  ctx.state = S.writeState(paths, {
    id, command: cmd.name, deliverable: cmd.deliverable, sizes: cmd.sizes.slice(), quality,
    models: tiers, phase: 'intake', round: 0, maxRounds, desks: [], pick: null, proof: [], scores: [],
    waitingOn: null, cost: { director: 0, senior: 0, builder: 0, total: 0, complete: true }, tokens: { director: 0, senior: 0, builder: 0 },
    files: { final: S.rel(ctx.projectDir, paths.finalFile), brief: S.rel(ctx.projectDir, paths.briefFile) },
    pen: 'builder', notes: [], misses: {}, startedAt: S.localIso(), updatedAt: S.localIso(),
  });
  S.emit(ctx.projectDir, 'job.start', { id, command: cmd.name, deliverable: cmd.deliverable });
  ctx.log(`job ${id} in ${S.rel(ctx.projectDir, paths.jobDir) || '.'} (${quality}: director ${tiers.director}, senior ${tiers.senior}, builder ${tiers.builder}, ${maxRounds} rounds)`);
  return loop(ctx);
}

// Continues a job from its state.json.
export async function resumeJob({ id, project, invoke, log, timeoutMs }) {
  const ctx = makeCtx({ project, invoke, log, timeoutMs });
  const paths = S.jobPaths(ctx.deskDir, id);
  const state = S.readState(paths);
  if (!state) throw new Error(`No job ${id} under ${S.rel(ctx.projectDir, join(ctx.deskDir, 'jobs')) || '.desk/jobs'}.`);
  const cmd = getCommand(state.command);
  ctx.paths = paths; ctx.cmd = cmd; ctx.texts = loadTexts(cmd); ctx.state = state; ctx.brandHint = null;
  const control = S.readControl(paths);
  if (control.paused) S.writeJson(paths.controlFile, { ...control, paused: false });
  let recovered = false;
  if (['failed', 'paused', 'done'].includes(state.phase)) for (const desk of state.desks) {
    if (desk.status === 'working') { desk.status = 'failed'; desk.updatedAt = S.localIso(); recovered = true; }
  }
  if (state.desks.some(desk => desk.status === 'failed') && state.cost.complete) { state.cost.complete = false; recovered = true; }
  if (recovered) S.writeState(paths, state);
  if (state.phase === 'paused' || state.phase === 'failed') state.phase = state.next || 'intake';
  if (state.phase === 'done') { ctx.log(`job ${id} is already done`); return { code: 0, id, state, handback: S.readText(paths.handbackFile, '') }; }
  state.waitingOn = null;
  if (existsSync(paths.briefFile)) ctx.brief = parseBrief(readFileSync(paths.briefFile, 'utf8'), knownSizes(ctx.texts));
  ctx.log(`resuming ${id} at ${state.phase}${state.round ? ` round ${state.round}` : ''}`);
  return loop(ctx);
}

async function loop(ctx) {
  const { state, paths } = ctx;
  const steps = { intake: stepIntake, roughs: stepRoughs, pick: stepPick, polish: stepPolish, proof: stepProof, signoff: stepSignoff, handback: stepHandback };
  try {
    while (state.phase !== 'done') {
      const step = steps[state.phase];
      if (!step) throw new Error(`Unknown phase "${state.phase}" in state.json.`);
      await step(ctx);
      S.writeState(paths, state);
    }
    const under = state.waitingOn?.type === 'approve_under_bar';
    return { code: under ? 4 : 0, id: state.id, state, handback: ctx.handback };
  } catch (e) {
    if (e.hold) {
      state.next = e.phase; state.phase = 'paused';
      S.writeState(paths, state);
      S.emit(ctx.projectDir, 'job.phase', { id: state.id, phase: 'paused', round: state.round });
      const where = `${e.phase}${state.round ? ` round ${state.round}` : ''}`;
      const line = `Holding at ${where}. The job keeps its state. Resume with: desk-run resume ${state.id}${ctx.projectDir !== process.cwd() ? ` --project "${ctx.projectDir}"` : ''}`;
      ctx.log(line);
      process.stdout.write(line + '\n');
      return { code: 3, id: state.id, state, held: true };
    }
    state.next = state.phase; state.phase = 'failed';
    state.waitingOn = { type: 'question', text: e.message };
    S.writeState(paths, state);
    S.emit(ctx.projectDir, 'job.waiting', { id: state.id, on: 'question' });
    ctx.log(`failed at ${state.next}: ${e.message}`);
    return { code: 1, id: state.id, state, error: e };
  }
}

// ---------- one desk call ----------

function tierFor(ctx, pen) {
  return pen === 'art-director' ? 'director' : pen === 'senior' ? 'senior' : 'builder';
}

// Reads the control file and the desk's inbox, records the desk on the floor, calls the model.
async function callDesk(ctx, { desk, tier, task, system, prompt, images = [] }) {
  const { state, paths } = ctx;
  const control = S.readControl(paths);
  if (control.paused) throw new Hold(state.phase);
  if (control.models && typeof control.models === 'object') {
    for (const t of TIERS) if (control.models[t] && control.models[t] !== state.models[t]) {
      resolveModel(control.models[t]);
      ctx.log(`${t} moved to ${control.models[t]} from the floor`);
      state.models[t] = control.models[t];
    }
  }
  const spec = state.models[tier];
  const note = S.takeInbox(paths, desk);
  const fullPrompt = note ? `## Note from the user\n\n${note}\n\n${prompt}` : prompt;
  const entry = { desk, task, status: 'working', model: spec, startedAt: S.localIso(), updatedAt: S.localIso() };
  state.desks.push(entry);
  S.writeState(paths, state);
  S.emit(ctx.projectDir, 'desk.start', { id: state.id, desk, model: spec, tier, task });
  ctx.log(`${desk}: ${task} at ${spec}${images.length ? ` with ${images.length} screenshot${images.length > 1 ? 's' : ''}` : ''}${note ? ' (with a note from the user)' : ''}`);
  const t0 = Date.now();
  try {
    const result = await ctx.invoke({ spec, system: `${system}\n\n${RUNNER_NOTE}`, prompt: fullPrompt, images, cwd: ctx.projectDir, timeoutMs: ctx.timeoutMs });
    entry.status = 'done';
    entry.model = result.spec || spec;
    entry.updatedAt = S.localIso();
    if (result.via) entry.via = result.via;
    const tokens = normalizeUsage(result.usage);
    addCost(state, tier, result.costUsd, tokens);
    // The same shape the SubagentStop hook writes in native mode, so the floor and state.mjs cost read both.
    S.emitRaw(ctx.projectDir, { type: 'desk.stop', id: state.id, desk, tier, status: 'done', seconds: Math.round((Date.now() - t0) / 1000),
      model: result.spec || spec, modelId: result.modelId || result.model, ...(tokens ? { tokens } : {}), ...(typeof result.costUsd === 'number' ? { costUsd: result.costUsd } : {}) });
    ctx.log(`${desk}: done in ${Math.round((Date.now() - t0) / 1000)}s${result.costUsd != null ? `, ${result.costUsd.toFixed(4)} usd` : ', cost not reported'}`);
    if (images.length && result.sawImages === false) state.signoffBy = 'report';
    return result;
  } catch (e) {
    entry.status = 'failed';
    entry.updatedAt = S.localIso();
    state.cost.complete = false;
    S.emitRaw(ctx.projectDir, { type: 'desk.stop', id: state.id, desk, tier, status: 'failed', model: spec, seconds: Math.round((Date.now() - t0) / 1000) });
    throw e;
  }
}

function addCost(state, tier, costUsd, tokens) {
  if (!state.tokens) state.tokens = { director: 0, senior: 0, builder: 0 };
  if (tokens) state.tokens[tier] = (state.tokens[tier] || 0) + (tokens.total || 0);
  if (typeof costUsd === 'number' && Number.isFinite(costUsd)) {
    state.cost[tier] = round4(state.cost[tier] + costUsd);
    state.cost.total = round4(state.cost.director + state.cost.senior + state.cost.builder);
  } else {
    state.cost.complete = false;
  }
}

function round4(n) { return Math.round(n * 10000) / 10000; }

function setPhase(ctx, phase, round) {
  ctx.state.phase = phase;
  if (round != null) ctx.state.round = round;
  S.writeState(ctx.paths, ctx.state);
  S.emit(ctx.projectDir, 'job.phase', { id: ctx.state.id, phase, round: ctx.state.round });
}

// ---------- proof ----------

async function proof(ctx, verb, file, outDir, { brand = null, mustAppear = [] } = {}) {
  const args = [PROOF_CLI, verb, file, '--sizes', ctx.state.sizes.join(','), '--out', outDir];
  if (verb === 'check' && brand) args.push('--brand', brand);
  if (verb === 'check' && mustAppear.length) args.push('--must-appear', ...mustAppear);
  const r = await execRun(process.execPath, args, { cwd: ctx.projectDir, timeoutMs: 5 * 60 * 1000 });
  let json = null;
  try { json = JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))); } catch {}
  if (!json) throw new Error(`proof ${verb} gave no JSON (exit ${r.code}): ${(r.stderr || r.stdout).split(/\r?\n/).find(l => l.trim()) || ''}`);
  if (json.error) throw new Error(`proof ${verb}: ${json.error}`);
  return json;
}

// ---------- steps ----------

async function stepIntake(ctx) {
  const { state, paths, texts, cmd } = ctx;
  if (!existsSync(paths.brandFile)) await brandFromProject(ctx);
  const brand = readFileSync(paths.brandFile, 'utf8');
  const system = texts.skill.replace(/\$ARGUMENTS/g, ctx.ask) + `\n\n## Runner note\n\nYou are doing step 1, Intake, only, through desk-run. The job folders exist and the runner staffs the desks and runs the loop after you. You have no tools, the files you would read are included below. Output the complete text of brief.md and nothing else: no fences, no preamble, the six headings from step 1 in order. Sizes come from the named sizes list below; the command's default sizes apply unless the ask names a platform.`;
  const prompt = [
    `Job id: ${state.id}. Command: ${cmd.name}. Deliverable: ${cmd.deliverable}. Default sizes: ${cmd.sizes.join(', ')}. Quality: ${state.quality}. Rounds: ${state.maxRounds}.`,
    section('The ask', ctx.ask),
    section('.desk/DESIGN.md', brand),
    section('.desk/project.json', JSON.stringify(S.readProject(ctx.deskDir), null, 2)),
    section('.desk/taste.md', S.readText(paths.tasteFile)),
    section(`Standard: ${cmd.standard}`, texts.standard),
    section('Named sizes', texts.sizesDoc),
    '\nWrite brief.md now.',
  ].join('\n');
  const r = await callDesk(ctx, { desk: 'design-manager', tier: 'director', task: 'intake', system, prompt });
  const briefText = r.text.replace(/^```[a-z]*\s*\n([\s\S]*?)\n```\s*$/i, '$1').trim() + '\n';
  writeFileSync(paths.briefFile, `<!-- ask: ${fiveWords(ctx.ask)} -->\n${briefText}`);
  ctx.brief = parseBrief(briefText, knownSizes(texts));
  if (ctx.brief.sizes.length) state.sizes = ctx.brief.sizes;
  ctx.log(`brief written: sizes ${state.sizes.join(', ')}, ${ctx.brief.copy.length} copy line${ctx.brief.copy.length === 1 ? '' : 's'}${ctx.brief.draftCopy ? ' (draft copy)' : ''}`);
  setPhase(ctx, 'roughs', 0);
}

// The brand step when .desk/DESIGN.md is missing: the director model reads a scan of the project and writes the file.
async function brandFromProject(ctx) {
  const { paths, texts } = ctx;
  const scan = scanProject(ctx.projectDir);
  const system = texts.brandProc + `\n\n## Runner note\n\nYou are running through desk-run with no tools. A scan of the project is below instead. If the project gives you nothing and no colour was given, do not ask a question: build the palette from the template's defaults (background #0b0b0c, foreground #f4f4f5, accent #0f62fe, Inter) and put "house style defaults, no brand found in the project" first under sources, so the user knows to edit the file. Output the complete DESIGN.md, front matter first, and nothing else, no fences.`;
  let prompt = (ctx.brandHint ? section('From the user', /^#[0-9a-f]{6}$/i.test(ctx.brandHint) ? `One colour for the brand: ${ctx.brandHint}` : `Brand source: ${ctx.brandHint}`) : '') + section('Project scan', scan) + '\nWrite .desk/DESIGN.md now.';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await callDesk(ctx, { desk: 'design-manager', tier: 'director', task: attempt === 1 ? 'brand from project' : 'brand from project, retry', system, prompt });
    const text = r.text.replace(/^```[a-z]*\s*\n([\s\S]*?)\n```\s*$/i, '$1').trim() + '\n';
    writeFileSync(paths.brandFile, text);
    try {
      const { readBrand } = await import(pathToFileURL(join(ROOT, 'proof', 'brand.mjs')).href);
      const b = readBrand(paths.brandFile);
      if (!b.raw?.colors || !b.type.family) throw new Error('front matter needs colors: with 6-digit hex values and type: with a family');
      ctx.log(`brand written to ${S.rel(ctx.projectDir, paths.brandFile)} (${b.colors.length} colours, ${b.type.family})`);
      return;
    } catch (e) {
      if (attempt === 2) throw new Error(`DESIGN.md did not parse: ${e.message}`);
      prompt += `\n\nThe previous attempt did not parse: ${e.message}. Write it again with exact front matter.`;
    }
  }
}

// What the brand procedure would look at, as text, bounded.
export function scanProject(dir) {
  const parts = [];
  const take = (file, lines = 60) => { try { return readFileSync(file, 'utf8').split(/\r?\n/).slice(0, lines).join('\n'); } catch { return null; } };
  const list = [];
  const walk = (d, depth) => {
    if (depth > 3) return;
    let entries = [];
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (['node_modules', '.git', '.desk', 'dist', 'build', '.next', 'out', 'coverage'].includes(e.name)) continue;
      const f = join(d, e.name);
      if (e.isDirectory()) walk(f, depth + 1);
      else if (list.length < 400) list.push(f);
    }
  };
  walk(dir, 0);
  const rel = f => relative(dir, f).split('\\').join('/');
  const pkg = take(join(dir, 'package.json'), 40); if (pkg) parts.push(`### package.json\n${pkg}`);
  const readme = list.find(f => /^readme\.md$/i.test(basename(f))); if (readme) parts.push(`### ${rel(readme)} (first lines)\n${take(readme, 40)}`);
  for (const f of list.filter(f => /^(design|brand)\.md$/i.test(basename(f)) || /design-tokens\.json$/i.test(f)).slice(0, 3)) parts.push(`### ${rel(f)}\n${take(f, 80)}`);
  for (const f of list.filter(f => /tailwind\.config\.(js|ts|cjs|mjs)$/.test(f)).slice(0, 2)) parts.push(`### ${rel(f)}\n${take(f, 80)}`);
  const css = list.filter(f => /\.(css|scss)$/.test(f)).map(f => ({ f, t: take(f, 120) })).filter(x => x.t && /--[a-z]/i.test(x.t)).slice(0, 5);
  for (const { f, t } of css) parts.push(`### ${rel(f)} (custom properties)\n${t.split(/\r?\n/).filter(l => /--[a-z][\w-]*\s*:|font-family|@import/i.test(l)).slice(0, 60).join('\n')}`);
  const logos = list.filter(f => /(logo|favicon|mark)[^/\\]*\.(svg|png)$/i.test(basename(f))).slice(0, 10).map(rel);
  if (logos.length) parts.push(`### Logo files\n${logos.join('\n')}`);
  const html = list.find(f => /^index\.html$/i.test(basename(f))); if (html) parts.push(`### ${rel(html)} (head)\n${take(html, 40)}`);
  if (!parts.length) parts.push('(the project has no package.json, README, CSS, tailwind config, tokens or logo files)');
  parts.push(`### Files seen (${list.length})\n${list.slice(0, 60).map(rel).join('\n')}`);
  return parts.join('\n\n').slice(0, 40000);
}

// The font sizes proof accepts, from the brand's base and ratio, so a builder never guesses one.
function scaleLine(brandText) {
  const base = Number(/^\s*base:\s*([\d.]+)/m.exec(brandText)?.[1]) || 16;
  const ratio = Number(/^\s*ratio:\s*([\d.]+)/m.exec(brandText)?.[1]) || 1.25;
  const sizes = [];
  for (let n = 0; n < 16; n++) { const s = Math.round(base * Math.pow(ratio, n)); if (s > 260) break; sizes.push(s); }
  return `Font sizes on the brand scale (base ${base}, ratio ${ratio}), the only sizes proof accepts, 12% either way: ${sizes.join(', ')}px.`;
}

// The brand font block, fetched once per job when scripts/font.mjs bundles the family. Builders never see the data URI.
function ensureFont(ctx) {
  if (ctx.font !== undefined) return ctx.font;
  try { ctx.font = loadBrandFont(ROOT, readFileSync(ctx.paths.brandFile, 'utf8'), ctx.paths.outDir); }
  catch { ctx.font = null; }
  if (ctx.font) ctx.log(`brand font ${ctx.font.family} inlined by the runner into every file (${Math.round(ctx.font.css.length / 1024)} KB)`);
  return ctx.font;
}

function fontLine(ctx) {
  const font = ensureFont(ctx);
  return font ? `The brand font ${font.family} is inlined by the runner into your file after you return, so write font-family: ${font.stack} and do not paste an @font-face block yourself.\n` : '';
}

// What the builder returned, with the font block spliced in, written to disk.
function writeHtml(ctx, file, text) {
  writeFileSync(file, injectFont(extractHtml(text), ensureFont(ctx)));
}

function briefBlock(ctx) {
  const { paths, texts } = ctx;
  const brand = readFileSync(paths.brandFile, 'utf8');
  return section('Brief (.desk/jobs/<id>/brief.md)', readFileSync(paths.briefFile, 'utf8').replace(/^<!--.*-->\n/, ''))
    + section('Brand (.desk/DESIGN.md)', brand + '\n\n' + scaleLine(brand))
    + section(`Standard: ${ctx.cmd.standard}`, texts.standard)
    + section('House style', texts.houseStyle);
}

function sizesLine(ctx) {
  const sizes = ctx.state.sizes;
  return sizes.map(name => {
    const m = new RegExp(`^\\|\\s*${name}\\s*\\|\\s*(\\d+x\\d+)`, 'm').exec(ctx.texts.sizesDoc);
    return m ? `${name} (${m[1]})` : name;
  }).join(', ');
}

function rendersOf(dir, sizes) {
  return sizes.map(s => join(dir, `${s}.png`)).filter(f => existsSync(f));
}

async function stepRoughs(ctx) {
  const { state, paths, texts } = ctx;
  const patterns = parsePatterns(texts.standard);
  if (patterns.length < 3) throw new Error(`The ${ctx.cmd.standard} standard lists ${patterns.length} composition patterns, roughs need three.`);
  const chosen = patterns.slice(0, 3);
  const previous = state.roughs || [];
  state.roughs = chosen.map((pattern, i) => ({ ...(previous[i]?.pattern === pattern ? previous[i] : {}), n: i + 1, pattern, file: S.rel(ctx.projectDir, join(paths.outDir, `rough-${i + 1}.html`)) }));
  S.writeState(paths, state);
  const control = S.readControl(paths);
  if (control.paused) throw new Hold('roughs');
  const common = briefBlock(ctx);
  const results = await Promise.allSettled(chosen.map(async (pattern, i) => {
    const n = i + 1;
    const file = join(paths.outDir, `rough-${n}.html`);
    if (state.roughs[i].written && existsSync(file)) return;
    const prompt = `Job ${state.id}. Out folder: ${paths.outDir}. Renders folder: ${paths.rendersDir}.\n`
      + `You own one file: ${file}. Return it whole in one fenced block tagged html, then your return block.\n`
      + `This is a rough. Composition pattern for this rough: ${pattern}. Build that pattern honestly, pushed as far as the brand allows, so it differs from the other two roughs.\n`
      + `Sizes: ${sizesLine(ctx)}. One DOM, media queries adapt it to each size.\n` + fontLine(ctx) + common;
    const result = await callDesk(ctx, { desk: ctx.cmd.builder, tier: 'senior', task: `rough ${n}, ${pattern.toLowerCase()}`, system: texts.roles[ctx.cmd.builder], prompt });
    writeHtml(ctx, file, result.text);
    const ret = parseBuilderReturn(result.text);
    if (ret.fonts) state.roughs[i].fonts = ret.fonts;
    state.roughs[i].written = true;
    S.writeState(paths, state);
  }));
  // Finish and save the other desks before a failure can end the CLI process.
  const failed = results.find(r => r.status === 'rejected');
  if (failed) throw failed.reason;
  for (let i = 0; i < results.length; i++) {
    const n = i + 1;
    const file = join(paths.outDir, `rough-${n}.html`);
    const out = join(paths.rendersDir, 'roughs', `rough-${n}`);
    await proof(ctx, 'render', file, out);
    state.roughs[i].renders = S.rel(ctx.projectDir, out);
    ctx.log(`rough ${n} rendered to ${S.rel(ctx.projectDir, out)}`);
  }
  setPhase(ctx, 'pick', 0);
}

async function stepPick(ctx) {
  const { state, paths, texts } = ctx;
  const control = S.readControl(paths);
  const userPick = Number.isInteger(control.pick) && control.pick >= 1 && control.pick <= 3 ? control.pick : null;
  const images = [];
  const listing = [];
  for (const r of state.roughs) {
    for (const png of rendersOf(join(ctx.projectDir, r.renders), state.sizes)) { images.push(png); listing.push(`${images.length}. rough ${r.n} at ${basename(png, '.png')}: ${png}`); }
  }
  if (!images.length) throw new Error('No rough screenshots to pick from.');
  const prompt = `Job ${state.id}. Out folder: ${paths.outDir}. Renders folder: ${paths.rendersDir}.\n`
    + `Three roughs were made from the same brief. Patterns: ${state.roughs.map(r => `rough ${r.n} ${r.pattern.toLowerCase()}`).join(', ')}.\n`
    + `Screenshots attached in this order:\n${listing.join('\n')}\n`
    + (userPick ? `The user has already picked rough ${userPick} from the floor. Do not re-pick: your pick line must read "pick: ${userPick}", the reason is "the user's call", and your notes are for rough ${userPick}.\n` : '')
    + `Return your pick in the shape your brief defines.\n` + briefBlock(ctx);
  const r = await callDesk(ctx, { desk: 'art-director', tier: 'director', task: 'pick', system: texts.roles['art-director'], prompt, images });
  let pick;
  try { pick = parsePick(r.text); } catch (e) { throw new Error(`${e.message}\nThe reply was:\n${r.text.slice(0, 800)}`); }
  const rough = userPick || pick.pick;
  copyFileSync(join(paths.outDir, `rough-${rough}.html`), paths.finalFile);
  state.pick = { by: userPick ? 'user' : 'art-director', rough, pattern: state.roughs[rough - 1].pattern, combineWith: pick.combineWith, reason: userPick ? "the user's call" : pick.reason, lost: pick.lost, notes: pick.notes, at: S.localIso() };
  state.notes = pick.notes.slice();
  state.pen = 'builder';
  state.lastRenders = state.roughs[rough - 1].renders;
  S.emit(ctx.projectDir, 'job.pick', { id: state.id, by: state.pick.by, rough });
  ctx.log(`pick: rough ${rough} (${state.pick.pattern.toLowerCase()}) by ${state.pick.by}, ${pick.notes.length} notes`);
  setPhase(ctx, 'polish', 1);
}

async function stepPolish(ctx) {
  const { state, paths, texts } = ctx;
  const round = state.round;
  const pen = state.pen;
  const images = rendersOf(join(ctx.projectDir, state.lastRenders), state.sizes);
  const notes = state.notes.length ? state.notes.map((n, i) => `${i + 1}. ${n}`).join('\n') : '(no notes, check the file against the standard)';
  const current = stripFont(readFileSync(paths.finalFile, 'utf8'));
  const shots = images.map((f, i) => `${i + 1}. ${basename(f, '.png')}: ${f}`).join('\n');
  let r;
  if (pen === 'art-director') {
    const prompt = `Job ${state.id}. Polish round ${round} of ${state.maxRounds}. Escalation: you take the pen for this round, the same notes were missed two rounds running.\n`
      + `Rewrite ${paths.finalFile} yourself: apply the notes below, keep the DOM structure and the file contract, change the minimum. Return the whole file in one fenced block tagged html, then the escalation shape from your brief (took the pen, changed, notes for the builder).\n`
      + `Sizes: ${sizesLine(ctx)}.\n` + fontLine(ctx) + `Notes outstanding:\n${notes}\nScreenshots of the current state attached:\n${shots}\n`
      + section('Current final.html', '```html\n' + current + '\n```') + briefBlock(ctx);
    r = await callDesk(ctx, { desk: 'art-director', tier: 'director', task: `pen, round ${round}`, system: texts.roles['art-director'], prompt, images });
    const esc = parseEscalation(r.text);
    state.penNotes = esc.notes;
    ctx.log(`art director took the pen: ${esc.changed || 'rewrote final.html'}`);
  } else {
    const prompt = `Job ${state.id}. Polish round ${round} of ${state.maxRounds}${pen === 'senior' ? ' (escalated to the senior model)' : ''}. You own ${paths.finalFile}. Return the complete revised file in one fenced block tagged html, then your return block.\n`
      + `Sizes: ${sizesLine(ctx)}.\n` + fontLine(ctx) + `Notes to apply, in order:\n${notes}\n${state.penNotes?.length ? `Notes from the Art Director's rewrite last round:\n${state.penNotes.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n` : ''}Screenshots of the current state attached:\n${shots}\n`
      + section('Current final.html', '```html\n' + current + '\n```') + briefBlock(ctx);
    r = await callDesk(ctx, { desk: ctx.cmd.builder, tier: tierFor(ctx, pen), task: `polish round ${round}${pen === 'senior' ? ', escalated' : ''}`, system: texts.roles[ctx.cmd.builder], prompt, images });
    state.penNotes = [];
  }
  writeHtml(ctx, paths.finalFile, r.text);
  setPhase(ctx, 'proof', round);
}

function proofNotes(result) {
  const notes = [];
  for (const render of result.renders || []) for (const f of render.failures || []) {
    notes.push(`proof ${f.check} at ${render.size}: ${f.text ? `"${f.text}" ` : ''}${f.reason}`);
  }
  return notes;
}

async function stepProof(ctx) {
  const { state, paths } = ctx;
  const round = state.round;
  const out = join(paths.rendersDir, `round-${round}`);
  const mustAppear = ctx.brief && !ctx.brief.draftCopy ? ctx.brief.copy : [];
  const result = await proof(ctx, 'check', paths.finalFile, out, { brand: paths.brandFile, mustAppear });
  const failures = (result.renders || []).reduce((n, r) => n + (r.failures?.length || 0), 0);
  state.proof.push({ round, pass: !!result.pass, failures });
  state.lastRenders = S.rel(ctx.projectDir, out);
  S.emit(ctx.projectDir, 'job.proof', { id: state.id, round, pass: !!result.pass, failures });
  if (result.pass) {
    ctx.log(`proof round ${round}: pass`);
    setPhase(ctx, 'signoff', round);
    return;
  }
  const notes = proofNotes(result);
  ctx.log(`proof round ${round}: ${failures} failure${failures === 1 ? '' : 's'} (${[...new Set(notes.map(n => n.split(' ')[1]))].join(', ')})`);
  afterMiss(ctx, notes, [...new Set((result.renders || []).flatMap(r => (r.failures || []).map(f => `proof:${f.check}`)))]);
}

async function stepSignoff(ctx) {
  const { state, paths, texts } = ctx;
  const round = state.round;
  const images = rendersOf(join(ctx.projectDir, state.lastRenders), state.sizes);
  if (!images.length) throw new Error(`No screenshots in ${state.lastRenders} for the sign-off.`);
  const shots = images.map((f, i) => `${i + 1}. ${basename(f, '.png')}: ${f}`).join('\n');
  const prompt = `Job ${state.id}. Sign-off for round ${round} of ${state.maxRounds}. Screenshots attached:\n${shots}\n`
    + `Proof passed this round (overflow, safe zone, contrast on real pixels, type scale, palette, copy present).\n`
    + `The Art Director picked rough ${state.pick.rough} (${state.pick.pattern.toLowerCase()}): ${state.pick.reason}\nThe Art Director's notes at the pick:\n${state.pick.notes.map((n, i) => `${i + 1}. ${n}`).join('\n') || '(none)'}\n`
    + `Return the sign-off in the exact shape your brief defines.\n`
    + briefBlock(ctx) + section('Rubric', texts.rubric) + section('Taste (.desk/taste.md)', S.readText(paths.tasteFile));
  const r = await callDesk(ctx, { desk: 'creative-director', tier: 'director', task: `sign-off round ${round}`, system: texts.roles['creative-director'], prompt, images });
  let scores;
  try { scores = parseScores(r.text); } catch (e) { throw new Error(`${e.message}\nThe reply was:\n${r.text.slice(0, 800)}`); }
  state.scores.push({ round, by: 'creative-director', axes: scores.axes, average: scores.average, pass: scores.pass, notes: scores.notes.map(n => (n.axis ? `${n.axis}: ${n.text}` : n.text)), polish: scores.polish });
  S.emit(ctx.projectDir, 'job.score', { id: state.id, round, average: scores.average, pass: scores.pass });
  ctx.log(`sign-off round ${round}: ${AXES.map(a => `${a} ${scores.axes[a]}`).join(', ')}, average ${scores.average}, ${scores.pass ? 'pass' : 'under the bar'}${scores.statedPass != null && scores.statedPass !== scores.pass ? ' (the reply said otherwise, the rubric decides)' : ''}`);
  if (scores.pass) {
    state.waitingOn = null;
    setPhase(ctx, 'handback', round);
    return;
  }
  const notes = scores.notes.map(n => (n.axis ? `${n.axis}: ${n.text}` : n.text));
  afterMiss(ctx, notes, scores.failing);
}

// After a failed proof or sign-off: the notes for the next round, the escalation ladder, the cap.
function afterMiss(ctx, notes, keys) {
  const { state } = ctx;
  const misses = {};
  for (const k of keys) misses[k] = (state.misses[k] || 0) + 1;
  state.misses = misses;
  state.notes = notes;
  const repeated = Object.values(misses).some(n => n >= 3); // noted, missed once, missed twice
  if (state.pen === 'art-director') {
    state.pen = 'builder'; state.misses = {};
  } else if (repeated && state.pen === 'builder') {
    state.pen = 'senior'; state.misses = {}; ctx.log('the same note was missed two rounds running, the next round goes to the senior model');
  } else if (repeated && state.pen === 'senior') {
    state.pen = 'art-director'; state.misses = {}; ctx.log('the senior missed twice, the Art Director takes the pen next round');
  }
  if (state.round >= state.maxRounds) {
    ctx.log(`round cap ${state.maxRounds} reached, handing back under the bar`);
    state.waitingOn = { type: 'approve_under_bar', text: `Under the bar after ${state.maxRounds} rounds. ${openLine(state)}` };
    S.emit(ctx.projectDir, 'job.waiting', { id: state.id, on: 'approve_under_bar' }); // "type=" would overwrite the event type in emit-event.mjs
    setPhase(ctx, 'handback', state.round);
    return;
  }
  setPhase(ctx, 'polish', state.round + 1);
}

function openLine(state) {
  const last = state.scores[state.scores.length - 1];
  const lastProof = state.proof[state.proof.length - 1];
  if (lastProof && !lastProof.pass && (!last || last.round < lastProof.round)) return `proof still fails: ${state.notes.slice(0, 2).join('; ')}`;
  if (!last) return 'no sign-off yet';
  const under = AXES.filter(a => last.axes[a] < 8);
  const avgShort = last.average < 8.5 && !under.length ? `average ${last.average} under 8.5` : '';
  const notes = last.notes.filter(n => under.some(a => n.startsWith(a + ':'))).slice(0, 2);
  return [under.length ? `${under.join(', ')} under 8` : '', avgShort, notes.join('; ')].filter(Boolean).join(', ');
}

function modelShort(spec) {
  return String(spec || '').split('/').pop();
}

function deskLine(state, builderDesk) {
  const parts = [];
  const builder = deskName(builderDesk), ad = deskName('art-director'), cd = deskName('creative-director');
  const count = (pred) => state.desks.filter(pred);
  const roughs = count(d => /^rough/.test(d.task) && d.status === 'done');
  if (roughs.length) parts.push(`${builder} x${roughs.length} roughs (${[...new Set(roughs.map(d => modelShort(d.model)))].join(', ')})`);
  const pick = count(d => d.task === 'pick');
  if (pick.length) parts.push(`${ad} pick (${modelShort(pick[0].model)})`);
  const polish = count(d => /^polish/.test(d.task) && !/escalated/.test(d.task) && d.status === 'done');
  if (polish.length) parts.push(`${builder} polish x${polish.length} (${[...new Set(polish.map(d => modelShort(d.model)))].join(', ')})`);
  const esc = count(d => /escalated/.test(d.task) && d.status === 'done');
  if (esc.length) parts.push(`${builder} polish x${esc.length} escalated (${[...new Set(esc.map(d => modelShort(d.model)))].join(', ')})`);
  const pen = count(d => /^pen/.test(d.task) && d.status === 'done');
  if (pen.length) parts.push(`${ad} pen x${pen.length} (${modelShort(pen[0].model)})`);
  const sign = count(d => /^sign-off/.test(d.task) && d.status === 'done');
  if (sign.length) parts.push(`${cd} sign-off x${sign.length} (${[...new Set(sign.map(d => modelShort(d.model)))].join(', ')})`);
  return parts.join(', ');
}

async function stepHandback(ctx) {
  const { state, paths } = ctx;
  const last = state.scores[state.scores.length - 1];
  const passed = !!(last && last.pass && !state.waitingOn);
  const briefHead = /<!-- ask: (.*?) -->/.exec(S.readText(paths.briefFile, '') || '');
  const ask = briefHead ? briefHead[1] : state.deliverable;
  const outRel = S.rel(ctx.projectDir, paths.outDir);
  const jobRel = S.rel(ctx.projectDir, paths.jobDir);
  const files = readdirSync(paths.outDir).filter(f => statSync(join(paths.outDir, f)).isFile()).length + 1; // plus handback.md
  const firstPass = state.proof.find(p => p.pass);
  const failedBefore = state.proof.filter(p => !p.pass && (!firstPass || p.round < firstPass.round));
  const proofLine = firstPass
    ? `Proof: passed on round ${firstPass.round}${failedBefore.length ? ` after ${failedBefore.reduce((n, p) => n + p.failures, 0)} fix${failedBefore.reduce((n, p) => n + p.failures, 0) === 1 ? '' : 'es'}` : ''}.`
    : 'Proof: never passed.';
  const scoresLine = last
    ? `${AXES.map(a => `${a} ${last.axes[a]}`).join(', ')}, average ${last.average}, ${passed ? 'pass' : 'under the bar'}`
    : 'no sign-off reached, under the bar';
  const c = state.cost;
  const costLine = `director ${c.director.toFixed(2)}, senior ${c.senior.toFixed(2)}, builder ${c.builder.toFixed(2)}, total ${c.total.toFixed(2)} (list prices, from the CLI)${c.complete ? '' : ' (some costs are unknown)'}`;
  const vias = [...new Set(state.desks.map(d => d.via).filter(Boolean))];
  const lines = [
    `Done: ${state.deliverable} for ${ask}, ${files} files in ${outRel}/`,
    `  final.html, renders at ${state.sizes.join(' and ')} in ${state.lastRenders ? state.lastRenders.split('\\').join('/') : jobRel + '/renders'}/`,
    `Desks: ${deskLine(state, ctx.cmd.builder)}`,
    `Pick: rough ${state.pick?.rough}, ${state.pick?.pattern?.toLowerCase()}${state.pick?.by === 'user' ? " (the user's pick)" : ''}, "${state.pick?.reason || ''}"`,
    `Scores: ${scoresLine}`,
    `Rounds: ${state.round} of ${state.maxRounds}. ${proofLine}`,
    `Cost: ${costLine}`,
    `Open: ${passed ? 'none' : openLine(state)}${state.signoffBy === 'report' ? ' (sign-off by report, the director model did not see the screenshots)' : ''}`,
  ];
  if (vias.includes('api')) lines.push(`Models: ${[...new Set(state.desks.map(d => `${d.model}${d.via ? ` via ${d.via}` : ''}`))].join(', ')}`);
  let handback = lines.join('\n') + '\n';
  if (passed) {
    const decision = `${state.pick.pattern} works for this brand's ${state.deliverable} (${S.localIso().slice(0, 10)})`;
    handback += `\n<!-- desk:memory\ndecisions:\n  - "${decision}"\n-->\n`;
    const projectCfg = S.readProject(ctx.deskDir);
    projectCfg.decisions = [...(projectCfg.decisions || []), decision].slice(-50);
    S.writeProject(ctx.deskDir, projectCfg);
  }
  writeFileSync(paths.handbackFile, handback);
  state.files.handback = S.rel(ctx.projectDir, paths.handbackFile);
  state.phase = 'done';
  state.finishedAt = S.localIso();
  state.desks = state.desks.map(d => (d.status === 'working' ? { ...d, status: 'failed' } : d));
  S.writeState(paths, state);
  S.emit(ctx.projectDir, 'job.done', { id: state.id, rounds: state.round, average: last ? last.average : 0, pass: passed });
  ctx.handback = handback;
  process.stdout.write(handback);
}

// ---------- doctor and providers ----------

export async function doctor({ project, probe = false, out = s => process.stdout.write(s + '\n') } = {}) {
  const { detect, runModel } = await import('./providers/index.mjs');
  const table = loadModels();
  const d = detect({ fresh: true });
  out(`desk-run doctor, ${S.localIso()}`);
  out('');
  const rows = [];
  for (const [name, p] of Object.entries(table.providers)) {
    const r = d[name];
    const cli = !r.cli.found ? `${p.cli}: not on PATH`
      : !r.cli.works ? `${p.cli}: ${r.cli.error}`
      : `${p.cli} ${r.cli.version}${r.cli.signedIn ? `, signed in${r.cli.account ? ` (${r.cli.account})` : ''}` : ', not signed in'}`;
    const key = r.key ? `${r.key} set` : `${p.keyEnv.join(' or ')} not set`;
    const via = r.via === 'cli' ? `uses the ${p.cli} CLI` : r.via === 'api' ? `uses the API key` : 'unreachable';
    out(`${p.label.padEnd(10)} ${cli}; ${key}; ${via}`);
    out(`${''.padEnd(10)} ${TIERS.map(t => `${t} ${p.tiers[t]} (${p.models[p.tiers[t]].id})`).join(', ')}`);
    rows.push({ name, r });
  }
  if (d.extra?.copilot?.found) out(`${'also'.padEnd(10)} copilot ${d.extra.copilot.version || 'found'}, its adapter comes with 1.1`);
  out('');
  const chosen = chooseDefaults(d);
  out(chosen.models ? `Defaults for this machine: ${TIERS.map(t => `${t} ${chosen.models[t]}`).join(', ')} (${chosen.reason})` : `Defaults for this machine: none, ${chosen.reason}. Without a provider the host agent plays every desk itself.`);
  const projectDir = resolve(project || process.cwd());
  const deskDir = S.findDesk(projectDir, { create: false });
  const cfg = deskDir ? S.readJson(join(deskDir, 'project.json')) : null;
  out(cfg?.models ? `Project ${S.rel(projectDir, join(deskDir, 'project.json'))}: ${TIERS.map(t => `${t} ${cfg.models[t]}`).join(', ')}, quality ${cfg.quality || 'studio'}` : `Project: no .desk/project.json under ${projectDir}, the defaults above apply`);
  out(deskDir && existsSync(join(deskDir, 'DESIGN.md')) ? `Brand: ${S.rel(projectDir, join(deskDir, 'DESIGN.md'))}` : 'Brand: no .desk/DESIGN.md yet, the first job finds the brand in the project');
  try {
    const { launch } = await import(pathToFileURL(join(ROOT, 'proof', 'browser.mjs')).href);
    const b = await launch(); await b.close();
    out('Proof: Chrome found, renders work');
  } catch (e) { out(`Proof: ${String(e.message).split('\n')[0]}`); }
  out(`Models table: runner/models.json checked ${table.checkedAt}`);
  if (probe) {
    out('');
    out('Probe: one short call per reachable provider');
    for (const { name, r } of rows) {
      if (!r.via) { out(`  ${name}: skipped, unreachable`); continue; }
      const spec = providerDefaults(name).builder;
      const t0 = Date.now();
      try {
        const res = await runModel({ spec, system: 'Reply with the single word ready.', prompt: 'Are you there?', timeoutMs: 120000 });
        out(`  ${name}: ok via ${res.via} in ${Math.round((Date.now() - t0) / 1000)}s, said "${res.text.trim().slice(0, 40)}", cost ${res.costUsd != null ? res.costUsd.toFixed(5) : 'not reported'}`);
      } catch (e) { out(`  ${name}: failed, ${String(e.message).split('\n')[0]}`); }
    }
  }
  return d;
}

export function providers({ out = s => process.stdout.write(s + '\n') } = {}) {
  const table = loadModels();
  out(`Providers and tiers (runner/models.json, checked ${table.checkedAt}). Prices are list USD per million tokens, input / output.`);
  for (const [name, p] of Object.entries(table.providers)) {
    out('');
    out(`${name} (${p.label}), CLI ${p.cli}, key ${p.keyEnv.join(' or ')}`);
    for (const [alias, m] of Object.entries(p.models)) {
      const tier = TIERS.find(t => p.tiers[t] === alias);
      out(`  ${name}/${alias.padEnd(11)} ${m.id.padEnd(24)} ${m.input != null ? `${m.input} / ${m.output}` : 'price unknown'}${tier ? `   default for ${tier}` : ''}`);
    }
  }
  out('');
  out(`Presets: ${Object.entries(PRESETS).map(([k, v]) => `${k} = ${TIERS.map(t => v[t]).join(', ')}`).join('; ')}`);
}

// ---------- cli ----------

function usage() {
  return `desk-run: Desk Studio's loop as a program.

  desk-run <command> "<ask>" [--project DIR] [--quality studio|best|thrifty] [--rounds N]
           [--models director=anthropic/opus,builder=google/flash] [--brand #hex|path] [--timeout MIN]
  desk-run resume <id> [--project DIR]
  desk-run doctor [--probe] [--project DIR]
  desk-run providers

Commands: ${Object.entries(COMMANDS).map(([k, v]) => `${k} (${v.about})`).join('; ')}.
Exit codes: 0 done at the bar, 4 handed back under the bar, 3 holding, 1 failed, 2 usage.`;
}

export function parseArgv(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { out.flags[k] = next; i++; } else out.flags[k] = true;
    } else out._.push(a);
  }
  return out;
}

export async function main(argv = process.argv.slice(2)) {
  const { _, flags } = parseArgv(argv);
  const [command, ...rest] = _;
  if (!command || command === 'help' || flags.help) { process.stdout.write(usage() + '\n'); return command ? 0 : 2; }
  const timeoutMs = flags.timeout ? Number(flags.timeout) * 60 * 1000 : undefined;
  if (command === 'doctor') { await doctor({ project: flags.project, probe: !!flags.probe }); return 0; }
  if (command === 'providers') { providers(); return 0; }
  const { runModel } = await import('./providers/index.mjs');
  if (command === 'resume') {
    if (!rest[0]) { process.stderr.write('desk-run resume needs the job id.\n'); return 2; }
    const r = await resumeJob({ id: rest[0], project: flags.project, invoke: runModel, timeoutMs });
    return r.code;
  }
  if (!COMMANDS[command]) { process.stderr.write(`Unknown command "${command}".\n${usage()}\n`); return 2; }
  const ask = rest.join(' ');
  if (!ask) { process.stderr.write(`Give the ask in quotes: desk-run ${command} "<ask>"\n`); return 2; }
  const r = await runJob({
    command, ask, project: flags.project, quality: flags.quality, rounds: flags.rounds ? Number(flags.rounds) : undefined,
    models: flags.models ? parseModelsFlag(flags.models) : undefined, brand: typeof flags.brand === 'string' ? flags.brand : undefined,
    invoke: runModel, timeoutMs,
  });
  if (r.error) process.stdout.write(`Failed at ${r.state.next}: ${r.error.message}\nFix the cause and run: desk-run resume ${r.id}${flags.project ? ` --project "${flags.project}"` : ''}\n`);
  return r.code;
}

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main().then(code => process.exit(code)).catch(e => { process.stderr.write(`desk-run: ${e.message}\n`); process.exit(1); });
}
