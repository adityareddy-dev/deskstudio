import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandFamily, injectFont, stripFont, loadBrandFont, FONT_START, FONT_END } from '../fonts.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const font = { family: 'Geist', css: '@font-face { font-family: "Geist"; src: url(data:font/woff2;base64,AAAA) format("woff2"); }', stack: '"Geist", Arial, sans-serif' };

test('the brand family is the first name in type.family', () => {
  assert.equal(brandFamily('type:\n  family: "Geist, Inter, Arial, sans-serif"\n'), 'Geist');
  assert.equal(brandFamily('type:\n  family: Inter\n'), 'Inter');
  assert.equal(brandFamily('colors:\n  background: "#000"\n'), null);
});

test('inject puts the block at the top of the first style and strip takes it out again', () => {
  const html = '<!doctype html><html><head><style>\nbody{margin:0}\n</style></head><body>x</body></html>';
  const out = injectFont(html, font);
  assert.ok(out.includes(`<style>\n${FONT_START}\n@font-face`));
  assert.ok(out.includes(`${FONT_END}\n\nbody{margin:0}`));
  assert.equal(stripFont(out), html);
  assert.equal(injectFont(out, font), out, 'injecting twice leaves one block');
  const noStyle = injectFont('<html><head></head><body>y</body></html>', font);
  assert.ok(noStyle.includes('<head>\n<style>\n' + FONT_START));
  assert.equal(stripFont('plain'), 'plain');
  assert.equal(injectFont(html, null), html);
});

test('loadBrandFont is null without scripts/font.mjs', () => {
  const root = mkdtempSync(join(tmpdir(), 'desk-font-'));
  assert.equal(loadBrandFont(root, 'type:\n  family: "Geist"\n', root), null);
});
