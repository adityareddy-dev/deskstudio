---
name: Desk Studio
colors:
  background: "#15100b"
  foreground: "#fcf3e4"
  accent: "#ffaa1c"
  muted: "#c2b19b"
  surface: "#1f1711"
  line: "#3b2e23"
  danger: "#ff8a4c"
  bot: "#f6e9d6"
  lens: "#2a1f18"
  amber: "#ffaa1c"
  green: "#009e73"
  pink: "#cc79a7"
  blue: "#0072b2"
  sky: "#56b4e9"
  orange: "#d55e00"
  background-light: "#fbf3e6"
  foreground-light: "#2b2017"
  accent-light: "#9a5b00"
  muted-light: "#6f604f"
  surface-light: "#fffaf2"
  line-light: "#eadbc4"
  danger-light: "#b34700"
type:
  family: "Inter"
  headingWeight: 800
  bodyWeight: 400
  base: 16
  ratio: 1.25
spacing:
  unit: 4
  radius: 10
logo:
  path: "brand/mark.svg"
  clearSpace: "0.25x height"
motion:
  entrance: "320ms cubic-bezier(0.16, 1, 0.3, 1)"
  pop: "360ms cubic-bezier(0.34, 1.56, 0.64, 1)"
  move: "700ms cubic-bezier(0.65, 0, 0.35, 1)"
  exit: "200ms cubic-bezier(0.7, 0, 0.84, 0)"
sources:
  - "direction of 2026-10-29: a fun dashboard where the studio is visible, the lamp dropped"
  - "the dashboard redesign in dashboard/public, then this kit to match it"
  - "the six trims shared with the site film (Okabe-Ito, safe for colour vision deficiency)"
---

# Desk Studio

## Position

For developers and founders who ship without a designer. A small studio of 42 desks works inside your coding agent, and you watch it work on the dashboard. Warm, plain, a bit playful.

## Voice

Plain, confident, short. Numbers are figures and stay exact. Fun comes from the bots and the motion, never from the words: no hype, no exclamation marks.

Example: "Your own design studio."

## The bots

Every desk is a small toy bot at its own desk: a cream body, one lens eye, a laptop, and the trim colour of its tier. The bot is the brand. The logo is its head.

| Tier | Trim | Wears | Count |
|---|---|---|---|
| Manager | amber #ffaa1c | a headset | 1 |
| Director | pink #cc79a7 | a bow tie | 3 |
| Senior | sky #56b4e9 | a lanyard and badge | 17 |
| Builder | green #009e73 | a cap | 21 |

- On the dashboard, a bot is awake only while an agent of its desk is really working: lens open, typing, its laptop mark lit in the trim. Otherwise it sleeps, lens shut, breathing slowly. Never wake a bot on the dashboard to fill a frame. Illustrations (the banner, the site's crew) can show the crew at work.
- Blue #0072b2 is for links and information, orange #d55e00 for anything that needs you: under the bar, a failed proof, a job waiting on you.
- Amber is the Manager's trim, the job's place on the track and the pick ring.

## The mark

- The head of a studio bot: a rounded cream head, two ear bolts, one lens with an amber iris, a dark pupil and a white glint. It sits on a dark tile with a little dusk light in the top left corner (`logo/logo.svg`).
- On light pages use the outlined head (`logo/logo-light.svg`, `logo/mark-on-light.svg`). In one colour use `mark-mono.svg`.
- Smallest size: 16px for the tile. Clear space: a quarter of the mark's height on every side.
- Don't add a body, arms or a second eye to the mark, don't recolour the iris, don't put the cream head straight on white without the outline.

## Colour by job

Dark set, the default for the dashboard

| Job | Token | Hex |
|---|---|---|
| Page, dusk | background | #15100b |
| Panels | surface | #1f1711 |
| Raised panels, inputs | surface-2 | #2a2018 |
| Hairlines | line | #3b2e23 |
| Text | foreground | #fcf3e4 |
| Secondary text | muted | #c2b19b |
| Small labels, times | faint | #a08d77 |
| Bot body | bot | #f6e9d6 |
| Lens | lens | #2a1f18 |
| Desk top, desk front | desk | #b07a4c, #8c5c37 |

Light set, the studio by day

| Job | Token | Hex |
|---|---|---|
| Page | background-light | #fbf3e6 |
| Panels | surface-light | #fffaf2 |
| Hairlines | line-light | #eadbc4 |
| Text | foreground-light | #2b2017 |
| Secondary text | muted-light | #6f604f |

The six trims are the same in both sets. As text they get a lighter shade on dark and a darker one on light, listed in the contrast tables.

## Type

Inter, the same face as the site film. 800 for the wordmark and big figures, 700 for headings, 650 for labels and names, 400 for body. Geist Mono for commands, ids and paths only. Figures are tabular. Scale and sizes are in `type.md`.

## Shape and depth

- Radius 10 for controls and cards, 14 for rooms, 18 for panels, 999 for pills and buttons.
- Buttons are pills with a 2px bottom edge, like a plastic key, and press down by 1px.
- Rooms on the floor have a wall band and plank lines. Panels can carry a soft warm glow at the top of the page, nothing else glows.
- Spacing on a 4px grid.

## Motion

Bots wake with a small hop, bob while they work and blink now and then. The job ticket slides along the track. Bubbles pop in. Scorecard bars fill from the left. The pick ring draws once. Confetti falls once, when a job you are watching signs off at the bar. All of it stops under reduced motion. Details in `motion.md`.

## Do

- Show the floor as rooms by tier, every desk a bot, and only the working ones awake.
- Draw the pass line at 8 on every scorecard and the bar at 8.5 on the score chart.
- Write a desk by its job title: Art Director, Typographer.
- Keep figures exact. 0.48 stays 0.48.

## Don't

- Don't fake activity: no bot awake, no score and no cost the record does not have.
- Don't use the old lamp, slab or disc anywhere. They are retired.
- Don't set long text in a trim colour, or small text in amber on light.
- Don't use exclamation marks, "Introducing", or any of the house style's banned words.

## Contrast

WCAG 2.x ratios, measured. Text pairs pass at 4.5:1, large text and non-text at 3:1.

Dark set

| Pair | On background | On surface | On surface-2 |
|---|---|---|---|
| foreground | 17.2 | 16.0 | 14.5 |
| muted | 9.1 | 8.5 | 7.6 |
| faint #a08d77 | 5.9 | 5.5 | 5.0 |
| amber text #ffbf52 | 11.5 | 10.8 | 9.7 |
| green text #3fcf9f | 9.6 | 8.9 | 8.1 |
| pink text #e39cc4 | 8.8 | 8.3 | 7.4 |
| sky text #8ccdf2 | 10.9 | 10.2 | 9.2 |
| orange text #ff8a4c | 8.1 | 7.6 | 6.8 |

Light set

| Pair | On background-light | On surface-light | On surface-2-light #f6ecdc |
|---|---|---|---|
| foreground-light | 14.4 | 15.3 | 13.6 |
| muted-light | 5.5 | 5.8 | 5.2 |
| amber text #9a5b00 | 4.9 | 5.2 | 4.6 |
| green text #007a5a | 4.8 | 5.1 | 4.6 |
| pink text #a5497f | 4.9 | 5.2 | 4.7 |
| sky text #1a6fa3 | 5.0 | 5.3 | 4.7 |
| orange text #b34700 | 5.0 | 5.3 | 4.7 |

Trims as shapes (bars, dots, rings) on the page background

| Trim | Dark | Light |
|---|---|---|
| amber #ffaa1c | 9.9 | 1.7, so the ring on light uses #c27a00 (3.1) |
| green #009e73 | 5.5 | 3.1 |
| pink #cc79a7 | 6.2 | 2.8, decorative only |
| blue #0072b2 | 3.6 | 4.7 |
| sky #56b4e9 | 8.2 | 2.1, the chart line on light uses #1a78b0 (4.4) |
| orange #d55e00 | 4.9 | 3.5 |

Dark ink #1a120b on amber is 9.7, on the bot's cream 15.5. White on the green button #007a5a is 5.3.

## Data palettes

Categorical six, in this order, safe under colour vision deficiency: amber #ffaa1c, sky #56b4e9, green #009e73, pink #cc79a7, blue #0072b2, orange #d55e00. Every series also gets a direct label. Tiers always keep their own trim: director pink, senior sky, builder green.
