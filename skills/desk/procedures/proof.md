# Proof

The studio's own mechanical check. It runs on rendered pixels, never on code, and it never calls a model.

```bash
node "${CLAUDE_PLUGIN_ROOT}/proof/cli.mjs" check <file.html|svg> --brand <DESIGN.md> --sizes linkedin,ig-post --out <renders dir> [--scheme light|dark|both] [--must-appear "text one" "text two"]
node "${CLAUDE_PLUGIN_ROOT}/proof/cli.mjs" render <file.html> --sizes linkedin --out <dir>
node "${CLAUDE_PLUGIN_ROOT}/proof/cli.mjs" sizes
```

`check` prints one JSON object:

```json
{
  "pass": false,
  "file": "final.html",
  "renders": [
    { "size": "linkedin", "width": 1200, "height": 627, "png": ".../linkedin.png", "pass": false,
      "failures": [
        { "check": "contrast", "text": "Launching Tuesday", "reason": "2.9:1 against the pixels behind it, needs 3:1 at this size and weight" },
        { "check": "safe-zone", "text": "deskstudio.ai", "reason": "ends 14px from the right edge, the safe zone is 72px" }
      ] }
  ],
  "screenshots": [".../linkedin.png", ".../ig-post.png"]
}
```

Checks, in the order they run:

0. **font**: the brand's first family is loaded in the file (inlined per `fonts.md`), not left to a system fallback.
1. **overflow**: the document is no wider or taller than the canvas, and no text box is clipped by an ancestor.
2. **safe-zone**: every text box is inside the size's safe zone.
3. **contrast**: for every text box, the worst contrast between its colour and the actual pixels behind it, sampled every 2px, against 4.5:1 (or 3:1 for 24px and up, or 18.67px and up at weight 700).
4. **type-scale**: every font size is at or above the minimum and sits on the brand's scale (base and ratio from DESIGN.md, 12% tolerance).
5. **palette**: the share of pixels further than 45 RGB units from every brand colour is under 5%.
6. **copy**: every string passed with `--must-appear` appears in the rendered text.
7. **size** (email sizes only): the HTML is under 102 KB, or Gmail clips it. Email sizes skip the font check, since clients do not load fonts, and render the full height.

A file with more than one `[data-slide]` (a carousel, a deck) renders every slide on its own at the size, as `slide-01.png` onward, each checked like a card. A carousel (`[data-carousel]` present) also gets one `series` entry: every content slide uses the same headline size and the same type steps, and the set has one background family, or two alternating. The cover and the close may differ by one step.

`--scheme both` renders every size in light and dark (`prefers-color-scheme`), named `<size>-light.png` and `<size>-dark.png`. Page sizes (`phone`, `tablet`, `desktop`) render the full page and may scroll; text hidden for screen readers is ignored.

`motion <file> --size slide --seconds 6 [--fps 30] [--no-export]` records the clip for the checks (reading time per text block, flashes, first and last frame), then exports it frame by frame, every animation seeked to each frame time, to `<name>.mp4`, `<name>.webm` and `<name>-frames/` with `f-00000.png` as the poster. The exports are exact to the frame; the recorder's `-recorded.webm` is not.

A failure's `reason` is written for a builder to act on. The Manager sends the failures and the screenshots to the owning desk and never forwards proof failures to the Creative Director.
