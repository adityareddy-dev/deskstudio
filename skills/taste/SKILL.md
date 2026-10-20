---
name: taste
description: Record what you liked or rejected about a job, by rubric axis, into .desk/taste.md so every later job starts from it. Use right after looking at an output, with the job id and a sentence.
argument-hint: "<job id or 'last'> liked|rejected <what, in your words> | show | forget <entry number>"
---

Record taste as the Design Manager. No desks are spawned and no model is called beyond this session: this command writes a file.

**Deliverable and standard.** An entry in `.desk/taste.md`, the file the Creative Director reads on top of the standards on every job. Entries are written in the rubric's axes so a director can act on them, in plain words, never in the user's prompt text verbatim.

**Desks.** None.

**Inputs.** A job id under `.desk/jobs/`, or `last` for the most recent `state.json` by `updatedAt`, then `liked` or `rejected`, then the user's sentence. `show` prints the file. `forget N` removes entry N. With no job id and a sentence, the entry is general and `job` is `none`.

**Proof sizes.** None.

**Output.** `.desk/taste.md` in the project, created if missing with the heading below, one entry appended:

```md
# Taste

What the user approved and rejected, for the Creative Director to apply on top of the standards. Newest last.

## 1. liked, 2026-10-18, job 20261018-1830-launch-card-linkedin
- deliverable: social-card, pattern: editorial split, scores: average 8.75
- axes: hierarchy, composition
- note: the stat carried the card, keep the big figure left and the headline short on launch cards
- apply: on social cards for this brand, prefer the stat card and editorial split patterns, keep headlines under seven words
```

**Run.** Do not run the loop. Instead:

1. Find `.desk/` as step 0 of `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` describes, then the job: read its `state.json` for deliverable, pattern (from `pick`), the final scores, and the Art Director's notes.
2. Map the user's sentence to one to three rubric axes (hierarchy, typography, spacing, colour, composition, originality, brand, copy). If it names a pattern, a colour move or a copy habit, say so in `note`.
3. Write `apply` as an instruction a director can follow on the next job of this kind, in one line, under 30 words.
4. Append the entry, numbered from the last one, with the date in America/Chicago. Never copy the user's sentence verbatim, rewrite it as an instruction.
5. Emit one event: `node "${CLAUDE_PLUGIN_ROOT}/scripts/emit-event.mjs" taste.add id=<job id or none> kind=liked|rejected axes=<comma list>`.
6. Reply in two lines: the entry number and the `apply` line.

For `show`, print the file. For `forget N`, remove that entry, renumber nothing, and emit `taste.forget entry=N`.

The ask: **$ARGUMENTS**
