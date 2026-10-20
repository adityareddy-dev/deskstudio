---
name: init
description: Set up Desk Studio in this project. Finds the brand in the project, writes .desk/DESIGN.md and .desk/project.json with the model tiers, and says what it found.
argument-hint: "[--brand <hex colour or URL>] [--quality studio|best|thrifty]"
---

Set up `.desk/` for this project.

1. Create `.desk/`, `.desk/out/`, `.desk/jobs/` in the project root if missing, and a `.desk/.gitignore` containing `jobs/`, `events.jsonl`, `dashboard.runtime.json`.
2. If `.desk/DESIGN.md` is missing, follow `${CLAUDE_PLUGIN_ROOT}/skills/desk/procedures/brand-from-project.md`. If `--brand` gives a colour or a URL, use that instead of asking.
3. If `.desk/project.json` is missing, write the defaults from the end of `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md`, with `--quality` applied if given.
4. Tell the user in three lines: where the brand came from, the three tiers and their models, and that `/desk:design <ask>` is the next thing to type.

Arguments: $ARGUMENTS
