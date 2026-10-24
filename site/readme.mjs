#!/usr/bin/env node
// Writes README.md from the repo's records, so every number in it comes from a run: the golden gallery, the launch
// card job, the desk registry and the models table. Run after a golden changes: node site/readme.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const json = f => JSON.parse(readFileSync(join(root, f), 'utf8'));
const money = v => `$${(Math.round(v * 100) / 100).toFixed(2)}`;
const avgOf = g => { const v = Object.values(g.axes || {}); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : g.average; };
const rel = p => relative(root, p).replace(/\\/g, '/');

const registry = json('skills/desk/desks.json');
const models = json('runner/models.json');
const starters = json('site/starters.json');
const jobCount = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][starters.length] || String(starters.length);
const jobLink = number => { const job = starters.find(job => job.number === number); const title = job && [2, 6].includes(number) ? job.title[0].toLowerCase() + job.title.slice(1) : job?.title; return job ? `[${title}](https://github.com/adityareddy-dev/deskstudio/issues/${job.number})` : null; };
const starterGroups = [[[3, 4], 'for someone who uses that host.'], [[5, 6], 'for someone comfortable with JavaScript.'], [[1, 2], 'for someone who wants to write a desk. Bigger than the rest.']];
const cardJob = '20261019-0025-launch-card-desk-studio';
const card = json(`clips/fixtures/card/jobs/${cardJob}/state.json`);
const cardFinal = card.scores.find(s => s.round === card.round) || card.scores.at(-1);
const judge = Math.round(card.cost.director / card.cost.total * 100);

const goldens = [];
for (const deliverable of readdirSync(join(root, 'evals', 'golden'))) {
  for (const name of readdirSync(join(root, 'evals', 'golden', deliverable))) {
    const dir = join(root, 'evals', 'golden', deliverable, name);
    if (!existsSync(join(dir, 'golden.json'))) continue;
    const g = JSON.parse(readFileSync(join(dir, 'golden.json'), 'utf8'));
    const c = existsSync(join(root, 'evals', 'cases', `${basename(g.from || '')}.json`)) ? JSON.parse(readFileSync(join(root, 'evals', 'cases', `${basename(g.from)}.json`), 'utf8')) : {};
    goldens.push({ deliverable, name, dir, command: g.command || c.command || deliverable, brand: g.brand || c.brand || name.split('-')[0], average: avgOf(g), rounds: g.rounds, cost: g.cost?.total, image: pickRender(dir) });
  }
}
goldens.sort((a, b) => a.deliverable.localeCompare(b.deliverable) || a.name.localeCompare(b.name));
function pickRender(dir) {
  const r = join(dir, 'renders');
  if (!existsSync(r)) return null;
  const all = [];
  const walk = (d, depth) => { for (const f of readdirSync(d, { withFileTypes: true })) { if (f.isDirectory() && depth < 3) walk(join(d, f.name), depth + 1); else if (f.isFile() && /\.png$/.test(f.name) && !/background/.test(f.name)) all.push(join(d, f.name)); } };
  walk(r, 0);
  // The main state first: an empty, error or loading state render only when there is nothing else.
  const main = all.filter(f => !/(^|[\\/])(empty|error|loading)[\\/]/.test(f));
  const pool = main.length ? main : all;
  const prefer = [/slide-01[\\/]ig-post\.png$/, /email-600-light\.png$/, /held-00000\.png$/, /f-00000\.png$/, /[\\/]hero[\\/]desktop\.png$/, /[\\/]desktop\.png$/, /[\\/]linkedin\.png$/, /[\\/]x\.png$/, /ig-post\.png$/, /ig-square\.png$/, /\.png$/];
  for (const p of prefer) { const hit = pool.sort().find(f => p.test(f)); if (hit) return hit; }
  return null;
}

const ctlDir = join(root, 'clips', 'fixtures', 'controls', 'jobs');
const ctl = JSON.parse(readFileSync(join(ctlDir, readdirSync(ctlDir)[0], 'state.json'), 'utf8'));
const ctlAvg = (Object.values(ctl.scores.at(-1).axes).reduce((a, b) => a + b, 0) / 8).toFixed(1);
const gif = (name, alt = name) => existsSync(join(here, 'media', `${name}.gif`)) ? `![${alt}](site/media/${name}.gif)\n\n` : '';
const tierRows = [['director', 'the pick, the notes, the sign-off'], ['senior', 'the roughs, research, type, tokens, copy'], ['builder', 'every polish round, the making']];
const desksByTier = t => registry.desks.filter(d => d.tier === t);

const md = `<p align="center"><img src="brand/logo/banner.png" alt="Desk Studio. Your own design studio. At your desk." width="100%"></p>

<p align="center">A full design studio inside the coding agent you already use.<br>One command, free, nothing leaves your machine but the model calls you already make.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/deskstudio"><img src="https://img.shields.io/npm/v/deskstudio" alt="npm version"></a>
  <a href="https://github.com/adityareddy-dev/deskstudio/actions/workflows/check.yml"><img src="https://github.com/adityareddy-dev/deskstudio/actions/workflows/check.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-MIT-blue" alt="MIT licence"></a>
  <a href="https://www.codetriage.com/adityareddy-dev/deskstudio"><img src="https://www.codetriage.com/adityareddy-dev/deskstudio/badges/users.svg" alt="Open Source Helpers"></a>
  <a href="https://github.com/adityareddy-dev/deskstudio/contribute"><img src="https://img.shields.io/github/issues/adityareddy-dev/deskstudio/good%20first%20issue?label=good%20first%20issues&color=ffaa1c" alt="good first issues"></a>
</p>

<p align="center"><a href="https://deskstudio.ai">deskstudio.ai</a> · <a href="#install">Install</a> · <a href="#docs">Docs</a> · <a href="#contribute">Contribute</a> · <a href="https://github.com/adityareddy-dev/deskstudio/discussions">Discussions</a></p>

<br>

## One command, every style

<p align="center"><img src="site/media/one-command.gif" alt="One command typed in a terminal, then every piece the studio has signed off" width="760"></p>
<p align="center"><sub>Type one line in your agent. The wall is the ${goldens.length} pieces the studio has signed off so far.</sub></p>

<br>

## How a job runs

<p align="center"><img src="site/media/explainer.gif" alt="A team of desk robots passes one job along: roughs, the pick, polish, proof and the sign-off" width="760"></p>
<p align="center"><sub>Three roughs on Sonnet, the pick on Opus, polish on Haiku, proof with no model, then the sign-off. The launch card job, retold with its real numbers.</sub></p>

<br>

## Install

Claude Code:

\`\`\`
/plugin install desk --marketplace adityareddy-dev/deskstudio
\`\`\`

On a Claude Code older than 2.1.275, add the marketplace first, then install:

\`\`\`
/plugin marketplace add adityareddy-dev/deskstudio
/plugin install desk@deskstudio
\`\`\`

Then ask for something:

\`\`\`
/desk:design a launch card for LinkedIn
\`\`\`

Codex, Cursor, Gemini CLI, Copilot, Windsurf or OpenCode, one line in the project:

\`\`\`
npx deskstudio add
\`\`\`

It writes \`.desk/\`, copies the desks to \`.agents/skills/desk/\` and puts one marked block in the agent's instruction file. Every agent by default, one with \`--agent codex\`. Run it again any time, it keeps project text outside its markers, updates untouched desk briefs and preserves your edits unless you pass \`--force\`. It records installed file hashes in \`.desk/installed.json\`, including on the first upgrade from npm 1.0.0.

| Agent | Where the block goes |
| --- | --- |
| Codex | \`AGENTS.md\` |
| OpenCode | \`AGENTS.md\` |
| Gemini CLI | \`GEMINI.md\` |
| Copilot | \`.github/copilot-instructions.md\` |
| Cursor | \`.cursor/rules/desk.mdc\` |
| Windsurf | \`.windsurf/rules/desk.md\` |

Then ask the agent in plain words, "design a launch card for LinkedIn", it reads the block and runs the studio. Or run it yourself:

\`\`\`
npx --package deskstudio desk-run design "a launch card for LinkedIn"
\`\`\`

The desks call models through the CLI you are already signed in to (\`claude\`, \`codex\` or \`agy\`) or a key (\`ANTHROPIC_API_KEY\`, \`OPENAI_API_KEY\`, \`GEMINI_API_KEY\`). \`npx --package deskstudio desk-run doctor\` shows which path it will take without making a model call.

The runner takes \`design\` for social cards for now. The other commands in the gallery below are Claude Code skills, see [command availability](docs/commands.md#command-availability).

Files land in \`.desk/out/<job>/\` with a short note on who did what, the scores and the cost.

## What it makes

${goldens.length} signed-off pieces so far, for four made-up brands (Northlight, Quill, Ferro and Harbor), one real site whose brand the studio found in the project, and the studio's own. The score is the eight-axis average, rounded to one decimal, and the cost is list price for the whole job. Scores come from the studio's model reviewers, they are not independent benchmarks.

| Piece | Command | Score | Rounds | Cost |
| --- | --- | --- | --- | --- |
${goldens.map(g => `| ${g.image ? `[${g.deliverable}${g.brand ? ` for ${g.brand}` : ''}](${rel(g.image)})` : g.deliverable} | \`/desk:${g.command}\` | ${g.average} | ${g.rounds} | ${money(g.cost)} |`).join('\n')}

Every one of these is in [\`evals/golden/\`](evals/golden/) with its renders and its state, and the final file where the job kept one.

## Contribute

${jobCount} jobs are open, and none of the checks need a model call. [Your first contribution](docs/first-contribution.md) has the files to read and the check to run for each small one.

${starterGroups.map(([numbers, note]) => { const links = numbers.map(jobLink).filter(Boolean); return links.length ? `- ${links.join(' or ')}, ${note}` : ''; }).filter(Boolean).join('\n')}

Check that a job is open and unclaimed before starting. The [contribution guide](CONTRIBUTING.md) covers setup, source files and checks. Want to talk first, or show what you made? [Discussions](https://github.com/adityareddy-dev/deskstudio/discussions) is open, and [Show and tell](https://github.com/adityareddy-dev/deskstudio/discussions/categories/show-and-tell) is for finished pieces. To report a failed install, use the [issue templates](https://github.com/adityareddy-dev/deskstudio/issues/new/choose) with the host, version and exact command. Remove private project content from logs.

## How it gets there

Every visual job runs the way a studio runs:

1. **Roughs.** The UI Designer makes three directions at the senior model from the brief, the brand and the standard for the piece.
2. **Pick.** The Art Director looks at the renders, picks one or combines, and writes the notes.
3. **Polish.** The builder desk revises with the notes and the screenshot. Rounds are cheap, so this is where the iteration goes.
4. **Proof.** Contrast on the rendered pixels, overflow, safe zones, palette, type scale, copy present. No model in the loop. A failure goes back to the builder with the screenshot. Proof runs on every polished file, not on the roughs.
5. **Sign-off.** The Creative Director scores eight axes: hierarchy, typography, spacing, colour, composition, originality, brand fit, copy. Pass is every axis at 8 or above and the average at 8.5 or above.

A builder that misses the same note twice hands the file to a senior. A senior that misses twice hands it to the Art Director for one round. After the cap, the job comes back marked under the bar, with a note naming the axis that fell short.

The launch card at the top went roughs, pick (rough ${card.pick.rough}: ${card.pick.reason}), then ${card.scores.map(s => `${s.average}`).join(', ')} over ${card.round} rounds, signed off at ${cardFinal.average}.

${gif('before-after')}## The dashboard

\`/desk:dashboard setup\` once, then \`/desk:dashboard start\`, opens a local page: ${registry.desks.length} desks lit when active, the job's phase and round, the review board with every rough, pick and round, the scorecard, and the cost by tier. Every control is a write to a file the Manager reads before its next step: pause, continue, stop, move a tier or a desk to another model, write a desk a note, pick a rough yourself, approve under the bar or send back with notes.

${gif('pick-it-yourself')}${gif('swap-the-seat', 'Change the builder role')}${gif('note-to-the-desk')}One real job, run from the dashboard: paused after the roughs, the pick made by hand, the builder role moved from Haiku to Sonnet, and a note written to the UI Designer. It came back signed off at ${ctlAvg} in ${ctl.round} rounds, ${money(ctl.cost.total)} at list price.

${gif('the-pick')}## The team

${registry.desks.length} desks, the Design Manager and ${registry.desks.length - 1} that run as subagents. Each is a written brief: what it owns, how it decides, its checklist and what it hands to the next desk. Full index in [docs/roles.md](docs/roles.md).

${tierRows.map(([t, does]) => `**${t[0].toUpperCase() + t.slice(1)}s** (${does}, default \`${registry.tiers[t].default}\`): ${desksByTier(t).map(d => d.name).join(', ')}.`).join('\n\n')}

The Design Manager runs in your session on whatever model you run.

## What it costs

Cheap models make, strong models judge. Roughs come from the senior roles, every polish round from the builder roles, and the pick, the notes and the sign-off from the director roles.

| Tier | Default | Does |
| --- | --- | --- |
${tierRows.map(([t, does]) => `| ${t} | \`${registry.tiers[t].default}\` | ${does} |`).join('\n')}

The launch card above: ${money(card.cost.total)} at list price. Director ${money(card.cost.director)}, senior ${money(card.cost.senior)}, builder ${money(card.cost.builder)}. ${judge}% went to judgment, ${100 - judge}% to making, over ${card.desks.length} desk runs. How the dashboard counts it is in [docs/cost.md](docs/cost.md).

${gif('cost-meter')}## Models per role

The runner reaches each provider through the CLI you already have signed in, on the plan you already pay for. API keys are the fallback. One provider is fine, and tiers can mix. Jobs have completed through the Anthropic, OpenAI and Google CLIs. Google uses Antigravity CLI. Set once in \`.desk/project.json\`, or from the dashboard for one job:

\`\`\`json
"models": {
  "director": "anthropic/opus",
  "senior": "anthropic/sonnet",
  "builder": "openai/nano"
}
\`\`\`

| Provider | CLI | Roles |
| --- | --- | --- |
${Object.values(models.providers).map(p => `| ${p.label} | \`${p.cli}\` | director \`${p.tiers.director}\`, senior \`${p.tiers.senior}\`, builder \`${p.tiers.builder}\` |`).join('\n')}

\`desk-run doctor\` says which CLIs and keys are on the machine and what the defaults would be. Details in [docs/providers.md](docs/providers.md) and [docs/runner.md](docs/runner.md).

## Proof

Every polished file is rendered in Chrome at each size and checked on the pixels before the Creative Director scores it: text contrast against the pixels behind it, overflow and clipping, safe zones per platform, colours inside the brand palette, type on the brand scale, every line of copy present, carousels consistent across slides, reading time and flashes in motion. \`desk-proof\` works on its own too:

\`\`\`
desk-proof check hero.html --brand .desk/DESIGN.md --sizes phone,desktop
\`\`\`

${gif('proof')}## Other agents

| Agent | What you get |
| --- | --- |
| Claude Code | Everything: the ${registry.desks.length - 1} desks as native subagents with the repo's tools, the Manager in your session, the loop, proof, the dashboard, video. |
| Codex, Cursor, Gemini CLI, Copilot, Windsurf, OpenCode | \`npx deskstudio add\` writes a rules block the agent reads and copies the desk briefs. The runner takes \`design\` for social cards, with the same loop, proof and dashboard, and desks return files rather than editing the repo. For design work inside the codebase the agent plays the Design Manager from the briefs. The other commands are Claude Code only for now. The installer is tested for each of these agents. Jobs have completed through the Claude, Codex and Antigravity CLIs. |

## Privacy

It runs on your machine. The only things that leave it are the model calls the desks make and, for the few research desks, web lookups. The dashboard is 127.0.0.1 only with a token in the URL. The event log holds names, numbers and paths, never the prompt text. See [docs/privacy.md](docs/privacy.md).

## Docs

[Commands](docs/commands.md), [Codex setup](docs/codex.md), [the desks](docs/roles.md), [the dashboard](docs/dashboard.md), [cost](docs/cost.md), [the runner](docs/runner.md), [providers](docs/providers.md), [privacy](docs/privacy.md), [first contribution](docs/first-contribution.md).

To cite Desk Studio, use [CITATION.cff](CITATION.cff) or GitHub's **Cite this repository**.

## Licence

MIT.
`;
writeFileSync(join(root, 'README.md'), md);
console.log(`README.md ${Math.round(Buffer.byteLength(md) / 1024)} KB, ${goldens.length} goldens`);
