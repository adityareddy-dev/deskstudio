---
name: dashboard
description: The floor, a local dashboard for Desk Studio. See every desk, the job, the roughs and scores, and steer it: pause, change a model, write a desk a note, pick a rough, approve. setup, start, stop, status or disable.
argument-hint: "setup|start|stop|status|disable [--port N]"
---

Run the floor for this project. The subcommand is the first word of **$ARGUMENTS**; with no word, use `status`.

Before `setup`, tell the user in three lines what it does:

1. The floor logs desk names, models, rounds, scores, costs and file paths to `.desk/events.jsonl`. Never prompt text, copy or notes.
2. It serves on 127.0.0.1 only, behind a token that changes on every start. Nothing leaves the machine.
3. `/desk:dashboard disable` turns it off. Deleting `.desk/events.jsonl` clears the log.

Then run the subcommand:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dashboard/server.js" <subcommand> --project "$PWD" [--port N]
```

What each one does:

- `setup` writes `.desk/dashboard.json` (`enabled`, `port`, default 7433) and adds `events.jsonl`, `jobs/`, `dashboard.runtime.json` and `dashboard.log` to `.desk/.gitignore`. Creates `.desk/` if it is missing.
- `start` runs the server in the background and prints `http://127.0.0.1:PORT/?token=...`. Show that URL to the user as a link. The token is new on every start and lives in `.desk/dashboard.runtime.json` with the pid.
- `status` says whether it is running and prints the URL again.
- `stop` checks that the pid on record still answers with the token, then ends it.
- `disable` stops it and sets `enabled` to false. `setup` turns it back on.

When it fails:

- "Floor is not enabled": run `setup` first.
- "Port N is in use": run `start --port M` with another port, or stop what is on N. `setup --port M` makes it stick.
- "No .desk/ found": run `/desk:init`, or `setup`, in the project root.
- "did not come up": the last lines of `.desk/dashboard.log` are printed with the error.

Do not open a browser yourself. The user opens the link.
