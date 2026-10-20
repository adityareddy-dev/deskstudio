# Evals

Every command has at least one case here. A case runs the real plugin headlessly in a fresh project with one of the eval brands, and the result is judged by the same rubric the studio uses: the Creative Director's last score must pass and reach the case's minimum average.

```
node evals/run.mjs --list
node evals/run.mjs --case design-card-northlight
node evals/run.mjs --quality thrifty
node evals/golden.mjs add evals/results/<run>/<case>
node evals/golden.mjs list
```

Runs call models and cost money at list price. A full run is the launch gate's number source: every figure on the site and in the README comes from `evals/golden/`.

- `cases/` one JSON per case: command, ask, brand, sizes, copy that must appear, round cap, what is expected.
- `brands/` the made-up brands the cases use. Each is a complete `DESIGN.md`.
- `results/` one folder per run with `summary.json`, `summary.md`, and per case the handback, the final file, its renders and its state. Gitignored except the summaries.
- `golden/` signed-off outputs by deliverable, with the state and scores that produced them.
