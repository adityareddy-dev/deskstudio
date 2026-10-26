# Desk Studio in Windsurf

## Install

Use Node.js 20 or newer. In the project root, run:

```
npx deskstudio add --agent windsurf
```

## What the installer writes

This writes `.desk/`, copies the desk briefs to `.agents/skills/desk/` and adds a marked block to `.windsurf/rules/desk.md`.

## Before a runner job

Check the available providers without making a model call:

```
npx --package deskstudio desk-run doctor
```

A fresh runner project selects Anthropic models in `.desk/project.json`. The configured provider must be reachable. Signing in to the host alone does not change those settings.

## Known limits

Checked on 2026-10-26 against deskstudio 1.0.0 from npm. The installer writes the file above. Desk Studio has not been run inside Windsurf.

The runner currently takes `design` for social cards. Other slash commands are Claude Code skills. The host session and the desks use their own model access.
