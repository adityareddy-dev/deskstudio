# Standard: dashboard

A screen that answers the questions behind a few decisions: a KPI row, the charts that explain it, a filter bar, a table for the detail, a sidebar to get elsewhere. One file, phone, tablet and desktop from one DOM, with every state designed.

## What a top studio dashboard does

- Starts from decisions, not data. The decisions are listed, one question per decision, one metric per question. Those metrics are the first screen. Everything else is a drill-down.
- Puts the most important number top left. A KPI row of three to five tiles, each the same shape: a 13px label, a 32 to 40px tabular value, a 13px change with its sign and period, a sparkline if there is history.
- Reads left to right, top to bottom, from summary to detail. A chart that explains a KPI sits under it. No more than six charts on a screen, more becomes a second screen or a tab.
- Has one filter bar under the title with global filters only, the time range first, always. Chart-level controls sit on the chart.
- Gives every chart a takeaway title and direct labels, to the chart standard.
- Puts the table under the charts: sortable, first column sticky, numbers right-aligned and tabular at 14px, no zebra rows, a hover row, 10 to 25 rows with a paginator.
- Designs the states, not just the happy path. Loading as skeletons the size of the content. Empty says what will be here and how to get data in. Error says what failed and offers a retry. Stale shows a timestamp and a warning line.
- Chooses a density for the job. Monitoring screens are denser and dark. Analysis screens are airier and light. One or the other.
- Works on a phone: KPIs two across, charts one per row, the table as cards or a horizontal scroll with the first column sticky, filters in one sheet, the sidebar as a drawer.

## Type

- The brand typeface, two weights, tabular numerals on every figure.
- Page title 24px. Tile label 13px uppercase is allowed at +0.04em tracking, or 13px sentence case. Tile value 32 to 40px weight 600. Chart titles 16px weight 600. Table 14px. Small 12px for timestamps and footnotes, nothing under 12px.
- Line height 1.4 on labels, 1.1 on values.
- The same sizes on every tile. A tile that needs a different size is a different component.

## Colour

- Neutral by default: background, surface one step away, text, muted text, a 1px border colour. The accent on one number or the selected state, nothing else.
- Status colours for success, warning and danger, used only on status and never alone: a word or an icon sits beside the colour.
- Charts use the chart standard's palettes. The series that matters takes the accent, the rest take muted.
- Tiles separated by a 1px border or a surface tint, never a drop shadow.
- Contrast 4.5:1 for all text including the 12px timestamps, 3:1 for borders and chart marks.
- Dark and light designed as two palettes from the brand file, not inverted.

## Composition patterns that work

Give one of these to each rough so the three differ.

1. **Sidebar and grid.** A 240px sidebar left with the navigation and the mark, a title and filter bar top, a 12-column grid with 24px gutters: KPI row spanning 12 as four tiles of 3, two charts of 6, a table of 12.
2. **Top nav, wide tiles.** No sidebar. A slim top bar with navigation, a KPI row of five tiles, one hero chart spanning 8 beside a list spanning 4, the table below. For a single-page product dashboard.
3. **Monitoring wall.** Dark, dense, 16px padding, a KPI row of five, six small charts in a 3 by 2 grid, a live table under them with the newest row on top, no sidebar, a status strip along the top.
4. **Report page.** Light, airy, a 960px column: a title and date, a KPI row of three, one chart per row each with a two-line reading under it, the table last. For a weekly review that is read, not watched.
5. **Split focus.** The left 60% is one big chart with its controls, the right 40% stacks the KPIs and a short table. For a dashboard about one metric and its breakdown.

## Banned on a dashboard

Gauges, speedometers, pie charts as KPIs, decorative icons on tiles, gradients, drop shadows on tiles, tiles spanning 5 or 7 columns, a chart without a takeaway title, more than six charts on a screen, a filter per chart for a global dimension, zebra rows, centred numbers in a table, red and green as the only difference between good and bad, a loading spinner where a skeleton fits, an empty state that says "No data", a dashboard that needs a hover to read a value, a KPI tile with two values, a rounded corner radius that differs between tiles.

## File contract

One self-contained HTML file. Fonts and styles inline, no network. Phone, tablet and desktop from one DOM on an 8px grid with media queries. Charts as inline SVG from the chart standard, each inside a tile with 16 to 20px padding. The four states as `[data-state="loading|empty|error|stale"]` variants on the root, each rendering the whole screen in that state from CSS alone, the default being `ready`. Real text for every label and value, sample data where the real data is not known, marked `data-sample`. Sidebar as `<nav>`, the filter bar as a `<form>`, the table as a `<table>` with `<th scope>`. No script required to render any state. Proof renders the ready state at each named size and the three other states at `desktop`.

Sizes for this deliverable, by name: `phone` 390x844, `tablet` 768x1024, `desktop` 1440x900, `desktop-wide` 1920x1080 when the ask names a large screen.
