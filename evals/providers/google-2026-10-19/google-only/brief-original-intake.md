<!-- ask: A Northlight battery announcement social -->
## Deliverable
Social card (`social-card`): a single still announcement image for Northlight built as one self-contained responsive HTML file (`final.html` with one `<main data-artboard>`) adapting cleanly across both target aspect ratios.

## Sizes
`linkedin` (1200x627, 6% safe zone on all sides: at least 72px left/right and 38px top/bottom) and `ig-post` (1080x1350, 6% safe zone on sides and top: at least 65px left/right and 81px top; 10% safe zone on bottom: at least 135px bottom).

## Copy
```text
Seven years to break even.
Then free.
Battery now included.
northlight.energy
```

## Brand
`.desk/DESIGN.md` (Northlight).
1. Palette: warm paper background (`#f7f5f0`), deep charcoal foreground (`#161614`), muted warm grey (`#6b6a66`), warm surface (`#ebe8e0`), and one orange accent (`#d9480f`) reserved strictly for the payoff.
2. Typography & alignment: left-aligned composition with generous margins, `Inter, Arial, sans-serif` in weights `600` (heading) and `400` (body), using at most three type sizes across the artboard.
3. Voice & restraint: warm, plain, numerate; lead with the seven-year interval structure and use zero sky gradients, sun icons, leaves, or secondary accents.

## Fonts
`Inter` (`Inter, Arial, sans-serif`), which is bundled; inline weights `400` and `600` as `@font-face` data URIs per `/workspace/deskstudio/skills/desk/procedures/fonts.md`. Use at most three type sizes (headline at least 44px on `linkedin` and 65px on `ig-post` with line-height `1.0`–`1.1` and tracking `-0.02em` to `-0.01em`; supporting line; and brand mark at least 24px).

## Must be true
- Render the exact four copy lines verbatim as real DOM text and add zero extra copy (no numbers, captions, or tick labels on the markers).
- Build the seven-year interval as the distinctive typographic structure: seven measured vertical markers (`#161614` / `#6b6a66`) becoming one orange (`#d9480f`) payoff marker, with `Seven years to break even.` aligned to the seven-marker span and `Then free.` aligned to the orange payoff.
- Use no icons, gradients, stock images, drop shadows, or borders around cards/artboards; keep all elements comfortably inside platform safe zones and avoid any empty vertical band taller than a third of the canvas on `ig-post`.

## Scope
quick — one asset, brand exists in `.desk/DESIGN.md`, and exact copy is provided.
