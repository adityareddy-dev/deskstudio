---
name: email-campaign
description: A sequence of emails that share one template and one voice: the plan, the timing, every subject line, every message with its text part. Use for onboarding, a launch series, a nurture or a re-engagement run.
argument-hint: "<what the sequence does and for whom> [--emails N] [--days d1,d2,...] [--quality ...]"
---

Run an email sequence as the Design Manager.

**Deliverable and standard.** A sequence plan to `standards/copy.md` and each email to `${CLAUDE_PLUGIN_ROOT}/skills/desk/standards/email.md`, all built on one template picked once, so the series reads as one sender.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Growth/Analytics Specialist | `desk:growth-analytics-specialist` | senior | the sequence logic: how many, when, what each one is for, what to measure |
| Email Copywriter | `desk:email-copywriter` | builder | subjects, preheaders, bodies, CTAs, text parts for every email |
| Copy Editor | `desk:copy-editor` | senior | one voice across the run, the banned list |
| Compliance Designer | `desk:compliance-designer` | senior | footer, consent and the legal line, once for the series |
| Email Designer | `desk:email-designer` | builder | three template roughs at the senior model, then every email |
| Art Director | `desk:art-director` | director | the pick of the template, notes on the set |
| Creative Director | `desk:creative-director` | director | sign-off on the template and the set sheet |

**Inputs.** Text (the goal, the audience, the product), a file to draw from (onboarding docs, a feature list), a URL, screenshots to feature.

**Proof sizes.** `email-600`, light and dark, per email.

**Output** under `.desk/out/<id>/`:

- `sequence.md`: a table of number, day, purpose, subject, preheader, CTA, what it measures.
- `NN-<slug>.html` and `NN-<slug>.txt` per email, numbered in send order.
- `subjects.md`: three subject options per email with counts, the chosen one marked.
- `set.html`: every email at thumbnail size on one sheet, in order.
- `renders/` per email, light and dark.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `email-campaign`. Changes to the loop for this command:

- Scope is `full`. The sequence plan comes first and sets the count (default 5) and days (default 0, 2, 5, 9, 14). Copy for every email follows through the Copy Editor before any build.
- Roughs are three templates shown on email one. The pick is of the template. Every email is then built in it, up to four in parallel, each polished until proof passes light and dark.
- Sign-off is on `set.html` plus email one and the last one in full. Template notes apply to every email in one polish round.

The ask: **$ARGUMENTS**
