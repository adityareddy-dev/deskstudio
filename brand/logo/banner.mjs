#!/usr/bin/env node
// The README banner: the logo and the line on the left, a tilted wall of the studio's signed-off pieces on the right.
//   node brand/logo/banner.mjs                            brand/logo/banner.png, 1280x400 at 2x
//   node brand/logo/banner.mjs --w 1000 --h 420 --out x.png  the same design at another size (dev.to cover)
//   node brand/logo/banner.mjs --w 1128 --h 191 --cover --out x.png  no logo, the line centred (LinkedIn page cover)
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../../proof/browser.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter(Boolean));
const BW = +(args.w || 1280), BH = +(args.h || 400), k = BH / 400, COVER = !!args.cover;
const root = join(here, '..', '..');

function pickRender(dir) {
  const r = join(dir, 'renders');
  if (!existsSync(r)) return null;
  const all = [];
  const walk = (d, depth) => { for (const f of readdirSync(d, { withFileTypes: true })) { if (f.isDirectory() && depth < 3) walk(join(d, f.name), depth + 1); else if (f.isFile() && /\.png$/.test(f.name) && !/background/.test(f.name)) all.push(join(d, f.name)); } };
  walk(r, 0);
  const main = all.filter(f => !/(^|[\\/])(empty|error|loading)[\\/]/.test(f));
  const pool = main.length ? main : all;
  const prefer = [/slide-01[\\/]ig-post\.png$/, /email-600-light\.png$/, /held-00000\.png$/, /f-00000\.png$/, /[\\/]hero[\\/]desktop\.png$/, /[\\/]desktop\.png$/, /[\\/]linkedin\.png$/, /[\\/]x\.png$/, /ig-post\.png$/, /ig-square\.png$/, /\.png$/];
  for (const p of prefer) { const hit = pool.sort().find(f => p.test(f)); if (hit) return hit; }
  return null;
}
const pieces = [];
for (const deliverable of readdirSync(join(root, 'evals', 'golden')).sort())
  for (const n of readdirSync(join(root, 'evals', 'golden', deliverable)).sort()) {
    const dir = join(root, 'evals', 'golden', deliverable, n);
    const image = existsSync(join(dir, 'golden.json')) && pickRender(dir);
    if (image) pieces.push(pathToFileURL(image).href);
  }
const mixed = [];
for (let i = 0; pieces.length; i = (i + 7) % pieces.length) mixed.push(pieces.splice(i, 1)[0]);
const rows = [0, 1, 2, 3].map(r => [...mixed.slice(r * 5), ...mixed.slice(0, r * 5)].slice(0, 7));

const font = f => pathToFileURL(join(root, 'fonts', f)).href;
const logo = readFileSync(join(here, 'logo.svg'), 'utf8').replace(/^<svg[^>]*>/, '<svg viewBox="0 0 512 512" class="logo">');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 100 900; src: url("${font('inter/Inter-Variable.woff2')}") format("woff2"); }
@font-face { font-family: "Geist Mono"; font-weight: 100 900; src: url("${font('geist/GeistMono-Variable.woff2')}") format("woff2"); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${BW}px; height: ${BH}px; overflow: hidden; background: #12110f; font-family: Inter, sans-serif; color: #f4f0e8; }
.wall { position: absolute; left: ${COVER ? -60 : Math.round(BW * 0.37)}px; top: ${Math.round(-150 * k)}px; transform: rotate(-9deg); display: grid; gap: 14px; }
.row { display: flex; gap: 14px; }
.row:nth-child(even) { margin-left: -90px; }
.row img { height: ${Math.round(128 * k)}px; border-radius: 6px; border: 1px solid #3b3830; display: block; }
.fade { position: absolute; inset: 0; background: ${COVER ? 'rgba(18,17,15,.78)' : 'linear-gradient(90deg, #12110f 0%, #12110f 36%, rgba(18,17,15,.86) 52%, rgba(18,17,15,.2) 78%, rgba(18,17,15,.35) 100%)'}; }
.copy { position: absolute; ${COVER ? 'left: 0; right: 0; text-align: center;' : 'left: ' + Math.round(64 * k) + 'px;'} top: 50%; transform: translateY(-50%); }
.top { display: flex; align-items: center; gap: 22px; }
.logo { width: ${Math.round(92 * k)}px; height: ${Math.round(92 * k)}px; }
h1 { font-weight: 650; font-size: ${Math.round(64 * k)}px; letter-spacing: -0.03em; }
p { margin-top: ${COVER ? 0 : Math.round(22 * k)}px; font-weight: 550; font-size: ${COVER ? Math.round(BH * 0.2) : Math.round(30 * k)}px; letter-spacing: -0.01em; }
.url { margin-top: ${Math.round(14 * k)}px; font: 400 ${COVER ? Math.round(BH * 0.1) : Math.round(20 * k)}px "Geist Mono", monospace; color: #ffaa1c; }
</style></head><body>
<div class="wall">${rows.map(r => `<div class="row">${r.map(src => `<img src="${src}" alt="">`).join('')}</div>`).join('')}</div>
<div class="fade"></div>
<div class="copy">${COVER ? '' : `<div class="top">${logo}<h1>Desk Studio</h1></div>`}<p>Your own design studio. At your desk.</p><div class="url">deskstudio.ai</div></div>
</body></html>`;

const work = mkdtempSync(join(tmpdir(), 'banner-'));
const page_ = join(work, 'index.html');
writeFileSync(page_, html);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: BW, height: BH }, deviceScaleFactor: 2 })).newPage();
await page.goto(pathToFileURL(page_).href, { waitUntil: 'load' });
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
const outFile = args.out || join(here, 'banner.png');
await page.screenshot({ path: outFile });
await browser.close();
rmSync(work, { recursive: true, force: true });
console.log(outFile);
