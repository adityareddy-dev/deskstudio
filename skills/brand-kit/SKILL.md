---
name: brand-kit
description: Build a brand kit from one or two colours, a name or a URL: three directions rendered as real work, one picked, written to brand/ and .desk/DESIGN.md. Use when a project has no brand yet or needs a proper one.
argument-hint: "<name or one-line position> [#hex [#hex]] [--from URL] [--quality studio|best|thrifty]"
---

Make a brand as the Design Manager.

**Deliverable and standard.** A brand kit to `${CLAUDE_PLUGIN_ROOT}/skills/desk/standards/brand-kit.md`: mark, wordmark, lockups, palette by job, type, spacing, motion language, rules, the kit sheet and three applications (a card, a hero, a 3 second sting), plus the `DESIGN.md` the studio reads from now on.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Brand Strategist | `desk:brand-strategist` | director | the position line and the three direction briefs |
| Typographer | `desk:typographer` | senior | typeface, weights, scale, wordmark tracking per direction |
| Design System Lead | `desk:design-system-lead` | senior | the palette by job with contrast ratios, spacing, radii, the `DESIGN.md` front matter and `palette.css` |
| UI Designer | `desk:ui-designer` | builder | the three rough sheets at the senior model, the card and hero applications, polish rounds |
| Icon Designer | `desk:icon-designer` | builder | the mark and lockups as SVG on the grid |
| Motion Designer | `desk:motion-designer` | builder | the motion language and the sting |
| Art Director | `desk:art-director` | director | notes on the three directions, no pick (the user picks) |
| Creative Director | `desk:creative-director` | director | sign-off on the chosen kit |

**Inputs.** Text (a name, a one-line position), one or two hex colours, or `--from URL` to pull the colours and type a site already uses. Nothing at all is fine: the Brand Strategist asks one question.

**Proof sizes.** `desktop` for the sheet, `linkedin` and `ig-post` for the card, `phone` and `desktop` for the hero, `slide` for the sting (recorded).

**Output** under `.desk/out/<id>/`:

- `direction-1/`, `direction-2/`, `direction-3/`: each a full kit folder per the standard's file contract, with `sheet.html`, so the user picks between three real brands.
- `compare.html`: the three sheets side by side at thumbnail size with the position line under each.
- `brand/`: the chosen direction, polished and signed off, copied to the project's `brand/` and its `DESIGN.md` to `.desk/DESIGN.md`.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `brand-kit`. Changes to the loop for this command:

- Step 0's brand check is skipped: this command makes the brand. Use the house style as the brand for the roughs.
- Roughs are the three directions, each a kit folder, each from a Brand Strategist brief naming a pattern from the standard. The Art Director writes notes per direction but does not pick.
- The pick is the user's. Set `waitingOn` to `{ "type": "pick", "text": "Three directions in compare.html. Which one, 1, 2 or 3?" }`, say it in one line, and stop until they answer or `control.json` has `pick`.
- Polish, proof and sign-off run on the chosen direction only. On sign-off, copy the kit to `brand/` in the project and `DESIGN.md` to `.desk/DESIGN.md`, and say so in the handback.

The ask: **$ARGUMENTS**
