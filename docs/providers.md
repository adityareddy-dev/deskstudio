# Providers

The runner reaches each provider through the CLI people already have, on the plan they already pay for. API keys are the fallback. One provider is fine, and tiers can mix: `--models director=anthropic/opus,builder=openai/nano`, or the same in `.desk/project.json`.

`desk-run doctor` prints, for each provider, whether the CLI is on PATH and works, whether it is signed in or a key is set, which path the runner will take, the models per tier, and the defaults it would choose for this machine. `desk-run doctor --probe` adds one short real call per reachable provider, which is the only way to catch a sign-in whose token has expired. `desk-run providers` prints the model table.

Every adapter exports the same thing: `runCli({ model, system, prompt, images, cwd, timeoutMs })` and `runApi(...)`, each returning `{ text, usage, costUsd, provider, model, via }`. `images` is a list of PNG paths. `usage` is `{ input, output, cacheRead, cacheWrite }` with `input` the uncached part, normalised to the shape the native desk.stop event carries (`total` added). `runner/providers/index.mjs` picks the path (CLI when signed in, else key), prices token counts when the provider reports no dollars, and adds `modelId`.

## Anthropic

- **CLI**: `claude` (Claude Code). Sign in with `claude auth login`, checked with `claude auth status`.
- **Key**: `ANTHROPIC_API_KEY` (and `ANTHROPIC_BASE_URL` if set) through the Messages API with `fetch`.
- **Flags used**: `claude -p --verbose --model <alias> --input-format stream-json --output-format stream-json --max-turns 1 --tools "" --no-session-persistence --setting-sources "" --system-prompt-file <file>`. The user message goes in on stdin as one stream-json line with base64 image blocks before the text. The result event carries `total_cost_usd`, `usage` and `modelUsage`. The runner removes `CLAUDECODE` from the child's environment so a claude started from inside a Claude Code session does not refuse to nest.
- **Tiers**: director `opus`, senior `sonnet`, builder `haiku`. `fable` is there for the `best` preset. The CLI takes the alias, the API takes the id.
- **Cost**: dollars straight from the CLI. The API path is priced from the table.

## OpenAI

- **Verified run**: [two real Codex CLI jobs](../evals/providers/openai-2026-10-19/README.md) on 2026-10-19, including an OpenAI-only job signed off at 8.75 after two polish rounds with both sizes passing proof. Director `large`, senior `mini`, builder `mini`. The earlier `nano` builder job reached the cap under the bar and is preserved too.
- **CLI**: `codex` (Codex CLI). Sign in with `codex login`, checked with `codex login status`. A revoked token still reports "Logged in", only `--probe` or the first real call shows it.
- **Key**: `OPENAI_API_KEY` through the Responses API with `fetch` (`instructions` for the brief, `input_image` data URLs for screenshots).
- **Flags used**: `codex exec --json --skip-git-repo-check --ephemeral -s read-only -C <cwd> -m <model> -c model_reasoning_effort="medium" -o <file> [-i <png>]... -`. The prompt is read from stdin. Codex has no system prompt flag, so the brief goes first in the prompt under its own heading. `--json` prints JSONL: `item.completed` with an `agent_message` item carries the text, `turn.completed` carries `usage` (`input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`), `turn.failed` carries the error. `DESK_OPENAI_EFFORT` changes the reasoning effort.
- **Tiers**: director `large`, senior `mini`, builder `nano`, which map to the frontier, workhorse and fast models the CLI lists.
- **Cost**: tokens from the CLI, priced from the table.

## Google

- **CLI**: `agy` (Antigravity CLI). Install from [Google's CLI page](https://antigravity.google/cli), run `agy` to sign in, and check the available slugs with `agy models`. Google rejected individual-account sign-in through Gemini CLI 0.64.0 on 2026-10-19 and directed users to Antigravity. The runner checks Antigravity through its CLI without reading the credential store.
- **Key**: `GEMINI_API_KEY` or `GOOGLE_API_KEY` through `generateContent` with `fetch` (`systemInstruction` for the brief, `inline_data` parts for screenshots).
- **Flags used**: `agy --input-format stream-json --output-format stream-json --model <slug> --effort <level> --disable-slash-commands --print-timeout <duration>`. Registered aliases pin the listed effort as well as the model. The complete role brief and job go on stdin as one `user` event, under separate headings. Plain piped input alongside `--print` is ignored by Antigravity 1.4.2. The result event supplies `status`, `response` and `usage`; failures are rejected even if the process exits zero.
- **Workspace and screenshots**: every call gets a temporary workspace with copies of the supplied PNGs. The host project is not the CLI's working directory. Antigravity reads images with `view_file` (`AbsolutePath`) or `read_file` (`Path`), and the adapter verifies a completed read for every screenshot before accepting the response. The temporary files are removed after success or failure. Desks return HTML in their response.
- **Tiers**: director `flash-high` (Gemini 3.8 Flash High), senior `flash` (Medium), builder `flash-low` (Low). `argon` selects Gemini 4 Argon High when the account has quota. `pro` remains for plans offering Gemini 3.1 Pro and for the API. `flash-lite` remains an API model. Check `agy models` and `agy -p /usage` for your account before choosing other slugs.
- **Cost**: token counts from the CLI are priced where the table has a price. Argon's price is unknown, so its dollar cost is null and the handback marks the total incomplete. Argon is available through Antigravity, and is rejected on the Gemini API path with guidance to choose `google/pro` or `google/flash`.
- **Verified runs**: a [Google-only job and a mixed OpenAI/Google job](../evals/providers/google-2026-10-19/README.md) both passed at 8.75, after three and two polish rounds respectively, with both sizes passing proof. The Google-only job used explicit steering notes, retained with its artifacts. The API-key path has not finished an end-to-end job.

## The models table

`runner/models.json`, with `checkedAt`. Each provider lists its CLI name, key variables, the three tiers and its models: an id for the API, the name the CLI takes, list prices per million tokens (input, output, and cacheRead and cacheWrite where published. The Anthropic rows match `scripts/prices.json`) and whether the model takes images. The default role per tier comes from `skills/desk/desks.json`, not from here. `desk-run providers` prints it.

| Provider | Tier | Alias | Model | List price in / out per 1M |
| --- | --- | --- | --- | --- |
| anthropic | director | opus | claude-opus-5-5 | 4 / 20 |
| anthropic | senior | sonnet | claude-sonnet-5-5 | 2 / 10 |
| anthropic | builder | haiku | claude-haiku-5-5 | 0.10 / 0.50 |
| anthropic | (best) | fable | claude-fable-5-1 | 10 / 50 |
| openai | director | large | gpt-6-astra | 10 / 50 |
| openai | senior | mini | gpt-6.1-sol | 2 / 10 |
| openai | builder | nano | gpt-6-luna | 0.10 / 0.50 |
| google | director | flash-high | gemini-3.8-flash (High) | 0.75 / 3.75 |
| google | senior | flash | gemini-3.8-flash | 0.75 / 3.75 |
| google | builder | flash-low | gemini-3.8-flash (Low) | 0.75 / 3.75 |
| google | optional | argon | gemini-4-argon (High) | unknown |
| google | API / some plans | pro | gemini-3.1-pro-preview | 2 / 12 |
| google | API | flash-lite | gemini-3.5-flash-lite | 0.30 / 2.50 |

Anthropic and OpenAI were checked on 2026-10-18 against their CLI and pricing tables. Google's API prices were checked on that date, and Antigravity slugs were checked with `agy models` on 2026-10-19. A full id also works in a spec (`openai/gpt-6-luna`), and an id the table does not list runs with its price unknown.

## Defaults

`desk-run doctor` and `/desk:init` pick the defaults from what is on the machine: Anthropic for every tier when `claude` is signed in, otherwise the strongest provider found for director and senior and the cheapest for builder. With no CLI and no key the runner cannot run a job, and the host agent plays every desk itself with the briefs as instructions, one model, no tiering, and the handback note says so.

## Presets

`studio` is opus, sonnet, haiku. `best` is fable, opus, sonnet. `thrifty` is sonnet, haiku, haiku. Presets are Anthropic only. Mixing providers is done with `--models` or in `project.json`, where the `presets` map can be edited to anything.
