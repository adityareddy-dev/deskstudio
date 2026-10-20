# Brand from the project

Run this when `.desk/DESIGN.md` is missing. Find the brand before asking for it. Ask the user only for what the project does not already say.

## 1. Look

In the project root and `src/`, `app/`, `styles/`, `public/`, read what exists:

- CSS custom properties in any `.css`, `.scss`, `globals.css`, `tokens.css`: colours, font families, spacing, radii.
- `tailwind.config.*`: `theme.extend.colors`, `fontFamily`, `spacing`, `borderRadius`.
- An existing `DESIGN.md`, `BRAND.md`, `brand/`, `design-tokens.json`, a Style Dictionary or DTCG tokens file.
- A logo: `logo.svg`, `logo*.png`, `favicon.svg`, `public/*.svg`.
- `package.json` name and description, the README's first paragraph, for the voice.
- An existing site in `index.html` or the app's layout: the fonts it loads, the colours in its header.

## 2. Decide

From what you found, pick:

- **Palette.** A background, a foreground, one accent, and up to three supporting colours. Name each by its job.
- **Type.** The typeface the project loads, or if none, pick one from the house style defaults: Inter for product, Geist for developer tools, Source Serif for editorial, and say so.
- **Spacing.** The grid unit (8px unless the project uses 4px), the radii in use.
- **Voice.** Three adjectives and a one-line example from the README.
- **Logo.** The path, and its clear space (half its height on every side).

If the project gives you nothing, ask the user one question: "One colour for the brand, or a site to pull it from?" Then build the palette from that colour: the colour as accent, a near-black and a near-white tinted toward it for background and foreground, two tints for support.

## 3. Write `.desk/DESIGN.md`

```md
---
name: <project name>
colors:
  background: "#0b0b0c"
  foreground: "#f4f4f5"
  accent: "#0f62fe"
  muted: "#8a8a93"
  surface: "#141416"
type:
  family: "Inter"
  headingWeight: 600
  bodyWeight: 400
  base: 16
  ratio: 1.25
spacing:
  unit: 8
  radius: 8
logo:
  path: "public/logo.svg"
  clearSpace: "0.5x height"
sources:
  - "src/styles/globals.css (custom properties)"
  - "tailwind.config.ts (theme.extend.colors)"
---

# <Project name>

<One line on what the project does, in the project's own words.>

## Voice

<Three adjectives.> Example: "<a line from the README>."

## Do

- Use the accent once per screen, on the action or the number.

## Don't

- Put the logo on a tint of the accent.
```

Every colour in `colors` is a 6-digit hex. Proof reads this file to check palette and type, so the front matter has to be exact. Tell the user in one line what you found and where, and that they can edit `.desk/DESIGN.md` any time.
