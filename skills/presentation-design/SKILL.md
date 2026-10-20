---
name: presentation-design
description: A slide deck on one slide system, one idea per slide, typed for a room, from an outline, a document or a one-line brief. Use for a pitch, a review, a talk or a report that will be presented.
argument-hint: "<topic, outline or a file to build from> [--slides N] [--mode stage|screen] [--quality ...]"
---

Make a deck as the Design Manager.

**Deliverable and standard.** A deck to `${CLAUDE_PLUGIN_ROOT}/skills/desk/standards/deck.md`: six slide types, 1920x1080, takeaway headlines, data slides to `standards/chart.md`, copy to `standards/copy.md`.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Content Designer | `desk:content-designer` | builder | the outline: one takeaway per slide, the slide type for each, speaker notes |
| Copy Editor | `desk:copy-editor` | senior | every headline is a claim under twelve words, the banned list |
| Presentation Designer | `desk:presentation-designer` | senior | three slide-system roughs, then the full deck, polish rounds at the builder model |
| Data Viz Designer | `desk:data-viz-designer` | builder | every data slide's chart as inline SVG |
| Image Editor | `desk:image-editor` | builder | crops, scrims and treatment on any supplied images |
| Art Director | `desk:art-director` | director | the pick of the system and the notes |
| Creative Director | `desk:creative-director` | director | sign-off |

**Inputs.** Text (a topic or a pasted outline), a file (a Markdown doc, a plan, a report, a CSV for the data slides), a URL, a folder of images or screenshots.

**Proof sizes.** `slide`, per `[data-slide]`.

**Output** under `.desk/out/<id>/`:

- `deck.html`: every slide as `<section data-slide data-type>` with notes inside, per the file contract.
- `outline.md`: slide number, type, headline, the one element, the note.
- `deck.pdf`: Chrome print of the same file, one slide per page.
- `renders/` with one PNG per slide.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `presentation-design`. Changes to the loop for this command:

- The outline comes first and is approved by the Copy Editor before any slide exists. `--slides` caps it (default 12 for a pitch, 20 otherwise).
- Roughs are three slide systems, each shown on the title, one content and one data slide (three slides each) in a pattern from the standard. The pick is of the system. The full deck is then built in it.
- Data slides' charts come from the Data Viz Designer as SVG fragments the Presentation Designer places. Proof renders every slide, and a failure names the slide number.
- Sign-off is on the full set of renders, read as a contact sheet first, then the five slides the Art Director flags.

The ask: **$ARGUMENTS**
