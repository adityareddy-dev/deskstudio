// Finds a Chrome on this machine and renders a file at an exact size.
// Order: CHROME_PATH, then the Chrome channel, then Edge, then Chromium if Playwright has one.
import { chromium } from 'playwright-core';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';

const ATTEMPTS = [
  () => process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : null,
  () => ({ channel: 'chrome' }),
  () => ({ channel: 'msedge' }),
  () => ({}),
];

// The browser has to match this copy's Playwright, so name the setup of this copy. The npm package (npx or an
// install) has the short form. Anywhere else, the Claude Code plugin included, it is this file's own CLI.
const CLI = fileURLToPath(new URL('./cli.mjs', import.meta.url));
export const SETUP_COMMAND = /[\\/](_npx|node_modules)[\\/]/.test(CLI) ? 'npx --package deskstudio desk-proof setup' : `node "${CLI}" setup`;
const MISSING_LIBS = /error while loading shared libraries|missing dependencies to run browsers/i;

export async function launch() {
  const errors = [];
  let libs = false;
  for (const attempt of ATTEMPTS) {
    const opts = attempt();
    if (!opts) continue;
    try {
      return await chromium.launch({ headless: true, ...opts, args: ['--disable-dev-shm-usage', '--force-device-scale-factor=1'] });
    } catch (e) {
      if (MISSING_LIBS.test(String(e.message))) libs = true;
      errors.push(`${JSON.stringify(opts)}: ${String(e.message).split('\n')[0]}`);
    }
  }
  const head = libs
    ? `A browser is installed, but this machine is missing the system libraries it needs. Run ${SETUP_COMMAND} --with-deps once. It installs them with admin rights, so it asks for your password.`
    : `No Chrome, Edge or Chromium found. Run ${SETUP_COMMAND} once to download the one proof uses, or set CHROME_PATH to a Chrome executable.`;
  throw new Error(head + '\n' + errors.join('\n'));
}

async function works() {
  try { const b = await launch(); await b.close(); return null; } catch (e) { return e; }
}

// desk-proof setup: downloads the headless Chromium that matches this copy of Playwright, so proof renders on a
// machine with no Chrome. --with-deps also installs its Linux system libraries (Playwright asks for sudo).
export async function setup({ withDeps = false, log = s => process.stdout.write(s + '\n') } = {}) {
  if (!withDeps && !(await works())) { log('Proof is ready, a browser renders on this machine.'); return 0; }
  const cli = join(dirname(createRequire(import.meta.url).resolve('playwright-core/package.json')), 'cli.js');
  log(`Installing the headless Chromium proof uses${withDeps ? ', with its system libraries' : ''}.`);
  const r = spawnSync(process.execPath, [cli, 'install', ...(withDeps ? ['--with-deps'] : []), 'chromium', '--only-shell'], { stdio: 'inherit' });
  if (r.status !== 0) { log(`The install did not finish (exit ${r.status}). Run it again, or set CHROME_PATH to a Chrome executable.`); return 1; }
  const err = await works();
  if (!err) { log('Proof is ready, a browser renders on this machine.'); return 0; }
  log(String(err.message).split('\n')[0]);
  return 1;
}

export async function openPage(browser, file, size, { scheme = 'light' } = {}) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height || 800 }, deviceScaleFactor: 1, reducedMotion: 'no-preference', colorScheme: scheme });
  await context.route('**/*', route => /^(https?|wss?):/.test(route.request().url()) ? route.abort() : route.continue());
  const page = await context.newPage();
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(50);
  return { page, context };
}

// Keep each browser capture below the texture limit, then join the tiles at native size.
async function capture(page, path, { fullPage, width, height }) {
  const tileSize = 8192;
  if (!fullPage || (width <= tileSize && height <= tileSize)) {
    await page.screenshot({ path, fullPage });
    return;
  }
  const image = new PNG({ width, height });
  for (let y = 0; y < height; y += tileSize) for (let x = 0; x < width; x += tileSize) {
    const clip = { x, y, width: Math.min(tileSize, width - x), height: Math.min(tileSize, height - y) };
    const tile = PNG.sync.read(await page.screenshot({ fullPage: true, clip, type: 'png' }));
    PNG.bitblt(tile, image, 0, 0, tile.width, tile.height, x, y);
  }
  writeFileSync(path, PNG.sync.write(image));
}

// Returns the text boxes with computed style, the document extent, and writes two PNGs:
// the render, and the render with all text hidden (what sits behind the text).
export async function snapshot(page, pngPath, { fullPage = false, only = null } = {}) {
  if (fullPage) await page.evaluate(async () => {
    await Promise.all([...document.images].map(async image => {
      image.loading = 'eager';
      try { await image.decode(); } catch {}
    }));
  });
  // A carousel lays its slides one under another. `only: n` shows slide n alone, filling the canvas.
  const isolate = only ? await page.evaluateHandle(n => {
    const style = document.createElement('style');
    style.setAttribute('data-desk-proof-slide', '');
    style.textContent = `[data-slide]:not([data-slide="${n}"]) { display: none !important; } [data-slide="${n}"] { position: fixed !important; inset: 0 !important; width: ${innerWidth}px !important; height: ${innerHeight}px !important; margin: 0 !important; }`;
    document.head.appendChild(style);
    return style;
  }, only) : null;
  if (isolate) await page.waitForTimeout(30);
  const dom = await page.evaluate(() => {
    const boxes = [];
    const rect = r => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      if (!el || !node.textContent.trim() || ['SCRIPT', 'STYLE', 'TITLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
      const style = getComputedStyle(el);
      let opacity = 1, hidden = false; const clips = [];
      for (let a = el; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        opacity *= Number(s.opacity);
        hidden ||= s.display === 'none' || s.visibility !== 'visible';
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') clips.push({ ...rect(a.getBoundingClientRect()), clipX: s.overflowX !== 'visible', clipY: s.overflowY !== 'visible' });
      }
      if (hidden || opacity < 0.9) continue;
      if (clips.some(c => c.width <= 1 || c.height <= 1)) continue; // visually hidden text for screen readers
      const range = document.createRange(); range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue;
        boxes.push({ ...rect(r), text: node.textContent.trim().replace(/\s+/g, ' '), color: el instanceof SVGElement ? style.fill : style.color, opacity, fontSize: parseFloat(style.fontSize), fontWeight: parseInt(style.fontWeight) || 400, fontFamily: style.fontFamily, clips });
      }
    }
    const de = document.documentElement;
    // Which families named in the page are actually loaded, so proof can catch a brand font falling back.
    // document.fonts.check() says yes whenever no @font-face matches, so measure instead: a family that is
    // not available renders as the generic fallback and gives the same width as the fallback alone.
    const fonts = {};
    const canvas = document.createElement('canvas').getContext('2d');
    const sample = 'mmmmmmmmmmlllllllllliiiiiiiiii0123456789 Desk Studio';
    const widthWith = (family, generic) => { canvas.font = `72px ${family ? `"${family}", ` : ''}${generic}`; return canvas.measureText(sample).width; };
    for (const b of boxes) for (const fam of b.fontFamily.split(',')) {
      const name = fam.trim().replace(/^["']|["']$/g, '');
      if (!name || name in fonts) continue;
      if (['sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'cursive', 'fantasy'].includes(name.toLowerCase())) { fonts[name] = true; continue; }
      fonts[name] = widthWith(name, 'monospace') !== widthWith('', 'monospace') || widthWith(name, 'serif') !== widthWith('', 'serif');
    }
    return { width: innerWidth, height: innerHeight, scrollWidth: de.scrollWidth, scrollHeight: de.scrollHeight, boxes, fonts, images: document.querySelectorAll('img,canvas,iframe,video').length };
  });
  const captureSize = { fullPage, width: Math.max(dom.width, dom.scrollWidth), height: Math.max(dom.height, dom.scrollHeight) };
  await capture(page, pngPath, captureSize);
  const hide = await page.evaluateHandle(() => {
    const style = document.createElement('style');
    style.setAttribute('data-desk-proof', '');
    style.textContent = '* { -webkit-text-fill-color: transparent !important; color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; caret-color: transparent !important; } text, tspan { fill: transparent !important; stroke: transparent !important; }';
    document.head.appendChild(style);
    return style;
  });
  const backgroundPath = pngPath.replace(/\.png$/, '.background.png');
  try {
    await capture(page, backgroundPath, captureSize);
  } finally {
    await hide.evaluate(el => el.remove());
    if (isolate) await isolate.evaluate(el => el.remove());
  }
  const metaPath = pngPath.replace(/\.png$/, '.dom.json');
  writeFileSync(metaPath, JSON.stringify(dom, null, 2));
  return { ...dom, png: pngPath, background: backgroundPath, meta: metaPath };
}
