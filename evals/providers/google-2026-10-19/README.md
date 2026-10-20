# Antigravity runner verification, 2026-10-19 to 20

These are real CLI runs for the fictional Northlight brand, separate from the default studio-tier goldens. Google rejected individual-account Gemini CLI 0.64.0 sign-in and directed the account to Antigravity. Antigravity CLI 1.4.2 completed Google authorization, listed its models and answered real text and screenshot probes. The runs use that CLI, with Codex CLI 0.159.2 for the mixed run's review seats. No API key or fake provider is used.

| Job | Seats | Outcome | Rounds | Proof |
| --- | --- | --- | --- | --- |
| [Google only, steered](google-only/result.json) | Argon intake, then director `google/flash-high`, senior and builder `google/flash-low` | 8.75, every axis at least 8 | 3 of 6 | both sizes pass |
| [Mixed OpenAI and Google](mixed-openai-google/result.json) | director `openai/large`, senior `google/flash`, builder `google/flash-low` | 8.75, every axis at least 8 | 2 of 6 | both sizes pass |

The Google-only run completed at 8.75 after three polish rounds. Its first polished version passed proof, then received 8.5 overall with composition at 7, which correctly sent it back to the builder. The second version was rejected for portrait hierarchy, spacing and composition. The third version corrected those issues and passed. This was a steered verification, not a new gallery golden. The [steering record](google-only/steering.md) retains the explicit layout and copy corrections.

Argon wrote the original intake. When its weekly quota was reported exhausted, the remaining review calls moved to Flash High and the senior seat moved to Flash Low. The intake had normalized the supplied URL by dropping its final full stop. That line was corrected before the second polish completed, with the original intake preserved. Independent proof checks the final output against all four original copy lines, including that punctuation.

The mixed run made three roughs through Google Flash Medium, then OpenAI picked the direction. Google Flash Low polished it, fixed a safe-zone failure, and OpenAI signed off the second round. Independent proof reproduced both sizes with all four supplied copy lines. Its recorded list-price subtotal is $1.0605, incomplete because failed or interrupted requests did not report usage. This is not a subscription bill.

## Adapter and retry findings

Antigravity ignores ordinary piped text alongside `--print`. The adapter sends the complete role and job as a `user` event through its documented stream-json input. Registered aliases pin the model and reasoning effort. A real probe confirmed both a role-specific response prefix and the headline read from the supplied image.

Each call uses a temporary workspace containing copied screenshots. References in the job are mapped to those copies. A completed `view_file` with `AbsolutePath`, or `read_file` with `Path`, must be present for every image before a visual response is accepted. Paths are canonicalized for symlinks and Windows case differences. Temporary files are removed after success or failure. Process errors and failed result statuses are rejected.

Early attempts reached a five-minute request limit, and an earlier adapter recognized only one of the image-read event formats. The logs retain those failures and resumes. The mixed polish request from the stale adapter was interrupted and restarted with corrected path handling. Completed rough responses were originally lost when a peer failed. The runner now saves each rough immediately, lets peer calls settle, and requests only missing files on resume. Legacy stopped desks are cleared from terminal snapshots, and unreported failed requests leave the dollar total incomplete.

Every completed desk in the retained states records `via: "cli"`. The folders retain the final candidate files, every available rough and polish render, proof reports, state, brief, control, filtered events and runner logs. `manifest.json` hashes those files. Some early failed attempts have usage events but no retained HTML because they preceded the partial-result fix.

The runs used Linux and Node 24. The Gemini API-key path remains unverified. Google's model availability and quotas depend on the account, and `agy models` plus `agy -p /usage` show the current choices. Argon's price is unknown and is never filled with a guessed dollar value.
