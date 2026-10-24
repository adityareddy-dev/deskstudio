# The team, cost and models

## The team

42 desks, the Design Manager and 41 that run as subagents. Each is a written brief: what it owns, how it decides, its checklist and what it hands to the next desk. Full index in [docs/roles.md](roles.md).

**Directors** (the pick, the notes, the sign-off, default `anthropic/opus`): Creative Director, Art Director, Brand Strategist.

**Seniors** (the roughs, research, type, tokens, copy, default `anthropic/sonnet`): Typographer, Design System Lead, Accessibility Specialist, Copy Editor, UX Researcher, Product Designer, UX Designer, Interaction Designer, Presentation Designer, Dashboard Architect, Landing Page Designer, Social Media Strategist, Growth/Analytics Specialist, Compliance Designer, Conversational Designer, Spatial Designer, AI Prompt Engineer.

**Builders** (every polish round, the making, default `anthropic/haiku`): UI Designer, Social Media Designer, Social Media Copywriter, Email Designer, Email Copywriter, Motion Designer, Illustration Director, Icon Designer, Image Editor, Data Viz Designer, Design Engineer, Framework Specialist, Editorial Designer, Print Designer, Storyboard Artist, Video Editor, Video/Content Producer, Content Designer, AI Image Director, AI Video Director, AI Audio & Voice Producer.

The Design Manager runs in your session on whatever model you run.

## What it costs

Cheap models make, strong models judge. Roughs come from the senior roles, every polish round from the builder roles, and the pick, the notes and the sign-off from the director roles.

| Tier | Default | Does |
| --- | --- | --- |
| director | `anthropic/opus` | the pick, the notes, the sign-off |
| senior | `anthropic/sonnet` | the roughs, research, type, tokens, copy |
| builder | `anthropic/haiku` | every polish round, the making |

The launch card in the README animation: $1.34 at list price. Director $0.81, senior $0.43, builder $0.10. 61% went to judgment, 39% to making, over 10 desk runs. How the dashboard counts it is in [docs/cost.md](cost.md).

![cost-meter](../site/media/cost-meter.gif)

## Models per role

The runner reaches each provider through the CLI you already have signed in, on the plan you already pay for. API keys are the fallback. One provider is fine, and tiers can mix. Jobs have completed through the Anthropic, OpenAI and Google CLIs. Google uses Antigravity CLI. Set once in `.desk/project.json`, or from the dashboard for one job:

```json
"models": {
  "director": "anthropic/opus",
  "senior": "anthropic/sonnet",
  "builder": "openai/nano"
}
```

| Provider | CLI | Roles |
| --- | --- | --- |
| Anthropic | `claude` | director `opus`, senior `sonnet`, builder `haiku` |
| OpenAI | `codex` | director `large`, senior `mini`, builder `nano` |
| Google | `agy` | director `flash-high`, senior `flash`, builder `flash-low` |

`desk-run doctor` says which CLIs and keys are on the machine and what the defaults would be. Details in [docs/providers.md](providers.md) and [docs/runner.md](runner.md).

