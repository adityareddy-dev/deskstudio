---
name: Desk Studio
colors:
  background: "#12110f"
  foreground: "#f4f0e8"
  accent: "#ffaa1c"
  muted: "#9a948a"
  surface: "#1c1a17"
  line: "#3b3830"
  danger: "#ff6b5e"
  background-light: "#ffffff"
  foreground-light: "#17140f"
  accent-light: "#c27a00"
  muted-light: "#6b655b"
  surface-light: "#f6f3ec"
  line-light: "#d9d4c8"
  danger-light: "#c4281c"
type:
  family: "Inter"
  headingWeight: 600
  bodyWeight: 400
  base: 16
  ratio: 1.25
spacing:
  unit: 8
  radius: 4
logo:
  path: "brand/mark.svg"
  clearSpace: "0.5x height"
motion:
  entrance: "300ms cubic-bezier(0.16, 1, 0.3, 1)"
  exit: "200ms cubic-bezier(0.7, 0, 0.84, 0)"
  move: "300ms cubic-bezier(0.65, 0, 0.35, 1)"
  emphasis: "400ms cubic-bezier(0.16, 1, 0.3, 1)"
sources:
  - "brand-kit job 20261018-2114-desk-studio-brand-kit, direction 3"
  - "pick ring drawn as direction 2's hand-drawn circle, in direction 3's amber"
---

# Desk Studio

## Position

For developers and founders who ship without a designer, 42 desks working inside your agent while you run the dashboard. Warm, plain, steady.

## Voice

Plain, confident, short. Claims, not descriptions. Numbers are figures and stay exact.

Example: "Your own design studio."

## The accent's two jobs

Amber is a desk at work and the pick: a lit lamp, and the ring drawn round the picked desk or rough. Nothing else is amber. Amber is never a text colour, never a button fill, never a background for text. A lamp at rest is muted, and the slab is always foreground.

## Colour by job

Dark set (default for the dashboard and the sting)

| Job | Token | Hex |
|---|---|---|
| Page | background | #12110f |
| Text | foreground | #f4f0e8 |
| Lit lamp, pick ring | accent | #ffaa1c |
| Secondary text, unlit lamp, empty slab | muted | #9a948a |
| Desk and panel fill | surface | #1c1a17 |
| Hairlines, resting desk border | line | #3b3830 |
| Score under 8 | danger | #ff6b5e |

Light set (hero page, sheet, card on white)

| Job | Token | Hex |
|---|---|---|
| Page | background-light | #ffffff |
| Text | foreground-light | #17140f |
| Lit lamp, pick ring | accent-light | #c27a00 |
| Secondary text, unlit lamp, empty slab | muted-light | #6b655b |
| Panel fill | surface-light | #f6f3ec |
| Hairlines | line-light | #d9d4c8 |
| Score under 8 | danger-light | #c4281c |

Background, foreground and accent keep the strategist's hexes in both sets. Nothing else is changed from the strategy. `line` and `line-light` are decorative separators and carry no content, so they have no ratio to meet.

## Spacing, radius, elevation

- Unit 8px. Scale in units: 0.5, 1, 2, 3, 4, 6, 8, 12, 16 (4, 8, 16, 24, 32, 48, 64, 96, 128px). Nothing off the scale.
- Radius 0 on the mark, slabs, bars and the dashboard's desks. Radius 4 is the default for panels, inputs and buttons. Radius 8 for cards and the hero's rough frames. Nothing round.
- No shadows. Menus and dialogs may take one 1px `line` border instead.
- Breakpoints 390, 768, 1024, 1440.

## Do

- Set every lit lamp in amber and every other element in foreground, muted or surface.
- Keep the mark's disc 8 units across, over the right third of a square-ended slab.
- Put figures in Inter with tabular numerals wherever they sit in a row.
- Use foreground on background for headlines and body, muted for labels and secondary lines.
- Draw the pass line at 8 on every scorecard, even when every axis passes.
- Show the 42-desk grid as 7 columns by 6 rows, and only where it is the dashboard.
- Draw the pick ring as one open amber stroke round the picked desk or rough: a slightly irregular oval 1.5 times the picked box, centred on it, round caps and joins, no fill, drawn clockwise from the top arc a third in from the left, the end running past the start (8px on rings under 120px wide, 12px from 120px), its last quarter drifting outward so it passes the start with one stroke width of clear space between the two strokes. Stroke 3px under 120px wide, 4px from 120px. One ring per screen.
- Write a desk by its job title: Art Director, Typographer.
- Respect reduced motion: show the end state, no fill, draw or stagger.

## Don't

- Don't set text in amber, on light or on dark.
- Don't put text on an amber fill.
- Don't use a second accent, a gradient, a glow, a shadow or a blur.
- Don't move the disc to the centre, enlarge it, curve the slab or give the unit a face.
- Don't tile the 42-desk grid behind text.
- Don't letterspace the wordmark past 0 or set it uppercase.
- Don't round, dress up or compare a figure. 0.48 stays 0.48.
- Don't use exclamation marks, "Introducing", or any of the house style's banned words.
- Don't close, fill, double or straighten the ring, set it in foreground, or draw it round a line of text.

## Contrast

WCAG 2.x ratios. Text pairs pass at 4.5:1. Large text and non-text pairs pass at 3:1.

Dark set

| Pair | Ratio | Bar | Result |
|---|---|---|---|
| foreground on background | 16.6:1 | 4.5 | pass |
| foreground on surface | 15.3:1 | 4.5 | pass |
| muted on background | 6.3:1 | 4.5 | pass |
| muted on surface | 5.8:1 | 4.5 | pass |
| danger on background | 6.7:1 | 4.5 | pass |
| danger on surface | 6.2:1 | 4.5 | pass |
| accent on background (lamp, ring, non-text) | 9.9:1 | 3 | pass |
| accent on surface (lamp, ring, non-text) | 9.1:1 | 3 | pass |

Light set

| Pair | Ratio | Bar | Result |
|---|---|---|---|
| foreground-light on background-light | 18.4:1 | 4.5 | pass |
| foreground-light on surface-light | 16.6:1 | 4.5 | pass |
| muted-light on background-light | 5.8:1 | 4.5 | pass |
| muted-light on surface-light | 5.2:1 | 4.5 | pass |
| danger-light on background-light | 5.7:1 | 4.5 | pass |
| danger-light on surface-light | 5.2:1 | 4.5 | pass |
| accent-light on background-light (lamp, ring, non-text) | 3.5:1 | 3 | pass |
| accent-light on surface-light (lamp, non-text) | 3.1:1 | 3 | pass |

Amber on the light set is for lamps and the ring at 3:1, never text.

## Data palettes

Categorical six, from the accent, built on the Okabe-Ito set that holds under colour vision deficiency. Order is fixed. Every series also gets a direct label, so colour is never the only cue.

| Slot | Dark | Light |
|---|---|---|
| 1 | #ffaa1c | #c27a00 |
| 2 | #56b4e9 | #1a78b0 |
| 3 | #009e73 | #007a5a |
| 4 | #cc79a7 | #a5497f |
| 5 | #0072b2 | #2a3f9e |
| 6 | #d55e00 | #b34700 |

The dark slots all clear 3:1 on background (the lowest is #0072b2 at 3.6:1). The light slots all clear 3:1 on background-light. The light set is adjusted from the dark by hand and has not been run through a CVD simulation.

Sequential seven, one amber hue, light to heavy, low to high value.

| Step | Dark | Light |
|---|---|---|
| 1 | #3b2d12 | #f7ead2 |
| 2 | #5f4511 | #f0d3a0 |
| 3 | #85600f | #e4b668 |
| 4 | #ad7b10 | #d29a35 |
| 5 | #d49416 | #c27a00 |
| 6 | #ffaa1c | #8f5a00 |
| 7 | #ffd27a | #5c3a00 |

Diverging pair, amber to blue through a neutral. The pair is separable for protan and deutan viewers.

| End | Dark | Light |
|---|---|---|
| Low | #56b4e9 | #1a78b0 |
| Mid | #9a948a | #e8e3d8 |
| High | #ffaa1c | #c27a00 |
