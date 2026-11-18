#!/usr/bin/env node
// Fonts the studio ships, inlined so every file renders the same everywhere.
//   node font.mjs list
//   node font.mjs css <family> [--out file.css]     prints an @font-face block with the font as a data URI
//   node font.mjs stack <family>                     prints the font-family stack to use with that block
// Families: Geist, Geist Mono, Inter, Source Serif 4. All under the SIL Open Font License, see fonts/<family>/LICENSE.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILIES, bundledFamily as find, substituteFor } from '../fonts/families.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'fonts');
const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'list') {
  for (const f of Object.values(FAMILIES)) console.log(`${f.name.padEnd(16)} ${f.weights.padEnd(8)} ${existsSync(join(root, f.file)) ? 'ready' : 'missing'}  ${f.file}`);
  process.exit(0);
}
if (cmd !== 'css' && cmd !== 'stack') { console.error('usage: font.mjs list | css <family> [--out file] | stack <family>'); process.exit(2); }
const fam = find(rest[0]);
if (!fam) { console.error(`No bundled font named "${rest[0]}". Bundled: ${Object.values(FAMILIES).map(f => f.name).join(', ')}. The closest one is ${substituteFor(rest[0]).name}: use it and say so in your return.`); process.exit(1); }
if (cmd === 'stack') { console.log(fam.stack); process.exit(0); }
const path = join(root, fam.file);
if (!existsSync(path)) { console.error(`font file missing: ${path}`); process.exit(1); }
const data = readFileSync(path).toString('base64');
const css = `@font-face { font-family: "${fam.name}"; font-style: normal; font-weight: ${fam.weights}; font-display: block; src: url("data:font/woff2;base64,${data}") format("woff2"); }\n`;
const outIdx = rest.indexOf('--out');
if (outIdx >= 0) { writeFileSync(rest[outIdx + 1], css); console.log(`wrote ${rest[outIdx + 1]} (${Math.round(css.length / 1024)} KB), font-family: ${fam.stack}`); }
else process.stdout.write(css);
