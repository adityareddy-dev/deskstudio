# Handback

The last message of a job. Ten lines at most, plain words, the user reads it on a phone.

```
Done: <deliverable> for <ask in five words>, <n> files in .desk/out/<id>/
  final.html, renders at linkedin and ig-post in .desk/jobs/<id>/renders/round-3/
Desks: UI Designer x3 roughs (sonnet), Art Director pick (opus), UI Designer polish x2 (haiku), Creative Director sign-off (opus)
Pick: rough 2, editorial split, "the stat carries it, the other two centred the headline"
Scores: hierarchy 9, typography 9, spacing 8, colour 9, composition 9, originality 8, brand 9, copy 9, average 8.75, pass
Rounds: 3 of 8. Proof: passed on round 2 after one contrast fix.
Cost: director 0.21, senior 0.09, builder 0.02, total 0.32 (list prices, from the CLI)
Open: none
```

If the cap was reached, the `Scores` line says `under the bar` and an `Open` line says which axis and the last note, and `waitingOn` is set in state. If cost was incomplete, the `Cost` line ends with `(some runs did not report usage)`. If the user made the pick or an approval, say so on that line.

Then write a memory block so the Stop hook can save what was decided, inside the message:

```
<!-- desk:memory
decisions:
  - "Editorial split works for this brand's launch cards (2026-10-18)"
-->
```

Nothing else after the block.
