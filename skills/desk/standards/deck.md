# Standard: deck

A set of slides for a room or a screen share: a pitch, a review, a talk, a report read as slides. One file, every slide at 1920x1080, built to be read from the back of a room at a glance while someone talks over it.

## What a top studio deck does

- Says one thing per slide. The headline is the takeaway ("Revenue doubled after the pricing change", not "Revenue"). If a slide has nothing to claim, it is two slides or none. Over 30 words on a content slide means it is two slides.
- Runs on a slide system of six types and nothing else: title, section, content, data, quote, close. Every slide is one of them, and every slide of a type is laid out the same way.
- Puts the headline first, then the one element (a chart, an image, a quote, three fragments at most), then a small footer with the slide number and the mark in the same corner on every slide.
- Treats a data slide as one chart or one number. The number at 160px or larger with its label under it. The chart with a direct label on the thing that matters and no legend if it can be avoided.
- Uses images full bleed on one side or the whole slide with a scrim block for the headline. Never a small image floating in white.
- Gives section slides air: the section name, a number, nothing else.
- Keeps one accent on the one thing per slide, the mark in one corner at one size, the slide number in one place.
- Picks dark or light for the room: dark for a stage, light for a screen share. One or the other for the whole deck.
- Ends on a close slide with the one line to remember and how to reach the speaker, and nothing new.
- A pitch runs problem, who has it, what you do, why now, how it works (one slide, a picture), traction, business model, team, the ask. Ten to twelve slides.

## Type

- One typeface, two weights. A second only when the brand names one for headings.
- Sizes for a room at 1920x1080: title 72 to 96px, slide headline 56 to 64px, body 32 to 36px, labels and footer 24px. Nothing under 24px anywhere, including chart labels.
- Headline line height 1.05 to 1.15, tracking -0.02em. Body 1.3 to 1.4. Headlines wrap to two lines at most.
- Bullets are fragments, three at most, 32px, with an 8px grid between them. Bullets that are sentences become a paragraph on its own slide.
- Four sizes across the deck: title, headline, body, label. The same four on every slide.

## Colour

- Background, text, one accent, one muted for secondary text and gridlines. The accent is the one thing per slide: the figure, the bar the headline is about, the highlighted word.
- Contrast 4.5:1 for body, 3:1 for headlines, measured on the rendered slide. Projectors lose contrast, so aim higher than the minimum: 7:1 for body on a stage deck.
- Images get a scrim block in the brand's background colour at 85% or more under any text.
- Charts use the chart standard's palettes from the brand file. No new hues for data.
- No gradient unless the brand owns one, and then only on the title and close slides.

## Composition patterns that work

Give one of these to each rough so the three differ. The pattern sets the content slide, and the other five types follow it.

1. **Headline left, element right.** Headline on the left five columns, the element on the right seven, footer along the bottom. Section slides put the name at the same left edge, huge.
2. **Headline top, element below.** Headline across the full width at the top, the element in the lower two thirds, mark bottom right. The classic for data-heavy decks.
3. **Full bleed.** Every content slide carries one image or colour field edge to edge, the headline in a solid block in one corner, body kept to one line. For talks with strong photography.
4. **Column of type.** No visuals except on data slides. Headline, then the body set in a 1120px column, lots of air, the accent on one phrase. For a narrative deck read as a document.
5. **Numbered beats.** Every slide has a big number top left (01, 02) at 160px, the headline beside it, the element below. Sections renumber. For a how-it-works or a roadmap.

## Banned on a deck

More than one idea per slide, over 30 words on a content slide, bullets that are full sentences, five bullets, a slide that builds in five clicks, a transition other than none or a 200ms fade, text under 24px, a legend when a direct label would do, a logo on every slide bigger than 40px tall, a decorative stock image, clip art or icons as decoration, a pie chart over three slices, two charts on one slide, a table with more than five rows, a gradient on content slides, a title slide with a paragraph, "Thank you" as the whole close slide, "Agenda" as a slide.

## File contract

One self-contained HTML file. Fonts, images and styles inline or as data URIs, no network. Each slide is a `<section data-slide="n" data-type="title|section|content|data|quote|close">` inside one `<main data-deck>`, each exactly 1920x1080, stacked for authoring and printable one per page with `@page { size: 1920px 1080px; margin: 0 }`. Speaker notes as `<aside data-notes>` inside the slide, hidden on render. Charts as inline SVG with real `<text>`. All text as real DOM text. No script required to render. Proof renders each `[data-slide]` at `slide` size (`slide-01.png` onward), checks each like a card, and checks the deck holds four type sizes plus one figure size across every slide.

Sizes for this deliverable, by name: `slide` 1920x1080. A PDF comes from Chrome print of the same file.
