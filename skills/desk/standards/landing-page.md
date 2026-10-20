# Standard: landing page

A page with one job: make a stranger understand what this is and do one thing. One file, phone and desktop from one DOM, read in the first five seconds and scrolled by the few who are convinced.

## What a top studio landing page does

- Passes the five-second test. Cover everything below the fold and a stranger can say what the product is and what to do. Headline 4 to 10 words, a claim. Subline up to 20 words, the how or the proof. One primary CTA.
- Shows the thing. The hero visual is the product, a real output or a clip of it running, never an illustration of a concept. On a phone the headline, subline and CTA fit above the fold and the visual may sit below.
- Has a section order that proves something at each step: hero, what it makes (show it), how it works (three steps with pictures), proof (numbers, names, a real example), who it is for or what each plan gets, objections (a plain FAQ), the CTA again, footer. Any section that proves nothing is cut.
- Changes rhythm. Sections alternate full width, split and grid so the page does not read as a stack of identical blocks. One idea per section, one claim as its heading, two to four lines of body, one visual.
- Uses real copy everywhere. Every number has a source. Every logo is real and allowed. The CTA says what happens next ("Start a free project", "See the demo") and uses the same words every time it appears.
- Repeats the CTA at most once every two sections, and once at the end.
- Loads fast. Hero image under 200KB, a clip as a muted autoplay loop under 1.5MB with a poster, fonts inline or preloaded, no layout shift, no script needed to read the page.
- Works at 390px wide with one column, 48px tall buttons at full width, 16px body, and nothing that needs a hover.

## Type

- One typeface, two weights. A second typeface only when the brand names one for headings.
- Hero headline 56 to 72px on desktop, 36 to 44px on phone, weight 600 or 700, line height 1.0 to 1.1, tracking -0.02em.
- Section headings 32 to 40px desktop, 28 to 32px phone. Body 18px desktop, 16px phone, line height 1.5 to 1.6. Small text 14px, never under 13px.
- Line length 60 to 70 characters. Text blocks have a max-width of 640px.
- A scale with a ratio from the brand file (1.25 default), no size off it.

## Colour

- Background, text, one accent. The accent is the primary CTA and nothing else on the same screen. A second use of the accent on a screen means one of them is wrong.
- Surfaces are one step from the background (a tint or a 1px border), never a drop shadow on a flat section.
- Contrast 4.5:1 for body, 3:1 for large headings and UI boundaries. The CTA label at 4.5:1 against the button.
- Dark and light are designed, not inverted. If the page ships in one mode, it ships in the brand's mode.
- No gradient unless the brand owns one, and then only once, and never as a blob behind the hero.

## Composition patterns that work

Give one of these to each rough so the three differ.

1. **Left copy, right product.** Hero split 5/7 on desktop, copy left on a column, the product shot or clip bleeding off the right edge. Stacks on phone with copy first.
2. **Centred claim, product below.** A single short headline centred (two lines at most), the CTA under it, the product full width under that cutting the fold. The only pattern where centring is allowed, and only in the hero.
3. **Type-led editorial.** A big left-aligned headline across eight columns, subline and CTA in the first four, no visual in the hero, the product arrives in section two at full width.
4. **Output first.** The hero is the real output (a command and its result, a rendered file) in a framed block at 60% width, the headline beside or above it. For developer products.
5. **Narrow column.** The whole page on a 720px column centred in the viewport, like a well-set letter, with the product shots breaking out to 1120px. The column never sits against the left edge with the right half of the screen empty. Slow, confident, for products with a strong story.

## Banned on a landing page

Hero gradient blobs, decorative blur circles, three-column icon features that say nothing, "Trusted by 10,000+" without a source, a testimonial carousel, star ratings from nowhere, a chat widget, a cookie banner where the law does not require one, "Welcome" or "Introducing" in a headline, "Learn more" as a CTA, two primary CTAs in one screen, a hero visual that is an illustration of a concept, lorem ipsum, a hero image over 200KB, layout shift as fonts load, text over an image without a scrim, every section as a card, a pricing table with more than three tiers.

## File contract

One self-contained HTML file. Fonts, images and styles inline or as data URIs, no network except the clip source if one exists. Phone and desktop from one DOM with media queries. One `<main>` with one `<h1>`, sections as `<section>` with a heading each, the CTA as an `<a>` with a visible focus state and `[data-state]` variants for hover and focus written in CSS. A `<meta>` set for the preview image (title, description, `og:image` at `og` size). All text as real DOM text. No script required to render the page. Must render without overflow in headless Chrome at each named size.

Sizes for this deliverable, by name: `phone` 390x844, `desktop` 1440x900, and `tablet` 768x1024 when the ask names it. Proof renders the full page at each.
