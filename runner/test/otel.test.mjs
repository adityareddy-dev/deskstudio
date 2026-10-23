import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runJob } from '../run.mjs';
import { makeFake } from '../providers/fake.mjs';
import { readEvents, jobIds, buildTrace, toOtlp, main } from '../otel.mjs';
import { BRIEF, roughReply, polishReply, PICK, SCORES_PASS, tempProject } from './fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CARD = join(here, '..', '..', 'clips', 'fixtures', 'card', 'events.jsonl');
const quiet = () => {};
const kv = span => Object.fromEntries(span.attributes.map(a => [a.key, Object.values(a.value)[0]]));
const byName = (spans, prefix) => spans.filter(s => s.name.startsWith(prefix));

test('the Claude Code card run becomes one trace with a span per desk and per tool call', () => {
  const events = readEvents(CARD);
  const [id] = jobIds(events);
  const { traceId, spans, desks } = buildTrace(events, id);
  const root = spans[0];
  assert.equal(root.name, 'invoke_workflow design');
  assert.equal(root.parentSpanId, undefined);
  assert.equal(kv(root)['gen_ai.workflow.name'], 'design');
  assert.equal(byName(spans, 'invoke_agent ').length, events.filter(e => e.type === 'desk.stop').length);
  assert.equal(byName(spans, 'execute_tool ').length, events.filter(e => e.type === 'desk.tool').length);
  assert.ok(spans.every(s => s.traceId === traceId && /^[0-9a-f]{32}$/.test(s.traceId) && /^[0-9a-f]{16}$/.test(s.spanId)));
  const ids = new Set(spans.map(s => s.spanId));
  assert.equal(ids.size, spans.length);
  assert.ok(spans.slice(1).every(s => ids.has(s.parentSpanId)));
  for (const tool of byName(spans, 'execute_tool ')) {
    const parent = spans.find(s => s.spanId === tool.parentSpanId);
    assert.equal(kv(parent)['gen_ai.agent.name'], kv(tool)['gen_ai.agent.name']);
    assert.ok(BigInt(tool.startTimeUnixNano) >= BigInt(parent.startTimeUnixNano));
  }
  const first = kv(byName(spans, 'invoke_agent ')[0]);
  assert.equal(first['gen_ai.agent.name'], 'ui-designer');
  assert.equal(first['gen_ai.provider.name'], 'anthropic');
  const stop = events.find(e => e.type === 'desk.stop');
  assert.equal(Number(first['gen_ai.usage.input_tokens']), stop.tokens.input + stop.tokens.cacheRead + stop.tokens.cacheWrite);
  assert.equal(Number(first['gen_ai.usage.output_tokens']), stop.tokens.output);
  // docs/cost.md: the launch card cost $1.34 at list price, 1.3354 in state.json.
  const total = Object.values(desks).reduce((n, d) => n + d.costUsd, 0);
  assert.equal(Math.round(total * 10000) / 10000, 1.3354);
  assert.equal(desks['creative-director'].calls, 3);
});

test('a desk-run job gets a chat span under each desk, with tokens and cost, and a proof tool span', { timeout: 120000 }, async () => {
  const dir = tempProject();
  const roughs = [roughReply(1, 'Editorial split'), roughReply(2, 'Full bleed with scrim'), roughReply(3, 'Type only')];
  const fake = makeFake({ brief: BRIEF('linkedin'), roughs, pick: PICK, polish: polishReply(), scores: SCORES_PASS });
  const r = await runJob({ command: 'design', ask: 'a LinkedIn card announcing Desk Studio.', project: dir, rounds: 2, invoke: fake.runModel, log: quiet });
  assert.equal(r.code, 0, r.error?.message);
  const events = readEvents(join(dir, '.desk', 'events.jsonl'));
  const { spans, desks } = buildTrace(events, r.id);
  const agents = byName(spans, 'invoke_agent ');
  const chats = byName(spans, 'chat ');
  assert.equal(agents.length, fake.calls.length);
  assert.equal(chats.length, fake.calls.length);
  for (const chat of chats) {
    const a = kv(chat);
    const parent = spans.find(s => s.spanId === chat.parentSpanId);
    assert.equal(chat.kind, 3);
    assert.equal(parent.kind, 1);
    assert.equal(a['gen_ai.operation.name'], 'chat');
    assert.equal(a['gen_ai.agent.name'], kv(parent)['gen_ai.agent.name']);
    assert.equal(a['gen_ai.provider.name'], 'anthropic');
    assert.equal(chat.name, `chat ${a['gen_ai.request.model']}`);
    assert.equal(Number(a['gen_ai.usage.input_tokens']), 1300); // 1000 plus 200 cache read plus 100 cache write
    assert.equal(Number(a['gen_ai.usage.output_tokens']), 500);
    assert.equal(a['deskstudio.cost.usd'], 0.01);
    assert.equal(kv(parent)['gen_ai.usage.input_tokens'], undefined, 'tokens sit on the model call only');
  }
  assert.deepEqual(Object.keys(desks).sort(), ['art-director', 'creative-director', 'design-manager', 'ui-designer']);
  assert.equal(desks['ui-designer'].calls, 4);
  const proof = byName(spans, 'execute_tool proof');
  assert.equal(proof.length, r.state.proof.length);
  assert.equal(kv(proof[0])['gen_ai.tool.name'], 'proof');
  assert.equal(kv(spans[0])['deskstudio.job.pass'], true);
});

test('the export posts OTLP/JSON to the collector named in OTEL_EXPORTER_OTLP_ENDPOINT', async () => {
  let got = null;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => { got = { path: req.url, type: req.headers['content-type'], auth: req.headers.authorization, body: JSON.parse(body) }; res.end('{}'); });
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const { port } = server.address();
  try {
    const env = { OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${port}/`, OTEL_EXPORTER_OTLP_HEADERS: 'authorization=Bearer%20x', OTEL_RESOURCE_ATTRIBUTES: 'deployment.environment.name=test', OTEL_SERVICE_NAME: 'studio-a' };
    const code = await main(['--events', CARD], env, quiet);
    assert.equal(code, 0);
  } finally { server.close(); }
  assert.equal(got.path, '/v1/traces');
  assert.equal(got.type, 'application/json');
  assert.equal(got.auth, 'Bearer x');
  const resource = Object.fromEntries(got.body.resourceSpans[0].resource.attributes.map(a => [a.key, a.value.stringValue]));
  assert.equal(resource['service.name'], 'studio-a');
  assert.equal(resource['deployment.environment.name'], 'test');
  assert.equal(got.body.resourceSpans[0].scopeSpans[0].scope.name, 'deskstudio');
  assert.equal(got.body.resourceSpans[0].scopeSpans[0].spans.length, 172);
});

test('without an endpoint the request body goes to stdout', async () => {
  let printed = '';
  const code = await main(['--events', CARD], {}, s => { printed += s; });
  assert.equal(code, 0);
  const body = JSON.parse(printed);
  assert.deepEqual(body, toOtlp([buildTrace(readEvents(CARD), jobIds(readEvents(CARD))[0])], {}));
});


test('the CLI flushes a full trace when stdout is piped', () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('OTEL_')));
  const result = spawnSync(process.execPath, [join(here, '..', 'otel.mjs'), '--events', CARD], {
    env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.length > 65536, 'exercise output larger than the truncated pipe buffer');
  const expected = toOtlp([buildTrace(readEvents(CARD), jobIds(readEvents(CARD))[0])], env);
  assert.deepEqual(JSON.parse(result.stdout), expected);
});
