---
name: status
description: Show every Desk Studio job in this project with its phase, round, scores and cost, from the state files, with no model calls. Use to see what is running, what finished and what is waiting on you.
argument-hint: "[job id | running | waiting | done] [--json]"
---

Report job status as the Design Manager. No desks are spawned and no model is called beyond this session: this command reads files and prints a table.

**Deliverable and standard.** A table, one row per job, from `.desk/jobs/*/state.json`. Plain words, readable on a phone.

**Desks.** None.

**Inputs.** Nothing, to list every job newest first. A job id, to show one job in full. A filter: `running` (phase not `done` or `paused`, and `waitingOn` null), `waiting` (`waitingOn` set, or phase `paused`), `done`. `--json` prints the raw state objects instead of the table.

**Proof sizes.** None.

**Output.** Printed, not written to disk:

```
Jobs in .desk/jobs/ (3)

id                                  command         phase    round  avg   pass  cost   waiting on
20261018-1830-launch-card-linkedin  design          done     3/8    8.75  yes   0.32   none
20261018-1902-welcome-email         email-template  polish   2/8    8.10  no    0.18   none
20261018-1911-brand-kit-blue        brand-kit       paused   0/8    -     -     0.41   pick: which direction, 1, 2 or 3
```

For one job: the table row, then the desks list (desk, task, status, model), the pick line, the proof lines, each score line with its axes, `files`, and the last five events for that id from `.desk/events.jsonl` if the file exists.

**Run.** Do not run the loop. Instead:

1. Find `.desk/` as step 0 of `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` describes. If there is no `.desk/jobs/`, say "No jobs yet. Run /desk:design to start one." and stop.
2. Read every `state.json`. Skip and list separately any file that does not parse, with its path.
3. Sort by `updatedAt` descending. Apply the filter. `avg` is the last entry of `scores` or `-`, `pass` likewise, `cost` is `cost.total` with `~` in front when `cost.complete` is false.
4. Print the table with the columns above, then one line: how many running, waiting, done, and the total cost across listed jobs.
5. If any job is `waiting`, end with its id and the `waitingOn.text` so the user can answer it.
6. Emit no events and write nothing.

The ask: **$ARGUMENTS**
