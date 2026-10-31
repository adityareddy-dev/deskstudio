# Desk Studio brand

Position: for developers and founders who ship without a designer, a small studio of 42 desks inside your coding agent that you watch work on the dashboard. Warm, plain, a bit playful.

The brand comes from the dashboard: every desk is a toy bot at its own desk, and the logo is that bot's head. It shares the six trim colours and Inter with the site film.

## Files

| File | What it is |
|---|---|
| `DESIGN.md` | Colours by job with measured contrast, type, shape, the bots, do and don't. Its front matter is what the studio's proof reads. |
| `palette.css` | The tokens, dark and light. |
| `type.md`, `motion.md` | The type scale and the moves. |
| `sheet.html` | The kit on one page: mark, wordmark, lockups, the four tiers of bots, colour, type and motion. |
| `mark.svg`, `mark-mono.svg`, `mark-clear.svg` | The bot head in colour, in one colour, and with its clear space. |
| `wordmark.svg`, `lockup-horizontal.svg`, `lockup-stacked.svg` | The words, and the tile with the words, in `currentColor`. |
| `logo/` | The app icon (`logo.svg`, `logo-light.svg`), PNGs from 32 to 1024, `favicon.ico`, the lockups on dark and light, the README banner and the cover images. |
| `brief.md` | The brief and what changed. |

## Making the files

```
python brand/logo/build.py        # every SVG, the words outlined from Inter 800
node brand/logo/render.mjs        # the PNGs and favicon.ico
node brand/logo/banner.mjs        # the README banner, and --og, --devto, --cover variants
```

## The mark

- A studio bot's head: cream, two ear bolts, one lens with an amber iris. On the dark tile with a little dusk light.
- On light pages, the outlined head. In one colour, `mark-mono.svg`.
- Smallest size 16px. Clear space a quarter of the mark's height.

## Colour

Dark is the default: dusk brown #15100b with cream text. Light is the studio by day, #fbf3e6. The trims: amber #ffaa1c (the Manager, the pick, where the job is), pink #cc79a7 (directors), sky #56b4e9 (seniors), green #009e73 (builders and passes), blue #0072b2 (links and information), orange #d55e00 (anything that needs you).

## Type

Inter 800 for the wordmark and big figures, 700 headings, 650 labels, 400 body. Geist Mono for commands and paths.

## Voice

Plain, confident, short. Figures exact. The fun is in the bots and the motion, not in the words.
