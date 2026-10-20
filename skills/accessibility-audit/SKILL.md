---
name: accessibility-audit
description: A WCAG 2.2 AA audit of a file or URL with a code fix for every finding, and --fix to apply them. Use when a page or component needs to be checked for everyone, beyond what the contrast check sees.
argument-hint: "<file.html | URL> [--sizes phone,desktop] [--fix] [--level AA|AAA]"
---

Audit for accessibility as the Design Manager. The Accessibility Specialist leads.

**Deliverable and standard.** An audit report with a fix per finding, to WCAG 2.2 AA (AAA with `--level AAA`), using the Accessibility Specialist's brief as the standard and the deliverable's own standard for anything visual. With `--fix`, the fixes applied to a copy of the file.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Accessibility Specialist | `desk:accessibility-specialist` | senior | leads: structure, names, keyboard, focus, colour, motion, text, media, each finding with a criterion and a fix |
| Content Designer | `desk:content-designer` | builder | alt text, link text, labels, error messages that say what to do |
| Design Engineer | `desk:design-engineer` | builder | with `--fix`: applies every fix in the copy, keeps the design |
| Art Director | `desk:art-director` | director | with `--fix`: confirms the fixed render still matches the original's design intent |

**Inputs.** A path to an HTML file, or a URL saved first to `.desk/jobs/<id>/source.html`. A screenshot is not enough for this command: say so and stop.

**Proof sizes.** `--sizes`, else `phone,desktop`. Proof's contrast, overflow and type checks run first so the Specialist does not repeat them.

**Output** under `.desk/out/<id>/`:

- `audit.md`: result line, then findings as severity, criterion, element, what is wrong, the fix, grouped blocker, major, minor, then what proof already caught, then what needs a manual check (a screen reader pass, a real keyboard).
- with `--fix`: `final.html` (the fixed copy, original untouched), `applied.md` (each fix and where), and `renders/` before and after.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `accessibility-audit`. Changes to the loop for this command:

- Skip roughs and the pick. Phase order: intake, proof (checks and screenshots), audit (Specialist and Content Designer in parallel), report, and with `--fix`: fix rounds.
- The gate is not the rubric. A round passes when the Specialist's return is `pass` with zero blockers and zero majors and proof passes. The Creative Director is not spawned, and `scores` in state holds `{ "by": "accessibility-specialist", "blockers": n, "majors": n, "minors": n, "pass": bool }` per round instead of axes.
- With `--fix`, the Design Engineer applies the fixes, proof reruns, the Specialist re-audits, up to `--rounds` (default 4). The Art Director looks once at the final render against the original and may add design notes for one more round.
- The handback's Scores line reads the findings counts before and after.

The ask: **$ARGUMENTS**
