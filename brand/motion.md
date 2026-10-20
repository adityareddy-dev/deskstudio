# Motion, Desk Studio

Source of truth is the `motion:` block in DESIGN.md. The table copies it. Where this file and DESIGN.md differ, DESIGN.md wins.

## The four moves

| Move | Duration | Easing | Used for |
|---|---|---|---|
| entrance | 300ms | cubic-bezier(0.16, 1, 0.3, 1) | a thing arriving: a lamp lighting, a line landing (opacity plus a 16 to 24px rise) |
| settle | 300ms | cubic-bezier(0.65, 0, 0.35, 1) | a thing moving into place (DESIGN.md calls this `move`) |
| exit | 200ms | cubic-bezier(0.7, 0, 0.84, 0) | a thing leaving |
| emphasis | 400ms | cubic-bezier(0.16, 1, 0.3, 1) | the one thing to look at: the pick ring |

Linear only for opacity under 150ms and for progress. No bounce. Stagger between items is 60 to 80ms, six items at most per group, except the scorecard's eight slabs at 60ms and the sting's 42-lamp wave at 20ms.

## The three dashboard moves

| Move | Property | Duration | Easing | Stagger |
|---|---|---|---|---|
| A lamp lights | lamp disc `background-color` from muted `#9a948a` to amber `#ffaa1c`. The slab holds still. Flat, no glow, no flash. | 300ms | entrance | 20ms in the sting wave, none for a single desk |
| The pick ring draws | one open amber stroke (`#ffaa1c` on dark, `#c27a00` on light), `pathLength` 1, `stroke-dasharray` 1, `stroke-dashoffset` 1 to 0. Clockwise from the top arc a third in from the left, the end running 8px past the start (12px on rings 120px and wider). Round caps and joins, no fill. It starts once the thing it circles has landed. | 400ms | emphasis | none |
| The scorecard slabs fill | eight slabs, each `transform: scaleX(0)` to `scaleX(1)` from its left edge, left to right. The pass line at 8 is drawn from the first frame and never animates. A slab under 8 stops at its value and stays muted, its figure turns danger `#ff6b5e`. | 300ms each | entrance | 60ms between slabs |
| The cost line grows | one line in three segments, director then senior then builder, in the foreground colour at 100%, 60% and 30%, measured against the next whole dollar. Each segment's `width` moves from its last value to its new one when a desk reports. No amber, no stagger. | 300ms | settle | none |

The pick ring appears fully drawn on the card, and it draws on the dashboard and on the sheet. It is not in the hero or the sting, where amber stays the lamps. One ring per screen.

The sting lights all 42 desks in reading order, 20ms apart, from 200ms (the last starts at 1020ms and is lit by 1320ms), then the end line lands with the entrance move at 1333ms and holds to 3000ms.

## Reduced motion

Under `prefers-reduced-motion: reduce` show the end state with no fill, draw or stagger. Lamps are amber from the first frame, the pick ring is already drawn on the first frame, scorecard slabs are already filled. The only movement left is a 150ms linear crossfade on text that would have landed. No loops, no autoplay.
