# Type, Desk Studio

## Family

Inter, variable, the same face as the site film. Geist Mono for commands, job ids and file paths only.

| Use | Weight |
|---|---|
| Wordmark, big figures (score, cost, time) | 800 |
| Headings, room signs | 700 |
| Desk names, labels, buttons, chips | 650 |
| Body | 400 |

Figures are tabular everywhere they sit in a row: `font-variant-numeric: tabular-nums`.

## Fallback stack

```css
font-family: "Inter", "Inter Fallback", ui-sans-serif, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

@font-face {
  font-family: "Inter Fallback";
  src: local("Arial");
  size-adjust: 107.4%;
  ascent-override: 90.2%;
  descent-override: 22.5%;
  line-gap-override: 0%;
}
```

## Scale

| Step | Size px | Line height | Weight | Tracking |
|---|---|---|---|---|
| display | 76 | 1.02 | 800 | -0.035em |
| headline | 48 | 1.08 | 800 | -0.03em |
| title | 30 | 1.15 | 700 | -0.02em |
| stat figure | 24 | 1.1 | 800 | -0.02em |
| lead | 20 | 1.45 | 400 | 0 |
| body | 16 | 1.5 | 400 | 0 |
| small | 13 | 1.45 | 400 | 0 |
| label | 11 | 1.2 | 650, caps | +0.07em |
| desk name | 10.5 to 12.5 | 1.15 | 650 | -0.01em |

Nothing under 10.5px. Body measure 60 to 70 characters.

## Wordmark

"Desk Studio" in Inter 800, tracking -0.03em, outlined in `wordmark.svg` and the lockups by `logo/build.py`. Never uppercase.
