---
name: chart-design
description: One chart that answers one question, as an HTML file with an inline SVG, colourblind-safe, directly labelled, with the takeaway as the title. Use when you have data and a point to make with it.
argument-hint: "<the question and the data: inline, a CSV or JSON path> [--for card|slide|dashboard] [--sizes ...]"
---

Make a chart as the Design Manager.

**Deliverable and standard.** A chart to `${CLAUDE_PLUGIN_ROOT}/skills/desk/standards/chart.md`: the form picked from the question, the takeaway as the title, direct labels, honest axes, the accent on the point, palettes from the brand file. Title and labels to `standards/copy.md`.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Data Viz Designer | `desk:data-viz-designer` | builder | three roughs at the senior model (form, encoding, annotation), polish rounds |
| Copy Editor | `desk:copy-editor` | senior | the title is a claim, the subtitle names the measure, every label plain |
| Typographer | `desk:typographer` | senior | tabular figures, label sizes, number formatting |
| Art Director | `desk:art-director` | director | the pick and the notes |
| Creative Director | `desk:creative-director` | director | sign-off |

**Inputs.** The question in text, and the data inline (a small table in the ask), as a CSV or JSON path, or as a screenshot of a table to transcribe (the transcription is shown in the brief for the user to check).

**Proof sizes.** By `--for`: card `og,linkedin`, slide `slide`, dashboard `desktop` (as a tile sheet). Default `og`.

**Output** under `.desk/out/<id>/`:

- `final.html`: the chart per the file contract, inline SVG, hidden data table.
- `spec.json`: type, data, encodings, palette, annotations, for a library build when the project uses one.
- `data.csv`: the data as used, cleaned, with the source line.
- `chart.md`: the question, the form and why, the palette by job, the annotations, what was not charted and why.
- `renders/` per size.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `chart-design`. Changes to the loop for this command:

- The brief's Copy block holds the title, subtitle, unit and source as the strings that must appear. The Data Viz Designer may propose a better title, which goes through the Copy Editor before polish.
- Roughs are three forms or encodings of the same data in patterns from the standard, not three colourways. If the question only supports one form, the roughs differ in pattern (title and plot, big number, small multiples).
- Proof runs with `--must-appear` for the title and the unit. The Data Viz Designer's own check (bars start at zero, no dual axis, palette passes the two red-green checks) is reported in its return and counts as a proof failure when it fails.

The ask: **$ARGUMENTS**
