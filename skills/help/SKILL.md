---
name: help
description: What Desk Studio is and how to use it. The commands, the desks, the loop, the tiers, where files go.
---

Tell the user, in plain words and under 25 lines:

- Desk Studio is a design studio inside this coding agent. You ask for a thing, the Design Manager staffs desks, three roughs are made, the Art Director picks one and writes notes, a builder polishes, proof checks the pixels, the Creative Director scores it against an eight-axis rubric, and it comes back when it clears the bar.
- Commands in this build: `/desk:init` (set up the brand and models), `/desk:design <ask>` (anything), `/desk:help`.
- Desks in this build: Creative Director, Art Director, UI Designer. The full studio has 42.
- Tiers: director (opus), senior (sonnet), builder (haiku) by default. Change them in `.desk/project.json` or with `--quality best|thrifty|studio`.
- Where things go: `.desk/DESIGN.md` is the brand, `.desk/out/<job>/` the files, `.desk/jobs/<job>/` the renders, state and scores.
- Nothing leaves the machine except the model calls the agent already makes.

Then show one example: `/desk:design a LinkedIn card announcing our v2 launch`.
