// Shared fixtures: a brand, cards that pass proof, and the desks' return blocks.
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const BRAND = `---
name: Test
colors:
  background: "#0b0b0c"
  foreground: "#f4f4f5"
  accent: "#0f62fe"
  muted: "#8a8a93"
type:
  family: "Arial"
  headingWeight: 700
  bodyWeight: 400
  base: 16
  ratio: 1.25
spacing:
  unit: 8
  radius: 0
sources:
  - "test fixture"
---
# Test

A test brand.
`;

export const BRIEF = (sizes = 'linkedin') => `- **Deliverable.** Social card announcing a product.
- **Sizes.** ${sizes.split(',').map(s => '`' + s.trim() + '`').join(' and ')}.
- **Copy.** Verbatim:

\`\`\`
Your own design studio.
One command, free, nothing leaves your machine.
deskstudio.ai
\`\`\`

- **Brand.** .desk/DESIGN.md: dark background, Inter, one blue accent.
- **Must be true.** No network, one artboard.
- **Scope.** quick.
`;

// A card that passes every proof check at linkedin and ig-post with the brand above.
export const CARD = (extra = '', marker = 'rough') => `<!doctype html><html><head><meta charset="utf-8"><title>card</title><style>
html,body{margin:0;background:#0b0b0c;color:#f4f4f5;font-family:Arial,sans-serif}
main{width:100vw;height:100vh;box-sizing:border-box;padding:8vw;display:flex;flex-direction:column;justify-content:center;gap:24px;position:relative}
h1{font-size:62.5px;line-height:1.05;margin:0;font-weight:700;max-width:70%;letter-spacing:-0.01em}
p{font-size:25px;margin:0;line-height:1.35;max-width:70%}
.mark{position:absolute;left:8vw;bottom:12vh;font-size:25px;color:#0f62fe;font-weight:700}
${extra}</style></head><body><main data-artboard><h1>Your own design studio.</h1><p>One command, free, nothing leaves your machine.</p><span class="mark">deskstudio.ai</span></main></body></html>
<!-- ${marker} -->`;

export const roughReply = (n, pattern) => `Here is the rough.\n\n\`\`\`html\n${CARD('', `rough ${n}`)}\n\`\`\`\n\nfile: rough-${n}.html\npattern: ${pattern}\nfonts: Inter, fallback Arial\nproof: not run\n`;

export const polishReply = (extra = '', marker = 'polish') => `\`\`\`html\n${CARD(extra, marker)}\n\`\`\`\nfile: final.html\napplied: 1, 2\nfonts: Inter, fallback Arial\nproof: not run\n`;

export const PICK = `pick: 2
reason: the stat reads first and it uses the whole width
lost: 1 headline and mark fight for first, 3 centred everything
notes:
1. Headline from 56px to 68px, line height 1.0.
2. Mark to bottom left, 24px from both edges.
`;

export const SCORES_PASS = `scores: hierarchy 9, typography 9, spacing 8, colour 9, composition 9, originality 8, brand 9, copy 9
average: 8.75
pass: yes
notes:
- spacing: tighten the gap between headline and subhead to 16px
polish:
- the mark could sit 8px higher
`;

export const SCORES_FAIL = (axis = 'hierarchy', n = 7) => {
  const axes = { hierarchy: 9, typography: 9, spacing: 8, colour: 9, composition: 9, originality: 8, brand: 9, copy: 9 };
  axes[axis] = n;
  const avg = Math.round((Object.values(axes).reduce((s, v) => s + v, 0) / 8) * 100) / 100;
  return `scores: ${Object.entries(axes).map(([k, v]) => `${k} ${v}`).join(', ')}
average: ${avg}
pass: no
notes:
- ${axis}: headline up 24px, subhead down to 24px
`;
};

export const PEN = `took the pen: yes
changed: headline to 72px, mark moved to the corner
notes for the builder:
1. keep the mark where it is
\n\`\`\`html\n${CARD('', 'pen')}\n\`\`\`
`;

// A temp project with .desk/DESIGN.md (unless withBrand is false).
export function tempProject({ withBrand = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'desk-run-test-'));
  mkdirSync(join(dir, '.desk'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fixture', private: true }));
  if (withBrand) writeFileSync(join(dir, '.desk', 'DESIGN.md'), BRAND);
  return dir;
}
