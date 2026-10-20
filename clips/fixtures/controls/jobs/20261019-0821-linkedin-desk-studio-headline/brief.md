<!-- ask: a LinkedIn card for Desk -->
## Deliverable
Social card: one still image for a LinkedIn feed, readable in under two seconds on a phone. One `<main data-artboard>`, self-contained HTML, adapting to both sizes with media queries on the same DOM.

## Sizes
`linkedin` 1200x627 (6% safe zone all sides) and `ig-post` 1080x1350 (6% sides and top, 10% bottom).

## Copy
```
You run the floor.
deskstudio.ai
```
Both lines are verbatim from the user and must appear exactly as written, including the full stop. "You run the floor." is the headline. "deskstudio.ai" is the small label beside the mark, never the headline. No supporting line was given. Add one only if the composition needs it, and mark it as draft copy that a copy desk may improve.

## Brand
`.desk/DESIGN.md`. The three things that matter most here:
1. Dark set: foreground #f4f0e8 on background #12110f, muted #9a948a for the URL label, surface #1c1a17 for any panel.
2. Amber #ffaa1c is only a lit lamp or the pick ring. It is never text, never a fill behind text, and the ring never goes round a line of text. The card's one accent must be a lamp, the mark's disc, or a ring round a desk.
3. Voice is plain, confident and short. The mark is `brand/mark.svg`: an 8-unit disc over the right third of a square-ended slab, 0.5x height clear space, radius 0. Spacing is on the 8px scale only.

## Fonts
Inter, headline 600 and body 400, tabular numerals on any figure. Confirm it is bundled with `node scripts/font.mjs list` and inline it per `procedures/fonts.md`. If Inter is not bundled, the runner names the closest bundled sans here before roughs start, and every desk uses that one family.

## Must be true
- Headline at least 44px on `linkedin` and at least 65px on `ig-post`, line height 1.0 to 1.1, tracking -0.02em to -0.01em.
- Three type sizes at most. The URL is at least 20px.
- Mark small and in a corner, under 12% of the width.
- No empty band taller than a third of the canvas on `ig-post`.
- One accent use only.
- No gradient, glow, shadow, blur, emoji, exclamation mark or artboard radius.
- The 42-desk grid is not tiled behind text.
- Brand palette only.
- No other constraints in `project.json`, and `taste.md` is empty.
- Out of scope: other sizes, animation, extra copy.

## Scope
Quick. One asset, the brand exists and the copy is given. The desks are roughs, then the Art Director, then the Creative Director, at studio quality with a cap of 4 rounds.
