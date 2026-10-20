# Standard: icon set

A family of icons that read as one hand: the same grid, the same stroke, the same corners, the same optical weight, so twenty icons in a toolbar look like they were drawn in one sitting. SVG files plus a sheet that shows them together at real sizes.

## What a top studio icon set does

- Draws on one grid. A 24px grid with a 2px padding on every side, so the live area is 20px and the keyline shapes (circle, square, horizontal and vertical rectangles) are sized so they look equal in weight. Every icon fits the keylines.
- Uses one stroke. 1.5px or 2px, chosen once, on every line of every icon, with round or square caps and joins chosen once. Fills only as a solid variant of the same shape, never mixed with strokes inside one icon.
- Rounds one way. Corners at one radius (2px on a 24 grid is common), terminals matching the caps, no mix of sharp and round inside a set.
- Balances optically. A circle is drawn a little larger than a square of the same nominal size, a triangle larger still. Icons are checked side by side at 16px and 24px, not alone at 400px.
- Snaps to the pixel. Horizontal and vertical strokes sit on whole or half pixels so they render crisp at 16, 20 and 24. Diagonals and curves are checked for mush at 16.
- Means one thing each. One metaphor per icon, the common one where a convention exists (a magnifier searches, a gear sets), the simplest shape that still says it. No icon needs a label to be guessed, and every icon still gets a label in the interface.
- Comes in the sizes the interface uses, with a redrawn simplified version for 16px when the 24px version loses detail, not a scaled copy.
- Is named for what it is, not what it does: `arrow-right`, not `next`. Lowercase, hyphenated, with a size suffix only when there are multiple cuts (`search-16`, `search-24`) and a variant suffix for fills (`star-fill`).
- Ships as a sheet. Every icon on the grid at 16 and 24, strokes visible, names under them, on both the light and the dark background from the brand.

## Type

- Icons carry no text. A letter inside an icon (a bold "B") is the brand typeface's letter redrawn as a shape at the set's stroke weight.
- On the sheet, names at 12px in the brand typeface, muted colour, under each icon, and the size labels at 11px.
- Icons sit on the text baseline in use: at 16px body an icon is 16 or 20px, vertically centred on the x-height, with a 4 or 8px gap to the word.

## Colour

- One colour: `currentColor`. An icon takes the text colour around it. No colour baked into the file except for a brand mark that is part of the set.
- Two-tone icons use `currentColor` at full and at a fixed `opacity` (0.4) for the secondary shape, never a second hex.
- Status icons take status colours from the interface, not from the file, and always sit beside a word.
- Contrast is the text contrast: 3:1 against the background at least, since an icon is a UI boundary, 4.5:1 when it stands alone as the only cue.

## Composition patterns that work

Give one of these to each rough so the three differ. The pattern is the drawing style, shown on the same eight icons.

1. **Hairline geometric.** 1.5px stroke, square caps, 2px corners, strict geometry, little detail. For dense tools.
2. **Rounded friendly.** 2px stroke, round caps and joins, 4px corners, slightly larger shapes, open counters. For consumer products.
3. **Solid glyph.** Filled shapes only, one piece each, cut-outs for detail, no strokes. For small sizes and badges.
4. **Duotone.** 2px stroke with a secondary filled shape at 40% opacity behind it, both `currentColor`. For dashboards that need a bit of weight.
5. **Sharp technical.** 2px stroke, square caps, 0px corners, 45 degree diagonals only, grid visible in the shapes. For developer tools.

## Banned on an icon set

Two stroke weights in one set, mixed caps, a stroke and a fill in one icon, a gradient, a drop shadow, a baked-in colour, a scaled 24px icon shipped as the 16px cut, strokes off the pixel at 16, a metaphor that needs the label to guess, a 3D or isometric icon, an icon with a circle or square background in the set file (that is the component's job), text in an icon, more than two tones, decorative detail that vanishes at 16px, names by function (`next`, `delete`) instead of shape (`arrow-right`, `trash`), emoji as an icon.

## File contract

A folder `icons/` under the job's out folder with one SVG per icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` for stroke sets, `fill="currentColor"` for solid sets, a `<title>` with the name, paths only (no `<g>` transforms, no raster, no text), coordinates rounded to one decimal, each file under 2KB. A 16px cut lives in `icons/16/` with the same names. A `sprite.svg` with every icon as a `<symbol id="<name>">`. An `icons.json` manifest listing name, sizes, variant and the one-line meaning. A `sheet.html`, self-contained, that shows the whole set on the grid at 16 and 24 with names, on the brand's light and dark backgrounds, the keylines toggled on with `[data-keylines]`. Proof renders `sheet.html` at `desktop` and checks contrast and type scale on the sheet. A set check compares stroke width, caps and corner radius across every file and fails on a mismatch.

Sizes for this deliverable, by name: `desktop` 1440x900 for the sheet. Icons are drawn at 24 and 16 CSS px and also shown at 20 and 32 on the sheet.
