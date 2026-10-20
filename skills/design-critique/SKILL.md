---
name: design-critique
description: A heuristic critique of a screen or flow against the Nielsen ten usability heuristics plus the studio rubric, from a screenshot, a file or a URL. Use when you want a usability read, not a redesign.
argument-hint: "<screenshot.png | file.html | URL> [--flow <second screenshot> ...] [--sizes a,b]"
---

Critique a design as the Design Manager. No roughs, no pick, no polish: the studio looks, names what works and what fails, and says what to change.

**Deliverable and standard.** A critique report. Scored on two lists: the Nielsen ten (visibility of status, match with the real world, user control, consistency, error prevention, recognition over recall, flexibility, minimal design, error recovery, help) each rated pass, weak or fail with the evidence, and the studio rubric's eight axes. The standard is whichever matches the input, else the house style.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| UX Designer | `desk:ux-designer` | senior | the ten heuristics, with the element and the fix for each weak or fail |
| Content Designer | `desk:content-designer` | builder | labels, errors, empty states and microcopy against the copy standard |
| Creative Director | `desk:creative-director` | director | the rubric scores and the three changes that matter most |

**Inputs.** A screenshot (the default mode), a set of screenshots for a flow with `--flow`, an HTML file, or a URL. Screenshot mode is the common case: nothing is rendered, the desks read the images. A file or URL is rendered by proof at the sizes first so the critique is of the real thing, and the proof failures are listed under the heuristics as evidence.

**Proof sizes.** Screenshot mode: none. File or URL: `--sizes`, else `phone,desktop`.

**Output** under `.desk/out/<id>/`:

- `critique.md`: a one-paragraph read, the heuristics table (heuristic, rating, where, fix), the rubric scores, the copy findings, then "Three things to change first".
- `renders/` when a file or URL was rendered.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `design-critique`. Changes to the loop for this command:

- Skip roughs, pick, polish and sign-off as gates. Phase order: intake, render (file or URL only), critique (UX Designer and Content Designer in parallel), score (Creative Director), report.
- The Creative Director's scores are a reading, not a gate: under-bar does not loop. The report carries them as they are.
- In screenshot mode the brief's Sizes line says "screenshot" and state records `proof: []`.

The ask: **$ARGUMENTS**
