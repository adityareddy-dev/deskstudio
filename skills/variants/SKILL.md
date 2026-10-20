---
name: variants
description: Three directions side by side for any design ask, with the Art Director's notes on each and no polish. Use when you want to see the options before committing, or to pick a direction yourself.
argument-hint: "<what you need designed> [--count 3..5] [--quality ...]"
---

Run the roughs step on its own as the Design Manager.

**Deliverable and standard.** Three roughs of whatever the ask is, each in a different composition pattern from the deliverable's standard, laid out side by side with notes. The standard is the one that matches the ask (card, carousel, landing page, email, deck, chart, dashboard, clip, icon set, print piece). No polish, no proof gate, no sign-off: these are directions, not finished files.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| the deliverable's builder desk | per the standard: `desk:ui-designer`, `desk:social-media-designer`, `desk:email-designer`, `desk:data-viz-designer`, `desk:motion-designer`, `desk:presentation-designer`, `desk:landing-page-designer`, `desk:dashboard-architect`, `desk:icon-designer`, `desk:print-designer` | senior (roughs run at the senior model) | one rough each, in parallel |
| Art Director | `desk:art-director` | director | notes per rough: what works, what fails, what it would take, and a recommendation without applying it |

**Inputs.** Text, a file to draw from, a URL, a screenshot, the same as `design`.

**Proof sizes.** The standard's default sizes. Proof renders screenshots only, no checks.

**Output** under `.desk/out/<id>/`:

- `rough-1.html`, `rough-2.html`, `rough-3.html` (up to `--count`), each named for its pattern in a comment on line one.
- `compare.html`: the roughs side by side at each size with the pattern name and the Art Director's notes under each.
- `compare.md`: the notes and the recommendation in text.
- `renders/` per rough.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `variants`. Changes to the loop for this command:

- Run steps 0 to 3 as written, then only the Roughs part of step 4, rendered with screenshots. The Art Director writes notes and a recommendation but no `final.html` is made and `pick` in state records `{ "by": "none" }`.
- Skip polish, proof checks and sign-off. `scores` stays empty. The handback's Scores line reads `not scored, variants only` and the Open line says how to continue: `/desk:design` with the chosen rough's path as the input.
- `--count` above 3 spawns more roughs, each in a further pattern, and the standard has five.

The ask: **$ARGUMENTS**
