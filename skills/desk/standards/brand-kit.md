# Standard: brand kit

The smallest set of decisions that makes every future piece look like the same brand: a mark, a wordmark, a palette with a job per colour, type, spacing, a motion language and the rules for using them. A folder of files, plus the `DESIGN.md` the studio reads on every job after this one.

## What a top studio kit does

- Starts from a position, in one line: who it is for, what it does, how it should feel in three adjectives. Every choice below is checked against that line.
- Has a mark that works at 16px and at 2m. One shape, one or two colours, no gradient, no thin strokes under 1.5px at 24px, recognisable as a silhouette. Drawn on a 24-unit grid, exported as SVG with the clear space baked into the viewBox as an option.
- Has a wordmark in the brand typeface or a custom cut of it, with the letter spacing fixed and the mark lockup set in two arrangements (horizontal, stacked) with the spacing defined in mark heights.
- Gives every colour a job and a name by that job: background, foreground, accent, muted, surface, and up to three supporting colours (success, warning, danger, or a secondary accent). Every pair that will carry text is listed with its contrast ratio.
- Picks one typeface for the brand, two weights, a base size and a ratio, and says what the fallback stack is. A second typeface only with a reason written down.
- Sets spacing on an 8px grid with a radius scale of two or three values, and says which is the default.
- Writes the motion language: entrance, settle, exit, emphasis, each with a duration and an easing, in one short table, used by every clip and every screen.
- Writes the rules for use in plain lines: do, don't, minimum sizes, clear space, what goes on what background, how the accent is used, the one-line voice.
- Renders itself. The kit ships as a sheet the user can look at: mark at four sizes, the lockups, the palette with ratios, the type scale set in real words, the spacing and radii, and three real applications (a social card, a site hero, a 3 second sting) so the kit is judged on work, not swatches.
- Comes in three directions at the rough stage, each with its own position line, so the user picks a brand, not a colour.

## Type

- One typeface, two weights, named in the kit with the weights as numbers. Base 16px, ratio 1.25 for product and 1.333 for display brands.
- The wordmark's tracking fixed in em and written down. Lowercase wordmarks never letterspaced past 0.01em.
- The type page of the sheet shows the scale as real text at every step, headline to small, with the line heights beside them.
- Fallback stack listed, metric-close, and the sheet shows the wordmark in the fallback too.

## Colour

- Five core colours and up to three supporting, each a 6-digit hex, each with a job name. A dark and a light set when the brand will ship both, derived on purpose, not inverted.
- Every text pair listed with its ratio and whether it passes 4.5:1 or 3:1. The accent on the background at 3:1 at least so it can carry a large headline or a button label at 4.5:1 with a chosen text colour.
- The accent has one use written down (the action, the number, the thing to look at). It is never a background for text in the default rules.
- Palettes for data derived here: a categorical set of six from the accent, a sequential ramp of seven, a diverging pair, checked for colour vision deficiency, to the chart standard.
- One gradient at most, owned and written down with its two stops and its angle, or none.

## Composition patterns that work

Give one of these to each rough so the three directions differ. The pattern is the brand's visual idea, carried through mark, type and the three applications.

1. **Geometric mark, grotesque type.** A mark from one or two primitives on a strict grid, a neutral sans with tight headlines, a single strong accent on near-black or near-white. Calm, technical.
2. **Wordmark-led.** No separate mark, or a letter from the wordmark cut out as the mark. The wordmark is the brand, set large, the palette one accent on paper tones.
3. **Monogram and warm palette.** A one or two letter monogram in a rounded or soft form, a warm off-white background, a deep accent, type with some character in the headings.
4. **Mark as a system.** A mark built from repeatable units that also form patterns, dividers and the loading state, so the brand has a texture it owns, with a plain typeface to stay out of its way.
5. **Editorial.** A serif for headings, a sans for the interface, a restrained ink palette with one bright accent, the mark a simple stamp. For brands that publish.

## Banned on a kit

A gradient mark, a mark with thin strokes that vanish at 16px, two accents, three typefaces, a palette without jobs, a palette with no contrast ratios listed, colour names like "ocean" and "sunset" instead of jobs, clear space described in words instead of mark heights, a wordmark that is just the typeface with no tracking decision, a motion language with no durations, a kit sheet made of swatches alone with no application, rules written as adjectives ("bold", "modern") instead of instructions, a `DESIGN.md` with values that do not match the sheet, lorem ipsum anywhere on the sheet, stock imagery as the application.

## File contract

A folder `brand/` under the job's out folder, then copied to the project's `brand/` and `.desk/DESIGN.md` on the user's pick:

- `DESIGN.md` in the exact front matter shape the studio reads, with every value a real one:

```md
---
name: <brand name>
colors:
  background: "#0b0b0c"
  foreground: "#f4f4f5"
  accent: "#0f62fe"
  muted: "#8a8a93"
  surface: "#141416"
type:
  family: "<typeface>"
  headingWeight: 600
  bodyWeight: 400
  base: 16
  ratio: 1.25
spacing:
  unit: 8
  radius: 8
logo:
  path: "brand/mark.svg"
  clearSpace: "0.5x height"
motion:
  entrance: "400ms cubic-bezier(0.16, 1, 0.3, 1)"
  exit: "250ms cubic-bezier(0.7, 0, 0.84, 0)"
  move: "300ms cubic-bezier(0.65, 0, 0.35, 1)"
  emphasis: "500ms cubic-bezier(0.16, 1, 0.3, 1)"
sources:
  - "brand-kit job <id>, direction <n>"
---
```

followed by the position line, the voice (three adjectives and one example line), the Do and Don't lists, and the contrast table.

- `mark.svg`, `wordmark.svg`, `lockup-horizontal.svg`, `lockup-stacked.svg`, each with a `viewBox`, no raster, no text as outlines except the wordmark, colours as `currentColor` or the named hex.
- `palette.css` with every colour as a custom property named by job, in light and dark sets.
- `type.md` with the family, weights, fallback stack, scale table and the wordmark tracking.
- `motion.md` with the four moves, durations and easings, and the reduced-motion rule.
- `README.md` with the rules for use in plain lines.
- `sheet.html`, the self-contained kit sheet, and the three applications `card.html` (social-card standard), `hero.html` (landing-page standard, hero only) and `sting.html` (motion-clip standard, 3 seconds).

Proof renders `sheet.html` at `desktop`, `card.html` at `linkedin` and `ig-post`, `hero.html` at `phone` and `desktop`, and records `sting.html` at `slide`. Proof reads the new `DESIGN.md` for palette and type, so the sheet and the file must agree.

Sizes for this deliverable, by name: `desktop` 1440x900 for the sheet, `linkedin` 1200x627 and `ig-post` 1080x1350 for the card, `phone` 390x844 and `desktop` for the hero, `slide` 1920x1080 for the sting.
