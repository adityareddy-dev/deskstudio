# Codex setup

Add Desk Studio to an existing project without losing its instructions or edited desk briefs.

## Install

Use Node.js 20 or newer. Install Codex following the [official CLI setup](https://developers.openai.com/codex/cli), then check `codex --version`. For example, the official macOS/Linux installer is:

```sh
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

Sign in using the official setup before adding Desk Studio. A fresh install needs a ready model provider; it stops before writing project files if none is available. Check provider access with `npx --package deskstudio desk-run doctor`, which makes no model call.

From your project's root, run:

```sh
npx deskstudio add --agent codex
```

This creates or updates `AGENTS.md`, copies the Manager's skill, role briefs, rubric, standards and procedures to `.agents/skills/desk/`, and seeds `.desk/project.json`, `.desk/taste.md` and `.desk/.gitignore` if missing. Installation makes no model calls and does not create `.desk/DESIGN.md`; a design job finds the brand in the project.

Codex reads [project instructions from AGENTS.md](https://developers.openai.com/codex/agent-configuration/agents-md) and discovers [local skills in .agents/skills](https://developers.openai.com/codex/build-skills). Start a new Codex session from the project root after installation so it loads the updated instructions:

```sh
codex
```

Then try this design request:

```text
Use Desk Studio to improve this project's landing page. Read
.agents/skills/desk/SKILL.md, use the existing brand and components,
and check the result at phone and desktop sizes.
```

For work inside the codebase, Codex plays the Design Manager from the installed briefs. The separate runner currently supports `design` for a social card; see [command availability](commands.md#command-availability) before trying other commands. Design work uses models through your host or configured providers and may incur usage costs; installation and the check below make no model calls, though a fresh install needs a detected provider. Visual proof needs Chrome or Chromium, and motion exports also need system `ffmpeg`; see [prerequisites](../CONTRIBUTING.md#run-the-checks).

## What a second install keeps

`AGENTS.md` contains a managed block between `<!-- desk:start -->` and `<!-- desk:end -->`. Every install refreshes that block, even without `--force`, while preserving text above and below it. If there is no block, the installer appends one. Put project-specific instructions outside the markers.

| Content | Normal install | With `--force` |
| --- | --- | --- |
| Text outside the markers in `AGENTS.md` | Kept | Kept |
| Desk Studio block inside the markers | Refreshed | Refreshed |
| Untouched skill files matching a recorded install hash or the recognized npm 1.0.0 baseline | Updated to the package copy | Updated to the package copy |
| Edited skill files or copies with no recognized baseline at packaged paths | Kept and reported as edited | Replaced with the package copy |
| Missing packaged skill files | Added | Added |
| Existing `.desk/` seed files | Kept | Kept |

The installer records packaged skill hashes in `.desk/installed.json`. It retains the previous baseline for preserved edits so a later install does not mistake them for untouched files.

`--force` replaces differing packaged skill files, not just role briefs. It does not reset `.desk/project.json` or `.desk/taste.md`, write `.desk/DESIGN.md`, or delete extra user-created skill files. Back up edits before using it:

```sh
npx deskstudio add --agent codex --force
```

## Try it in a disposable project

These macOS/Linux shell commands check a second install without starting Codex or running a design job. Use a machine with a provider already configured, and use the same Desk Studio version for both installs.

```sh
mkdir -p /tmp/deskstudio-checks
project_dir=$(mktemp -d /tmp/deskstudio-checks/codex.XXXXXX)
cd "$project_dir"
printf '# Project instructions\n\nKeep this above the studio.\n' > AGENTS.md
npx deskstudio add --agent codex
printf '\nKeep this below the studio.\n' >> AGENTS.md
brief=.agents/skills/desk/roles/ui-designer.md
printf '\nProject-specific UI guidance.\n' >> "$brief"
cp AGENTS.md expected-AGENTS.md
cp "$brief" expected-brief.md

npx deskstudio add --agent codex
cmp AGENTS.md expected-AGENTS.md
cmp "$brief" expected-brief.md
```

Both `cmp` commands should exit zero with no output. The second install should report `AGENTS.md: unchanged`, the seed files as `kept`, and `roles/ui-designer.md` as kept as edited. There should still be just one pair of Desk Studio markers. If the package adapter changes between versions, the block can change while your surrounding text stays intact.

In this disposable project, you can also repeat with `--force`: the brief should return to the packaged version while the instructions outside the markers remain. These are installer checks, not evidence of a live Codex design session.
