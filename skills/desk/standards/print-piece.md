# Standard: print piece

A thing that gets printed: a business card, a poster, a one-pager handed across a table. One HTML file laid out in physical units with bleed, trim and safe area, turned into a PDF by Chrome's print, held in a hand or read from across a room instead of on a screen.

## What a top studio print piece does

- Is built in physical units. Millimetres or inches in the CSS, a `@page` size that matches the trim plus bleed, and pixels nowhere except as a proof proxy.
- Knows the three edges. **Bleed** extends every background and image 3mm (0.125in) past the trim so a cut that drifts leaves no white sliver. **Trim** is the finished size. **Safe** keeps every word and the mark at least 5mm (0.2in) inside the trim on a card and 10mm on a poster or page, because the cut drifts both ways.
- Puts crop marks outside the bleed on the press PDF and leaves them off the screen proof.
- Sets type for paper, which has no backlight. Body on a one-pager 10 to 11pt, never under 9pt. A card's smallest line 7pt at least, and only for the address or URL. A poster's headline reads at the viewing distance: roughly 1cm of cap height per metre of distance, so 60 to 100mm headlines on an A2 poster read across a room.
- Uses colour that will print. The brand's hex values are the design, but the file notes the CMYK conversion and the piece is checked in a CMYK-safe preview: no screen-only neon, no rich black on small text (100% K for text under 12pt), rich black (60/40/40/100) only on large fields.
- Puts images in at 300dpi at their printed size, and never upscales. A 100mm-wide photo is 1181px wide at least.
- Has one idea per side, like a card. A business card is the name and one way to reach the person on the front, the mark on the back, or everything on one side with air. A poster is one headline, one visual, the where and when in a small block. A one-pager is one claim, three to five short sections, one call to action.
- Treats the back as designed, not blank. A card back is the mark, a colour field or a pattern. A one-pager back carries the detail.
- Leaves air. Margins on a page 15 to 20mm, more on the outer edge for a piece that gets stapled or bound. A card has at least 5mm between the text block and the trim.

## Type

- One typeface, two weights, the brand's. A serif is allowed on paper when the brand owns one.
- Sizes in points. Business card: name 9 to 11pt weight 600, role and contact 7 to 8pt. One-pager: headline 24 to 32pt, section heads 12 to 14pt, body 10 to 11pt, captions 8pt. Poster: headline 60 to 100mm cap height on A2, supporting line 18 to 24pt, the details block 12 to 14pt.
- Line length 55 to 70 characters on a one-pager, columns of 60 to 80mm. Two columns on a portrait page at most.
- Line height 1.3 to 1.4 for body on paper, 1.0 to 1.1 for a poster headline. Tracking -0.01em on large headlines, none on body.
- Hairlines at 0.25pt minimum, rules at 0.5pt.

## Colour

- Background, text, one accent, from the brand file. Fewer colours print truer and cheaper.
- Text under 12pt in one solid ink (black, or one brand colour at 100%), never built from four.
- Large colour fields are flat, not gradients, because gradients band on press. A gradient the brand owns is the one exception and gets a note on the proof.
- Contrast on paper reads darker than on screen, so the floor is still 4.5:1 for body and 3:1 for the headline, measured on the screen proof.
- The CMYK note in the file lists every brand colour with its approximate CMYK and a line saying the press profile decides the final values.

## Composition patterns that work

Give one of these to each rough so the three differ.

1. **Edge block.** A solid brand-colour block bleeding off one edge (left on a card, top on a poster) carrying the mark, the rest paper with the type on a column.
2. **Type only.** No image. The headline large and left-aligned, the small block of details bottom left, the mark bottom right. Paper and ink.
3. **Full bleed image.** One photograph or illustration to all four bleeds, a solid block in one corner carrying the words, the mark in the opposite corner.
4. **Centred stamp.** The only centred pattern: the mark or a short wordmark centred on a plain field, the details in a single small centred line under it. For a card back or a minimal poster.
5. **Two-column sheet.** A one-pager with the headline across the top, a narrow left column for the summary and the call to action, a wide right column for the three to five sections.

## Banned on a print piece

Text or the mark inside the bleed, text under 5mm from the trim on a card, type under 7pt, body built from four inks, rich black under small type, a gradient background, an image under 300dpi at print size, an RGB-only neon the press cannot hit, a drop shadow or glow, a border right at the trim (it will look uneven after the cut), crop marks on the screen proof, a QR code without the URL printed beside it, a card with two phone numbers and three logos, lorem ipsum, a poster headline that needs to be closer than two metres to read.

## File contract

One self-contained HTML file per piece with a `@page { size: <trim+bleed> ; margin: 0 }` rule, a `<main data-print data-trim="55mm 85mm" data-bleed="3mm" data-safe="5mm">` sized to the trim plus bleed, backgrounds and images extended to the bleed, every text box inside the safe area, fonts inline, images inline at 300dpi for their printed size, and a `[data-side="front|back"]` section per side as its own page. Crop marks as an SVG layer toggled with `[data-marks]`, off by default. A comment block at the top of the file lists each brand colour with its approximate CMYK. The PDF is made with headless Chrome print to PDF at `preferCSSPageSize`, with `data-marks` on for the press file and off for the screen proof: `press.pdf` and `proof.pdf`. Proof renders each side at the pixel proxy below and checks contrast, safe zone (the safe area, not a platform zone) and type scale in points.

Sizes for this deliverable, given as pixels at 96dpi of the trim plus bleed, until these names are added to the sizes list: `business-card` 91x61mm is `344x231`, `a4` 216x303mm is `816x1145`, `letter` 8.75x11.25in is `840x1080`, `a3` 303x426mm is `1145x1610`, `a2` 426x600mm is `1610x2268`, `poster-18x24` 18.25x24.25in is `1752x2328`. Pass them to proof as `WIDTHxHEIGHT`.
