# Changelog

## [1.1.1](https://github.com/adityareddy-dev/deskstudio/releases/tag/v1.1.1) - 2026-11-18

Easier to start, and no more stuck jobs on a real project's font or logo.

- A brand font the studio does not ship no longer fails proof every round. The closest bundled family stands in for it, as the fonts procedure always said: proof accepts it, the runner inlines it, and the handback names it. Before, a project on any font other than Geist, Inter or Source Serif 4 used up every round and never reached the sign-off.
- The brand logo reaches the file in runner mode. Builders write `src="desk:logo"` and the runner puts the logo the brand names in as a data URI after they return, the same way it handles the font. Before, the builders had no way to read the file, the mark rendered as a broken image, and the Creative Director marked brand down every round. A logo the runner cannot use is named to every desk once, and the files use the wordmark.
- `desk-proof setup` downloads the browser proof uses, for a machine with no Chrome or Edge. `--with-deps` also installs its Linux system libraries.
- `desk-run` checks for a working browser before it calls any model, so a missing browser costs nothing.
- `deskstudio add` names the API keys it accepts when no CLI is signed in, and prints the next two commands.
- The README starts with a short Get started section, and the dashboard guide shows the whole page.
- `site/readme.mjs` writes the README in the repo again, and CI fails when the two differ.

## [1.1.0](https://github.com/adityareddy-dev/deskstudio/releases/tag/v1.1.0) - 2026-10-31

A new dashboard, a brand to match it, and a new film on the site.

- The dashboard shows every desk as a small bot at its own desk, in a room for its tier, awake only while an agent of that desk is working. The job moves along a track from the brief to the sign-off, with the round, score, cost and time beside it. The review board has a tab per round, a score chart against the bar, and the scorecard. The studio log says what happened in plain words. All controls and routes are unchanged.
- The logo is the bot's head with its one lens eye. The lamp mark is retired.
- A dashboard guide with screenshots in `docs/dashboard.md`, and a 50-second captioned walkthrough.
- `clips/frames.mjs` records the dashboard at 60 frames a second on a virtual clock, replaying real job records.
- The 50-second film on deskstudio.ai and in the README is new: a rendered studio floor, the 42 desks, and one job from brief to sign-off.

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
