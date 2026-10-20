# Standard: video

A short piece with a script: a launch clip, an explainer, a feature walk-through, a making-of. Written as beats, drawn as storyboard frames in HTML, built as a timeline in CSS and the Web Animations API, recorded in headless Chrome to WebM and MP4, and played silent in a feed, so the captions are the soundtrack.

## What a top studio video does

- Is one idea, said in the first second. The opening frame carries the hook line as a still, because a paused or autoplaying video is a poster first.
- Runs on a script of beats, not a paragraph. Each beat has a time, what is on screen, the caption (ten words or fewer), and the one movement. A 10 second clip has three to five beats, a 30 second explainer eight to twelve, a 60 second walk-through fifteen at most.
- Has a storyboard before it has motion. One frame per beat, drawn at the real size with real copy and the real brand, so the pick happens on frames and the motion is built onto an approved board.
- Keeps shots at a reading pace. A shot with a caption holds for the caption's reading time (`words * 60 / 200` seconds, 1.2 seconds at least) plus the movement. A shot without words holds 1 to 2 seconds. Nothing under 0.8 seconds except a cut.
- Burns captions in. Every spoken or implied line is on screen as text, in the safe zone, two lines at most, on a scrim when over anything busy, in the brand typeface, the same position in every shot.
- Shows the real thing. Real output, the real interface, real numbers from the recorded run. No mockups, no numbers invented for the frame.
- Cuts clean. A cut or a 200 to 300ms crossfade between shots, one wipe at most in a clip when it is the idea (before and after). Transitions never carry meaning the content does not.
- Ends on the line to remember and holds it 1.5 to 2 seconds: the install line, the handle, the URL. Nothing new in the last two seconds.
- Ships for the platform. 16:9 for a site and X and LinkedIn, 9:16 for vertical on X, LinkedIn, Shorts and Reels, 1:1 for a feed. Each with its own safe zone, each a reframe of the same board, not a crop.
- Respects reduced motion and never flashes. Luminance across a full frame changes by more than 20% at most three times a second, a reduced-motion viewer gets crossfades.

## Type

- One typeface, two weights, the brand's scale. The caption is the type system's one job here.
- Captions 5% of the frame height tall at least (54px on 1080 tall, 96px on 1920 tall), weight 500 or 600, line height 1.3, two lines at most, ten words at most, left-aligned on a column or centred when the shot is centred, the same every shot.
- Title cards (the hook, the close) at 7% of the short side at least on 16:9 and 6% on 9:16, two or three lines, tight.
- Type moves by rise and fade or wipe. Never letter by letter past four words, never a typewriter effect on a sentence.
- Tabular numerals on anything that counts.

## Colour

- Background, text, one accent, the brand's. The accent arrives with the point and sits on one element per shot.
- Caption scrims in the brand background at 70% or more, or a solid caption bar, one or the other for the whole piece.
- Contrast on every held frame: 4.5:1 for captions, 3:1 for title cards, checked on the frame where the text is fully in.
- Screen recordings are shown in the interface's own colours inside a frame on the brand background, never recoloured. The frame has no drop shadow, a 1px border or none.
- Colour changes between shots are a 300 to 500ms transition, not a cut, unless the cut is the point.

## Composition patterns that work

Give one of these to each rough so the three differ. The pattern is the board's visual idea, carried through every shot.

1. **Screen and caption.** The real interface recorded or rebuilt at 80% of the frame on the brand background, the caption in a fixed bar below it. For walk-throughs.
2. **Type-led.** Title cards and captions only, large type on colour fields, the product appears in one shot in the middle. For a claim-first launch clip.
3. **Split screen.** Left half the interface, right half the caption and a single figure or mark, the split constant across shots. For before-and-after and cost stories.
4. **Zoom and hold.** Each shot is a crop of the interface pushed in on one detail (a desk card, a score filling), the caption names what to see, the next shot pushes to the next detail.
5. **Frames and reveal.** Three to five storyboard-style frames fan out across the shot one by one, then one fills the screen. For making-of and process pieces.

## Banned on a video

Voiceover assumed (there is none by default), music assumed, a shot under 0.8 seconds, a caption over ten words, a caption that moves while readable, a typewriter effect, a mockup or an invented number, a comparison with anyone else, a transition that carries meaning, a flash, a blank first or last frame, a logo sting over 1.5 seconds, a cropped 9:16 made from the 16:9 instead of a reframe, captions outside the platform safe zone, text in the bottom 15% on 9:16, a frame rate other than 30fps, a file over 1.5MB for a site loop, an AI attribution or disclosure on screen.

## File contract

A folder under the job's out folder:

- `script.md`: the beats as a table with columns time, on screen, caption, movement, and a last line with the total length and the platforms.
- `storyboard.html`: one self-contained HTML file with one `<section data-frame="n" data-beat="n">` per beat at the primary size, laid out one under the other, real copy, the caption in place, the brand's type and colour. Proof renders each `[data-frame]` at the primary size.
- `final.html`: the timeline, to the motion-clip standard's file contract, with `<main data-clip data-duration="<ms>">`, CSS keyframes or Web Animations with fixed delays, `[data-caption]` elements with `data-start` and `data-end`, 30fps-aligned timings, reduced motion written in, no wall clock, no random, no network. One DOM reframing to each named size with media queries.
- `captions.vtt`: the captions with their times, for platforms that take a caption file.
- Rendered by proof's recorder from `final.html` at each named size: `clip-16x9.webm`, `clip-9x16.webm`, `clip-1x1.webm` when asked, with `.mp4` (H.264, yuv420p) beside each when ffmpeg is on PATH, and `poster-16x9.png` and friends from the first frame. The recorder checks reading time per caption, flashes and contrast on the held frames.

Sizes for this deliverable, by name: `slide` 1920x1080 for 16:9, `ig-story` 1080x1920 for 9:16, `ig-square` 1080x1080 for 1:1. Platform export: X and LinkedIn take 16:9, 9:16 and 1:1 as MP4 H.264 under 100MB, Shorts and Reels take 9:16, and a site loop is WebM under 1.5MB with its poster and muted autoplay.
