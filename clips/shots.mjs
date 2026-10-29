#!/usr/bin/env node
// The dashboard guide's screenshots, from real records replayed to a moment (replay.mjs), on the real dashboard.
//   node clips/shots.mjs [--out docs/images/dashboard] [--only name,name]
// Writes <name>.webp at 1920 wide (1440 by 810 CSS pixels at 4/3), and a PNG next to it with --png.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createFloor } from '../dashboard/server.js';
import * as R from './replay.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter(Boolean));
const OUT = resolve(args.out || join(root, 'docs', 'images', 'dashboard'));
const only = args.only ? String(args.only).split(',') : null;
const CARD = 'clips/fixtures/card', HARBOR = 'evals/golden/brand-kit/harbor';
const startOf = re => rec => Date.parse(rec.final.desks.find(d => re.test(d.task || '')).startedAt);
const end = rec => rec.t1 + 1500;
const plus = (f, ms) => rec => f(rec) + ms;
const region = sel => async page => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.max(0, r.left - 12), y: Math.max(0, r.top - 12 + scrollY), width: Math.min(innerWidth, r.width + 24), height: r.height + 24 }; }, sel);

const SHOTS = [
  { name: 'empty', project: 'my-project', note: 'A project with the dashboard on and no job yet.' },
  { name: 'floor', record: HARBOR, project: 'harbor', at: plus(startOf(/direction 3 card and hero/), 40000), note: 'A brand-kit job at its busiest: ten agents across four desks.' },
  { name: 'job', record: CARD, project: 'deskstudio', at: plus(startOf(/sign-off round 2/), 60000), clip: region('#job') },
  { name: 'now-and-log', record: CARD, project: 'deskstudio', at: plus(startOf(/polish round 2/), 70000), clip: region('.side') },
  { name: 'board-roughs', record: CARD, project: 'deskstudio', at: end, scroll: '#board', clip: async page => page.evaluate(() => { const b = document.querySelector('#board .board-grid > div').getBoundingClientRect(); return { x: b.left - 16, y: b.top - 60 + scrollY, width: b.width + 32, height: b.height + 80 }; }) },
  { name: 'board-rounds', record: CARD, project: 'deskstudio', at: end, scroll: '#board', clip: async page => page.evaluate(() => { const b = document.querySelectorAll('#board .board-grid > div')[1].getBoundingClientRect(); return { x: b.left - 16, y: b.top - 16 + scrollY, width: b.width + 32, height: b.height + 32 }; }) },
  { name: 'ledger', record: CARD, project: 'deskstudio', at: end, clip: region('#ledger') },
  { name: 'desk-sheet', record: CARD, project: 'deskstudio', at: plus(startOf(/polish round 2/), 70000), act: async page => { await page.click('#floor button.desk[data-slug="ui-designer"]'); await page.waitForTimeout(700); } },
  // A demo state: the record never waited on an approval, so this one sets waitingOn by hand to show the banner.
  { name: 'your-call', record: CARD, project: 'deskstudio', at: plus(startOf(/polish round 2/), -5000), demo: s => { s.waitingOn = { type: 'approve_under_bar', text: 'Round 1 scored 8.4 with originality at 7. Approve it as it is, or send it back with notes.' }; }, clip: async page => page.evaluate(() => { const a = document.querySelector('#banner').getBoundingClientRect(), b = document.querySelector('#job').getBoundingClientRect(); return { x: 0, y: a.top - 12 + scrollY, width: innerWidth, height: b.bottom - a.top + 24 }; }) },
  { name: 'light', record: CARD, project: 'deskstudio', at: plus(startOf(/sign-off round 3/), 60000), scheme: 'light' },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--force-color-profile=srgb', '--hide-scrollbars'] });
for (const s of SHOTS) {
  if (only && !only.includes(s.name)) continue;
  const tmp = mkdtempSync(join(tmpdir(), 'desk-shots-'));
  const proj = join(tmp, s.project), desk = join(proj, '.desk');
  mkdirSync(desk, { recursive: true });
  if (s.record) {
    const rec = R.loadRecord(join(root, s.record));
    const T = s.at(rec);
    R.writeDesk(desk, rec, R.rebase(R.at(rec, T), Date.now() - T));
    if (s.demo) { const f = join(desk, 'jobs', rec.id, 'state.json'); const st = JSON.parse(readFileSync(f, 'utf8')); s.demo(st); writeFileSync(f, JSON.stringify(st, null, 2)); }
  } else writeFileSync(join(desk, 'project.json'), readFileSync(join(root, CARD, 'project.json')));
  const floor = createFloor({ root: proj, desk, token: 'shot', port: 0 });
  const port = await floor.listen();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3, colorScheme: s.scheme || 'dark' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error(`${s.name}: ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/?token=shot`, { waitUntil: 'load' });
  await page.waitForSelector('#floor .desk');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1400);
  if (s.scroll) { await page.evaluate(sel => { const el = document.querySelector(sel); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 66); }, s.scroll); await page.waitForTimeout(900); }
  if (s.act) await s.act(page);
  // Let every move finish so the still shows the end state.
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
  const png = join(tmp, `${s.name}.png`);
  const clip = s.clip ? await s.clip(page) : null;
  await page.screenshot({ path: png, ...(clip ? { clip, fullPage: true } : {}) });
  const webp = join(OUT, `${s.name}.webp`);
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-quality', '88', webp]);
  if (args.png) writeFileSync(join(OUT, `${s.name}.png`), readFileSync(png));
  console.log(s.name, '->', webp);
  await ctx.close(); await floor.close();
  rmSync(tmp, { recursive: true, force: true });
}
await browser.close();
