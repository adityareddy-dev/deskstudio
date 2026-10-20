# Phase 1b summary

What the 1.0.0 commands produce at the default tiers (director opus, senior sonnet, builder haiku) on four made-up brands (Northlight, Quill, Ferro and Harbor), Adi's own site, and the studio's own brand. Every row is a real run; the gallery is `evals/golden/`, listed by `node evals/golden.mjs list`. The floor-steered job includes the user's pick, seat change and note. Costs are list price for the whole job. Written 2026-10-19.

## Goldens at the studio tier

| Deliverable | Golden | Average | Cost |
| --- | --- | --- | --- |
| brand-kit | harbor | 8.6 | $10.16 |
| carousel | quill-drafts-beat-versions | 8.9 | $2.11 |
| chart | northlight-payback-by-state | 8.6 | $0.84 |
| dashboard | northlight-install-ops | 8.5 | $6.21 |
| email | ferro-welcome | 8.8 | $1.42 |
| landing-page | quill-drafts | 8.5 | $2.12 |
| motion-clip | quill-launch-sting | 9.0 | $3.33 |
| social-card | ferro-spec-reveal | 8.8 | $0.80 |
| social-card | northlight-battery-launch | 8.6 | $0.97 |
| social-card | northlight-battery-post | 8.6 | $0.65 |
| social-card | quill-drafts-launch | 8.9 | $0.97 |
| video | ferro-spec-reveal | 8.5 | $2.29 |
| deck | northlight-pitch | 8.5 | $7.93 |
| social-card | real-brand-site (Adi's own site, brand found in the project) | 8.5 | $1.23 |
| social-card | desk-studio-launch (the studio's own) | 8.9 | $1.34 |
| social-card | desk-studio-floor (steered from the floor) | 8.5 | $2.39 |
| brand-kit | desk-studio (the studio's own) | 8.6 | $11.60 |

Seventeen goldens across ten deliverable types, all at or above the bar (every axis 8 or above, average 8.5 or above). The three studio-made rows are the studio's own launch card, a card from a job steered from the floor, and its own brand kit.

The report commands (design-review, design-critique, accessibility-audit, design-qa, variants, design-system) produced usable reports on the same brands; they are not scored.

## The tiers side by side, the northlight card

| Tier | Seats | Average | Rounds | Cost | Result |
| --- | --- | --- | --- | --- | --- |
| studio | opus, sonnet, haiku | 8.6 | 2 | $0.97 | at the bar |
| thrifty | sonnet, haiku, haiku | 8.1 | 3 | $0.35 | under the bar after 3 rounds (run of 2026-10-18 21:25 CDT) |
| best | fable, opus, sonnet | 8.9 | 1 | $4.03 | at the bar, one round (run of 2026-10-19 02:50 CDT) |

## The deck

`presentation-pitch-northlight` passed at 8.6 in five rounds on 2026-10-18 before the runner kept files, and was rerun on 2026-10-19: 8.5 in four rounds, $7.93 at list price, now golden. The Harbor brand kit's pick was answered by the eval case (`then`), not made by the Art Director.

## What changed because of the evals

In the git log (`git log --oneline`): narrow-column landing pages centred, desks save files before reporting done, directors' maxTurns raised to read every render, a waiting job continues on an answer instead of starting a new job, per-slide rendering for carousels and decks with a series check, frame-accurate clip export, the dashboard command sending state renders only when changed (dashboard jobs were the costliest at $6.21), an empty band over a third of a portrait card treated as a composition fault, the brand font required to be loaded or the proof fails.

## Provider verification

The earlier mixed-provider OpenAI attempt failed at polish with a 401. Now a fresh ChatGPT sign-in and [two real OpenAI-only jobs](providers/openai-2026-10-19/README.md) establish the Codex CLI path. The mini-builder job passed proof at both sizes and sign-off at 8.75 in two polish rounds. The nano-builder job was correctly returned under the bar for originality at its six-round cap. These provider runs are separate from the default studio-tier golden table above.

The Google path previously had no completed job. On 2026-10-19 to 20, [Antigravity verification](providers/google-2026-10-19/README.md) completed a steered Google-only job at 8.75 in three polish rounds and a mixed OpenAI/Google job at 8.75 in two, both with proof passing at both sizes. These provider checks are separate from the 17 default studio-tier goldens. Individual-account Gemini CLI access was retired, so the Google adapter now uses Antigravity CLI. The original PC's earlier unsigned Gemini installation remains historical, and API-key paths remain unverified.
