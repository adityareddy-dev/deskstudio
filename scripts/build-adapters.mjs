#!/usr/bin/env node
// Builds the npm package: generates adapters/*.md from the role briefs and the command table, then copies
// runner/, proof/, skills/desk/, scripts/emit-event.mjs and adapters/ into packages/deskstudio/ so the package
// is self-contained. The copies are listed in packages/deskstudio/.gitignore, only the sources live in git.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PKG = join(ROOT, 'packages', 'deskstudio');
const { COMMANDS } = await import(pathToFileURL(join(ROOT, 'runner', 'commands.mjs')).href);

function roleNames() {
  const dir = join(ROOT, 'skills', 'desk', 'roles');
  return readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
    const first = readFileSync(join(dir, f), 'utf8').split(/\r?\n/).find(l => l.startsWith('# '));
    return first ? first.slice(2).trim() : f.replace(/\.md$/, '');
  });
}

export function adapterBlock({ skillsDir = '.agents/skills/desk' } = {}) {
  const commands = Object.entries(COMMANDS).map(([name, c]) => `\`${name}\` (${c.about})`).join(', ');
  const desks = roleNames();
  return `<!-- desk:start -->
## Desk Studio

This project has a design studio on call. The desks, their briefs, the rubric and the standards live in \`${skillsDir}/\`. The brand lives in \`.desk/DESIGN.md\` once a job has run, and the user can edit it any time.

For a design ask that ends in files (a card, a carousel, a landing page, an email, a deck, a chart, a clip, a brand kit), run the studio and hand back what it prints:

    npx --package deskstudio desk-run <command> "<the ask>"

Commands: ${commands}. Flags: \`--quality studio|best|thrifty\`, \`--rounds N\`, \`--models director=anthropic/opus,builder=google/flash\`. \`npx --package deskstudio desk-run doctor\` shows which model providers this machine can use.

The runner writes finished files to \`.desk/out/<job>/\` and the job state to \`.desk/jobs/<job>/\`. Its last lines are the handback: what was made and where, which desks worked on which model, the scores, the rounds, the cost. Return that to the user as it is. Exit code 3 means the job is holding (paused from the dashboard), 4 means it was handed back under the bar.

For design work inside the codebase (components, styles, pages), play the Design Manager yourself: read \`${skillsDir}/SKILL.md\` and follow it, with the role briefs in \`${skillsDir}/roles/\`, \`${skillsDir}/rubric.md\` and the standards in \`${skillsDir}/standards/\`. Desks on call: ${desks.join(', ')}. Run proof on anything visual with \`npx --package deskstudio desk-proof check <file> --brand .desk/DESIGN.md --sizes <sizes> --out .desk/renders\`.
<!-- desk:end -->
`;
}

// One file per host, same block, different wrapper.
export function buildAdapterFiles() {
  const block = adapterBlock();
  return {
    'agents.md': block,
    'gemini.md': block,
    'copilot.md': block,
    'windsurf.md': block,
    'opencode.md': block,
    'cursor.mdc': `---\ndescription: Desk Studio, the design studio on call for this project\nalwaysApply: true\n---\n\n${block}`,
  };
}

function copyTree(src, dst, { skip = [] } = {}) {
  mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const name of readdirSync(src)) {
    if (skip.includes(name)) continue;
    const s = join(src, name), d = join(dst, name);
    if (statSync(s).isDirectory()) n += copyTree(s, d, { skip });
    else { copyFileSync(s, d); n++; }
  }
  return n;
}

export function build({ log = s => process.stdout.write(s + '\n') } = {}) {
  const adaptersDir = join(ROOT, 'adapters');
  mkdirSync(adaptersDir, { recursive: true });
  const files = buildAdapterFiles();
  for (const [name, text] of Object.entries(files)) writeFileSync(join(adaptersDir, name), text);
  log(`adapters: ${Object.keys(files).length} files in ${relative(ROOT, adaptersDir)}/`);

  const copies = [
    ['runner', 'runner', { skip: ['test'] }],
    ['proof', 'proof', { skip: ['test'] }],
    ['dashboard', 'dashboard', { skip: ['test'] }],
    [join('skills', 'desk'), join('skills', 'desk'), {}],
    ['adapters', 'adapters', {}],
    ['fonts', 'fonts', {}],
  ];
  for (const [from, to, opts] of copies) {
    const src = join(ROOT, from);
    if (!existsSync(src)) { log(`skipped ${from}/, not in the repo yet`); continue; }
    const dst = join(PKG, to);
    rmSync(dst, { recursive: true, force: true });
    const n = copyTree(src, dst, opts);
    log(`copied ${from}/ to packages/deskstudio/${to.split('\\').join('/')}/ (${n} files)`);
  }
  mkdirSync(join(PKG, 'scripts'), { recursive: true });
  for (const name of ['emit-event.mjs', 'font.mjs', 'state.mjs', 'prices.json']) {
    if (!existsSync(join(ROOT, 'scripts', name))) continue;
    copyFileSync(join(ROOT, 'scripts', name), join(PKG, 'scripts', name));
    log(`copied scripts/${name}`);
  }
  const ignore = ['# Generated by scripts/build-adapters.mjs, the sources live at the repo root.', 'runner/', 'proof/', 'dashboard/', 'skills/', 'scripts/', 'adapters/', 'fonts/', 'node_modules/', ''].join('\n');
  writeFileSync(join(PKG, '.gitignore'), ignore);
  const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'));
  log(`package ${pkg.name}@${pkg.version} is self-contained in packages/deskstudio/`);
}

const direct = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (direct) build();
