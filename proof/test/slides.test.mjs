import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, '..', 'cli.mjs');
const interCss = execFileSync('node', [join(here, '..', '..', 'scripts', 'font.mjs'), 'css', 'Inter'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });

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
`;

// Four slides laid one under another, the way the carousel standard asks for them.
const carousel = (slide3Headline = '62.5px') => `<!doctype html><html><head><style>${interCss}
html,body{margin:0;background:#0b0b0c;color:#f4f4f5;font-family:Inter,Arial,sans-serif}
[data-slide]{width:1080px;height:1350px;box-sizing:border-box;padding:96px;display:flex;flex-direction:column;justify-content:center;gap:24px;position:relative}
h1{font-size:62.5px;line-height:1.05;margin:0;font-weight:700}
[data-slide="3"] h1{font-size:${slide3Headline}}
p{font-size:25px;margin:0}
.n{position:absolute;right:96px;bottom:135px;font-size:20px;color:#8a8a93}
</style></head><body><main data-carousel>
<section data-slide="1"><h1>Cutting a line never deletes it</h1><span class="n">01 / 04</span></section>
<section data-slide="2"><h1>Every cut stays beside the draft</h1><p>Still readable, still yours.</p><span class="n">02 / 04</span></section>
<section data-slide="3"><h1>Bring a line back any time</h1><p>One move, no versions.</p><span class="n">03 / 04</span></section>
<section data-slide="4"><h1>Save this for your next cut</h1><span class="n">04 / 04</span></section>
</main></body></html>`;

function check(html) {
  const dir = mkdtempSync(join(tmpdir(), 'desk-slides-'));
  writeFileSync(join(dir, 'DESIGN.md'), brand);
  writeFileSync(join(dir, 'final.html'), html);
  let out;
  try { out = execFileSync('node', [cli, 'check', join(dir, 'final.html'), '--brand', join(dir, 'DESIGN.md'), '--sizes', 'ig-post', '--out', join(dir, 'renders')], { encoding: 'utf8' }); }
  catch (e) { out = e.stdout; }
  return { dir, result: JSON.parse(out) };
}

test('a carousel renders every slide on its own at the size', () => {
  const { dir, result } = check(carousel());
  const slides = result.renders.filter(r => typeof r.slide === 'number');
  assert.equal(slides.length, 4);
  assert.ok(existsSync(join(dir, 'renders', 'slide-01.png')));
  assert.ok(existsSync(join(dir, 'renders', 'slide-04.png')));
  for (const s of slides) assert.deepEqual(s.failures, [], `slide ${s.slide}: ${JSON.stringify(s.failures)}`);
  assert.equal(result.pass, true);
});

test('a content slide with its own headline size fails the series check', () => {
  const { result } = check(carousel('48.8px'));
  const series = result.renders.find(r => r.slide === 'series');
  assert.ok(series, 'series entry present');
  assert.ok(series.failures.some(f => f.check === 'series' && /headline/.test(f.reason)));
  assert.equal(result.pass, false);
});
