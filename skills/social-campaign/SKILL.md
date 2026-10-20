---
name: social-campaign
description: A whole social campaign: the strategy, a posting calendar, every caption, and the visuals made as one batch in one system. Use when a launch or a theme needs a run of posts, not one.
argument-hint: "<what the campaign is about> [--weeks N] [--platforms linkedin,x,instagram] [--posts N]"
---

Run a social campaign as the Design Manager.

**Deliverable and standard.** A strategy and calendar to `standards/copy.md`, captions to the same, and a batch of visuals each to `standards/social-card.md` or `standards/carousel.md`, all sharing one series system (grid, type steps, mark position, palette use) so the feed reads as one campaign.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Social Media Strategist | `desk:social-media-strategist` | senior | the strategy: audience, the one message, the arc across posts, cadence |
| Growth/Analytics Specialist | `desk:growth-analytics-specialist` | senior | what to measure per post, posting windows, what success looks like in numbers |
| Social Media Copywriter | `desk:social-media-copywriter` | builder | every caption and every on-card line |
| Copy Editor | `desk:copy-editor` | senior | consistency across the batch, the banned list |
| Social Media Designer | `desk:social-media-designer` | builder | the series system as three roughs at the senior model, then every visual |
| Art Director | `desk:art-director` | director | the pick of the series system, notes on the batch |
| Creative Director | `desk:creative-director` | director | sign-off on the system and on the batch sheet |

**Inputs.** Text (the theme, the launch, the dates), a file to draw from (a plan, a changelog, a README), a URL, and optionally a folder of screenshots to feature.

**Proof sizes.** Per visual by platform: LinkedIn `linkedin` and `ig-square`, X `x`, Instagram `ig-post`, stories `ig-story`, carousels `ig-post`.

**Output** under `.desk/out/<id>/`:

- `strategy.md`: one page: audience, the message, the arc, cadence, what to measure.
- `calendar.md`: a table of date, platform, format, hook line, visual file, status.
- `captions.md`: every caption per post and platform with counts and alt text.
- `visuals/NN-<slug>.html`: one file per visual, numbered in calendar order, each to its standard.
- `batch.html`: every visual at thumbnail size on one sheet, in calendar order, so the series is judged as a feed.
- `renders/` per visual at its sizes.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `social-campaign`. Changes to the loop for this command:

- Scope is `full`. Strategy and measurement run first in parallel and return one page each. Copy for every post follows, through the Copy Editor, before any visual starts.
- Roughs are three series systems, each shown on the same two posts (the first card and one carousel cover). The pick is of the system. Every visual in the batch is then built in the picked system by the Social Media Designer, up to six at a time in parallel, each polished until proof passes.
- Sign-off is on `batch.html` (the feed) plus the three visuals the Art Director flags as weakest. Notes on the system apply to the whole batch in one polish round.
- Default `--posts` is 8 over `--weeks` 2 on the platforms in `project.json`, else LinkedIn and X.

The ask: **$ARGUMENTS**
