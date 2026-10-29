# Motion, Desk Studio

Motion says what the studio is doing. Every move is tied to something in the job's record: a desk starting or stopping, a phase changing, a pick, a score. Nothing moves to look busy.

## The moves

| Move | Duration | Easing | Used for |
|---|---|---|---|
| entrance | 320ms | cubic-bezier(0.16, 1, 0.3, 1) | a panel, a log line, a card arriving |
| pop | 360ms | cubic-bezier(0.34, 1.56, 0.64, 1) | a speech bubble, a toast, a bot's hop |
| move | 700ms | cubic-bezier(0.65, 0, 0.35, 1) | the job ticket along the track, the cost line |
| exit | 200ms | cubic-bezier(0.7, 0, 0.84, 0) | a thing leaving |

## The bots

| State | When | What moves |
|---|---|---|
| Asleep | no agent of the desk is working | lens shut, a 4.8s breath, a small "z" now and then, dimmed in the big rooms |
| Waking | an agent of the desk starts | a 520ms hop, the lens opens in 260ms |
| Awake | while it works | a 1.1s bob, typing arms, a blink about every 4s, the pupil looking round, the laptop mark lit in the trim |
| Half awake | the job lists the desk as working but no agent is live | lens half open, no bob |

Each bot gets its own phase offset, so a room never moves in step.

## The job

- The ticket slides to the next station in 700ms with a small hop, the rail behind it fills green to blue.
- The current station pings once every 1.8s while the job runs, and stops when it is paused or closed.
- Score and cost figures count to their new value in 600ms.
- Scorecard bars fill from the left, 420ms each, 60ms apart. The pass line at 8 never moves.
- The pick ring draws once, clockwise, in 600ms, when the pick lands.
- Confetti in the six trims falls once, about 2s, when a job you are watching signs off at the bar.

## Reduced motion

Under `prefers-reduced-motion: reduce` everything shows its end state: bots are drawn awake or asleep without moving, bars are full, the ring is drawn, no confetti, no pings.

## Recording

The dashboard clips are recorded by `clips/frames.mjs` on a virtual clock, one screenshot per frame at 60 fps, so the motion in the clips is the motion in the product.
