import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadBrandLogo, injectLogo, stripLogo, LOGO_TOKEN } from '../logo.mjs';
import { tinyPng } from './fixtures.mjs';

const brandWith = path => `---\nname: Test\nlogo:\n  path: "${path}"\n---\n# Test\n`;

test('a PNG logo in the project becomes a data URI with its size', () => {
  const dir = mkdtempSync(join(tmpdir(), 'desk-logo-'));
  writeFileSync(join(dir, 'logo.png'), tinyPng(6, 3));
  const logo = loadBrandLogo(dir, brandWith('logo.png'));
  assert.equal(logo.mime, 'image/png');
  assert.equal(logo.width, 6);
  assert.equal(logo.height, 3);
  assert.match(logo.uri, /^data:image\/png;base64,/);
});

test('a logo the runner cannot use says why, and no logo is null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'desk-logo-'));
  assert.match(loadBrandLogo(dir, brandWith('missing.png')).missing, /not in the project/);
  assert.match(loadBrandLogo(dir, brandWith('../outside.png')).missing, /outside the project/);
  writeFileSync(join(dir, 'logo.pdf'), 'x');
  assert.match(loadBrandLogo(dir, brandWith('logo.pdf')).missing, /inlines .png/);
  assert.equal(loadBrandLogo(dir, '---\nname: Test\n---\n'), null);
});

test('the token and the data URI swap both ways', () => {
  const logo = { uri: 'data:image/png;base64,AAAA' };
  const html = `<img src="${LOGO_TOKEN}"><div style="background:url('${LOGO_TOKEN}')"></div>`;
  const inlined = injectLogo(html, logo);
  assert.ok(!inlined.includes(LOGO_TOKEN) && inlined.split(logo.uri).length === 3);
  assert.equal(stripLogo(inlined, logo), html);
  assert.equal(injectLogo(html, null), html);
  assert.equal(injectLogo(html, { missing: 'x' }), html);
});
