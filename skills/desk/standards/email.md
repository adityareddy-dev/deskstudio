# Standard: email

One message in an inbox: a welcome, a launch, a digest, a receipt, one step of a sequence. One HTML file and one plain-text file, read on a phone in a client that drops half of CSS, often in dark mode, often with images off.

## What a top studio email does

- Is 600px wide, built on tables, with every style inline. A `<style>` block carries only media queries and dark mode, and the design still reads if the block is dropped.
- Has one job and one CTA. The headline says the news or the benefit in under ten words, the body gets to the CTA inside two short paragraphs, the CTA is a verb that says what happens next. A second link is text in the footer, not a second button.
- Reads with images off. Alt text is written as copy, every image has width and height, and nothing that matters is text inside an image.
- Has a preheader of 40 to 90 characters that continues the subject line, hidden in the body and followed by whitespace characters so the client does not pull body text after it.
- Ships a plain-text part written by hand. The same message, readable, with the link on its own line.
- Survives dark mode. `color-scheme: light dark` is declared, `prefers-color-scheme: dark` overrides exist, logos sit on transparent backgrounds with safe contrast both ways, and there is no pure black text or pure white background that inverts badly.
- Stacks to one column under 480px, and the stacked version reads even in a client that strips the media query.
- Keeps the footer honest and legible: sender address, unsubscribe, the legal line, at 12 to 13px with real contrast.
- Stays under 102KB of HTML.

## Type

- The brand font first with a metric-close system stack after it, and the design checked in the fallback, because web fonts load only in some clients.
- Headline 28 to 32px, weight 600 or 700, line height 1.2. Body 16px, line height 1.5. Small 12 to 13px for the footer only.
- Three sizes across the email. Nothing under 12px.
- Line length 50 to 65 characters at 600px, which means body text in a single column with 24 to 32px side padding.
- No letterspacing on body text, no centred paragraphs longer than two lines.

## Colour

- Background, text, one accent. The accent is the CTA button and at most one more mark (a rule, a label), nothing else.
- Solid colours on table cells, never a background image on the structure.
- Contrast 4.5:1 for body and the CTA label, 3:1 for the headline, measured in light and in dark mode.
- The button is a table cell with padding, a background colour and a border for the clients that drop the background, at least 44px tall and full width on phones.
- The brand palette and nothing else.

## Composition patterns that work

Give one of these to each rough so the three differ.

1. **Letter.** Mark top left at 32px tall, headline, two paragraphs, button, signature, footer. No images. The most reliable pattern and the right one for a welcome or an announcement from a person.
2. **Hero and one card.** A full-width image or solid colour block at the top carrying the headline on a scrim, one text block, one button, footer. One image only.
3. **Numbered steps.** Headline, then three rows each with a number, a bold line and one sentence, then the button. For onboarding and how-it-works.
4. **Digest.** Headline, then two to four items each with a 24px rule above, a bold title, one line and a text link, then one button at the end. Items never become cards with borders.
5. **Receipt.** Headline with the confirmation, a two-column table of the details with labels left and values right, the total bold, one button to the thing bought, footer. Plain, fast, no hero.

## Banned on an email

Two buttons, a background image behind text, text inside an image, a web font with no fallback checked, body under 14px, a hero over 600px wide, a layout that needs the media query to stack, a footer without an unsubscribe, "Click here" as the CTA, a first-name merge tag with no fallback, an animated GIF as the hero, more than one image per 300px of height, an email over 102KB, an all-image email, a centred paragraph longer than two lines, grey body text on a tinted background.

## File contract

Two files: `final.html` and `final.txt`. The HTML is a 600px table layout with `role="presentation"` on every layout table, inline CSS on every element, a `<style>` block only for `@media (max-width: 480px)` and `@media (prefers-color-scheme: dark)`, `color-scheme` and `supported-color-schemes` meta set, the preheader as the first element in the body, all links absolute, images with width, height and alt. No script, no forms, no video. The text file carries the same content with one link per line. Proof renders the HTML at `email-600` as a full page in light and in dark mode and checks contrast, overflow and the copy that must appear.

Sizes for this deliverable, by name: `email-600` 600px wide at full height. Proof renders it twice, light and dark.
