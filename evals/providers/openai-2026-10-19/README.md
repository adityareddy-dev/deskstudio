# OpenAI runner verification, 2026-10-19

Two real jobs ran through Codex CLI 0.159.2 after a fresh ChatGPT sign-in. No API key or fake provider was used. Every desk in both state files records `via: "cli"`. The Art Director reviewed six rough screenshots, and the Creative Director reviewed both polished sizes. Both jobs made LinkedIn and Instagram portrait cards for the made-up Northlight brand.

| Result | Director | Senior | Builder | Rounds | Final proof | Sign-off |
| --- | --- | --- | --- | --- | --- | --- |
| [nano-builder](nano-builder/result.json) | openai/large | openai/mini | openai/nano | 6 of 6 | pass | 8.5 average, originality 6, under the bar, exit 4 |
| [mini-builder](mini-builder/result.json) | openai/large | openai/mini | openai/mini | 2 of 6 | pass | 8.75 average, every axis 8 or above, exit 0 |

The second job used a more specific seven-year timeline brief as well as a different builder. These are two provider-verification observations, not a controlled model comparison. They are separate from the 17 default studio-tier goldens and are not included in the homepage gallery.

The mini-builder job's list-price estimate is $0.6207, calculated from the CLI token counts using `runner/models.json`. The nano-builder job's estimate is $0.6704. These are estimates, not subscription charges or API billing receipts.

## Artifacts

Each result directory keeps the actual brief, brand, state, handback, final and rough HTML, every round's renders and proof reports, the filtered job events, and the runner log. Its `manifest.json` hashes every captured file. The original temporary workspace paths in state and proof reports describe where the job ran. The artifacts are copied here for inspection. No sign-in codes, account tokens or credentials are retained.

The signed-off output is [final.html](mini-builder/out/final.html), with [LinkedIn](mini-builder/renders/round-2/linkedin.png) and [Instagram portrait](mini-builder/renders/round-2/ig-post.png) renders. The first job's under-bar result remains intact in `nano-builder/`.

## Parser correction found by the real run

The first intake returned `## Sizes` and `## Copy` with plain copy. The old parser recognized only bold headings and fenced copy, so it found zero required copy lines. The job was paused before its pick, the parser was corrected, and it resumed with its supplied copy enforced by proof. No completed desk call was rerun. The second job started with the corrected parser and found four required copy lines at intake.

Regression tests cover Markdown headings, plain copy, section boundaries, verbatim text that resembles Markdown, and a complete runner loop that sends missing copy back to the builder before sign-off. Credentials and model access succeeded before these jobs, so the parser issue was independent of sign-in.

To recheck the saved signed-off output from the repository root:

```bash
node proof/cli.mjs check evals/providers/openai-2026-10-19/mini-builder/out/final.html --brand evals/providers/openai-2026-10-19/mini-builder/DESIGN.md --sizes linkedin,ig-post --out .desk/provider-recheck --must-appear "Seven years to break even." "Then free." "Battery now included." "northlight.energy."
```

This establishes a completed OpenAI CLI path, including screenshot input, usage reporting, proof retries, sign-off and handback. It does not establish that the Google or API-key paths have completed jobs.
