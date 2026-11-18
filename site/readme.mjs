#!/usr/bin/env node
// Writes README.md. Edit the text here, never README.md itself, then run: node site/readme.mjs
// The open starter jobs come from site/starters.json and the desk count from the desk registry, so they stay true.
// CI runs this and fails when README.md differs from what it writes.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const json = f => JSON.parse(readFileSync(join(root, f), 'utf8'));

const registry = json('skills/desk/desks.json');
const starters = json('site/starters.json');
const jobCount = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][starters.length] || String(starters.length);
const jobLink = number => { const job = starters.find(job => job.number === number); const title = job && [2, 6].includes(number) ? job.title[0].toLowerCase() + job.title.slice(1) : job?.title; return job ? `[${title}](https://github.com/adityareddy-dev/deskstudio/issues/${job.number})` : null; };
const starterGroups = [[[3, 4], 'for someone who uses that host.'], [[5, 6], 'for someone comfortable with JavaScript.'], [[1, 2], 'for someone who wants to write a desk. Bigger than the rest.']];

const md = `<p align="center"><img src="brand/logo/banner.png" alt="Desk Studio. Your own design studio. At your desk." width="100%"></p>

# Desk Studio

A full design studio inside the coding agent you already use. One command, free, nothing leaves your machine but the model calls you already make.

<p>
  <a href="https://www.npmjs.com/package/deskstudio"><img src="https://img.shields.io/npm/v/deskstudio" alt="npm version"></a>
  <a href="https://github.com/adityareddy-dev/deskstudio/actions/workflows/check.yml"><img src="https://github.com/adityareddy-dev/deskstudio/actions/workflows/check.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-MIT-blue" alt="MIT licence"></a>
  <a href="https://www.codetriage.com/adityareddy-dev/deskstudio"><img src="https://www.codetriage.com/adityareddy-dev/deskstudio/badges/users.svg" alt="Open Source Helpers"></a>
  <a href="https://github.com/adityareddy-dev/deskstudio/contribute"><img src="https://img.shields.io/github/issues/adityareddy-dev/deskstudio/good%20first%20issue?label=good%20first%20issues&color=ffaa1c" alt="good first issues"></a>
</p>

[deskstudio.ai](https://deskstudio.ai) · [Get started](#get-started) · [Dashboard guide](docs/dashboard.md) · [Docs](#docs) · [Contribute](#contribute) · [Discussions](https://github.com/adityareddy-dev/deskstudio/discussions)

<a href="site/media/explainer.mp4"><img src="site/media/explainer.gif" alt="One brief through roughs, pick, polish, pixel proof and scored sign-off" width="760"></a>

[Watch the 50-second explainer](site/media/explainer.mp4)

## Get started

You need Node.js 20 or newer and one model account you already use: Claude Code or the \`claude\` CLI, the \`codex\` CLI, Antigravity (\`agy\`), or an API key (\`ANTHROPIC_API_KEY\`, \`OPENAI_API_KEY\` or \`GEMINI_API_KEY\`).

**In Claude Code**, install the plugin, then ask:

\`\`\`
/plugin install desk --marketplace adityareddy-dev/deskstudio
/desk:design a launch card for LinkedIn
\`\`\`

If proof finds no browser on the machine, it prints the one command that sets one up.

**In Codex, Cursor, Gemini CLI, Copilot, Windsurf, OpenCode or a plain terminal**, run these in your project:

\`\`\`
npx deskstudio add
npx --package deskstudio desk-run doctor
npx --package deskstudio desk-run design "a launch card for LinkedIn"
\`\`\`

\`add\` sets the project up and tells your agent about the studio, so after that you can also ask the agent in plain words. \`doctor\` checks your model sign-in and the browser proof renders with, and makes no model call. \`design\` makes the card, usually in a few minutes.

No Chrome on the machine? Run this once and proof downloads its own browser:

\`\`\`
npx --package deskstudio desk-proof setup
\`\`\`

On a Linux server with no desktop, add \`--with-deps\` so it also installs the system libraries the browser needs.

The files land in \`.desk/out/<job>/\`: three roughs, \`final.html\`, and a short note on who did what, the scores and the cost.

## What a run looks like

<a href="site/media/real-run.mp4"><img src="site/media/real-run.gif" alt="Eight seconds captured from a fresh Desk Studio CLI job" width="760"></a>

[Watch the real CLI capture](site/media/real-run.mp4)

The outputs, scores and cost are in [What it makes](docs/gallery.md).

## Watch it work

The dashboard shows the studio as it works. Every desk is a small bot at its own desk, awake while its agent works, and the job moves along a track from the brief to the sign-off with its round, score and cost. Turn it on once per project, start it, and open the link it prints:

\`\`\`
npx --package deskstudio desk-dashboard setup
npx --package deskstudio desk-dashboard start
\`\`\`

In Claude Code that is \`/desk:dashboard setup\`, then \`/desk:dashboard start\`. It only listens on 127.0.0.1, behind a token in the link.

<a href="docs/images/dashboard/full-page.webp"><img src="docs/images/dashboard/full-page.webp" alt="The whole dashboard during a real launch card job: the track, the floor of desks, the review board with three roughs, the polish rounds, and the cost by role" width="760"></a>

<a href="site/media/walkthrough.mp4"><img src="site/media/floor-idle.gif" alt="The floor of a real brand-kit job: desks wake as their agents start and sleep when they stop" width="760"></a>

[Watch a whole job on the dashboard, 50 seconds with captions](site/media/walkthrough.mp4). How to read every part of it is in [the dashboard guide](docs/dashboard.md).

## Why it exists

Cheap models make, strong models judge. Every visual job runs the way a studio runs: roughs, a pick, polish, proof, sign-off. The desks call models through the CLI you are already signed in to (\`claude\`, \`codex\` or \`agy\`) or a key (\`ANTHROPIC_API_KEY\`, \`OPENAI_API_KEY\`, \`GEMINI_API_KEY\`). \`npx --package deskstudio desk-run doctor\` shows which path it will take without making a model call. Scores come from the studio's model reviewers, they are not independent benchmarks.

## How it works

Three roughs on Sonnet, the pick on Opus, polish on Haiku, proof with no model, then the sign-off. The launch card job, retold with its real numbers. The five steps, the retry rules and the pixel checks are in [How a job runs](docs/how-it-works.md).

- ${registry.desks.length} desks: the Design Manager and ${registry.desks.filter(d => d.agent !== false).length} that run as subagents. See [the team, cost and models](docs/team-and-cost.md) and [docs/roles.md](docs/roles.md).
- A local [dashboard](docs/dashboard.md) to watch the desks work, pause, move a desk to another model, write a desk a note or pick a rough yourself.
- It runs on your machine. The only things that leave it are the model calls the desks make and, for the few research desks, web lookups. The dashboard is 127.0.0.1 only with a token in the URL. See [docs/privacy.md](docs/privacy.md).

## Settings

\`npx deskstudio add\` writes \`.desk/\`, copies the desks to \`.agents/skills/desk/\` and puts one marked block in the agent's instruction file. Every agent by default, one with \`--agent codex\`. Outside Claude Code the runner takes \`design\` for social cards for now. The other commands are Claude Code skills. Older Claude Code versions, the table of instruction files per agent, what each agent gets and the update rules are in [docs/install.md](docs/install.md).

Models are set once in \`.desk/project.json\`, or from the dashboard for one job:

\`\`\`json
"models": {
  "director": "anthropic/opus",
  "senior": "anthropic/sonnet",
  "builder": "openai/nano"
}
\`\`\`

Providers and roles are in [docs/providers.md](docs/providers.md) and [docs/runner.md](docs/runner.md). Proof also works on its own:

\`\`\`
npx --package deskstudio desk-proof check hero.html --brand .desk/DESIGN.md --sizes phone,desktop
\`\`\`

## Contribute

${jobCount} jobs are open, and none of the checks need a model call. [Your first contribution](docs/first-contribution.md) has the files to read and the check to run for each small one.

${starterGroups.map(([numbers, note]) => { const links = numbers.map(jobLink).filter(Boolean); return links.length ? `- ${links.join(' or ')}, ${note}` : ''; }).filter(Boolean).join('\n')}

Check that a job is open and unclaimed before starting. The [contribution guide](CONTRIBUTING.md) covers setup, source files and checks. Want to talk first, or show what you made? [Discussions](https://github.com/adityareddy-dev/deskstudio/discussions) is open, and [Show and tell](https://github.com/adityareddy-dev/deskstudio/discussions/categories/show-and-tell) is for finished pieces. To report a failed install, use the [issue templates](https://github.com/adityareddy-dev/deskstudio/issues/new/choose) with the host, version and exact command. Remove private project content from logs.

## Docs

[Commands](docs/commands.md), [Codex setup](docs/codex.md), [the desks](docs/roles.md), [the dashboard](docs/dashboard.md), [cost](docs/cost.md), [the runner](docs/runner.md), [providers](docs/providers.md), [privacy](docs/privacy.md), [first contribution](docs/first-contribution.md), [install](docs/install.md), [what it makes](docs/gallery.md), [how a job runs](docs/how-it-works.md), [the team, cost and models](docs/team-and-cost.md), [the dashboard in use](docs/dashboard-tour.md).

To cite Desk Studio, use [CITATION.cff](CITATION.cff) or GitHub's **Cite this repository**.

## Licence

MIT.
`;
writeFileSync(join(root, 'README.md'), md);
console.log(`README.md ${Math.round(Buffer.byteLength(md) / 1024)} KB`);
