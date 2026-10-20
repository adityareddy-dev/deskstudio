import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { runCli, detect, runApi } from '../providers/google.mjs';

const model = { id: 'gemini-3.8-flash', cli: 'gemini-3.8-flash-low', effort: 'low' };

async function withCli(body, check) {
  const dir = mkdtempSync(join(tmpdir(), 'desk-google-test-'));
  const previous = process.env.PATH;
  const capture = join(dir, 'capture.json');
  const script = `#!/usr/bin/env node\nimport fs from 'node:fs';\nimport path from 'node:path';\nconst args=process.argv.slice(2);\nconst capture=${JSON.stringify(capture)};\n${body}\n`;
  writeFileSync(join(dir, 'agy'), script, { mode: 0o755 });
  if (process.platform === 'win32') {
    writeFileSync(join(dir, 'agy.mjs'), script);
    writeFileSync(join(dir, 'agy.cmd'), `@echo off\r\n"${process.execPath}" "%~dp0agy.mjs" %*\r\n`);
  }
  process.env.PATH = dir + delimiter + previous;
  try { return await check({ dir, capture }); }
  finally { process.env.PATH = previous; rmSync(dir, { recursive: true, force: true }); }
}

test('Google transports the whole brief on stdin and verifies each copied screenshot', async () => {
  const body = `let input=''; for await (const part of process.stdin) input+=part;
const message=JSON.parse(input);
const images=fs.readdirSync('.').filter(n=>n.endsWith('.png'));
for(const [i,file] of images.entries()) {
  const absolute=fs.realpathSync(file);
  const reported=process.platform==='win32'?absolute.toLowerCase():absolute;
  console.log(JSON.stringify({event:'step_update',step_update:{state:'DONE',tool_name:i?'read_file':'view_file',tool_info:{parameters:{[i?'Path':'AbsolutePath']:reported}}}}));
}
console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:JSON.stringify({message,args,images,cwd:process.cwd()}),usage:{input_tokens:120,output_tokens:34,thinking_tokens:20,cache_read_tokens:200}}}));`;
  await withCli(body, async ({ dir }) => {
    const image = join(dir, 'source.png');
    const otherImage = join(dir, 'other.png');
    writeFileSync(image, 'test image bytes');
    writeFileSync(otherImage, 'other test image bytes');
    const r = await runCli({ model, system: 'Complete system brief.', prompt: `Complete user brief. Review ${image} and ${otherImage}.`, images: [image, otherImage], cwd: dir, timeoutMs: 5000 });
    const data = JSON.parse(r.text);
    assert.equal(data.message.event, 'user');
    assert.match(data.message.message.content, /Complete user brief/);
    assert.match(data.message.message.content, /Complete system brief/);
    assert.ok(!data.message.message.content.includes(image) && !data.message.message.content.includes(otherImage));
    assert.ok(data.args.includes('--input-format') && data.args.includes('stream-json'));
    assert.ok(!data.args.includes('--print'));
    assert.ok(data.args.includes(model.cli));
    assert.equal(data.args[data.args.indexOf('--effort') + 1], 'low');
    assert.notEqual(data.cwd, dir, 'the caller project is never the CLI workspace');
    assert.deepEqual(data.images, ['screenshot-1.png', 'screenshot-2.png']);
    assert.deepEqual(r.usage, { input: 120, output: 34, cacheRead: 200, cacheWrite: 0 });
    assert.equal(existsSync(data.cwd), false, 'the temporary brief and screenshots are removed');
  });
});

test('Google rejects a successful envelope when the process exits nonzero', async () => {
  await withCli(`console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:'wrong'}}));process.exit(12);`, async () => {
    await assert.rejects(runCli({ model, prompt: 'a brief', timeoutMs: 5000 }), /agy failed \(exit 12\)/);
  });
});

test('Google rejects terminal errors even when the process exits zero', async () => {
  await withCli(`console.log(JSON.stringify({event:'result',result:{status:'ERROR',error:'model unavailable',response:''}}));`, async () => {
    await assert.rejects(runCli({ model, prompt: 'a brief', timeoutMs: 5000 }), /model unavailable/);
  });
});

test('Google rejects visual review when a screenshot was not inspected', async () => {
  await withCli(`console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:'looks good'}}));`, async ({ dir }) => {
    const image = join(dir, 'source.png');
    writeFileSync(image, 'test image bytes');
    await assert.rejects(runCli({ model, prompt: 'review', images: [image], timeoutMs: 5000 }), /did not inspect every supplied screenshot/);
  });
});

test('Google rejects missing results and removes the scratch workspace after failure', async () => {
  await withCli(`fs.writeFileSync(capture,process.cwd());console.log('no result');`, async ({ capture }) => {
    await assert.rejects(runCli({ model, prompt: 'a brief', timeoutMs: 5000 }), /gave no result event/);
    assert.equal(existsSync(readFileSync(capture, 'utf8')), false);
  });
});

test('Google checks Antigravity sign-in through the CLI and falls back to a key', async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    await withCli(`if(args[0]==='--version'){console.log('1.4.2');process.exit(0)};process.exit(1);`, async () => {
      const d = detect();
      assert.equal(d.cli.signedIn, false);
      assert.equal(d.via, 'api');
      assert.equal(d.key, 'GEMINI_API_KEY');
    });
  } finally {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});

test('Argon cannot silently fall through to a Gemini API request', async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    await assert.rejects(runApi({ model: { id: 'gemini-4-argon', api: false }, prompt: 'a brief' }), /Antigravity model/);
  } finally {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});
