# Privacy

Desk Studio runs on your machine, in your coding agent, with the model access you already have. The dashboard and the event log send nothing anywhere. The only things that leave your machine are the model calls the desks make and, for the few research desks, web lookups.

## What the dashboard logs

The dashboard is off until you run `/desk:dashboard setup`. Once on, hooks and the Design Manager append one JSON line per event to `.desk/events.jsonl`:

- session start and end, with the first eight characters of the session id
- a desk starting and stopping, with the desk name and an agent id, and on stop the model it ran on, its token counts and a list-price cost
- the name of each tool a desk uses, with the desk name
- job start, phase, pick, proof, score, waiting and done, with the job id, round numbers, pass or fail, failure counts and averages
- every control you use on the dashboard: pause, stop, a model change with the model names, a pick with the rough number, a note with the desk name and its length, approve, send back with the length of the notes

The log is trimmed when it passes 5 MB. `.desk/dashboard.log` holds one line per start, stop, control and server error.

## What is never logged

- the ask you typed
- the brief, the copy, or any text a desk wrote
- a note you wrote to a desk, or the notes you sent back with
- prompt text of any kind
- anything from outside `.desk/`

Notes and send-back text live only in `.desk/jobs/<id>/inbox/` and `.desk/jobs/<id>/control.json`, which are local files the Manager reads and that `setup` adds to `.desk/.gitignore`.

## Where it binds

The server listens on `127.0.0.1` only. It is not reachable from another machine, and it does not look up or call any host. Every API route and the event stream need a token. The token is new on every `start`, it is in the URL that `start` prints, and it is stored with the pid in `.desk/dashboard.runtime.json` so `stop` can check it is ending the right process. A request without the token gets a 401.

The file route serves only PNG, HTML, SVG and JSON under `.desk/out` and `.desk/jobs`, refuses `..`, and serves HTML and SVG with a sandbox header so a rendered rough cannot run scripts against the dashboard.

The page stores one thing in the browser, your light or dark choice.

## How to turn it off

```bash
/desk:dashboard disable
```

This stops the server and sets `enabled` to false in `.desk/dashboard.json`. The event log stays until you delete `.desk/events.jsonl`. To remove every trace, delete `.desk/events.jsonl`, `.desk/dashboard.json`, `.desk/dashboard.runtime.json` and `.desk/dashboard.log`.

With the dashboard disabled, the hooks still see the events but write nothing unless a `.desk/` folder exists, and the files they write stay local and gitignored.
