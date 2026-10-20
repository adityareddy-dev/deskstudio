---
name: video
description: A short video from script to rendered file: beats, storyboard frames as HTML, a CSS and Web Animations timeline, burned-in captions, recorded in Chrome to WebM and MP4 at 16:9 and 9:16. Use for a launch clip, an explainer or a walk-through with words to say.
argument-hint: "<what it shows and says> [--seconds N] [--sizes slide,ig-story,ig-square] [--quality ...]"
---

Make a video as the Design Manager.

**Deliverable and standard.** A video to `${CLAUDE_PLUGIN_ROOT}/skills/desk/standards/video.md`: script beats, storyboard, timeline to the motion-clip contract, captions burned in and as a VTT file, platform exports. Copy to `standards/copy.md`.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Video/Content Producer | `desk:video-content-producer` | builder | the script as beats: time, on screen, caption, movement |
| Copy Editor | `desk:copy-editor` | senior | every caption under ten words, the banned list, the facts |
| Storyboard Artist | `desk:storyboard-artist` | builder | three storyboard roughs at the senior model, one frame per beat |
| Motion Designer | `desk:motion-designer` | builder | the timeline from the picked board, polish rounds |
| Video Editor | `desk:video-editor` | builder | pacing, caption timing, the platform specs, the exports |
| Art Director | `desk:art-director` | director | the pick on the boards, notes on the frames |
| Creative Director | `desk:creative-director` | director | sign-off on the recorded frames |

**Inputs.** Text (what it shows and says), a file (a README, a plan, a changelog) to script from, screenshots or a screen recording to feature, a brand file.

**Proof sizes.** `slide` (16:9) and `ig-story` (9:16) by default, `ig-square` when asked. Storyboard frames render at the primary size, and the timeline is recorded at each.

**Output** under `.desk/out/<id>/`, per the standard's file contract:

- `script.md`, `storyboard.html`, `final.html`, `captions.vtt`.
- `clip-16x9.webm`, `clip-9x16.webm` (and `-1x1`), `.mp4` beside each when ffmpeg is on PATH, `poster-*.png`.
- `export.md` from the Video Editor: per platform, which file, size, length, what to check on upload.
- `renders/` with the held frames proof checked.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `video`. Changes to the loop for this command:

- Script first: the Producer writes the beats, the Copy Editor passes them, and `--seconds` caps the total (default 10, so three to five beats).
- Roughs are three storyboards of the same script in three patterns from the standard, each a `storyboard.html`. The pick is on boards, frame by frame.
- Build: the Motion Designer turns the picked board into `final.html`. Proof is the recorder at each size with the reading-time, flash and contrast checks. The Video Editor reviews pacing and caption timing on the recording and writes notes that count as proof failures for the next polish round.
- Sign-off is on the recording's held frames plus the first and last frame as stills.
- 9:16 and 1:1 are reframes in the same DOM, checked at their own safe zones, never crops.

The ask: **$ARGUMENTS**
