// The families the studio ships, and which one stands in for a brand font it does not ship.
// scripts/font.mjs, proof and the runner all read this file, so they agree on what "bundled" means.
// Every family is under the SIL Open Font License, see fonts/<family>/LICENSE.

export const FAMILIES = {
  'geist':           { name: 'Geist',          file: 'geist/Geist-Variable.woff2',               weights: '100 900', stack: '"Geist", "Inter", Arial, sans-serif' },
  'geist mono':      { name: 'Geist Mono',     file: 'geist/GeistMono-Variable.woff2',           weights: '100 900', stack: '"Geist Mono", ui-monospace, Menlo, Consolas, monospace' },
  'inter':           { name: 'Inter',          file: 'inter/Inter-Variable.woff2',               weights: '100 900', stack: '"Inter", Arial, sans-serif' },
  'source serif 4':  { name: 'Source Serif 4', file: 'source-serif-4/SourceSerif4-Variable.woff2', weights: '200 900', stack: '"Source Serif 4", Georgia, "Times New Roman", serif' },
};
const ALIASES = { 'source serif': 'source serif 4', 'sourceserif4': 'source serif 4', 'geistsans': 'geist', 'geist sans': 'geist' };

// Families proof accepts without a file: generic keywords and the system fonts every machine has.
const SYSTEM = ['sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'arial', 'helvetica', 'georgia', 'times new roman'];

const key = s => String(s || '').toLowerCase().replace(/["']/g, '').trim();

export function bundledFamily(name) {
  const k = key(name);
  return FAMILIES[k] || FAMILIES[ALIASES[k]] || null;
}

export function isSystemFamily(name) {
  return SYSTEM.includes(key(name));
}

const SERIF_NAMES = /\b(serif|garamond|georgia|times|baskerville|caslon|playfair|merriweather|lora|fraunces|newsreader|crimson|bodoni|didot|minion|charter|spectral|literata|tiempos|cormorant)\b/i;

// The closest bundled family by structure, as procedures/fonts.md asks: a bundled family already named in
// the stack first, then a mono for a mono, a serif for a serif, and Inter for every sans.
// `stack` is the brand's whole type.family value, for example: "Instrument Sans", Helvetica, sans-serif.
export function substituteFor(family, stack = '') {
  const names = String(stack || family).split(',').map(key).filter(Boolean);
  for (const n of names) { const f = bundledFamily(n); if (f) return f; }
  const generic = names.find(n => ['sans-serif', 'serif', 'monospace', 'ui-monospace', 'ui-serif', 'ui-sans-serif'].includes(n)) || '';
  if (/\b(mono|code|courier|consolas|menlo)\b/i.test(family) || generic.endsWith('monospace')) return FAMILIES['geist mono'];
  if (/\bsans\b/i.test(family) || generic.endsWith('sans-serif')) return FAMILIES.inter;
  if (SERIF_NAMES.test(family) || generic.endsWith('serif')) return FAMILIES['source serif 4'];
  return FAMILIES.inter;
}
