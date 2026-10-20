# Standard: carousel

A set of ten slides swiped one at a time in a feed: Instagram, LinkedIn documents, X. One file, ten artboards at one size, read on a phone with a thumb, one slide at a time, and most readers stop after slide three unless the slides earn the swipe.

## What a top studio carousel does

- Has a cover that is a hook, not a title. Six words or fewer, a claim, a number or a question the reader wants answered. The cover is the only slide most people see, so it is designed as a social card in its own right.
- Says one thing per slide, under 25 words a slide, in one headline and at most one supporting block. If a slide needs a second idea, it is two slides.
- Reads as a series. Same grid, same type steps, same mark position, same background family on every slide. A reader who lands on slide six knows it belongs to the same set.
- Carries the eye across the swipe. A slide number bottom right, small. A line, a shape or the headline's left edge sits at the same x on every slide so the swipe feels like one page turning.
- Builds. Slides two to nine move from the problem or the setup to the point, each one a step, so the order could not be shuffled.
- Closes with the handle and one CTA. The close slide repeats the mark larger, the handle as text, and one line that says what to do next (follow, save, the link in the profile). No new idea on the close.
- Lets the accent move. The accent lands on the one thing that matters on each slide, never the same element every time and never as the background on some slides and not others.
- Keeps every text box inside the safe zone of the size, with the bottom 10% clear on portrait.

## Type

- One typeface, two weights. Headline 600 or 700, body 400 or 500. The same two weights on all ten slides.
- Three sizes across the whole set: headline, body, small (slide number, handle, label). The headline size is the same on every content slide. The cover headline may be one step larger and the close slide one step smaller.
- Headline at least 6% of the short side (about 65px on 1080x1350), body at least 32px, small at least 24px.
- Headline line height 1.0 to 1.1, body 1.3 to 1.4, nothing wider than 18 words a line on body.
- A headline never wraps past four lines. Body never past six.

## Colour

- Background, text, one accent, used the same way on every slide. A dark set or a light set, never a mix, unless slides alternate on purpose in a strict two-step pattern.
- Contrast at least 4.5:1 for body, 3:1 for headline weight 700 above 24px, measured against the pixels behind the text.
- The brand palette and nothing else. Tints of a brand colour are fine, new hues are not.
- One image slide at most in a set of ten, with the text on a scrim or a solid block.

## Composition patterns that work

Give one of these to each rough so the three differ. The pattern holds across all ten slides.

1. **Numbered steps.** A big step number top left on every content slide at 20% of the short side, the headline under it, the body under that. The cover is the claim, the close is the recap list.
2. **Left rail.** A vertical accent rail or line at 8% from the left on every slide, text hanging off it. The cover breaks the rail with the headline across it. The close turns the rail into the mark.
3. **Type only, big.** Headline as the whole slide, two or three lines, accent on one word per slide, body as a single small line at the bottom. No shapes.
4. **Card on field.** A solid field with an inset card holding the text, the card the same size and position on every slide, the field colour shifting one step per slide across the set.
5. **Split halves.** Top half a solid block with the headline, bottom half the body or a single visual. The split line sits at the same height on every slide. The cover inverts the halves.

## Banned on a carousel

A cover that is a title, two slides on one idea, a different grid on any slide, the mark moving, a different headline size per slide, more than one image slide, text under the 10% bottom zone on portrait, a close slide with new content, "Swipe" as the whole cover, arrows as the only cue to swipe, platform chrome drawn in the design, emoji as bullets, a gradient background on some slides and not others, more than ten slides.

## File contract

One self-contained HTML file. Fonts, images and styles inline or as data URIs, no network. Ten `<section data-slide="1">` to `<section data-slide="10">` elements inside one `<main data-carousel>`, each the full artboard size, laid out one under the other for authoring. Proof renders each `[data-slide]` on its own at the named size (`slide-01.png` onward), checks every slide like a card, and checks the series: the same headline size and type steps on every content slide, one background family or two alternating. Every slide adapts to each named size with media queries on the same DOM. All text as real DOM text. No animation. The cover must also pass the social-card standard on its own.

Sizes for this deliverable, by name: `ig-post` 1080x1350 (the default for Instagram and LinkedIn documents), `ig-square` 1080x1080. A set is built for one size and proofed at that size.
