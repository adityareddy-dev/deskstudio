import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePick, parseScores, parseEscalation, extractHtml, parseBrief, parsePatterns, parseBuilderReturn } from '../parse.mjs';
import { parseModelsFlag, resolveModel, estimateCost, chooseDefaults, tierDefaults, deskInfo, deskName } from '../models.mjs';
import { PICK, SCORES_PASS, SCORES_FAIL, PEN, BRIEF } from './fixtures.mjs';

test('pick block parses number, reason, lost and notes', () => {
  const p = parsePick(PICK);
  assert.equal(p.pick, 2);
  assert.match(p.reason, /stat reads first/);
  assert.match(p.lost, /^1 headline/);
  assert.equal(p.notes.length, 2);
  assert.match(p.notes[0], /^Headline from 56px/);
  assert.equal(p.combineWith, null);
});

test('pick block tolerates fences, "rough 2" and a combine', () => {
  const p = parsePick('Here you go:\n```\npick: rough 3 + the mark from 1\nreason: shape\nnotes:\n- one\n- two\n```');
  assert.equal(p.pick, 3);
  assert.equal(p.combineWith, 1);
  assert.deepEqual(p.notes, ['one', 'two']);
  assert.throws(() => parsePick('no pick here'), /no "pick:" line/);
  assert.throws(() => parsePick('pick: 7'), /out of range/);
});

test('scores block parses axes, computes the bar and keeps notes per axis', () => {
  const s = parseScores(SCORES_PASS);
  assert.equal(s.axes.hierarchy, 9);
  assert.equal(s.axes.colour, 9);
  assert.equal(s.average, 8.75);
  assert.equal(s.pass, true);
  assert.equal(s.statedPass, true);
  assert.equal(s.notes[0].axis, 'spacing');
  assert.equal(s.polish.length, 1);
  const f = parseScores(SCORES_FAIL('typography', 6));
  assert.equal(f.pass, false);
  assert.deepEqual(f.failing, ['typography']);
  assert.equal(f.notes[0].axis, 'typography');
});

test('scores accept color spelling, "brand fit" and a 9/10 form, and the rubric decides over the stated pass', () => {
  const s = parseScores('scores: hierarchy 8/10, typography 8, spacing and rhythm 8, color 8, composition 8, originality 8, brand fit 8, copy 8\naverage: 8.0\npass: yes\nnotes:\n- none');
  assert.equal(s.axes.colour, 8);
  assert.equal(s.axes.brand, 8);
  assert.equal(s.axes.spacing, 8);
  assert.equal(s.pass, false, 'average 8.0 is under 8.5');
  assert.throws(() => parseScores('scores: hierarchy 9, typography 9'), /missing/);
});

test('escalation block', () => {
  const e = parseEscalation(PEN);
  assert.equal(e.tookPen, true);
  assert.match(e.changed, /72px/);
  assert.deepEqual(e.notes, ['keep the mark where it is']);
});

test('html comes out of a fenced block or bare markup', () => {
  assert.match(extractHtml('text\n```html\n<!doctype html><html><body>a</body></html>\n```\nfile: x'), /^<!doctype html>/);
  assert.match(extractHtml('<html><body>b</body></html> trailing'), /^<html>.*<\/html>\n$/s);
  assert.throws(() => extractHtml('nothing here'), /No HTML document/);
  const two = extractHtml('```html\n<html><body>short</body></html>\n```\n```html\n<!doctype html><html><head></head><body>the longer one</body></html>\n```');
  assert.match(two, /longer one/);
});

test('builder return block', () => {
  const r = parseBuilderReturn('```html\n<html></html>\n```\nfile: final.html\npattern: Type only\nfonts: Inter (fallback)\nproof: pass');
  assert.equal(r.pattern, 'Type only');
  assert.equal(r.proof, 'pass');
});

test('brief gives sizes and copy lines', () => {
  const b = parseBrief(BRIEF('linkedin, ig-post'), ['linkedin', 'ig-post', 'og']);
  assert.deepEqual(b.sizes, ['linkedin', 'ig-post']);
  assert.deepEqual(b.copy, ['Your own design studio.', 'One command, free, nothing leaves your machine.', 'deskstudio.ai']);
  assert.equal(b.draftCopy, false);
});

test('Markdown brief headings keep plain copy and requested sizes', () => {
  const b = parseBrief(`## Deliverable
A card.
## Sizes
\`x\`: landscape.
\`ig-post\`: portrait.
## Copy
Seven years to break even. Then free. Battery now included. northlight.energy.

Preserve every word; line breaks may change.
## Brand
Northlight.
`, ['linkedin', 'ig-post', 'x']);
  assert.deepEqual(b.sizes, ['x', 'ig-post']);
  assert.deepEqual(b.copy, ['Seven years to break even. Then free. Battery now included. northlight.energy.']);
});

test('copy parsing stays in its section and does not read another section’s fence', () => {
  const b = parseBrief('- **Copy.** Verbatim:\n\nKeep this sentence.\n\n- **Brand.**\n```\nNot copy.\n```', []);
  assert.deepEqual(b.copy, ['Keep this sentence.']);
  assert.deepEqual(parseBrief('## Copy\n\n## Brand\n```\nNot copy.\n```', []).copy, []);
});

test('fenced copy preserves text that looks like Markdown headings', () => {
  const b = parseBrief('## Copy\n```\n## Copy\n**Brand**\nKeep these symbols.\n```\n## Brand\nNot copy.', []);
  assert.deepEqual(b.copy, ['## Copy', '**Brand**', 'Keep these symbols.']);
});

test('patterns come from the standard in order', () => {
  const names = parsePatterns('## Patterns\n\n1. **Editorial split.** Landscape.\n2. **Full bleed with scrim.** One image.\n3. **Type only.** Headline.\n');
  assert.deepEqual(names, ['Editorial split', 'Full bleed with scrim', 'Type only']);
});

test('model specs resolve and the flag parses', () => {
  const m = resolveModel('anthropic/opus');
  assert.equal(m.id, 'claude-opus-5-5');
  assert.equal(resolveModel('google/flash').id, 'gemini-3.8-flash');
  assert.equal(resolveModel('openai/gpt-6-luna').alias, 'nano');
  assert.equal(resolveModel('openai/some-new-model').input, null);
  assert.throws(() => resolveModel('opus'), /provider\/model/);
  assert.throws(() => resolveModel('nope/opus'), /Unknown provider/);
  assert.deepEqual(parseModelsFlag('director=anthropic/opus,builder=google/flash'), { director: 'anthropic/opus', builder: 'google/flash' });
  assert.throws(() => parseModelsFlag('manager=anthropic/opus'), /Unknown tier/);
  assert.equal(estimateCost(resolveModel('anthropic/haiku'), { input: 1_000_000, output: 1_000_000 }), 0.6);
  assert.equal(estimateCost(resolveModel('anthropic/haiku'), { input: 0, output: 0, cacheRead: 1_000_000, cacheWrite: 1_000_000 }), 0.135);
  assert.equal(estimateCost(resolveModel('google/flash'), { input: 0, output: 0, cacheRead: 1_000_000 }), 0.75, 'no cache price, cached tokens priced as input');
  assert.equal(estimateCost(resolveModel('openai/some-new-model'), { input: 1, output: 1 }), null);
});

test('tiers and desks come from the registry', () => {
  assert.deepEqual(tierDefaults(), { director: 'anthropic/opus', senior: 'anthropic/sonnet', builder: 'anthropic/haiku' });
  assert.equal(deskInfo('ui-designer').tier, 'builder');
  assert.equal(deskInfo('creative-director').tier, 'director');
  assert.equal(deskName('art-director'), 'Art Director');
  assert.equal(deskInfo('nope'), null);
});

test('defaults follow what is on the machine', () => {
  assert.equal(chooseDefaults({ anthropic: { via: 'cli' }, openai: { via: null }, google: { via: null } }).models.director, 'anthropic/opus');
  const mixed = chooseDefaults({ anthropic: { via: null }, openai: { via: 'cli' }, google: { via: 'api' } });
  assert.equal(mixed.models.director, 'openai/large');
  assert.equal(mixed.models.builder, 'openai/nano');
  assert.equal(chooseDefaults({ anthropic: { via: null }, openai: { via: null }, google: { via: null } }).models, null);
});
