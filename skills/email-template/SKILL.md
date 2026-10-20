---
name: email-template
description: One HTML email with its plain-text part, built to render in real clients in light and dark mode. Use for a welcome, an announcement, a receipt, a digest or any single message.
argument-hint: "<what the email is and says> [--type welcome|announcement|digest|receipt|onboarding] [--quality ...]"
---

Make one email as the Design Manager.

**Deliverable and standard.** An email to `${CLAUDE_PLUGIN_ROOT}/skills/desk/standards/email.md`: 600px table layout, one CTA, dark mode, preheader, alt text, a hand-written plain-text part. Copy to `standards/copy.md`.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Email Copywriter | `desk:email-copywriter` | builder | subject line options, preheader, body, CTA, the plain-text part |
| Copy Editor | `desk:copy-editor` | senior | every string against the copy standard |
| Compliance Designer | `desk:compliance-designer` | senior | the footer: sender, unsubscribe, the legal line for the region |
| Email Designer | `desk:email-designer` | builder | three roughs at the senior model, polish rounds |
| Art Director | `desk:art-director` | director | the pick and the notes |
| Creative Director | `desk:creative-director` | director | sign-off |

**Inputs.** Text (what the email says, or the full copy verbatim), a file to draw from (release notes, a post), a URL for the CTA, a screenshot or image to feature as the one image.

**Proof sizes.** `email-600`, rendered light and dark.

**Output** under `.desk/out/<id>/`:

- `final.html`: the email per the file contract.
- `final.txt`: the plain-text part.
- `subjects.md`: five subject lines with character counts and the preheader for each, the recommended pair first.
- `clients.md`: what renders as designed, what degrades and how, and what still needs a real client test.
- `renders/` with `email-600-light.png` and `email-600-dark.png`.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `email-template`. Changes to the loop for this command:

- Copy first: the Email Copywriter writes it, the Copy Editor passes it, the Compliance Designer supplies the footer, then roughs start with the copy block fixed.
- Proof runs twice per round, light and dark, with `--must-appear` for the headline, the CTA label and the unsubscribe word. Both must pass.
- The Email Designer's `size` line (KB) goes in state, and over 102KB is a proof failure for this command.

The ask: **$ARGUMENTS**
