#!/usr/bin/env node
// desk-proof: render a file at named sizes and check the pixels.
//   check  <file> --brand DESIGN.md --sizes a,b --out dir [--must-appear "x" "y"]
//   render <file> --sizes a,b --out dir
//   sizes
import { mkdirSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { SIZES, resolveSizes } from './sizes.mjs';
import { launch, openPage, snapshot } from './browser.mjs';
import { readBrand } from './brand.mjs';
import { runChecks, checkSeries } from './check.mjs';
import { recordMotion, exportFrames } from './motion.mjs';

function parse(argv) {
  const out = { _: [], mustAppear: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--must-appear') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) out.mustAppear.push(argv[++i]); }
    else if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; out[k] = v; }
    else out._.push(a);
  }
  return out;
}

async function renderAll(file, sizes, outDir, schemes) {
  mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  const renders = [];
  try {
    for (const size of sizes) for (const scheme of schemes) {
      const { page, context } = await openPage(browser, file, size, { scheme });
      try {
        const suffix = schemes.length > 1 ? `-${scheme}` : '';
        // A carousel: every [data-slide] renders on its own at the size, named slide-01.png onward.
        const slides = await page.evaluate(() => document.querySelectorAll('[data-slide]').length);
        const kind = slides > 1 ? await page.evaluate(() => document.querySelector('[data-carousel]') ? 'carousel' : document.querySelector('[data-deck]') ? 'deck' : null) : null;
        if (slides > 1) {
          for (let n = 1; n <= slides; n++) {
            const png = join(outDir, `${sizes.length > 1 ? `${size.name}-` : ''}slide-${String(n).padStart(2, '0')}${suffix}.png`);
            const dom = await snapshot(page, png, { only: n });
            renders.push({ size, scheme, dom, slide: n, slides, kind });
          }
        } else {
          const png = join(outDir, `${size.name}${suffix}.png`);
          const dom = await snapshot(page, png, { fullPage: !!size.fullPage });
          renders.push({ size, scheme, dom });
        }
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  return renders;
}

const args = parse(process.argv.slice(2));
const cmd = args._[0];

try {
  if (cmd === 'sizes') {
    for (const [name, s] of Object.entries(SIZES)) console.log(`${name.padEnd(13)} ${String(s.width).padStart(5)}x${String(s.height || 'auto').padEnd(5)} safe ${s.safe.map(v => Math.round(v * 100) + '%').join('/')}`);
    process.exit(0);
  }
  if (cmd === 'motion') {
    const file = resolve(args._[1] || '');
    if (!args._[1]) throw new Error('Give the clip file to record.');
    const size = resolveSizes(args.size || args.sizes || 'slide')[0];
    const outDir = resolve(args.out || join(process.cwd(), '.desk', 'renders', basename(file).replace(/\.\w+$/, '')));
    const name = basename(file).replace(/\.\w+$/, '');
    const seconds = Number(args.seconds) || 8;
    const result = await recordMotion({ file, size, seconds, outDir, name });
    // The deliverable: frame-accurate MP4 and WebM from seeked frames, unless --no-export.
    if (!args['no-export']) Object.assign(result, await exportFrames({ file, size, seconds, fps: Number(args.fps) || 30, outDir, name }));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.pass ? 0 : 1);
  }
  if (cmd !== 'check' && cmd !== 'render') { console.error('usage: desk-proof check|render <file> --sizes a,b --out dir [--brand DESIGN.md] [--scheme light|dark|both] [--must-appear "x" "y"]  |  motion <file> --size slide|1080x1920 --seconds 8 --out dir  |  sizes'); process.exit(2); }
  const file = resolve(args._[1] || '');
  if (!args._[1]) throw new Error('Give the file to render.');
  const sizes = resolveSizes(args.sizes);
  const outDir = resolve(args.out || join(process.cwd(), '.desk', 'renders', basename(file).replace(/\.\w+$/, '')));
  const brand = cmd === 'check' && args.brand ? readBrand(resolve(args.brand)) : null;
  const schemeArg = String(args.scheme || 'light');
  const schemes = schemeArg === 'both' ? ['light', 'dark'] : [schemeArg];
  const renders = await renderAll(file, sizes, outDir, schemes);
  const result = { pass: true, file: basename(file), renders: [], screenshots: [] };
  const bytes = statSync(file).size;
  for (const { size, scheme, dom, slide } of renders) {
    const entry = { size: size.name, scheme, ...(slide ? { slide } : {}), width: size.width, height: size.height || dom.scrollHeight, png: dom.png, pass: true, failures: [] };
    if (cmd === 'check') {
      const isEmail = size.name.startsWith('email');
      entry.failures = runChecks({ dom, size, brand: isEmail && brand ? { ...brand, type: { ...brand.type, family: null } } : brand, renderPng: dom.png, backgroundPng: dom.background, mustAppear: args.mustAppear });
      if (isEmail && bytes > 102 * 1024) entry.failures.push({ check: 'size', text: '', reason: `${Math.round(bytes / 1024)} KB of HTML, Gmail clips emails over 102 KB` });
      entry.pass = entry.failures.length === 0;
      if (!entry.pass) result.pass = false;
    }
    result.renders.push(entry);
    result.screenshots.push(dom.png);
  }
  // The series check, once per size and scheme, when the file is a carousel.
  if (cmd === 'check') {
    const sets = new Map();
    for (const r of renders) if (r.slide && r.kind) { const k = `${r.size.name}|${r.scheme}|${r.kind}`; if (!sets.has(k)) sets.set(k, []); sets.get(k).push({ slide: r.slide, dom: r.dom, backgroundPng: r.dom.background }); }
    for (const [k, slides] of sets) {
      const failures = checkSeries(slides, { kind: k.split('|')[2] });
      if (failures.length) { result.pass = false; result.renders.push({ size: k.split('|')[0], scheme: k.split('|')[1], slide: 'series', pass: false, failures }); }
    }
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
} catch (e) {
  console.log(JSON.stringify({ pass: false, error: e.message }, null, 2));
  process.exit(2);
}
