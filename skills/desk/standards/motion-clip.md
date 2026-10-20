# Standard: motion clip

A short animated piece of 6 to 10 seconds: a brand sting, a product beat, a loop for a site background, a social clip without a script. One HTML file with a CSS or Web Animations timeline, recorded frame by frame in headless Chrome, played silent in a feed or on loop on a page.

## What a top studio clip does

- Is one idea in one sentence of motion. Three to five beats, each one movement, each 0.8 to 2.5 seconds. If a beat has two things moving, one of them goes or they stagger.
- Opens on the surprising thing in the first second. The first frame reads as a still with the hook, because a paused clip is a poster.
- Holds every text block long enough to read it twice. Minimum hold is `words * 60 / 200` seconds and never under 1.2 seconds. Nothing readable moves while it is being read.
- Moves things from where they belong. A card rises from 8 to 16px below, a line draws from its start, a number counts up from zero and lands on the real figure. Distances are small on UI, bigger on type.
- Uses one easing language. Entrances `cubic-bezier(0.16, 1, 0.3, 1)`, exits `cubic-bezier(0.7, 0, 0.84, 0)`, moves `cubic-bezier(0.65, 0, 0.35, 1)`. Linear only for opacity under 150ms and for progress. No bounce unless the brand is playful.
- Ends on purpose. A social clip ends on the line to remember (the handle, the install line) and holds it for 1.5 seconds. A loop ends where it began, the last 300ms easing into the first frame, with no visible seam.
- Carries captions when there are words to hear. Burned in, under ten words on screen, in the safe zone, on a scrim if over anything busy, held for their reading time.
- Respects reduced motion. Under `prefers-reduced-motion: reduce` every move becomes a 150ms crossfade and loops stop.
- Never flashes. Luminance across a full frame changes by more than 20% at most three times a second.
- Is deterministic. The same file records the same frames every time.

## Type

- One typeface, two weights, the same scale as the brand's cards. Headline at least 7% of the short side on 16:9, 6% on 9:16, body at least 32px on 1080-wide frames.
- Type animates by opacity and transform only: a rise of 16 to 24px with a fade, a wipe from a mask, a count-up. Never letter by letter past four words, never a typewriter effect on a sentence.
- Line height 1.05 to 1.15 on headlines, 1.3 on captions. Captions 5% of the frame height tall at least, two lines at most.
- Tabular numerals on any figure that counts.

## Colour

- Background, text, one accent. The accent appears when the point arrives and nowhere else. Colour changes are a transition of 300 to 500ms, never a cut.
- Contrast on every frame: 4.5:1 for captions and body, 3:1 for headlines, measured on the frame where the text is fully in.
- Scrims under captions in the brand background colour at 70% or more.
- The brand palette and nothing else. No gradient unless the brand owns one, and then it does not move.

## Composition patterns that work

Give one of these to each rough so the three differ.

1. **Type reveal.** Three lines arrive one at a time with a rise and fade, the accent lands on one word on the last line, hold, the mark fades in bottom left. Nothing else on screen.
2. **Draw the mark.** The brand mark draws itself from a stroke over 1.2 seconds, fills, settles, the wordmark slides in beside it, hold, loop or end on the line.
3. **Count and claim.** A number counts up over 1.5 seconds to the real figure at 25% of the short side, the label fades in under it, the claim arrives above, hold.
4. **Before and after.** The rough state on screen, a wipe from left to right over 600ms reveals the finished state, the scorecard fills axis by axis, hold on the result.
5. **Stack and settle.** Three to five elements enter with a 60ms stagger from 16px below, settle into a layout, the accent highlights one, the rest dim, hold.

## Banned on a clip

Two things moving at once without a stagger, a bounce on a serious brand, a typewriter effect on a sentence, text that moves while it is readable, a hold under 1.2 seconds on any words, a cut between colours, a flash, a loop with a visible seam, `requestAnimationFrame` driven by the wall clock, `Math.random`, a network request, a video or GIF embedded as the content, music or voice assumed, a first frame that is blank, a last frame that is blank, motion blur or filter animation, more than five beats in ten seconds, captions outside the safe zone, over ten words of caption on screen.

## File contract

One self-contained HTML file. Fonts, images and styles inline or as data URIs, no network. One `<main data-clip data-duration="8000" data-loop="false">` filling the viewport, adapting to each named size with media queries on the same DOM. The timeline is CSS `@keyframes` with `animation-delay` offsets from time zero, or the Web Animations API with fixed `delay` and `duration` values started once on load. No wall clock, no random, no `setTimeout` chains. Timings in multiples of 33ms where a frame boundary matters, since the recorder captures at 30fps. The first and last frame hold visible content. A `[data-caption]` element per caption with `data-start` and `data-end` in milliseconds. Reduced motion written into the file. Proof records the clip at each named size for the checks (reading time per text block, flashes, first and last frame), then exports it frame by frame: every animation seeked to each frame time at 30fps and screenshotted, so the MP4 (H.264) and WebM (VP9) are exact to the frame, with `f-00000.png` as the poster. The recorder's own WebM is kept as `-recorded.webm` for reference only, since Chrome starts it late and runs it long.

Sizes for this deliverable, by name: `slide` 1920x1080 for 16:9, `ig-story` 1080x1920 for 9:16, `ig-square` 1080x1080 for 1:1 when the ask names it.
