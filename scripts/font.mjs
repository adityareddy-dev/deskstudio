#!/usr/bin/env node
// Fonts the studio ships, inlined so every file renders the same everywhere.
//   node font.mjs list
//   node font.mjs css <family> [--out file.css]     prints an @font-face block with the font as a data URI
//   node font.mjs stack <family>                     prints the font-family stack to use with that block
// Families: Geist, Geist Mono, Inter, Source Serif 4. All under the SIL Open Font License, see fonts/<family>/LICENSE.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'fonts');
const FAMILIES = {
  'geist':           { name: 'Geist',          file: 'geist/Geist-Variable.woff2',               weights: '100 900', stack: '"Geist", "Inter", Arial, sans-serif' },
  'geist mono':      { name: 'Geist Mono',     file: 'geist/GeistMono-Variable.woff2',           weights: '100 900', stack: '"Geist Mono", ui-monospace, Menlo, Consolas, monospace' },
  'inter':           { name: 'Inter',          file: 'inter/Inter-Variable.woff2',               weights: '100 900', stack: '"Inter", Arial, sans-serif' },
  'source serif 4':  { name: 'Source Serif 4', file: 'source-serif-4/SourceSerif4-Variable.woff2', weights: '200 900', stack: '"Source Serif 4", Georgia, "Times New Roman", serif' },
};
const aliases = { 'source serif': 'source serif 4', 'sourceserif4': 'source serif 4', 'geistsans': 'geist', 'geist sans': 'geist' };

const [cmd, ...rest] = process.argv.slice(2);
const key = s => String(s || '').toLowerCase().replace(/["']/g, '').trim();
const find = s => { const k = key(s); return FAMILIES[k] || FAMILIES[aliases[k]] || null; };

if (cmd === 'list') {
  for (const f of Object.values(FAMILIES)) console.log(`${f.name.padEnd(16)} ${f.weights.padEnd(8)} ${existsSync(join(root, f.file)) ? 'ready' : 'missing'}  ${f.file}`);
  process.exit(0);
}
if (cmd !== 'css' && cmd !== 'stack') { console.error('usage: font.mjs list | css <family> [--out file] | stack <family>'); process.exit(2); }
const fam = find(rest[0]);
if (!fam) { console.error(`No bundled font named "${rest[0]}". Bundled: ${Object.values(FAMILIES).map(f => f.name).join(', ')}. Use the closest one, or a system stack, and say so in your return.`); process.exit(1); }
if (cmd === 'stack') { console.log(fam.stack); process.exit(0); }
const path = join(root, fam.file);
if (!existsSync(path)) { console.error(`font file missing: ${path}`); process.exit(1); }
const data = readFileSync(path).toString('base64');
const css = `@font-face { font-family: "${fam.name}"; font-style: normal; font-weight: ${fam.weights}; font-display: block; src: url("data:font/woff2;base64,${data}") format("woff2"); }\n`;
const outIdx = rest.indexOf('--out');
if (outIdx >= 0) { writeFileSync(rest[outIdx + 1], css); console.log(`wrote ${rest[outIdx + 1]} (${Math.round(css.length / 1024)} KB), font-family: ${fam.stack}`); }
else process.stdout.write(css);
