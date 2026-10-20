// The caption pass: one line burned into a clip, in the safe zone, on a scrim, in the brand's type.
// Rendered once in Chrome as a transparent PNG at the clip's size, then laid over every frame by ffmpeg,
// so the poster and the clip carry the same line and the first frame reads as a still.
//   captionPng({ text, width, height, scheme, out })  ->  path of the PNG, or null when text is empty
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch } from '../proof/browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = { dark: { bg: '18, 17, 15', text: '#f4f0e8' }, light: { bg: '255, 255, 255', text: '#17140f' } };
let fontCss = null;
const inter = () => fontCss ??= spawnSync(process.execPath, [join(root, 'scripts', 'font.mjs'), 'css', 'Inter'], { encoding: 'utf8' }).stdout || '';

// The caption standard: in the safe zone (5% of the short side), type at least 5% of the frame height, line height 1.3,
// at most two lines, on a scrim of the background colour (96%, so the page under it does not read through).
// `left` lines the caption up with the page's text column when the clip is wider than the page.
export function captionHtml({ text, width, height, scheme = 'dark', left = null }) {
  const b = BRAND[scheme] || BRAND.dark;
  const safe = Math.round(Math.min(width, height) * 0.05);
  const x = left ?? safe;
  const size = Math.round(Math.max(height * 0.05, 40) / 2) * 2;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${inter()}
html,body{margin:0;width:${width}px;height:${height}px;background:transparent;overflow:hidden}
.cap{position:absolute;left:${x}px;bottom:${safe}px;max-width:${width - x - safe}px;padding:${Math.round(size * 0.35)}px ${Math.round(size * 0.5)}px;
background:rgba(${b.bg}, 0.96);color:${b.text};font:600 ${size}px/1.3 "Inter", Arial, sans-serif;letter-spacing:-0.01em;
display:inline-block;box-sizing:border-box}
</style></head><body><div class="cap">${esc(text)}</div></body></html>`;
}

export async function captionPng({ text, width, height, scheme = 'dark', left = null, out }) {
  if (!text) return null;
  mkdirSync(dirname(out), { recursive: true });
  const html = join(dirname(out), 'caption.html');
  writeFileSync(html, captionHtml({ text, width, height, scheme, left }));
  const browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('file:///' + html.replace(/\\/g, '/'), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: out, omitBackground: true });
    await context.close();
  } finally { await browser.close(); }
  return existsSync(out) ? out : null;
}

// ffmpeg filter arguments that lay the caption over the first input.
export const overlayArgs = png => ['-i', png, '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto'];
