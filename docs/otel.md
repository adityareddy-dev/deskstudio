# Traces

`runner/otel.mjs` reads a job from `.desk/events.jsonl` and turns it into one OpenTelemetry trace. It works for jobs run through `desk-run` and for jobs run inside Claude Code, since both write the same event log. Nothing in the runner or the hooks changes, and nothing is sent unless you run it.

```sh
node runner/otel.mjs                          # the latest job, OTLP/JSON on stdout
node runner/otel.mjs --job <id>               # one job
node runner/otel.mjs --all                    # every job in the log, one trace each
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 node runner/otel.mjs   # post to a collector
```

It reads `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES` the way an SDK would. Only OTLP over HTTP with JSON is supported. The event log never has prompt text, copy or notes, so the trace doesn't either.

## The spans

The names and attributes follow the GenAI semantic conventions at [open-telemetry/semantic-conventions-genai@547934a](https://github.com/open-telemetry/semantic-conventions-genai/tree/547934afa90a34298441caf80c43b27255c3a292/docs/gen-ai) (2026-10-18). Those are still in Development, so attribute names can change.

| Span | Kind | What it is |
| --- | --- | --- |
| `invoke_workflow design` | internal | the job, from `job.start` to `job.done` |
| `invoke_agent <desk>` | internal | one desk's turn, with `gen_ai.agent.name` |
| `chat <model>` | client | the model call under a desk, desk-run only |
| `execute_tool <tool>` | internal | a tool a desk called in Claude Code, or the proof pass desk-run runs for the desks |

Tokens go on the span closest to the call that used them: the `chat` span in desk-run, where every desk turn is one call, and the `invoke_agent` span in Claude Code, where the hook only sees the desk's total. `gen_ai.usage.input_tokens` includes cache reads and writes, and those are also given on their own as `gen_ai.usage.cache_read.input_tokens` and `gen_ai.usage.cache_write.input_tokens`.

The conventions have no cost attribute, so cost is `deskstudio.cost.usd`, at list price on a plan the same as in [cost.md](cost.md). The other app attributes are `deskstudio.job.id`, `deskstudio.desk.tier`, `deskstudio.desk.task` and the proof round and failure count.

## What it can't see

In Claude Code only `PreToolUse` is hooked, so a tool span ends at the desk's next recorded event rather than when the tool returned. Model calls inside a Claude Code desk aren't in the log, so that mode has no `chat` spans. In desk-run three roughs start together and the stop event rounds to the second, so when two starts are equally close the rough's task is left off its span.
