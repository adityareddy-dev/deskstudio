---
name: design-template
description: A finished page template from the standards: landing page, dashboard, pricing, auth, blog, docs or onboarding, in the project's brand with real copy. Use when a project needs a page type it does not have yet.
argument-hint: "<landing-page|dashboard|pricing|auth|blog|docs|onboarding> <what it is for> [--framework html|react|vue|svelte]"
---

Make a page template as the Design Manager.

**Deliverable and standard.** One page type, by the first word of the ask. `landing-page` and `pricing` follow `standards/landing-page.md` (pricing uses its pricing rules). `dashboard` follows `standards/dashboard.md`. `auth`, `blog`, `docs` and `onboarding` follow the landing-page standard's type, colour and file contract with these shapes: auth is one form on one column with the mark and one line, no marketing. Blog is an index and an article at 680px measure with one image treatment. Docs is a sidebar, a 720px content column and a right-hand outline. Onboarding is three to five steps, one question each, a progress line, a skip. Copy to `standards/copy.md`.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Landing Page Designer | `desk:landing-page-designer` | senior | landing-page, pricing, blog, docs, onboarding: three roughs, the structure |
| Dashboard Architect | `desk:dashboard-architect` | senior | dashboard: three roughs, the structure |
| Content Designer | `desk:content-designer` | builder | real copy for every element: headings, body, labels, errors, empty states |
| Copy Editor | `desk:copy-editor` | senior | the copy standard across the page |
| UI Designer | `desk:ui-designer` | builder | polish rounds on the HTML |
| Design Engineer | `desk:design-engineer` | builder | with `--framework`: the component version from the signed-off HTML, tokens as variables |
| Art Director | `desk:art-director` | director | the pick and the notes |
| Creative Director | `desk:creative-director` | director | sign-off |

**Inputs.** Text (what the page is for, the product, the audience), a file to draw copy from (a README, pricing data, docs), a URL of the current page to replace.

**Proof sizes.** `phone,desktop`, plus `tablet` for dashboard and docs.

**Output** under `.desk/out/<id>/`:

- `final.html`: the page, self-contained, to its file contract, with `[data-state]` variants where the type has states (auth errors, onboarding steps, dashboard states).
- `copy.md`: every string on the page by element, so it can be edited without touching the layout.
- `components/` when `--framework` is set: the page split into components in that framework, with `tokens.css` and a `README.md` on how to drop them in.
- `renders/` per size.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `design-template`. Changes to the loop for this command:

- Copy first: the Content Designer writes every string, the Copy Editor passes it, then roughs start with the copy fixed.
- The structuring desk for the type runs the roughs at the senior model in patterns from the standard, then polish moves to the UI Designer.
- `--framework` (default from `project.json`, else none) adds one step after sign-off: the Design Engineer builds `components/` from `final.html` and the Art Director checks one render of the component version against the HTML.

The ask: **$ARGUMENTS**
