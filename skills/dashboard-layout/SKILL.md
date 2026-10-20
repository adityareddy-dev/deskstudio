---
name: dashboard-layout
description: A dashboard screen laid out from the decisions it serves: KPI row, charts, filter bar, table, sidebar, every state, at phone, tablet and desktop. Use when a product or a team needs a screen of numbers that reads.
argument-hint: "<what decisions it serves and what data exists> [--density monitoring|analysis] [--sizes ...]"
---

Make a dashboard as the Design Manager.

**Deliverable and standard.** A dashboard to `${CLAUDE_PLUGIN_ROOT}/skills/desk/standards/dashboard.md`: decisions first, KPI row, charts to `standards/chart.md`, filter bar, table, sidebar, four states, three breakpoints. Labels and empty states to `standards/copy.md`.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Dashboard Architect | `desk:dashboard-architect` | senior | the decisions, questions and metrics, then three layout roughs, then the layout through polish |
| Data Viz Designer | `desk:data-viz-designer` | builder | every chart tile as inline SVG, sample data marked |
| Interaction Designer | `desk:interaction-designer` | senior | the filter bar, table sorting, the four states, what happens on a phone |
| Content Designer | `desk:content-designer` | builder | tile labels, empty and error state copy, timestamps |
| UI Designer | `desk:ui-designer` | builder | polish rounds on the file |
| Art Director | `desk:art-director` | director | the pick and the notes |
| Creative Director | `desk:creative-director` | director | sign-off |

**Inputs.** Text (the decisions, the audience, the data that exists), a file (a schema, a CSV, a metrics list), a URL or screenshot of the current dashboard to replace.

**Proof sizes.** `phone,tablet,desktop` for the ready state, `desktop` for loading, empty, error and stale. `desktop-wide` when asked.

**Output** under `.desk/out/<id>/`:

- `final.html`: the dashboard per the file contract, states as `[data-state]` variants.
- `decisions.md`: decision, question, metric, where it sits on the screen, three to eight lines.
- `renders/` per size and state.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `dashboard-layout`. Changes to the loop for this command:

- `decisions.md` comes first from the Dashboard Architect and sets the KPI count and the chart list before any layout. The Content Designer writes every label and state line into the brief's copy block.
- Roughs are three layouts by the Dashboard Architect at the senior model in patterns from the standard, with grey chart placeholders of the right shape. The pick is of the layout. The Data Viz Designer then fills the tiles in the picked layout, and polish moves to the UI Designer.
- Proof renders every state. A state that is missing or identical to ready is a proof failure.
- The Creative Director gets the ready renders at every size each round, and the four state renders only in the round they changed. A sign-off that rereads seven unchanged screens is director money spent on nothing.
- `--density` defaults to analysis (light, airy) unless the ask says monitoring or live.

The ask: **$ARGUMENTS**
