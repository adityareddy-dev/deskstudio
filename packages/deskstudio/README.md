# deskstudio

Your own design studio. A full design studio inside the coding agent you already use. One command, free, nothing leaves your machine but the model calls you already make.

This package is Desk Studio for coding agents other than Claude Code, plus the `desk-run`, `desk-proof`, `desk-event` and `desk-floor` tools for every agent. In Claude Code, install the plugin instead:

```
/plugin install desk --marketplace adityareddy-dev/deskstudio
```

## Install

In the project, once:

```
npx deskstudio add
```

It copies the `.desk/` seed files, writes a marked block into `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/desk.mdc` and `.windsurf/rules/desk.md` without touching what is already there, and copies the desk skill (the 42 role briefs, the Design Manager's included) to `.agents/skills/desk/`. `--agent claude|codex|cursor|gemini|copilot|windsurf|opencode|all` limits it to one agent.

Then ask the agent for something. For a design ask, the block tells it to run the studio and hand back what it returns:

```
npx --package deskstudio desk-run design "a launch card for LinkedIn"
```

## What runs

The same loop as the plugin: three roughs from the senior seat, the Art Director picks one and writes notes, the builder seat polishes, a proof step checks the rendered pixels in Chrome (contrast, overflow, safe zones, palette, type scale, copy present), and the Creative Director scores eight axes. Pass is every axis at 8 or above and the average at 8.5 or above. Files land in `.desk/out/<job>/` with a note on who did what, the scores and the cost at list price.

Seats are per tier and reach each provider through the CLI you already have signed in (`claude`, `codex`, `agy`), with API keys as the fallback. Google uses Antigravity CLI because individual-account Gemini CLI sign-in is no longer supported. Run `agy` once to sign in and `agy models` to see your available models. One provider is fine, and tiers can mix. Jobs have completed through all three CLIs, including a Google-only job and a mixed OpenAI/Google job, both signed off at 8.75:

```
npx --package deskstudio desk-run doctor
npx --package deskstudio desk-run design "a launch card" --models director=anthropic/opus,builder=openai/nano
```

The floor, a local page on 127.0.0.1 where you watch the desks, pause, move a seat, write a desk a note or pick a rough yourself:

```
npx --package deskstudio desk-floor setup
npx --package deskstudio desk-floor start
```

`desk-proof` checks any HTML or SVG file on its own:

```
npx --package deskstudio desk-proof check hero.html --brand .desk/DESIGN.md --sizes phone,desktop
```

Node 20 or later and a Chrome or Edge on the machine. Docs, the desks and the signed-off gallery: https://deskstudio.ai and https://github.com/adityareddy-dev/deskstudio. MIT.
