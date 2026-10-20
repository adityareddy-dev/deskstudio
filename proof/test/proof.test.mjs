import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontMatter } from '../brand.mjs';
import { resolveSizes } from '../sizes.mjs';
import { launch, openPage, snapshot } from '../browser.mjs';
import { checkContrast } from '../check.mjs';
import { PNG } from 'pngjs';
import { execFileSync as run0 } from 'node:child_process';
const interCss = run0('node', [join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'font.mjs'), 'css', 'Inter'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, '..', 'cli.mjs');

const brand = `---
name: Test
colors:
  background: "#0b0b0c"
  foreground: "#f4f4f5"
  accent: "#0f62fe"
type:
  family: "Inter"
  base: 16
  ratio: 1.25
spacing:
  unit: 8
sources:
  - "test"
---
# Test
`;

const card = (extra = '', font = interCss) => `<!doctype html><html><head><style>${font}
html,body{margin:0;background:#0b0b0c;color:#f4f4f5;font-family:Inter,Arial,sans-serif}
main{width:100vw;height:100vh;box-sizing:border-box;padding:80px;display:flex;flex-direction:column;justify-content:center;gap:24px}
h1{font-size:62.5px;line-height:1.05;margin:0;font-weight:700;max-width:60%}
p{font-size:25px;margin:0;color:#f4f4f5}
.mark{position:absolute;left:80px;bottom:80px;font-size:20px;color:#0f62fe;font-weight:700}
${extra}</style></head><body><main data-artboard><h1>Your own design studio</h1><p>One command, free, nothing leaves your machine.</p><span class="mark">deskstudio.ai</span></main></body></html>`;

function run(args) {
  try { return JSON.parse(execFileSync('node', [cli, ...args], { encoding: 'utf8' })); }
  catch (e) { return JSON.parse(e.stdout); }
}

test('front matter parses nested maps and lists', () => {
  const fm = parseFrontMatter(brand);
  assert.equal(fm.colors.accent, '#0f62fe');
  assert.equal(fm.type.base, 16);
  assert.deepEqual(fm.sources, ['test']);
});

test('sizes resolve by name and by WxH', () => {
  const s = resolveSizes('linkedin,640x480');
  assert.equal(s[0].width, 1200);
  assert.equal(s[1].height, 480);
  assert.throws(() => resolveSizes('nope'));
});

test('a good card passes and a low contrast card fails on contrast', { timeout: 60000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'desk-proof-'));
  writeFileSync(join(dir, 'DESIGN.md'), brand);
  writeFileSync(join(dir, 'good.html'), card());
  writeFileSync(join(dir, 'bad.html'), card('p{color:#3a3a3f}'));
  const good = run(['check', join(dir, 'good.html'), '--brand', join(dir, 'DESIGN.md'), '--sizes', 'linkedin', '--out', join(dir, 'good'), '--must-appear', 'Your own design studio']);
  assert.equal(good.pass, true, JSON.stringify(good, null, 2));
  const bad = run(['check', join(dir, 'bad.html'), '--brand', join(dir, 'DESIGN.md'), '--sizes', 'linkedin', '--out', join(dir, 'bad')]);
  assert.equal(bad.pass, false);
  assert.ok(bad.renders[0].failures.some(f => f.check === 'contrast'), JSON.stringify(bad, null, 2));
});

test('a card without the brand font inlined fails on font', { timeout: 60000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'desk-proof-font-'));
  writeFileSync(join(dir, 'DESIGN.md'), brand);
  writeFileSync(join(dir, 'nofont.html'), card('', ''));
  const r = run(['check', join(dir, 'nofont.html'), '--brand', join(dir, 'DESIGN.md'), '--sizes', 'linkedin', '--out', join(dir, 'nofont')]);
  assert.equal(r.pass, false);
  assert.ok(r.renders[0].failures.some(f => f.check === 'font'), JSON.stringify(r, null, 2));
});

test('long pages keep their footer pixels and contrast checks past 16384px', { timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desk-proof-long-'));
  const browser = await launch();
  try {
    const file = join(dir, 'long.html');
    writeFileSync(join(dir, 'footer.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path fill="#0080ff" d="M0 0h32v32H0z"/></svg>');
    writeFileSync(file, `<!doctype html><style>
      html,body{margin:0;background:#fff;color:#000;font:24px Arial}
      main{height:21000px;position:relative}
      p{position:absolute;left:16px;margin:0;line-height:32px}
      .seam{top:8180px}.readable{top:18000px}.low{top:20000px;color:#ddd}
      img{position:absolute;left:16px;top:19050px}
    </style><main><p class="seam">Across a tile boundary</p><p class="readable">Readable footer</p><img src="footer.svg" loading="lazy" width="32" height="32" alt="Blue square"><p class="low">Faint footer</p></main>`);
    const { page, context } = await openPage(browser, file, { width: 390, height: 844 });
    try {
      const dom = await snapshot(page, join(dir, 'long.png'), { fullPage: true });
      const render = PNG.sync.read(readFileSync(dom.png));
      const background = PNG.sync.read(readFileSync(dom.background));
      assert.deepEqual([render.width, render.height], [390, 21000]);
      assert.deepEqual([background.width, background.height], [390, 21000]);
      const imagePixel = (19060 * render.width + 24) * 4;
      assert.deepEqual([...render.data.subarray(imagePixel, imagePixel + 3)], [0, 128, 255], 'lazy footer image is rendered');
      for (const box of dom.boxes) {
        let textPixels = 0;
        for (let y = Math.floor(box.y); y < Math.ceil(box.y + box.height); y++) {
          for (let x = Math.floor(box.x); x < Math.ceil(box.x + box.width); x++) {
            const i = (y * render.width + x) * 4;
            if (render.data[i] !== background.data[i]) textPixels++;
          }
        }
        assert.ok(textPixels > 20, `missing text pixels for ${box.text}`);
      }
      const failures = checkContrast(dom, dom.background);
      assert.deepEqual(failures.map(f => f.text), ['Faint footer']);
    } finally { await context.close(); }
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('motion records a clip and flags an empty first frame', { timeout: 90000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'desk-proof-motion-'));
  writeFileSync(join(dir, 'clip.html'), `<!doctype html><html><head><style>html,body{margin:0;background:#0b0b0c;color:#fff;font-family:Arial;width:100vw;height:100vh;overflow:hidden}.l{position:absolute;left:8%;top:30%;font-size:7vh;font-weight:700;opacity:0;animation:in .3s .4s forwards}@keyframes in{to{opacity:1}}</style></head><body><div class="l">Pause a job.</div></body></html>`);
  const r = run(['motion', join(dir, 'clip.html'), '--size', '640x360', '--seconds', '2', '--out', join(dir, 'out')]);
  assert.ok(r.webm, JSON.stringify(r, null, 2));
  assert.ok(r.frames >= 5);
  assert.ok(r.failures.some(f => f.check === 'first-frame'), JSON.stringify(r.failures));
});
