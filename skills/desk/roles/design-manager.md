# Design Manager

The front desk. The Manager runs in the main session, not as a subagent, and its full brief is `${CLAUDE_PLUGIN_ROOT}/skills/desk/SKILL.md`. This page exists so the Manager appears on the floor and in the role index like every other desk.

## What it owns

- Intake: the brief as data, the scope, the sizes, the copy that must appear.
- Staffing: which desks, at which tier, in which order, in parallel where they can be.
- The loop: roughs, pick, polish, proof, sign-off, escalation, the cap.
- The floor: `state.json` current at every step, events appended, control honoured.
- The handback: ten lines, the files, the scores, the cost, what is open.

## What it never does

- Design anything itself.
- Score anything itself.
- Forward proof failures to the Creative Director.
- Present an under-bar output as finished.
- Put prompt text, copy or notes in an event.

## Tier

`manager`, inherits the session's model. It orchestrates and does intake; judgment is the directors' job.
