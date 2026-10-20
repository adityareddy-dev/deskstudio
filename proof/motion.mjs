// Records a clip from an HTML timeline and checks it: reading time per text block, flashes, first and last frame.
// Output: WebM from Chrome's recorder, MP4 when ffmpeg is on PATH, sampled frames as PNG, and a JSON result.
import { mkdirSync, readdirSync, renameSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { launch } from './browser.mjs';

const SAMPLE_MS = 200;

function luminance(pngPath) {
  const img = PNG.sync.read(readFileSync(pngPath));
  let sum = 0, n = 0;
  for (let y = 0; y < img.height; y += 8) for (let x = 0; x < img.width; x += 8) {
    const i = (y * img.width + x) * 4;
    sum += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]; n++;
  }
  return n ? sum / n / 255 : 0;
}

function hasFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return r.status === 0;
}

// The export: every animation on the page seeked to each frame time and screenshotted, so the file is
// frame-accurate at the fps asked for. Chrome's recorder starts late and runs long, so it is for the checks only.
export async function exportFrames({ file, size, seconds = 8, fps = 30, outDir, name = 'clip' }) {
  const framesDir = join(outDir, `${name}-frames`);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const total = Math.round(seconds * fps);
  const browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
    await context.route('**/*', route => /^(https?|wss?):/.test(route.request().url()) ? route.abort() : route.continue());
    const page = await context.newPage();
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { for (const a of document.getAnimations({ subtree: true })) a.pause(); });
    for (let k = 0; k < total; k++) {
      await page.evaluate(t => { for (const a of document.getAnimations({ subtree: true })) { a.pause(); a.currentTime = t; } }, k * 1000 / fps);
      await page.screenshot({ path: join(framesDir, `f-${String(k).padStart(5, '0')}.png`) });
    }
    await context.close();
  } finally { await browser.close(); }
  let mp4 = null, webm = null;
  if (hasFfmpeg()) {
    const input = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(framesDir, 'f-%05d.png')];
    mp4 = join(outDir, `${name}.mp4`);
    if (spawnSync('ffmpeg', [...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(fps), mp4], { encoding: 'utf8' }).status !== 0) mp4 = null;
    webm = join(outDir, `${name}.webm`);
    if (spawnSync('ffmpeg', [...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-pix_fmt', 'yuv420p', '-r', String(fps), webm], { encoding: 'utf8' }).status !== 0) webm = null;
  }
  return { frames: total, fps, framesDir, mp4, webm, poster: join(framesDir, 'f-00000.png') };
}

export async function recordMotion({ file, size, seconds = 8, outDir, name = 'clip' }) {
  mkdirSync(outDir, { recursive: true });
  const framesDir = join(outDir, 'frames');
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const videoDir = join(outDir, 'video-tmp');
  rmSync(videoDir, { recursive: true, force: true });
  const browser = await launch();
  const samples = [];
  let videoPath = null;
  try {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, recordVideo: { dir: videoDir, size: { width: size.width, height: size.height } } });
    await context.route('**/*', route => /^(https?|wss?):/.test(route.request().url()) ? route.abort() : route.continue());
    const page = await context.newPage();
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const start = Date.now();
    let i = 0;
    while (Date.now() - start < seconds * 1000) {
      const t = (Date.now() - start) / 1000;
      const png = join(framesDir, `f-${String(i).padStart(4, '0')}.png`);
      const texts = await page.evaluate(() => {
        const out = [];
        const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const el = node.parentElement;
          if (!el || !node.textContent.trim() || ['SCRIPT', 'STYLE', 'TITLE'].includes(el.tagName)) continue;
          let opacity = 1, hidden = false;
          for (let a = el; a; a = a.parentElement) { const s = getComputedStyle(a); opacity *= Number(s.opacity); hidden ||= s.display === 'none' || s.visibility !== 'visible'; }
          const r = el.getBoundingClientRect();
          const inView = r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
          if (!hidden && opacity >= 0.9 && inView) out.push(node.textContent.trim().replace(/\s+/g, ' '));
        }
        return out;
      });
      await page.screenshot({ path: png });
      samples.push({ i, t, png, texts });
      i++;
      const next = start + (i * SAMPLE_MS);
      const wait = next - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
    }
    const video = page.video();
    await context.close();
    const tmp = video ? await video.path() : null;
    if (tmp && existsSync(tmp)) { videoPath = join(outDir, `${name}-recorded.webm`); renameSync(tmp, videoPath); }
    rmSync(videoDir, { recursive: true, force: true });
  } finally { await browser.close(); }

  // Checks
  const failures = [];
  // Reading time: each distinct text block must be continuously visible for max(1.2s, words*60/200).
  const spans = new Map();
  for (const s of samples) for (const text of new Set(s.texts)) {
    if (!spans.has(text)) spans.set(text, []);
    const list = spans.get(text);
    const last = list.at(-1);
    if (last && s.i === last.endIndex + 1) { last.end = s.t; last.endIndex = s.i; } else list.push({ start: s.t, end: s.t, endIndex: s.i });
  }
  for (const [text, list] of spans) {
    const words = text.split(/\s+/).length;
    const need = Math.max(1.2, words * 60 / 200);
    const longest = Math.max(...list.map(x => x.end - x.start + SAMPLE_MS / 1000));
    if (longest + 0.05 < need) failures.push({ check: 'reading-time', text: text.length > 40 ? text.slice(0, 37) + '...' : text, reason: `visible for ${longest.toFixed(1)}s at most, needs ${need.toFixed(1)}s for ${words} words` });
  }
  // Flashes: luminance jumps over 20% between samples, more than 3 in any one second.
  const lums = samples.map(s => luminance(s.png));
  const jumps = [];
  for (let k = 1; k < lums.length; k++) if (Math.abs(lums[k] - lums[k - 1]) > 0.2) jumps.push(samples[k].t);
  for (let k = 0; k < jumps.length; k++) { const inSecond = jumps.filter(t => t >= jumps[k] && t < jumps[k] + 1).length; if (inSecond > 3) { failures.push({ check: 'flash', text: '', reason: `${inSecond} large luminance changes within one second around ${jumps[k].toFixed(1)}s, the limit is 3` }); break; } }
  // First and last frame hold something readable.
  if (samples.length && !samples[0].texts.length) failures.push({ check: 'first-frame', text: '', reason: 'nothing readable on the first frame, the poster frame must carry the hook' });
  if (samples.length && !samples.at(-1).texts.length) failures.push({ check: 'last-frame', text: '', reason: 'nothing readable on the last frame, the end frame must hold the mark or the line' });

  return { pass: failures.length === 0, file, seconds, size: `${size.width}x${size.height}`, recorded: videoPath, ffmpeg: hasFfmpeg(), samples: samples.length, samplesDir: framesDir, poster: samples[0]?.png || null, failures };
}
