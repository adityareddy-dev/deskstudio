# Desk Studio in Codex

## Install

Use Node.js 20 or newer. In the project root, run:

```
npx deskstudio add --agent codex
```

## What the installer writes

This writes `.desk/`, copies the desk briefs to `.agents/skills/desk/` and adds a marked block to `AGENTS.md`.

## Before a runner job

Check the available providers without making a model call:

```
npx --package deskstudio desk-run doctor
```

A fresh runner project selects Anthropic models in `.desk/project.json`. The configured provider must be reachable. Signing in to the host alone does not change those settings.

## First run

Inside Codex's sandbox, npm may need a cache folder inside the project.

In the same project, ask:

```
design a launch card for LinkedIn
```

The request uses the runner's `design` command for a social card. You can also run it from the project root:

```
npx --package deskstudio desk-run design "a launch card for LinkedIn"
```

## Known limits

Checked on 2026-10-26 with deskstudio 1.0.0 and codex-cli 0.163.0: Codex reads the block and calls design. A finished card needs a reachable provider, and no card has been produced yet.

The runner currently takes `design` for social cards. Other slash commands are Claude Code skills. The host session and the desks use their own model access.
