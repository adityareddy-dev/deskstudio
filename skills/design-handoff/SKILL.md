---
name: design-handoff
description: Turn a finished job into what an engineer needs: tokens, redline specs, component API docs and the asset list. Use after a job is signed off and someone else will build it in the product.
argument-hint: "<job id or path to a signed-off final.html> [--framework html|react|vue|svelte] [--format md|json]"
---

Write a handoff as the Design Manager.

**Deliverable and standard.** A handoff pack from a signed-off deliverable. Non-visual, so the copy standard applies to the documents, the brand-kit standard's front matter shape to the tokens, and the source deliverable's own standard to the specs. Nothing is redesigned here: the pack describes what was signed off.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Design System Lead | `desk:design-system-lead` | senior | the tokens used by the file, named, diffed against `.desk/DESIGN.md`, new ones flagged |
| Design Engineer | `desk:design-engineer` | builder | the component breakdown, props and states, the specs with measurements, the framework notes |
| Content Designer | `desk:content-designer` | builder | the docs read as a developer would: plain, in order, nothing assumed |
| Copy Editor | `desk:copy-editor` | senior | one pass on every document |
| Creative Director | `desk:creative-director` | director | sign-off on the pack against the source renders: does it describe what was approved |

**Inputs.** A job id under `.desk/jobs/` (the pack reads its `state.json`, brief and `final.html`), or a path to any signed-off `final.html` with its brand file. A job that is under the bar is refused with the reason: hand off finished work only.

**Proof sizes.** None new. The source job's renders are reused, and `specs.html` renders at `desktop` for a visual check.

**Output** under `.desk/out/<id>/`:

- `tokens.json` and `tokens.css`: every token the file uses, by job, with values, and a `new` list for anything not in `.desk/DESIGN.md`.
- `specs.md`: per component or region: size at each breakpoint, spacing, type, colour tokens, states, motion, with the measurements from the file, not estimated from the render.
- `specs.html`: the signed-off render with redlines drawn over it as SVG, toggled with `[data-redlines]`.
- `components.md`: component list, props with types and defaults, states, slots, events, accessibility notes, in the `--framework` idiom (default from `project.json`, else plain HTML and CSS).
- `assets/`: every SVG and image from the file as separate files with their names and sizes in `assets.md`.
- `README.md`: how to use the pack, in ten lines.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `design-handoff`. Changes to the loop for this command:

- Skip roughs and the pick. Phase order: intake (read the source job), extract (Design System Lead and Design Engineer in parallel), write (Content Designer), edit (Copy Editor), sign-off, handback.
- Sign-off is the non-visual kind: the Creative Director checks the pack against the source renders and scores copy, hierarchy and brand fit, with the other axes n/a. Notes go to the desk that owns the file.
- Proof runs only on `specs.html` at `desktop`, screenshots only.

The ask: **$ARGUMENTS**
