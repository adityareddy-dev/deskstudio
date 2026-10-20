# The runner

`desk-run` is the Design Manager's loop as a Node program. It lets the same desks, the same loop and the same floor work outside Claude Code, with a different provider per tier. In Claude Code the plugin's subagents do this natively. Everywhere else, and for anyone who wants to mix providers across tiers, the runner drives the loop itself.

```
desk-run design "a launch card for LinkedIn" [--project DIR] [--quality studio|best|thrifty] [--rounds N]
         [--models director=anthropic/opus,builder=openai/nano] [--brand #hex|path] [--timeout MIN]
desk-run resume <id> [--project DIR]
desk-run doctor [--probe]
desk-run providers
```

From the repo: `bin/desk-run` (or `bin\desk-run.cmd`). From the npm package: `npx --package deskstudio desk-run`. The tool is a binary in the `deskstudio` package, so the package name must be explicit when it is not installed locally.

## What one job does

The loop is the one in `skills/desk/SKILL.md`, step for step. Every model call gets a role brief as its system prompt, the brief, the brand, the standard and the house style in the message, and screenshots where the step needs eyes. Desks return files as fenced HTML blocks. Antigravity reads copied screenshots in a temporary workspace, and every image read is checked before its response is accepted.

1. **Brand.** If `.desk/DESIGN.md` is missing, the director model reads a scan of the project (package.json, README, CSS custom properties, tailwind config, logo files, index.html head) with the brand-from-project procedure and writes the file. Headless, so it never asks: with nothing to go on it uses the house style defaults and says so under `sources`. `--brand #0f62fe` answers the one question the procedure would ask.
2. **Intake.** The director model plays the Manager with the Manager skill as its system prompt and writes `.desk/jobs/<id>/brief.md`. The runner reads the named sizes and the copy block out of it. The first line of the file is a comment holding the ask in five words for the handback. The ask lives nowhere else.
3. **Roughs.** Three calls at the senior model, in parallel, with the UI Designer brief. Each gets one composition pattern from the standard, the first three in the standard's order. Each returned HTML document is saved as `rough-N.html` immediately. If a call fails, the runner lets the other desks finish and preserves their files. Resume requests only the missing roughs, then renders the set with `proof render` (screenshots only).
4. **Pick.** The director model with the Art Director brief and every rough's screenshots at every size. The pick block is parsed exactly as the brief defines it. The picked rough is copied to `final.html`. `pick: N` in control.json overrides the Art Director, who then writes the notes for that rough, and state records `by: "user"`.
5. **Polish.** The builder model with the UI Designer brief, the current `final.html`, the notes in order and the current screenshots. One round is one call.
6. **Proof.** `proof/cli.mjs check` on `final.html` with the brand, the sizes and the brief's copy lines as `--must-appear` (unless the brief marked the copy as draft). Failures go back to the builder as notes, in plain words, and never reach the Creative Director.
7. **Sign-off.** The director model with the Creative Director brief, the rubric, the Art Director's pick notes and the screenshots. The scores block is parsed, and the bar is computed from the rubric (every axis 8 or above, average 8.5 or above) rather than trusted from the reply. Under the bar, the notes go back to the builder.
8. **Escalation.** A note is missed when the same axis (or the same proof check) fails again after being noted. Two misses running, so three failures in a row, move the next polish round to the senior model. Two more at the senior model and the Art Director takes the pen for one round (same brief, escalation shape, returns the whole file). Then back down to the builder.
9. **Cap.** `--rounds` (1 to 12, default 8 from project.json) counts polish rounds. At the cap the job hands back anyway, the Scores line says `under the bar`, the Open line names the axes and the last note, `waitingOn` is set to `approve_under_bar`, and the exit code is 4.
10. **Handback.** Printed to stdout in the shape of `skills/desk/procedures/handback.md`, also written to `.desk/out/<id>/handback.md`. A job that passed appends its decision to `project.json` (`decisions`) since there is no Stop hook outside Claude Code. Progress lines go to stderr, so a host agent can hand back stdout as it is.

Exit codes: 0 done at the bar, 4 handed back under the bar, 3 holding, 1 failed, 2 usage.

## Files

```
.desk/
  DESIGN.md            the brand (found or written once, edit any time)
  project.json         models per tier, quality, presets, maxRounds, decisions
  taste.md             what the user approved and rejected
  events.jsonl         one line per event, names, numbers and paths only
  jobs/<id>/
    brief.md           the brief, the only place the ask lives
    state.json         the floor: phase, round, desks, pick, proof, scores, cost, waitingOn
    control.json       written by the floor or by hand: paused, models, pick
    inbox/<desk>.md    a note from the user to one desk, read once then deleted
    renders/roughs/rough-N/<size>.png, renders/round-N/<size>.png
  out/<id>/
    rough-1.html rough-2.html rough-3.html final.html handback.md
```

`state.json` follows the shape in the Manager skill (the same one `scripts/state.mjs` keeps in native mode, with `tokens` by tier and desk entries `{ desk, task, status, model, startedAt, updatedAt }`), plus what the runner needs to resume: `pen` (builder, senior or art-director), `notes` (for the next polish round), `misses` (per axis or proof check), `roughs`, `lastRenders`, and `next` when the job is paused or failed. So the floor shows a runner job and a native job the same way.

Tiers and desks come from `skills/desk/desks.json`, the registry the floor and the generated agents share: the default seat per tier, and each desk's name and tier. A command may only staff desks that are in it.

## Events

Job events go through `scripts/emit-event.mjs` in its from-a-skill form: `job.start`, `job.phase`, `job.pick`, `job.proof`, `job.score`, `job.waiting`, `job.done`, and `desk.start` with the desk, tier, model and task. `desk.stop` is written by the runner itself in the shape the SubagentStop hook writes in native mode: `desk`, `tier`, `status`, `seconds`, `model` (the spec, `anthropic/haiku`), `modelId` (the provider's id), `tokens { total, input, cacheRead, cacheWrite, output }` when the provider reported them, and `costUsd` when it could be priced. `scripts/state.mjs cost` rolls those up the same way for both modes. Never prompt text, copy or notes, only names, numbers and paths.

## The control file

Before every model call the runner reads `.desk/jobs/<id>/control.json`:

- `"paused": true` holds the job. The current call is never interrupted, the hold happens before the next one. State gets `phase: "paused"` and `next: "<phase>"`, the runner prints one line saying how to resume, and exits 3.
- `"models": { "builder": "openai/nano" }` moves a tier for the rest of the job. State records the new seat, the handback lists every model each desk used.
- `"pick": 2` overrides the Art Director's pick, as above.

A file in `inbox/<desk>.md` is a note from the user to that desk. The runner puts it at the top of that desk's next prompt under "Note from the user" and deletes it. For the three parallel roughs the first rough takes the note.

The floor writes these files. Without the floor, write them by hand.

## Resume

`desk-run resume <id>` continues a job from its state: after a pause, after a failure (the step that failed runs again), or after the terminal was closed. It clears `paused` in control.json, since asking to resume is the answer. A finished job prints its handback again.

## Cost

Each call reports tokens as `{ input, output, cacheRead, cacheWrite, total }` (input is the uncached part) and `costUsd` when the provider gives dollars: the claude CLI reports dollars in its result, codex and agy report tokens which are priced from `runner/models.json` (input, output, and cache prices where published, else cached tokens cost as input), API calls are priced the same way. Tokens roll up into `state.tokens` by tier, cost into `state.cost`. Unknown prices, including Argon, and failed requests without usage leave the dollar total incomplete. These are list-price estimates, not subscription bills.

## Fonts

Builders in runner mode cannot run `scripts/font.mjs`, so the runner does it: when the brand's `type.family` starts with a bundled family, it asks `font.mjs` for the @font-face block once per job (into the out folder), tells the builder to write the family's stack and nothing else, and splices the block into every file the builder returns between `/* desk:font start */` and `/* desk:font end */`. The block is stripped again before the current file is shown to a builder, so a 100 KB data URI never sits in a prompt. Without `font.mjs`, or with a family it does not bundle, nothing is added and proof's font check says so.

## Vision

Pick and sign-off see the screenshots. Anthropic, OpenAI and Google have completed jobs with screenshot review. The [OpenAI results](../evals/providers/openai-2026-10-19/README.md) and [Google-only and mixed results](../evals/providers/google-2026-10-19/README.md) retain the artifacts and outcomes. Antigravity's image-read events are verified for every supplied screenshot. If a model in `models.json` is marked `vision: false`, the runner sends no images, state records `signoffBy: "report"`, and the handback says the director did not see the screenshots.

## Adding a command

`runner/commands.mjs` is a table: the standard, the deliverable name, the default sizes and the desks. A new command is one row plus its standard under `skills/desk/standards/`. No loop code changes.

## What stays Claude Code only

Native subagents with the host's tools (reading the repo, editing components, the Figma MCP), the hooks that light the floor from the host's own tool calls, and the memory block applied by the Stop hook. The runner's desks produce files, not repo edits, which is what deliverables are anyway. Everything else, the desks, the loop, the tiers, proof, the control file and the event log, runs anywhere Node and Chrome run.

## Tests

```
node --test "runner/test/*.test.mjs"
```

A fake provider answers from canned documents and score blocks, so the loop tests make no model calls and still render with proof for real. They cover the parsers, a pass on round one, notes carried into round two, a proof failure that never reaches the director, the cap, the escalation ladder, the brand step, two sizes, pause and resume, control.json seats and pick, the inbox, a failed call, and the installer on a temp dir.
