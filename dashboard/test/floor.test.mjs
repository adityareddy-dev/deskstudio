import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFloor, findProject } from '../server.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, 'fixture', 'desk');
const SERVER = join(here, '..', 'server.js');
const JOB = '20260101-0900-test-card';
const TOKEN = 'test-token-0123456789abcdef';
const tmpRoots = [];

function makeProject() {
  const root = mkdtempSync(join(tmpdir(), 'desk-floor-'));
  cpSync(FIXTURE, join(root, '.desk'), { recursive: true });
  tmpRoots.push(root);
  return { root, desk: join(root, '.desk') };
}

async function startFloor() {
  const { root, desk } = makeProject();
  const floor = createFloor({ root, desk, token: TOKEN, port: 0 });
  const port = await floor.listen();
  return { root, desk, port, floor, base: `http://127.0.0.1:${port}` };
}

function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((ok, fail) => {
    const req = http.request(url, { method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(buf.toString('utf8')); } catch {}
        ok({ status: res.statusCode, headers: res.headers, buf, json });
      });
    });
    req.on('error', fail);
    if (body) req.write(body);
    req.end();
  });
}

const auth = { 'X-Desk-Token': TOKEN };
const post = (base, id, data) => request(`${base}/api/control/${id}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const readJson = f => JSON.parse(readFileSync(f, 'utf8'));
const events = desk => readFileSync(join(desk, 'events.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));

after(() => { for (const r of tmpRoots) { try { rmSync(r, { recursive: true, force: true }); } catch {} } });

test('every api route needs the token, static files do not', async () => {
  const f = await startFloor();
  try {
    assert.equal((await request(`${f.base}/api/state`)).status, 401);
    assert.equal((await request(`${f.base}/api/health?token=wrong`)).status, 401);
    assert.equal((await request(`${f.base}/api/events`)).status, 401);
    assert.equal((await request(`${f.base}/api/file?path=out/${JOB}/final.html`)).status, 401);
    assert.equal((await request(`${f.base}/api/control/${JOB}`, { method: 'POST', body: '{"pause":true}' })).status, 401);
    assert.equal((await request(`${f.base}/api/health?token=${TOKEN}`)).status, 200);
    const h = await request(`${f.base}/api/health`, { headers: auth });
    assert.equal(h.status, 200);
    assert.equal(h.json.pid, process.pid);
    assert.equal((await request(`${f.base}/`)).status, 200);
    assert.match((await request(`${f.base}/`)).headers['content-type'], /text\/html/);
    assert.equal((await request(`${f.base}/app.js`)).status, 200);
    assert.equal((await request(`${f.base}/../server.js`)).status, 404);
    const font = await request(`${f.base}/fonts/inter/Inter-Variable.woff2`);
    assert.equal(font.status, 200, 'the floor sets Inter from the bundled fonts');
    assert.equal(font.headers['content-type'], 'font/woff2');
    assert.equal((await request(`${f.base}/fonts/inter/LICENSE`)).status, 404, 'only font files come out of fonts/');
    assert.equal((await request(`${f.base}/fonts/%2e%2e/package.json`)).status, 404, 'nothing above fonts/');
    assert.equal(f.floor.server.address().address, '127.0.0.1');
  } finally { await f.floor.close(); }
});

test('state route reads the fixture .desk', async () => {
  const f = await startFloor();
  try {
    const r = await request(`${f.base}/api/state`, { headers: auth });
    assert.equal(r.status, 200);
    assert.equal(r.json.project.quality, 'studio');
    assert.equal(r.json.brand.name, 'Fixture Brand');
    assert.equal(r.json.brand.colors.accent, '#0f62fe');
    assert.equal(r.json.jobs.length, 1);
    assert.equal(r.json.jobs[0].id, JOB);
    assert.equal(r.json.jobs[0].phase, 'polish');
    assert.equal(r.json.active, JOB);
    assert.equal(r.json.desks.desks.length, 42, 'the desk list comes from skills/desk/desks.json');
    assert.deepEqual(r.json.desks.tiers.map(t => t.id), ['manager', 'director', 'senior', 'builder']);
    assert.equal(r.json.desks.tiers.find(t => t.id === 'builder').model, 'anthropic/haiku');
    const ad = r.json.desks.desks.find(d => d.slug === 'art-director');
    assert.equal(ad.tier, 'director');
    assert.ok(ad.owns.length > 0, 'owns comes through from the registry');
    assert.ok(r.json.desks.desks.some(d => d.slug === 'ai-audio-voice-producer'));
  } finally { await f.floor.close(); }
});

test('jobs route finds roughs kept under renders/roughs, the way the runner keeps them', async () => {
  const f = await startFloor();
  try {
    const rend = join(f.desk, 'jobs', JOB, 'renders');
    mkdirSync(join(rend, 'roughs', 'rough-3'), { recursive: true });
    writeFileSync(join(rend, 'roughs', 'rough-3', 'linkedin.png'), readFileSync(join(rend, 'rough-1', 'linkedin.png')));
    const r = await request(`${f.base}/api/jobs/${JOB}`, { headers: auth });
    const nested = r.json.renders.find(x => x.name === 'rough-3');
    assert.ok(nested, 'rough-3 is listed');
    assert.equal(nested.kind, 'rough');
    assert.deepEqual(nested.files, [{ size: 'linkedin', path: `jobs/${JOB}/renders/roughs/rough-3/linkedin.png` }]);
    const png = await request(`${f.base}/api/file?path=jobs/${JOB}/renders/roughs/rough-3/linkedin.png`, { headers: auth });
    assert.equal(png.status, 200);
  } finally { await f.floor.close(); }
});

test('jobs route returns state, renders with paths, out files and the brief', async () => {
  const f = await startFloor();
  try {
    const r = await request(`${f.base}/api/jobs/${JOB}`, { headers: auth });
    assert.equal(r.status, 200);
    assert.equal(r.json.state.id, JOB);
    assert.equal(r.json.state.round, 1);
    assert.deepEqual(r.json.renders.map(x => x.name), ['rough-1', 'rough-2', 'round-1']);
    assert.deepEqual(r.json.renders[0].files, [{ size: 'linkedin', path: `jobs/${JOB}/renders/rough-1/linkedin.png` }]);
    assert.ok(r.json.out.some(o => o.name === 'rough-1.html'));
    assert.match(r.json.brief, /Fixture copy/);
    assert.equal(r.json.control, null);
    assert.deepEqual(r.json.inbox, []);
    assert.equal((await request(`${f.base}/api/jobs/nope`, { headers: auth })).status, 404);
  } finally { await f.floor.close(); }
});

test('controls land in control.json without clobbering, and log names only', async () => {
  const f = await startFloor();
  const dir = join(f.desk, 'jobs', JOB);
  try {
    writeFileSync(join(dir, 'control.json'), JSON.stringify({ custom: 'keep me', paused: false }));
    const before = events(f.desk).length;

    let r = await post(f.base, JOB, { pause: true });
    assert.equal(r.status, 200);
    let c = readJson(join(dir, 'control.json'));
    assert.equal(c.paused, true);
    assert.equal(c.custom, 'keep me');

    r = await post(f.base, JOB, { pause: false });
    assert.equal(readJson(join(dir, 'control.json')).paused, false);

    r = await post(f.base, JOB, { stop: true });
    assert.equal(readJson(join(dir, 'control.json')).stop, true);

    r = await post(f.base, JOB, { pick: 2 });
    assert.equal(readJson(join(dir, 'control.json')).pick, 2);

    r = await post(f.base, JOB, { approve: true });
    assert.ok(readJson(join(dir, 'control.json')).approve.at);

    r = await post(f.base, JOB, { sendBack: { notes: 'tighten the headline' } });
    assert.equal(readJson(join(dir, 'control.json')).sendBack.notes, 'tighten the headline');

    r = await post(f.base, JOB, { models: { builder: 'google/flash', desks: { 'motion-designer': 'openai/mini' } }, scope: 'job' });
    assert.equal(r.status, 200);
    c = readJson(join(dir, 'control.json'));
    assert.equal(c.models.builder, 'google/flash');
    assert.equal(c.models.desks['motion-designer'], 'openai/mini');
    assert.equal(c.custom, 'keep me');
    assert.equal(readJson(join(f.desk, 'project.json')).models.builder, 'anthropic/haiku', 'job scope leaves project.json alone');

    r = await post(f.base, JOB, { models: { senior: 'anthropic/opus' }, scope: 'default' });
    assert.equal(r.status, 200);
    const project = readJson(join(f.desk, 'project.json'));
    assert.equal(project.models.senior, 'anthropic/opus');
    assert.equal(project.models.director, 'anthropic/opus');
    assert.equal(project.quality, 'studio', 'other keys stay');
    assert.equal(readJson(join(dir, 'control.json')).models.senior, 'anthropic/opus', 'default scope also writes the job');

    r = await post(f.base, JOB, { models: { desks: { 'motion-designer': null } }, scope: 'job' });
    assert.equal(readJson(join(dir, 'control.json')).models.desks, undefined);

    const added = events(f.desk).slice(before);
    assert.deepEqual(added.map(e => e.type), ['control.pause', 'control.pause', 'control.stop', 'control.pick', 'control.approve', 'control.sendBack', 'control.models', 'control.models', 'control.models']);
    assert.equal(added[0].id, JOB);
    assert.equal(added[3].rough, 2);
    assert.equal(added[5].chars, 'tighten the headline'.length);
    assert.equal(added[6].builder, 'google/flash');
    assert.equal(added[7].scope, 'default');
    assert.ok(!JSON.stringify(added).includes('tighten the headline'), 'notes never reach the log');

    assert.equal((await post(f.base, JOB, { pause: 'yes' })).status, 400);
    assert.equal((await post(f.base, JOB, { pause: true, stop: true })).status, 400);
    assert.equal((await post(f.base, JOB, { models: { builder: 'haiku' } })).status, 400);
    assert.equal((await post(f.base, JOB, { pick: 0 })).status, 400);
    assert.equal((await post(f.base, 'missing-job', { pause: true })).status, 404);
    assert.equal((await request(`${f.base}/api/control/${JOB}`, { method: 'POST', headers: auth, body: 'not json' })).status, 400);
  } finally { await f.floor.close(); }
});

test('a note appends to the inbox and only its length is logged', async () => {
  const f = await startFloor();
  const inbox = join(f.desk, 'jobs', JOB, 'inbox', 'ui-designer.md');
  try {
    let r = await post(f.base, JOB, { note: { desk: 'ui-designer', text: 'headline up 24px' } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.inbox, ['ui-designer']);
    r = await post(f.base, JOB, { note: { desk: 'ui-designer', text: 'and cut the second gradient' } });
    const text = readFileSync(inbox, 'utf8');
    assert.match(text, /headline up 24px\n\nand cut the second gradient\n/);
    const log = readFileSync(join(f.desk, 'events.jsonl'), 'utf8');
    assert.ok(!log.includes('headline up 24px'));
    const last = events(f.desk).pop();
    assert.equal(last.type, 'control.note');
    assert.equal(last.desk, 'ui-designer');
    assert.equal(last.chars, 'and cut the second gradient'.length);
    assert.equal((await request(`${f.base}/api/jobs/${JOB}`, { headers: auth })).json.inbox[0], 'ui-designer');
    assert.equal((await post(f.base, JOB, { note: { desk: 'Bad Desk', text: 'x' } })).status, 400);
    assert.equal((await post(f.base, JOB, { note: { desk: 'ui-designer', text: '   ' } })).status, 400);
  } finally { await f.floor.close(); }
});

test('file route serves only png, html, svg and json under out and jobs, refuses ..', async () => {
  const f = await startFloor();
  try {
    const png = await request(`${f.base}/api/file?path=jobs/${JOB}/renders/rough-1/linkedin.png`, { headers: auth });
    assert.equal(png.status, 200);
    assert.equal(png.headers['content-type'], 'image/png');
    assert.equal(png.buf.subarray(1, 4).toString(), 'PNG');
    const html = await request(`${f.base}/api/file?path=.desk/out/${JOB}/rough-1.html`, { headers: auth });
    assert.equal(html.status, 200);
    assert.equal(html.headers['content-security-policy'], 'sandbox');
    assert.match(html.buf.toString(), /Rough one/);
    for (const bad of [`jobs/${JOB}/../../project.json`, '../package.json', 'out/../project.json', `jobs/${JOB}/..%2F..%2Fproject.json`]) {
      const r = await request(`${f.base}/api/file?path=${bad}`, { headers: auth });
      assert.ok(r.status === 400 || r.status === 403, `${bad} gave ${r.status}`);
    }
    assert.equal((await request(`${f.base}/api/file?path=project.json`, { headers: auth })).status, 403);
    assert.equal((await request(`${f.base}/api/file?path=DESIGN.md`, { headers: auth })).status, 403);
    assert.equal((await request(`${f.base}/api/file?path=jobs/${JOB}/brief.md`, { headers: auth })).status, 403);
    assert.equal((await request(`${f.base}/api/file?path=jobs/${JOB}/renders/rough-9/linkedin.png`, { headers: auth })).status, 404);
    assert.equal((await request(`${f.base}/api/file?path=${encodeURIComponent('C:/Windows/win.ini')}`, { headers: auth })).status, 400);
  } finally { await f.floor.close(); }
});

test('sse sends the backlog, then follows new lines', async () => {
  const f = await startFloor();
  try {
    const fixtureLines = events(f.desk).length;
    const got = await new Promise((ok, fail) => {
      const req = http.get(`${f.base}/api/events?token=${TOKEN}`, res => {
        assert.equal(res.statusCode, 200);
        assert.match(res.headers['content-type'], /text\/event-stream/);
        let text = '';
        let appended = false;
        const timer = setTimeout(() => { req.destroy(); fail(new Error('timed out waiting for the followed line')); }, 5000);
        res.on('data', c => {
          text += c;
          if (!appended && text.includes('event: ready')) {
            appended = true;
            appendFileSync(join(f.desk, 'events.jsonl'), JSON.stringify({ t: new Date().toISOString(), type: 'desk.stop', desk: 'ui-designer', agent: 'follow-1' }) + '\n');
          }
          if (appended && text.includes('"agent":"follow-1"')) { clearTimeout(timer); req.destroy(); ok(text); }
        });
        res.on('error', () => {});
      });
      req.on('error', e => { if (e.code !== 'ECONNRESET') fail(e); });
    });
    const frames = got.split('\n\n').filter(Boolean);
    assert.ok(frames[0].startsWith('event: hello'));
    const backlog = frames.slice(1, frames.indexOf('event: ready\ndata: {}'));
    assert.equal(backlog.length, fixtureLines);
    assert.match(backlog[0], /session\.start/);
    assert.ok(backlog.some(fr => fr.includes('"costUsd":0.0123')), 'priced desk.stop lines come through untouched');
    assert.ok(frames.some(fr => fr.includes('"desk.stop"') && fr.includes('"follow-1"')), 'the appended line arrived');
  } finally { await f.floor.close(); }
});

test('findProject walks up three levels', () => {
  const { root } = makeProject();
  const deep = join(root, 'a', 'b', 'c');
  execFileSync(process.execPath, ['-e', `require('fs').mkdirSync(${JSON.stringify(deep)}, { recursive: true })`]);
  assert.equal(findProject(deep).root, root);
  assert.equal(findProject(join(deep, 'd')), null);
});

test('cli: setup writes dashboard.json and the gitignore lines, start prints a url, status and stop work', async () => {
  const { root, desk } = makeProject();
  writeFileSync(join(desk, '.gitignore'), 'jobs/\n');
  const run = (args, opts = {}) => execFileSync(process.execPath, [SERVER, ...args, '--project', root], { encoding: 'utf8', timeout: 20000, ...opts });

  const status0 = (() => { try { return run(['status']); } catch (e) { return { code: e.status, out: e.stdout }; } })();
  assert.equal(status0.code, 3);
  assert.match(status0.out, /not enabled/);

  const setup = run(['setup', '--port', '7499']);
  assert.match(setup, /Floor enabled/);
  assert.deepEqual(readJson(join(desk, 'dashboard.json')), { enabled: true, port: 7499 });
  const ignore = readFileSync(join(desk, '.gitignore'), 'utf8').split('\n');
  for (const line of ['events.jsonl', 'jobs/', 'dashboard.runtime.json', 'dashboard.log']) assert.ok(ignore.includes(line), line);
  assert.equal(ignore.filter(l => l === 'jobs/').length, 1, 'no duplicate lines');

  const port = 7400 + Math.floor(Math.random() * 90);
  const started = run(['start', '--port', String(port)]);
  const m = /http:\/\/127\.0\.0\.1:(\d+)\/\?token=([0-9a-f]{32})/.exec(started);
  assert.ok(m, started);
  assert.equal(Number(m[1]), port);
  const token = m[2];
  try {
    const runtime = readJson(join(desk, 'dashboard.runtime.json'));
    assert.equal(runtime.token, token);
    assert.equal(runtime.port, port);
    const h = await request(`http://127.0.0.1:${port}/api/health`, { headers: { 'X-Desk-Token': token } });
    assert.equal(h.status, 200);
    assert.equal(h.json.pid, runtime.pid);
    assert.equal((await request(`http://127.0.0.1:${port}/api/state`)).status, 401);
    const status = run(['status']);
    assert.match(status, /running/);
    assert.ok(status.includes(`?token=${token}`));
    const again = run(['start']);
    assert.match(again, /already running/);
  } finally {
    const stopped = run(['stop']);
    assert.match(stopped, /stopped/);
  }
  assert.ok(!existsSync(join(desk, 'dashboard.runtime.json')));
  assert.equal(await request(`http://127.0.0.1:${port}/api/health`).catch(() => null), null);
  const disabled = run(['disable']);
  assert.match(disabled, /disabled/);
  assert.equal(readJson(join(desk, 'dashboard.json')).enabled, false);
  const noStart = (() => { try { return run(['start']); } catch (e) { return { code: e.status, err: e.stderr }; } })();
  assert.equal(noStart.code, 3);
  assert.match(noStart.err, /not enabled/);
});
