# Type, Desk Studio

## Family

Inter, variable. One typeface, two weights: 600 for headlines, desk names and labels, 400 for body. Nothing else is bold, light or italic. Inter is the plainest face that holds at 11 to 13px on 42 small desks, so it stays out of the pattern's way.

Mono: Geist Mono 400 on the install line and the inline `desk` command only, at 16px, so they read as a command. Figures never use it. Figures stay in Inter with tabular numerals.

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

The override values are unverified and get checked in proof. The sheet shows the wordmark in the fallback too.

## Scale

Base 16px, ratio 1.25, rounded to 0.5px. Headlines are tight, body is open.

| Step | n | Size px | Line height | Weight | Tracking |
|---|---|---|---|---|---|
| display | 8 | 95.5 | 1.0 | 600 | -0.03em |
| headline | 7 | 76.5 | 1.05 | 600 | -0.025em |
| 39 | 4 | 39 | 1.1 | 600 | -0.015em |
| title | 2 | 25 | 1.2 | 600 | 0 |
| 20 | 1 | 20 | 1.45 | 400 | 0 |
| body | 0 | 16 | 1.5 | 400 | 0 |
| small | -1 | 13 | 1.4 | 400 | 0 |
| label | -1 | 13 | 1.2 | 600, caps | +0.06em |

Measure: body 60ch, never over 70ch. Headlines run two lines at most on every surface. Nothing under 13px except desk figures on the floor at 11px minimum.

## Numerals

Tabular lining on floor desks, timers, costs and scores: `font-variant-numeric: tabular-nums lining-nums`. Proportional in prose and headlines.

## Wordmark

"Desk Studio" in Inter 600, tracking -0.02em. Never uppercase, never opened past 0.

## Surfaces

| Surface | Sizes |
|---|---|
| Floor (dark UI, 42 desks) | desk name 13px / 600, figures 13px / 400 tabular |
| Hero desktop | headline 76.5px, subline 20px, install line 16px Geist Mono, open line and Read the code 16px / 400 |
| Hero phone | headline 39px, subline, install line, open line and link 16px |
| Card linkedin 1200x627 | headline 95.5px, two lines, no support line |
| Card ig-post 1080x1350 | headline 95.5px, two lines, no support line |
| Sting 1920x1080 | end line 95.5px, two lines, held 1.37s |

Hierarchy is made by size and weight only. Amber is never a text colour. Typographic quotes and dashes, plain figures for numbers.
