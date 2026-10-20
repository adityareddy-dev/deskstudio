# Commands

Every command in the table is `/desk:<name>` in Claude Code. Each loop command is a fixed desk list and an output contract on top of the same loop: intake, roughs, pick, polish, proof, sign-off, handback. Files land in `.desk/out/<job id>/`, state in `.desk/jobs/<job id>/state.json`, and the dashboard shows the desks as they work.

Tiers: director (opus), senior (sonnet), builder (haiku) by default. `--quality studio|best|thrifty` on any command changes the roles. Roughs always run at the senior model, polish at the builder model. `desk:<slug>` is the agent name the dashboard lights up.

## Command availability

Outside Claude Code, the runner registers one command for now, `design`, one still image for a feed. The list lives in [`runner/commands.mjs`](../runner/commands.mjs).

```
npx --package deskstudio desk-run design "a launch card for LinkedIn"
```

It also has `doctor`, `providers` and `resume`, covered in [the runner guide](runner.md). The other commands in the table are Claude Code skills, not runner commands yet. `npx deskstudio add` copies the desk briefs and writes the host's instruction block, it does not add commands to the runner.

## 1.0.0

| Command | Makes | Standard | Desks | Output |
| --- | --- | --- | --- | --- |
| `design` | any deliverable that has a standard: the ask decides which | by deliverable | staffed per ask from the 42 | `final.html`, renders, scores |
| `design-review` | an audit of an existing file, URL or screenshot, with `--fix` | by input | Art Director, Creative Director, Accessibility Specialist, Copy Editor, UI Designer (fix) | `review.md`, renders, `final.html` with `--fix` |
| `design-critique` | a usability critique: the Nielsen ten plus the rubric, screenshot mode | by input | UX Designer, Content Designer, Creative Director | `critique.md` |
| `design-system` | tokens: generate, extract or audit, `.desk/DESIGN.md` and exports | brand-kit (front matter), dashboard (sheet) | Design System Lead, Typographer, Accessibility Specialist, Design Engineer, Art Director, Creative Director | `DESIGN.md`, `tokens.css`, `tailwind.theme.js`, `sheet.html`, `audit.md` |
| `brand-kit` | a brand in three directions, one picked, written to `brand/` | brand-kit | Brand Strategist, Typographer, Design System Lead, UI Designer, Icon Designer, Motion Designer, Art Director, Creative Director | `direction-1..3/`, `compare.html`, `brand/` with `DESIGN.md`, marks, palette, type, motion, sheet, card, hero, sting |
| `social-content` | one post, story or carousel with its caption | social-card, carousel, copy | Social Media Copywriter, Copy Editor, UI Designer (post, story) or Social Media Designer (carousel, series), Art Director, Creative Director | `final.html`, `caption.md`, renders |
| `social-campaign` | strategy, calendar, captions and a batch of visuals in one system | social-card, carousel, copy | Social Media Strategist, Growth/Analytics Specialist, Social Media Copywriter, Copy Editor, Social Media Designer, Art Director, Creative Director | `strategy.md`, `calendar.md`, `captions.md`, `visuals/NN-<slug>.html`, `batch.html` |
| `email-template` | one email, HTML and text, light and dark | email, copy | Email Copywriter, Copy Editor, Compliance Designer, Email Designer, Art Director, Creative Director | `final.html`, `final.txt`, `subjects.md`, `clients.md`, renders |
| `email-campaign` | a sequence on one template | email, copy | Growth/Analytics Specialist, Email Copywriter, Copy Editor, Compliance Designer, Email Designer, Art Director, Creative Director | `sequence.md`, `NN-<slug>.html` and `.txt`, `subjects.md`, `set.html` |
| `presentation-design` | a deck on one slide system | deck, chart, copy | Content Designer, Copy Editor, Presentation Designer, Data Viz Designer, Image Editor, Art Director, Creative Director | `deck.html`, `outline.md`, `deck.pdf`, renders per slide |
| `motion-design` | a 6 to 10 second clip, recorded | motion-clip | Storyboard Artist, Copy Editor, Motion Designer, Typographer, Video Editor, Art Director, Creative Director | `final.html`, `board.html`, `timeline.md`, `clip-*.webm`, `.mp4`, `poster-*.png` |
| `video` | script to rendered video with captions, 16:9 and 9:16 | video, motion-clip, copy | Video/Content Producer, Copy Editor, Storyboard Artist, Motion Designer, Video Editor, Art Director, Creative Director | `script.md`, `storyboard.html`, `final.html`, `captions.vtt`, `clip-*.webm`, `.mp4`, `poster-*.png`, `export.md` |
| `variants` | three directions side by side, no polish | by deliverable | the deliverable's builder desk x3, Art Director | `rough-1..3.html`, `compare.html`, `compare.md` |
| `accessibility-audit` | WCAG 2.2 AA findings with code fixes, `--fix` applies them | the Accessibility Specialist's brief | Accessibility Specialist, Content Designer, Design Engineer (fix), Art Director (fix) | `audit.md`, `final.html` and `applied.md` with `--fix` |
| `design-qa` | breakpoints, tokens, states and motion on a built screen | by deliverable | Design System Lead, Interaction Designer, Motion Designer, Design Engineer, Art Director, Creative Director | `qa.md`, `states.html`, renders, `final.html` with `--fix` |
| `chart-design` | one chart as HTML with inline SVG | chart, copy | Data Viz Designer, Copy Editor, Typographer, Art Director, Creative Director | `final.html`, `spec.json`, `data.csv`, `chart.md` |
| `dashboard-layout` | a dashboard with KPIs, charts, filters, table, states | dashboard, chart, copy | Dashboard Architect, Data Viz Designer, Interaction Designer, Content Designer, UI Designer, Art Director, Creative Director | `final.html`, `decisions.md`, renders per size and state |
| `design-template` | landing-page, dashboard, pricing, auth, blog, docs or onboarding page | landing-page, dashboard, copy | Landing Page Designer or Dashboard Architect, Content Designer, Copy Editor, UI Designer, Design Engineer, Art Director, Creative Director | `final.html`, `copy.md`, `components/` with `--framework` |
| `design-handoff` | tokens, specs, component docs from a signed-off job | copy, brand-kit (tokens) | Design System Lead, Design Engineer, Content Designer, Copy Editor, Creative Director | `tokens.json`, `tokens.css`, `specs.md`, `specs.html`, `components.md`, `assets/`, `README.md` |
| `taste` | an entry in `.desk/taste.md` by rubric axis | none | none, no model calls | `.desk/taste.md` |
| `status` | every job's phase, round, scores, cost | none | none, no model calls | printed table |
| `dashboard` | the dashboard: `setup`, `start`, `stop`, `status` | none | none | the browser dashboard on 127.0.0.1 |
| `init` | `.desk/` with the brand, models and quality from what is installed | none | none | `.desk/DESIGN.md`, `.desk/project.json` |
| `help` | what the studio does and which command to run | none | none | printed |

## Flags every loop command takes

| Flag | Does |
| --- | --- |
| `--quality studio|best|thrifty` | the model per tier for this job, over `project.json` |
| `--rounds N` | the cap across polish, proof and sign-off, 1 to 12, default 8 (review commands default lower) |
| `--sizes a,b` | the proof sizes by name from `skills/desk/procedures/sizes.md`, or `WIDTHxHEIGHT` |

## Standards

One file per deliverable in `skills/desk/standards/`: `social-card`, `carousel`, `landing-page`, `email`, `deck`, `chart`, `dashboard`, `motion-clip`, `brand-kit`, `icon-set`, `print-piece`, `video`, `copy`. Every desk on a job reads the standard before touching anything, and the Creative Director scores against it and the rubric.

## Later

1.1: `data-viz-audit`, `design-framework`, `brand-strategy`, `illustration-system`, `video-script`, `ab-variants`, `design-sprint`, `design-tutorial`, `print-layout`, `print-audit`, `pdf-report`, `email-audit`, `social-analytics`, `component-docs`, `design-md`, `lint-design`. 1.2: `gen-image`, `gen-video`, `gen-audio`, `gen-moodboard`, `prompt-refine`. 1.3, once the design tool connection is signed in: the figma set, `ux-audit`, `design-present`, `site-to-figma`.
