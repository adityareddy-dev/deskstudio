# Changelog

## Unreleased

A new dashboard and a brand to match it.

- The dashboard shows every desk as a small bot at its own desk, in a room for its tier, awake only while an agent of that desk is working. The job moves along a track from the brief to the sign-off, with the round, score, cost and time beside it. The review board has a tab per round, a score chart against the bar, and the scorecard. The studio log says what happened in plain words. All controls and routes are unchanged.
- The logo is the bot's head with its one lens eye. The lamp mark is retired.
- A dashboard guide with screenshots in `docs/dashboard.md`, and a 50-second captioned walkthrough.
- `clips/frames.mjs` records the dashboard at 60 frames a second on a virtual clock, replaying real job records.

## [1.0.2](https://github.com/adityareddy-dev/deskstudio/releases/tag/v1.0.2) - 2026-10-23

Export a job's event log as an OpenTelemetry trace with role timings, token usage and cost.

## [1.0.1](https://github.com/adityareddy-dev/deskstudio/releases/tag/v1.0.1) - 2026-10-20

Adds software citation metadata and a README citation link.

## [1.0.0](https://github.com/adityareddy-dev/deskstudio/releases/tag/v1.0.0) - 2026-10-19

Initial public release.

- 42 design desks, with briefs, a desk registry and generated Claude Code agents.
- The `deskstudio` npm installer for Codex, Cursor, Gemini CLI, Copilot, Windsurf and OpenCode.
- A runner that makes roughs, picks a direction, polishes with proof and scores eight axes before sign-off, with models configurable per role.
- Mechanical proof for rendered contrast, overflow, safe zones, brand fonts, palette, type scale and required copy, plus slide-series and motion checks.
- A local studio dashboard with job progress, scorecards, costs and file-based controls to pause, continue, stop, pick a rough or change a role's model.
- A gallery of 17 signed-off jobs with retained renders and state.

Released under the MIT licence.
