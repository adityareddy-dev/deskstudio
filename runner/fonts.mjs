// Brand fonts in runner mode. Builders here have no tools, so they cannot run scripts/font.mjs themselves.
// The runner does it once per job: it asks font.mjs for the @font-face block of the brand family, keeps it
// out of the builder's prompt (it is a 60 to 140 KB data URI) and splices it into every file the builder returns,
// between markers, so the file stays self-contained and proof sees the real face. When the brand names a family
// the studio does not ship, the closest bundled family stands in for it, as procedures/fonts.md asks.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSync } from './providers/exec.mjs';
import { bundledFamily, isSystemFamily, substituteFor } from '../fonts/families.mjs';

export const FONT_START = '/* desk:font start */';
export const FONT_END = '/* desk:font end */';

function familyLine(brandText) {
  const m = /^\s*family:\s*(.+)$/m.exec(brandText);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

export function brandFamily(brandText) {
  return familyLine(brandText).split(',')[0].trim().replace(/^["']|["']$/g, '') || null;
}

// { family, brandFamily, substituted, css, stack } when font.mjs exists and bundles the brand family or a stand-in
// for it. Null for a system family (Arial, Georgia, a generic keyword), which proof accepts as it is.
export function loadBrandFont(root, brandText, outDir) {
  const script = join(root, 'scripts', 'font.mjs');
  const brand = brandFamily(brandText);
  if (!brand || !existsSync(script) || isSystemFamily(brand)) return null;
  const family = bundledFamily(brand) ? brand : substituteFor(brand, familyLine(brandText)).name;
  // font.mjs knows its own aliases, so ask it for the block and take a non-zero exit as "not bundled".
  const cssFile = join(outDir, `fonts-${family.toLowerCase().replace(/\s+/g, '-')}.css`);
  const made = runSync(process.execPath, [script, 'css', family, '--out', cssFile], { timeoutMs: 60000 });
  if (made.code !== 0 || !existsSync(cssFile)) return null;
  const stackRun = runSync(process.execPath, [script, 'stack', family], { timeoutMs: 20000 });
  const stack = stackRun.code === 0 && stackRun.stdout.trim() ? stackRun.stdout.trim().split(/\r?\n/)[0] : `"${family}", Arial, sans-serif`;
  return { family, brandFamily: brand, substituted: family !== brand, css: readFileSync(cssFile, 'utf8'), stack, cssFile };
}

// Removes the runner's font block so a builder prompt stays small.
export function stripFont(html) {
  let s = html.indexOf(FONT_START);
  const e = html.indexOf(FONT_END);
  if (s < 0 || e < s) return html;
  if (html[s - 1] === '\n') s -= 1; // the newline inject added before the block
  return html.slice(0, s) + html.slice(e + FONT_END.length).replace(/^\n/, '');
}

// Puts the block at the top of the first <style>, or adds a <style> in <head>. Idempotent.
export function injectFont(html, font) {
  if (!font?.css) return html;
  const clean = stripFont(html);
  const block = `${FONT_START}\n${font.css.trim()}\n${FONT_END}\n`;
  const style = /<style\b[^>]*>/i.exec(clean);
  if (style) return clean.slice(0, style.index + style[0].length) + '\n' + block + clean.slice(style.index + style[0].length);
  const head = /<head\b[^>]*>/i.exec(clean);
  if (head) return clean.slice(0, head.index + head[0].length) + `\n<style>\n${block}</style>` + clean.slice(head.index + head[0].length);
  return `<style>\n${block}</style>\n` + clean;
}
