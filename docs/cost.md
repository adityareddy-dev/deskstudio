# What a job costs

On a subscription plan the figures here are list price, not a bill. On an API key they are what you pay. The floor shows what the work would cost at list price so you can see where the money goes and move seats around.

## The tiers

| Tier | Default | Does |
| --- | --- | --- |
| director | opus | the pick, the notes, the sign-off |
| senior | sonnet | the three roughs, research, type, tokens, copy editing |
| builder | haiku | every polish round, the making |

The launch card (a LinkedIn card and an Instagram card, three polish rounds, signed off at 8.9) cost $1.34 at list price: the director desks $0.81, the three Sonnet roughs $0.43, the three Haiku polish rounds $0.10. The polish rounds ran $0.02, $0.04 and $0.03 and the sign-offs grew as the notes got finer. The roughs and the judgment are the money, and the builder rounds are the cheap part. The run is in `clips/fixtures/card/`.

## How it is counted

Every desk runs as its own subagent with its own transcript. When a desk stops, the `desk.stop` hook reads that transcript, adds up input, cache read, cache write and output tokens per model, and prices them from `scripts/prices.json` (Anthropic list prices, with the date they were checked). The Manager never estimates. In runner mode the runner records the same fields from each provider's reported usage.

`state.mjs cost` rolls the desk events up by tier into the job's `state.json`. The launch card's:

```json
"cost": { "director": 0.8087, "senior": 0.4296, "builder": 0.0971, "total": 1.3354, "complete": true },
"tokens": { "director": 313437, "senior": 403248, "builder": 2912637 }
```

`complete: false` means at least one desk did not report usage, and the handback says so.

## Reading the floor

- The job panel shows cost so far by tier and the total, and a line that grows as the desks report.
- Each desk card shows the model it ran on and what its last turn cost.
- The cost line on the site comes from the launch card run in `clips/fixtures/card/`, never typed in.

## Moving seats

Change tiers in `.desk/project.json`, with `--quality studio|best|thrifty` on a command, or from the floor while a job is paused. `thrifty` puts Sonnet on the director desks and Haiku everywhere else, including the roughs. `best` puts Fable on the directors and Opus on the seniors. A mix across providers (`"builder": "openai/nano"`) goes through the runner.

On the Northlight card, thrifty cost $0.35 against $0.97 at the studio tier and finished at 8.1, under the bar after three rounds. The best preset has not been run to the end yet.

Cache reads dominate the token count because every desk re-reads the briefs, the brand and the standard, and those are cached across turns.
