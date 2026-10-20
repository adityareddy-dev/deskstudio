# The floor

The floor is the front desk of the studio. One page on your own machine where you see every desk, the job it is on, the roughs and the scores, and where you steer it: pause, change who sits where, write a desk a note, pick a rough yourself, approve or send back.

It is off by default. Turn it on once per project:

```bash
/desk:dashboard setup
/desk:dashboard start
```

`start` prints a link like `http://127.0.0.1:7433/?token=...`. Open it. The token changes on every start. `status` prints it again, `stop` ends the server, `disable` turns the floor off. Outside Claude Code the same commands are `desk-floor setup|start|stop|status|disable`, with `--project DIR` for another folder and `--port N` for another port.

## What it shows

**The job.** Command and deliverable, phase, round of max, quality preset, sizes, how long it has been running. The seats: which model each tier is on. Cost so far by tier from `state.json`, with a note when a desk did not report usage so the number is a floor, then the same cost per desk from the stop events, highest first. Staffing: every desk on the job with its task, status, model and how long it took, or has been going. The brief, folded away.

**The floor.** All 42 desks in a grid by tier: manager, director, senior, builder. The list is `skills/desk/desks.json`, the same registry the agents are built from. A desk lights up when it has started and not yet stopped, with its task, its model and the time it has been working. A desk with a model set just for it shows the model in the accent colour. Once a desk has stopped on this job, its card shows what it cost and how many tokens it used, summed over its runs, from what the desk reported when it stopped. The cost is list price, an estimate, since a subscription is not billed per token.

**The review board.** The three roughs from the latest render, with the pick ringed and the Art Director's reason and notes. Each polish round with its render, the proof result (passed, or how many checks failed) and the sign-off scores as one bar per rubric axis, green at 8 or above. Links to every file in the out folder.

**Memory.** The brand from `.desk/DESIGN.md` (name, colours, type), `.desk/project.json`, and `.desk/taste.md` when it exists.

**Events.** The last events from the log, names and numbers only.

When the job needs you, a banner says so at the top with Approve and Send back.

## What each control does

Every control is a write to a file the Design Manager reads before its next step. Nothing interrupts a desk mid-step. In native mode a running subagent cannot be stopped partway anyway, so pause means "hold at the next step" everywhere, and the button says so.

| Control | Where | What it writes |
| --- | --- | --- |
| Pause at next step, Continue | job panel | `control.json` `paused: true` or `false` |
| Stop job | job panel | `control.json` `stop: true` |
| Change model, "This job" | a tier row or a desk card | `control.json` `models.<tier>` or `models.desks.<desk>` |
| Change model, "Save as default" | the same | the above, and `models` in `.desk/project.json` |
| Use the tier model | a desk card with an override | removes `models.desks.<desk>` from `control.json` |
| Send note | a desk card | appends to `inbox/<desk>.md`, which the Manager puts in that desk's next prompt and then deletes |
| Pick this | a rough | `control.json` `pick: N`, which overrides the Art Director and is recorded as your call |
| Approve | the banner | `control.json` `approve: { at }` |
| Send back | the banner | `control.json` `sendBack: { notes, at }` |

Every control also appends one line to `.desk/events.jsonl`, type `control.<kind>`, with the job id and names or numbers: `paused`, the model names, the rough number, the desk a note went to and how long it was. Never the note itself.

Model names are `provider/model`, for example `anthropic/sonnet` or `openai/nano`. The picker lists the ones the project already uses plus the common ones, and takes any other name typed in.

## Where state lives

| Path | What |
| --- | --- |
| `.desk/dashboard.json` | `enabled` and `port`, written by `setup` |
| `.desk/dashboard.runtime.json` | pid, port and token of the running server, removed on `stop` |
| `.desk/dashboard.log` | start, stop, controls and errors, one line each |
| `.desk/events.jsonl` | the event log the floor tails |
| `.desk/jobs/<id>/state.json` | what the job panel and the review board show, kept by the Manager |
| `.desk/jobs/<id>/control.json` | your controls, merged key by key, read by the Manager |
| `.desk/jobs/<id>/inbox/<desk>.md` | your notes to a desk |
| `.desk/jobs/<id>/renders/rough-N/`, `round-N/` | the screenshots the board shows |
| `.desk/out/<id>/` | the files the desks made |

The page itself keeps one thing in the browser: the light or dark choice.

## Routes

All routes need the token, in the URL as `?token=` or in the header `X-Desk-Token`.

- `GET /api/health`: pid, port, start time.
- `GET /api/state`: project.json, the brand front matter, the jobs newest first, the active job, the desk list.
- `GET /api/jobs/:id`: state.json, control.json, the render folders with their PNGs, the out files, the brief, the inbox desks.
- `GET /api/events`: a server-sent event stream. The last 200 lines of the log on connect, then every new line. An extra `state` event fires when a state.json changes.
- `GET /api/file?path=`: a PNG, HTML, SVG or JSON file under `.desk/out` or `.desk/jobs` only. HTML and SVG are served sandboxed so a rough cannot run scripts against the floor.
- `POST /api/control/:id`: one of `{pause}`, `{stop}`, `{models, scope}`, `{pick}`, `{note}`, `{approve}`, `{sendBack}`.

## Tests

```bash
node --test "dashboard/test/*.test.mjs"
```
