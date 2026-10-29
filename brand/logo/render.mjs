#!/usr/bin/env node
// Renders the logo PNGs and favicon.ico from the SVGs that build.py writes. Chrome draws them, without the GPU.
//   node brand/logo/render.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
// [svg, png, width]: the height follows the SVG's own aspect.
const JOBS = [
  ['logo.svg', 'logo-32.png', 32], ['logo.svg', 'logo-180.png', 180], ['logo.svg', 'logo-240.png', 240],
  ['logo.svg', 'logo-512.png', 512], ['logo.svg', 'logo-1024.png', 1024], ['logo-light.svg', 'logo-light-512.png', 512],
  ['mark-on-dark.svg', 'mark-on-dark.png', 512], ['mark-on-light.svg', 'mark-on-light.png', 512],
  ['lockup-dark.svg', 'lockup-dark.png', null], ['lockup-light.svg', 'lockup-light.png', null],
  ['lockup-on-dark.svg', 'lockup-on-dark.png', null], ['lockup-on-light.svg', 'lockup-on-light.png', null],
];
const size = svg => { const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg); return [Number(m[1]), Number(m[2])]; };

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--force-color-profile=srgb'] });
const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
async function render(svg, w) {
  const [vw, vh] = size(svg);
  const W = w || vw, H = Math.round(W * vh / vw);
  await page.setViewportSize({ width: W, height: H });
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${W}px;height:${H}px}</style>${svg}`);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } });
}
for (const [src, out, w] of JOBS) {
  const png = await render(readFileSync(join(here, src), 'utf8'), w);
  writeFileSync(join(here, out), png);
  console.log(out, png.length, 'bytes');
}
// favicon.ico: 16, 32 and 48 pixel PNGs in one ICO.
const logo = readFileSync(join(here, 'logo.svg'), 'utf8');
const icons = [];
for (const s of [16, 32, 48]) icons.push([s, await render(logo, s)]);
const head = Buffer.alloc(6 + 16 * icons.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(icons.length, 4);
let offset = head.length;
icons.forEach(([s, png], i) => {
  const o = 6 + i * 16;
  head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3);
  head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(png.length, o + 8); head.writeUInt32LE(offset, o + 12);
  offset += png.length;
});
writeFileSync(join(here, 'favicon.ico'), Buffer.concat([head, ...icons.map(([, p]) => p)]));
console.log('favicon.ico', offset, 'bytes');
await browser.close();
