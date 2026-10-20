---
name: motion-design
description: A 6 to 10 second motion clip built in CSS and the Web Animations API and recorded in Chrome: a brand sting, a product beat, a site loop. Use when there is no script to speak, just one idea to move.
argument-hint: "<the one idea and where it plays> [--seconds 6..10] [--loop] [--sizes slide,ig-story,ig-square]"
---

Make a motion clip as the Design Manager.

**Deliverable and standard.** A clip to `${CLAUDE_PLUGIN_ROOT}/skills/desk/standards/motion-clip.md`: three to five beats, one movement each, reading-time holds, the brand's easings, deterministic, recorded to WebM and MP4 with a poster.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Storyboard Artist | `desk:storyboard-artist` | builder | the beats: time, what is on screen, the movement, as a board |
| Copy Editor | `desk:copy-editor` | senior | any words on screen against the copy standard |
| Motion Designer | `desk:motion-designer` | builder | three roughs at the senior model, the timeline, polish rounds |
| Typographer | `desk:typographer` | senior | the type moves: sizes, rise distances, what may animate |
| Video Editor | `desk:video-editor` | builder | pacing on the recording, the exports per size and platform |
| Art Director | `desk:art-director` | director | the pick on the boards and the first frames, the notes |
| Creative Director | `desk:creative-director` | director | sign-off on the recorded frames |

**Inputs.** Text (the idea, the words if any, where it plays), a brand file, an existing HTML (a card, a screen) to animate, a logo SVG for a sting.

**Proof sizes.** `slide` (16:9) by default, `ig-story` (9:16) and `ig-square` when asked. Recorded, not just screenshotted.

**Output** under `.desk/out/<id>/`:

- `final.html`: the timeline per the file contract.
- `board.html`: one `[data-frame]` per beat at the primary size.
- `timeline.md`: beat, start, end, what moves, easing, hold reason.
- `clip-16x9.webm` (and `-9x16`, `-1x1` when asked), `.mp4` beside each when ffmpeg is on PATH, `poster-*.png` from the first frame.
- `renders/` with the held frames proof checked.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `motion-design`. Changes to the loop for this command:

- The board comes first: the Storyboard Artist writes the beats and draws `board.html`, the Copy Editor passes any words. Roughs are three timelines on that board, each in a pattern from the standard.
- The pick is made on the first, middle and last frame of each rough plus its recording. Polish rounds revise `final.html` only.
- Proof is the recorder: `record` at each size, then the reading-time, flash and held-frame contrast checks. A failed hold is a proof failure, back to the Motion Designer.
- `--loop` makes the last 300ms ease into the first frame and the Creative Director checks the seam.

The ask: **$ARGUMENTS**
