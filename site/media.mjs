#!/usr/bin/env node
// The site's loops and posters, from the recorded takes: 1280 by 720 H.264 under the page budget, and a WebP poster.
//   node site/media.mjs [--takes clips/takes] [--out site/media]
// Each 16:9 take <name>-1920x1080.mp4 becomes media/<name>.mp4 and media/<name>.webp. The files are committed, so the
// Pages build needs no Chrome or ffmpeg: it copies them.
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter(Boolean));
const takes = resolve(args.takes || join(root, 'clips', 'takes'));
const out = resolve(args.out || join(here, 'media'));
mkdirSync(out, { recursive: true });

const ff = a => spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { encoding: 'utf8' });
const rows = [];
for (const f of readdirSync(takes).filter(f => /-1920x1080\.mp4$/.test(f)).sort()) {
  const name = f.replace(/-1920x1080\.mp4$/, '');
  const mp4 = join(out, `${name}.mp4`), jpg = join(out, `${name}.webp`);
  const r1 = ff(['-i', join(takes, f), '-vf', 'scale=1280:720', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4]);
  const poster = join(takes, `${name}-1920x1080.png`);
  const r2 = existsSync(poster) ? ff(['-i', poster, '-vf', 'scale=1280:720', '-c:v', 'libwebp', '-quality', '80', jpg]) : { status: 1 };
  rows.push({ name, mp4: r1.status === 0 ? statSync(mp4).size : null, jpg: r2.status === 0 ? statSync(jpg).size : null });
}
// Vertical takes (<name>-1080x1920) become the hero's tall loop, media/<name>-vertical.mp4, and its poster.
for (const f of readdirSync(takes).filter(f => /-1080x1920\.mp4$/.test(f)).sort()) {
  const name = f.replace(/-1080x1920\.mp4$/, '') + '-vertical';
  const mp4 = join(out, `${name}.mp4`), jpg = join(out, `${name}.webp`);
  const r1 = ff(['-i', join(takes, f), '-vf', 'scale=720:1280', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4]);
  const poster = join(takes, f.replace(/\.mp4$/, '.png'));
  const r2 = existsSync(poster) ? ff(['-i', poster, '-vf', 'scale=720:1280', '-c:v', 'libwebp', '-quality', '80', jpg]) : { status: 1 };
  rows.push({ name, mp4: r1.status === 0 ? statSync(mp4).size : null, jpg: r2.status === 0 ? statSync(jpg).size : null });
}
// GIFs for the README, where video does not play: 640 wide, 12 frames a second, a palette per clip.
const GIFS = ['one-command', 'explainer', 'one-line', 'the-pick', 'floor-idle', 'before-after', 'cost-meter', 'pick-it-yourself', 'swap-the-seat', 'note-to-the-desk', 'proof'];
for (const name of GIFS) {
  const src = join(takes, `${name}-1920x1080.mp4`);
  if (!existsSync(src)) continue;
  const gif = join(out, `${name}.gif`);
  // The one-command wall moves every pixel on every frame, so its GIF runs smaller and slower to stay near the others.
  const [fps, w, colors] = name === 'one-command' ? [10, 560, 96] : name === 'explainer' ? [10, 640, 128] : [12, 640, 128];
  const r = ff(['-i', src, '-vf', `fps=${fps},scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, '-loop', '0', gif]);
  const row = rows.find(x => x.name === name);
  if (row) row.gif = r.status === 0 ? statSync(gif).size : null;
}
for (const r of rows) console.log(`${r.name.padEnd(20)} mp4 ${r.mp4 ? (r.mp4 / 1e6).toFixed(2) + ' MB' : 'failed'}   poster ${r.jpg ? Math.round(r.jpg / 1e3) + ' KB' : 'failed'}${r.gif !== undefined ? `   gif ${r.gif ? (r.gif / 1e6).toFixed(2) + ' MB' : 'failed'}` : ''}`);
const over = rows.filter(r => r.mp4 > 1.5e6);
if (over.length) { console.error(`Over the 1.5 MB loop budget: ${over.map(r => r.name).join(', ')}`); process.exit(1); }
