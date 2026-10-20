---
name: social-content
description: One piece of social content with its copy: a post card, a story or a ten-slide carousel, for LinkedIn, X or Instagram. Use when you need one finished thing to post, visuals and caption together.
argument-hint: "<post|story|carousel> <what it says or a file to draw from> [--platform linkedin|x|instagram] [--quality ...]"
---

Make one piece of social content as the Design Manager.

**Deliverable and standard.** By the first word of the ask: `post` is a social card to `standards/social-card.md`, `story` is a social card at story size to the same standard, `carousel` is ten slides to `standards/carousel.md`. The caption and any on-card copy follow `standards/copy.md`. Default is `post` when the word is missing.

**Desks.**

| Desk | Agent | Tier | Does |
| --- | --- | --- | --- |
| Social Media Copywriter | `desk:social-media-copywriter` | builder | the on-card copy and the caption with the hook in the first line |
| Copy Editor | `desk:copy-editor` | senior | every string against the copy standard, the banned list |
| UI Designer | `desk:ui-designer` | builder | a single post or story: three roughs at the senior model, polish rounds |
| Social Media Designer | `desk:social-media-designer` | builder | a carousel, or a post that joins an existing series: three roughs at the senior model, polish rounds |
| Art Director | `desk:art-director` | director | the pick and the notes |
| Creative Director | `desk:creative-director` | director | sign-off |

**Inputs.** Text (what the post says, or the whole copy verbatim), a file path to draw from (a README, a changelog, a blog post), a URL, or a screenshot to feature as the one element.

**Proof sizes.** By platform: LinkedIn `linkedin` and `ig-square`, X `x`, Instagram `ig-post`. Story: `ig-story`. Carousel: `ig-post` (or `ig-square` when asked). Default when no platform is named: `linkedin,ig-post`.

**Output** under `.desk/out/<id>/`:

- `final.html`: the card, or the ten-slide carousel file with `[data-slide]` sections.
- `caption.md`: the caption per platform with its character count, the alt text for the image, and three hashtag options when the platform uses them (never in the caption's first line).
- `renders/` from proof at each size, which are the files to upload.

**Run.** Read `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md` now and follow it from step 0 to step 7 as the Design Manager with the desks above. Command name for state and events: `social-content`. Changes to the loop for this command:

- Copy comes first. The Social Media Copywriter writes the on-card copy and caption, the Copy Editor passes it, and only then do the roughs start with that copy in the brief's copy block. Copy is never changed during polish without going back through the Copy Editor.
- For a carousel, roughs are the cover plus slides two and ten in the pattern, so the pick is made on three slides each, not thirty. The picked direction then builds all ten before polish.
- Proof runs with `--must-appear` for every on-card string.

The ask: **$ARGUMENTS**
