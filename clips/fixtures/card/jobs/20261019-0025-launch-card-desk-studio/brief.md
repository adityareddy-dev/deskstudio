# Brief: 20261019-0025-launch-card-desk-studio

**Deliverable.** Social card, a LinkedIn launch card for Desk Studio, one self-contained HTML file per the social-card standard.

**Sizes.** `linkedin` 1200x627 and `ig-post` 1080x1350, same DOM, media queries.

**Copy.** Verbatim, every line, in this order. No other words anywhere on the card (no labels, no CTA, no date, no wordmark text beyond these lines).

```
Your own design studio.
A full design studio inside the coding agent you already use.
deskstudio.ai
```

Line 1 is the headline, line 2 the supporting line, line 3 the URL (small, never the headline). Punctuation and case exactly as written.

**Brand.** `.desk/DESIGN.md` (absolute path below). Three things that matter here:
1. Dark set by default: background #12110f, foreground #f4f0e8, muted #9a948a, surface #1c1a17, line #3b3830. Amber #ffaa1c is only a lit lamp or the pick ring, never text, never a fill behind text, used once.
2. Inter, heading 600, body 400, base 16, ratio 1.25, 8px unit with the scale 4/8/16/24/32/48/64/96/128, radius 0 on the mark and slabs, no shadows, no gradients, no glow, no blur.
3. The mark `brand/mark.svg`: a square-ended slab with the amber disc over its right third (disc stays amber, slab in foreground). Small and in a corner. Optional pick ring: one open amber stroke, per the DESIGN.md spec, never round a line of text, one per screen.

**Fonts.** Inter, bundled. Inline with `font.mjs css "Inter"` per procedures/fonts.md.

**Must be true.** Only the three lines of copy appear as text. Amber appears once and never as text. Headline at least 7% of the short side on linkedin (about 44px) and 6% on ig-post (about 65px), three sizes max, safe zones 6% (ig-post 10% bottom). On ig-post no empty band taller than a third of the canvas. No exclamation marks, no "Introducing". No taste.md on this project. project.json is defaults (studio preset).

**Scope.** quick: one asset, brand exists, copy given. Three roughs, Art Director pick, builder polish, proof, Creative Director sign-off. Max 8 rounds.
