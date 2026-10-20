---
name: design-review
description: Audit an existing design (an HTML file, a URL or a screenshot) against the rubric and report exact fixes, with --fix to run polish rounds on the file. Use when something already exists and the question is how good it is and what to change.
argument-hint: "<file.html | URL | screenshot.png> [--sizes a,b] [--fix] [--rounds N]"
---

Review an existing design as the Design Manager. No roughs, no pick: the work exists, the studio renders it, scores it and writes the fixes.

**Deliverable and standard.** A review report, and with `--fix` a revised copy of the file. The standard is the one that matches what the input is (social card, landing page, email, deck, chart, dashboard, carousel, motion clip). Say which in the brief. If none fits, score against the rubric and the house style alone.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Art Director | `desk:art-director` | director | reads the render, writes numbered notes with exact fixes |
| Creative Director | `desk:creative-director` | director | scores the eight axes on the render |
| Accessibility Specialist | `desk:accessibility-specialist` | senior | the findings proof cannot make: structure, names, keyboard, motion |
| Copy Editor | `desk:copy-editor` | senior | every string against the copy standard |
| UI Designer | `desk:ui-designer` | builder | with `--fix` only: polish rounds on the copy of the file |

**Inputs.** A path to an HTML or SVG file, a URL, or a screenshot (PNG or JPG). A URL is saved to `.desk/jobs/<id>/source.html` first (fetch it, or save it from the browser) and reviewed from that copy. A screenshot skips proof and rendering: the directors score the image as given and the report says "scored from a screenshot, no proof".

**Proof sizes.** From `--sizes`, else from the standard: `linkedin,ig-post` for a card, `phone,desktop` for a page, `email-600` for an email, `slide` for a deck, `desktop` otherwise.

**Output** under `.desk/out/<id>/`:

- `review.md`: the scores table, then the notes numbered, each with the axis, the exact change and where in the file, then the accessibility findings with criteria, then the copy changes, then the proof result. One screen if it can be.
- `renders/` from proof at each size.
- with `--fix`: `final.html` (the revised copy, the original is never edited) and the scores before and after.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `design-review`. Changes to the loop for this command:

- Skip roughs and the pick. Phase order: intake, render (proof with screenshots only), notes (Art Director), findings (Accessibility Specialist and Copy Editor in parallel), score (Creative Director), report.
- Without `--fix`, stop after the report. The handback says the scores and points at `review.md`. `phase` ends at `done` with no polish rounds.
- With `--fix`, copy the source to `final.html` and run polish, proof and sign-off as written, at most `--rounds` (default 4), with the Art Director's notes as round one's notes. Hand back both score lines.

The ask: **$ARGUMENTS**
