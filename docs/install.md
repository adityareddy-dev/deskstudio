# Install Desk Studio

## Install in your agent

Claude Code:

```
/plugin install desk --marketplace adityareddy-dev/deskstudio
```

On a Claude Code older than 2.1.275, add the marketplace first, then install:

```
/plugin marketplace add adityareddy-dev/deskstudio
/plugin install desk@deskstudio
```

Then ask for something:

```
/desk:design a launch card for LinkedIn
```

Codex, Cursor, Gemini CLI, Copilot, Windsurf or OpenCode, one line in the project:

```
npx deskstudio add
```

It writes `.desk/`, copies the desks to `.agents/skills/desk/` and puts one marked block in the agent's instruction file. Every agent by default, one with `--agent codex`. Run it again any time, it keeps project text outside its markers, updates untouched desk briefs and preserves your edits unless you pass `--force`. It records installed file hashes in `.desk/installed.json`, including on the first upgrade from npm 1.0.0.

| Agent | Where the block goes |
| --- | --- |
| Codex | `AGENTS.md` |
| OpenCode | `AGENTS.md` |
| Gemini CLI | `GEMINI.md` |
| Copilot | `.github/copilot-instructions.md` |
| Cursor | `.cursor/rules/desk.mdc` |
| Windsurf | `.windsurf/rules/desk.md` |

Then ask the agent in plain words, "design a launch card for LinkedIn", it reads the block and runs the studio. Or run it yourself:

```
npx --package deskstudio desk-run design "a launch card for LinkedIn"
```

The desks call models through the CLI you are already signed in to (`claude`, `codex` or `agy`) or a key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`). `npx --package deskstudio desk-run doctor` shows which path it will take without making a model call.

The runner takes `design` for social cards for now. The other commands in the [gallery](gallery.md) are Claude Code skills, see [command availability](commands.md#command-availability).

Files land in `.desk/out/<job>/` with a short note on who did what, the scores and the cost.

## Open the dashboard

To watch the desks work and steer the job, turn the dashboard on once per project and start it:

```
/desk:dashboard setup
/desk:dashboard start
```

Outside Claude Code:

```
npx --package deskstudio desk-dashboard setup
npx --package deskstudio desk-dashboard start
```

`start` prints a link on 127.0.0.1 with a token. Open it, then run a job. How to read it is in [the dashboard guide](dashboard.md).

## Other agents

| Agent | What you get |
| --- | --- |
| Claude Code | Everything: the 41 desks as native subagents with the repo's tools, the Manager in your session, the loop, proof, the dashboard, video. |
| Codex, Cursor, Gemini CLI, Copilot, Windsurf, OpenCode | `npx deskstudio add` writes a rules block the agent reads and copies the desk briefs. The runner takes `design` for social cards, with the same loop, proof and dashboard, and desks return files rather than editing the repo. For design work inside the codebase the agent plays the Design Manager from the briefs. The other commands are Claude Code only for now. The installer is tested for each of these agents. Jobs have completed through the Claude, Codex and Antigravity CLIs. |

