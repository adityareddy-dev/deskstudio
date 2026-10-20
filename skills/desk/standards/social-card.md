# Standard: social card

A single still image for a feed: LinkedIn, X, Instagram post or story, an Open Graph image, a YouTube thumbnail. One file, one artboard, built to be read in under two seconds while scrolling, on a phone, often with the brightness low.

## What a top studio card does

- Says one thing. One headline of three to nine words, one supporting line of up to twelve, a brand mark, and at most one more element (a number, a date, a product shot, a single illustration).
- Reads at thumbnail size. Cover the card with a thumb at arm's length and the headline still reads. That means the headline is at least 7% of the short side in height for landscape (about 44px on 1200x627) and 6% for portrait (about 65px on 1080x1350).
- Uses the aspect ratio. Landscape splits left and right or stacks headline over a wide element. Portrait stacks top to bottom with the headline in the top 40%. A story (9:16) keeps everything inside the middle 70% vertically.
- Owns the whole canvas. On portrait and square, an empty band taller than a third of the canvas between the headline and the bottom group is a composition fault (score it 7 at most): either the headline grows until the block carries the canvas, or the one extra element (the figure, a large mark, a product shot) sits in that band, or the bottom group rises to meet the headline. Air is deliberate when it is shaped, not when it is left over.
- Has a shape. The content block is left-aligned on a column, or a full-bleed image carries one side and the text the other. Centred is for a single short line only.
- Keeps the brand small and in a corner, or as the whole background. Never both.
- Has air. Outer margin at least 6% of the short side, 10% at the bottom on portrait (platform UI covers it).
- Contrast is real: text over an image sits on a scrim or a solid block, never on the busy part.

## Type

- One typeface, two weights. Headline 600 or 700, body 400 or 500.
- Headline line height 1.0 to 1.1, tight tracking (-0.02em to -0.01em) above 40px. Body line height 1.3 to 1.4.
- Scale: headline, one supporting size, one small size for the mark or a label. Three sizes, never more.
- Headline never wraps past three lines on landscape, four on portrait.
- Minimum sizes: 24px for anything readable, 20px only for a label that is not needed to understand the card.

## Colour

- Background, text, one accent. The accent appears once, on the one thing to look at.
- Dark background with light text, or light with dark. Mid-tone backgrounds need a block or scrim behind the text.
- Contrast at least 4.5:1 for body, 3:1 for headline weight 700 above 24px. Measured against the pixels behind the text, not the nominal background.
- The brand palette and nothing else. Tints of a brand colour are fine, new hues are not.

## Composition patterns that work

Give one of these to each rough so the three differ:

1. **Editorial split.** Landscape: left 55% headline block on solid colour, right 45% image or big number. Portrait: top 60% headline, bottom 40% element.
2. **Full bleed with scrim.** One image or colour field edge to edge, a solid block or gradient scrim in one corner carrying the text, mark opposite.
3. **Type only.** Headline as the image. Big, left-aligned, two or three lines, accent on one word or the number. Mark bottom left. Nothing else.
4. **Stat card.** One big figure at 25% of the short side, a label under it, the claim as the headline above or beside it.
5. **Frame.** A thin inner border on the brand colour, content inside on a column, the mark breaking the frame at one point.

## Banned on a card

Centred everything, two accents, a gradient background with a gradient scrim, more than three sizes, emoji, a logo over 12% of the width unless the card is the logo, text over the busy part of an image, a stock illustration, a drop shadow on text, a border radius on the artboard, a URL as the headline, "Learn more" as the CTA.

## File contract

One self-contained HTML file. Fonts, images and styles inline or as data URIs, no network. The artboard fills the viewport (`100vw` by `100vh`) and adapts to each named size with media queries on the same DOM. One `<main data-artboard>`. All text as real DOM text, no text in images. No animation. Must render identically in headless Chrome at each named size.

Sizes for this deliverable, by name: `linkedin` 1200x627, `x` 1600x900, `og` 1200x630, `ig-post` 1080x1350, `ig-square` 1080x1080, `ig-story` 1080x1920, `yt-thumb` 1280x720.
