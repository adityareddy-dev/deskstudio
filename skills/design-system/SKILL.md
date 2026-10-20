---
name: design-system
description: Generate, extract or audit the project's design tokens: writes or lints .desk/DESIGN.md and exports CSS custom properties or a Tailwind theme. Use when a project needs its tokens made, pulled out of existing code, or checked for drift.
argument-hint: "generate <brief> | extract [path] | audit [path] [--export css|tailwind|both]"
---

Make or check a token system as the Design Manager.

**Deliverable and standard.** A token set: colour by job, type scale, spacing, radii, motion. The brand-kit standard's `DESIGN.md` front matter is the shape, and the sheet renders to the dashboard standard's density rules. Three modes:

- `generate`: from a brief or one colour, three directions of palette and type, one picked, written to `.desk/DESIGN.md`.
- `extract`: read the project (CSS custom properties, Tailwind config, tokens files, the live site's header) with the brand-from-project procedure and write `.desk/DESIGN.md` from what is there, naming the sources.
- `audit`: lint the project against `.desk/DESIGN.md`: colours off the palette, sizes off the scale, spacing off the grid, radii not in the set, each with file and line.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Design System Lead | `desk:design-system-lead` | senior | owns the token set, the naming and the audit rules |
| Typographer | `desk:typographer` | senior | the type scale, weights, fallback stack |
| Accessibility Specialist | `desk:accessibility-specialist` | senior | every text pair's contrast, focus and border colours |
| Design Engineer | `desk:design-engineer` | builder | the exports and the sheet, polish rounds |
| Art Director | `desk:art-director` | director | the pick between the three directions (generate only) |
| Creative Director | `desk:creative-director` | director | sign-off on the rendered sheet |

**Inputs.** Text (a brief, one or two hex colours), a path to a project or a tokens file, or a URL to pull a palette from.

**Proof sizes.** `desktop` for the sheet, light and dark.

**Output** under `.desk/out/<id>/`:

- `DESIGN.md` in the exact front matter shape, copied to `.desk/DESIGN.md` on sign-off (generate and extract).
- `tokens.css` with every token as a custom property in `:root` and `[data-theme="dark"]`, and `tailwind.theme.js` exporting `theme.extend`, by `--export` (default both).
- `sheet.html`: the tokens rendered: palette with contrast ratios, the scale as real text, spacing and radii, the four motion moves.
- `audit.md` (audit only): findings as file, line, value, nearest token, grouped by kind.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `design-system`. Changes to the loop for this command:

- `generate` runs the full loop: three rough sheets (Design Engineer at the senior model, each with a palette and type direction from the Typographer), pick, polish, proof, sign-off.
- `extract` skips roughs and the pick: one sheet, polish until proof passes and the Creative Director signs it.
- `audit` skips roughs, pick, polish and sign-off: the Design System Lead's report is the deliverable. Exit with the findings count in the handback.
- Step 0's brand check is skipped: this command writes the brand file.

The ask: **$ARGUMENTS**
