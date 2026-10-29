#!/usr/bin/env node
// The README banner: the logo and the line on the left, a tilted wall of the studio's signed-off pieces on the right,
// and a row of studio bots at their desks in front of it, one per tier.
//   node brand/logo/banner.mjs                                  brand/logo/banner.png, 1280x400 at 2x
//   node brand/logo/banner.mjs --w 1000 --h 420 --out x.png     the same design at another size (dev.to cover)
//   node brand/logo/banner.mjs --w 1128 --h 191 --cover --out x.png   no logo, the line centred (LinkedIn page cover)
//   node brand/logo/banner.mjs --og --out site/media/og.png     the site's share image, 1200x630 at 1x
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter(Boolean));
const OG = !!args.og;
const BW = OG ? 1200 : +(args.w || 1280), BH = OG ? 630 : +(args.h || 400), k = BH / 400, COVER = !!args.cover;
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
    // The studio's own early pieces carry the retired lamp mark, so the wall leaves them out.
    const image = !/^desk-studio/.test(n) && existsSync(join(dir, 'golden.json')) && pickRender(dir);
    if (image) pieces.push(pathToFileURL(image).href);
  }
const mixed = [];
for (let i = 0; pieces.length; i = (i + 7) % pieces.length) mixed.push(pieces.splice(i, 1)[0]);
const rows = [0, 1, 2, 3].map(r => [...mixed.slice(r * 5), ...mixed.slice(0, r * 5)].slice(0, 7));

const url = f => pathToFileURL(join(root, f)).href;
const logo = readFileSync(join(here, 'logo.svg'), 'utf8').replace(/^<svg[^>]*>/, '<svg viewBox="0 0 512 512" class="logo">');
// The bots, from the dashboard's own drawing.
const bots = (() => { const g = {}; new Function('window', readFileSync(join(root, 'dashboard', 'public', 'bots.js'), 'utf8'))(g); return g.DeskBots; })();
const crew = [['manager', 'awake', 1], ['director', 'awake', 2], ['senior', 'awake', 3], ['builder', 'awake', 4], ['senior', 'asleep', 5]];
const botW = Math.round((OG ? 118 : COVER ? 64 : 92) * (OG ? 1 : k));
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${url('dashboard/public/bots.css')}"><style>
@font-face { font-family: Inter; font-weight: 100 900; src: url("${url('fonts/inter/Inter-Variable.woff2')}") format("woff2"); }
@font-face { font-family: "Geist Mono"; font-weight: 100 900; src: url("${url('fonts/geist/GeistMono-Variable.woff2')}") format("woff2"); }
* { margin: 0; padding: 0; box-sizing: border-box; animation: none !important; }
html, body { width: ${BW}px; height: ${BH}px; overflow: hidden; font-family: Inter, sans-serif; color: #fcf3e4;
  background: radial-gradient(${Math.round(BW * 0.7)}px ${Math.round(BH * 1.2)}px at 8% -20%, rgba(255,170,28,.22), transparent 70%), #15100b; }
.wall { position: absolute; left: ${COVER ? -60 : Math.round(BW * (OG ? 0.42 : 0.4))}px; top: ${Math.round(-150 * k)}px; transform: rotate(-9deg); display: grid; gap: 14px; opacity: .9; }
.row { display: flex; gap: 14px; }
.row:nth-child(even) { margin-left: -90px; }
.row img { height: ${Math.round(128 * k)}px; border-radius: 8px; display: block; box-shadow: 0 8px 22px rgba(0,0,0,.45); }
.fade { position: absolute; inset: 0; background: ${COVER ? 'rgba(21,16,11,.8)' : 'linear-gradient(90deg, #15100b 0%, #15100b 38%, rgba(21,16,11,.84) 54%, rgba(21,16,11,.25) 80%, rgba(21,16,11,.4) 100%)'}; }
.floor { position: absolute; left: ${COVER ? 0 : Math.round(BW * 0.44)}px; right: 0; bottom: 0; height: ${Math.round(botW * 0.62)}px; background: linear-gradient(180deg, rgba(43,32,23,0), rgba(43,32,23,.9) 40%); }
.crew { position: absolute; right: ${Math.round(BW * 0.04)}px; bottom: ${Math.round(BH * 0.04)}px; display: flex; gap: ${Math.round(botW * 0.12)}px; align-items: flex-end; }
.crew .bot-wrap { --bot-w: ${botW}px; }
.copy { position: absolute; ${COVER ? 'left: 0; right: 0; text-align: center;' : `left: ${Math.round(64 * (OG ? 1.1 : k))}px;`} top: ${OG ? '44%' : '50%'}; transform: translateY(-50%); }
.top { display: flex; align-items: center; gap: ${Math.round(20 * k)}px; }
.logo { width: ${Math.round((OG ? 96 : 88) * (OG ? 1 : k))}px; height: ${Math.round((OG ? 96 : 88) * (OG ? 1 : k))}px; }
h1 { font-weight: 800; font-size: ${Math.round((OG ? 66 : 62) * (OG ? 1 : k))}px; letter-spacing: -0.035em; }
p { margin-top: ${COVER ? 0 : Math.round((OG ? 30 : 20) * (OG ? 1 : k))}px; font-weight: 650; font-size: ${COVER ? Math.round(BH * 0.2) : Math.round((OG ? 40 : 30) * (OG ? 1 : k))}px; letter-spacing: -0.015em; max-width: ${OG ? 560 : 9999}px; line-height: 1.15; }
.url { margin-top: ${Math.round(14 * (OG ? 1.2 : k))}px; font: 500 ${COVER ? Math.round(BH * 0.1) : Math.round((OG ? 24 : 20) * (OG ? 1 : k))}px "Geist Mono", monospace; color: #ffbf52; }
</style></head><body>${bots.defs}
<div class="wall">${rows.map(r => `<div class="row">${r.map(src => `<img src="${src}" alt="">`).join('')}</div>`).join('')}</div>
<div class="fade"></div>${COVER ? '' : '<div class="floor"></div>'}
${COVER ? '' : `<div class="crew">${crew.map(([t, s, seed]) => `<span class="tier-${t}">${bots.html(t, s, seed)}</span>`).join('')}</div>`}
<div class="copy">${COVER ? '' : `<div class="top">${logo}<h1>Desk Studio</h1></div>`}<p>${OG ? 'Your own design studio.' : 'Your own design studio. At your desk.'}</p><div class="url">deskstudio.ai</div></div>
</body></html>`;

const work = mkdtempSync(join(tmpdir(), 'banner-'));
const page_ = join(work, 'index.html');
writeFileSync(page_, html);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--force-color-profile=srgb'] });
const page = await (await browser.newContext({ viewport: { width: BW, height: BH }, deviceScaleFactor: OG ? 1 : 2 })).newPage();
await page.goto(pathToFileURL(page_).href, { waitUntil: 'load' });
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
const outFile = args.out || join(here, 'banner.png');
await page.screenshot({ path: outFile });
await browser.close();
rmSync(work, { recursive: true, force: true });
console.log(outFile);
