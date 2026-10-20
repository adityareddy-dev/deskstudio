# Fonts

Every file the studio makes has to render the same on any machine and in headless Chrome, with no network. So fonts are inlined as data URIs, never linked, and never assumed to be installed.

The plugin ships four families under the SIL Open Font License, as variable fonts: Geist, Geist Mono, Inter, Source Serif 4.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/font.mjs" list
node "${CLAUDE_PLUGIN_ROOT}/scripts/font.mjs" css "Geist" --out <out>/fonts-geist.css   # one @font-face block, about 60 to 140 KB
node "${CLAUDE_PLUGIN_ROOT}/scripts/font.mjs" stack "Geist"                             # the font-family stack to write in the CSS
```

**Builders.** When the brand file's `type.family` names a bundled family (or starts with one, as in `Geist, Inter, Arial, sans-serif`), run `font.mjs css` once into the out folder and paste the block at the top of the file's `<style>`, then use the stack. One block per family used, two families at most. Say in your return which family was inlined.

When the brand names a family that is not bundled, use the closest bundled one by structure (a grotesque for a grotesque, a serif for a serif), say so in your return with the name, and the handback tells the user the brand font was substituted. Never leave a brand font to fall back to Arial or Times silently.

**Emails** are the exception: email clients ignore data-URI fonts, so the Email Designer writes a metric-close system stack and designs for the fallback.

**Size.** A card with one family inlined is about 150 KB of HTML. That is fine. A page that inlines two families is about 300 KB; the Design Engineer swaps data URIs for preloaded files when the page ships into a codebase.

**Init.** When `/desk:init` writes `DESIGN.md` and the project has no font, it picks a bundled one and says so: Inter for product, Geist for developer tools, Source Serif 4 for editorial.
