# Standard: chart

One chart answering one question: a line on a slide, bars on a card, a number with its change in a report. One file, an inline SVG with real text, built so the reader gets the answer from the title and sees why in the shape.

## What a top studio chart does

- Starts from the question and picks the form from it. Change over time: a line, or bars if there are few periods. Comparison across categories: horizontal bars sorted by value. Part of a whole: a stacked bar, or one number with its share, never a pie over three slices. Distribution: a histogram or a dot strip. Relationship: a scatter. Ranking: sorted bars. One number that matters: just the number, big, with its change.
- Makes the title the takeaway. "Builder desks cost 6% of the job", not "Cost by tier". A subtitle names what is measured, the unit and the period.
- Labels directly. The series name at the end of its line, the value at the end of its bar. A legend only when direct labels cannot fit, and then five entries at most, in the same order as the data.
- Puts the accent on the point. The series or bar the title is about takes the accent, the rest take the muted colour. Never a rainbow.
- Annotates the shape. One or two annotations, each a thin line and a short label, on the event that explains the turn ("pricing change" on the date). Nothing else drawn on the plot.
- Keeps the axes honest. Bars start at zero, always. A line may not, and then the axis says so in the subtitle. Ticks are plain figures, the unit once in the axis title. Gridlines light and horizontal only on a line chart, none on a bar chart with direct labels.
- Knows what not to chart. Two numbers go in a sentence. One number goes big with its label. A table of twelve values stays a table. Nothing is charted to decorate.
- Reads without colour. The accent series is also the thickest line or the labelled one, so the chart works in greyscale and for every kind of colour vision.

## Type

- The brand typeface, two weights. Tabular numerals on every figure.
- Title 20 to 24px weight 600, subtitle 14 to 16px, direct labels 14px, axis labels 12 to 14px, annotation labels 13px. Nothing under 12px. On a slide, every size steps up so nothing is under 24px.
- Numbers formatted for reading: thousands separators, one decimal at most, units once, abbreviated large numbers (1.2M) when the axis title says so.
- Axis labels horizontal. A category label that does not fit horizontally means the chart should be horizontal bars.

## Colour

- From the brand file, and used by job:
  - **Categorical**, up to six. The brand accent first, then hues at matched lightness and distinct in hue, checked for the two red-green deficiencies and for the blue-yellow one. Beyond four categories, grey everything that is not the point.
  - **Sequential**, one hue from a light tint to the full colour, seven steps at most, each step at least 10 in lightness from the next.
  - **Diverging**, two hues through a neutral mid, for data with a meaningful zero or midpoint only.
- Gridlines and axes in the muted colour at 30 to 40% opacity. The plot background is the page background, never a box.
- Contrast 4.5:1 for every label, 3:1 for every mark against the background and against its neighbour where they touch.
- Status colours (good, warning, bad) only when the data is a status, and always with a word or icon beside the colour.

## Composition patterns that work

Give one of these to each rough so the three differ.

1. **Title, plot, source.** Title and subtitle top left, the plot filling the rest, the source line bottom left at 12px. The default.
2. **Big number and sparkline.** The figure at 25% of the short side with its change beside it, a thin sparkline under it, the label and period under that. For one metric.
3. **Small multiples.** The same small chart repeated per category in a grid of two by three or three by three, same axes on all, the one that matters in the accent. For comparing shapes.
4. **Annotated line.** One line, one accent, two annotations with short labels on the two events that explain the shape, direct label at the end.
5. **Ranked bars with the gap.** Horizontal bars sorted, the top one in the accent, the gap to the next labelled, the rest muted.

## Banned on a chart

3D, gradients on bars or areas, dual y-axes, a truncated bar axis, smoothing that invents data, a pie over three slices, a donut for precision, a rainbow palette, a legend when labels fit, gridlines in both directions, a plot inside a bordered box, rotated axis labels, a title that describes instead of claims, chart junk (icons, pictures, textures in the bars), a drop shadow, colour as the only difference between series, a number without its unit, decimals the data does not have.

## File contract

One self-contained HTML file with one inline `<svg>` sized to the artboard with a `viewBox`, real `<text>` for every label, brand fonts inline, no library. The SVG carries a `<title>` with the takeaway and a `<desc>` with what is measured. The data sits under the SVG as a visually hidden `<table>`. Colours as CSS custom properties from the brand file at the top of the file. No animation. When the project uses a chart library, a `spec.json` beside the file describes type, data, encodings and palette for the Framework Specialist. Proof renders at each named size and checks contrast, type scale and palette.

Sizes for this deliverable, by name: `og` 1200x630 and `linkedin` 1200x627 for a chart as a card, `x` 1600x900, `ig-square` 1080x1080, `slide` 1920x1080 for a chart on a slide, where the plot sits at 1400x700 inside the slide grid. On a dashboard the chart renders inside the dashboard file at its sizes.
