#!/usr/bin/env node
// The promotional image set, from frames of the recorded takes, so still and motion match.
//   node site/images.mjs [--takes clips/takes] [--out site/images]
// Subjects: the floor, the scorecard, the cost line, the gallery, and the hook (the sting's end line), each at
// og 1200x630, linkedin 1200x627, x 1600x900, reddit 1200x628 (from the 16:9 take), square 1080x1080 (from the 1:1
// take) and story 1080x1920 (from the 9:16 take). The hook at og size is also written to site/media/og.png.
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter(Boolean));
const takes = resolve(args.takes || join(root, 'clips', 'takes'));
const out = resolve(args.out || join(here, 'images'));
mkdirSync(out, { recursive: true });

// Subject: the take and the second to take the frame at.
const SUBJECTS = {
  hook: { clip: 'made-by-the-studio', at: 2.0 },
  floor: { clip: 'floor-idle', at: 0.0 },
  scorecard: { clip: 'before-after', at: 3.2 },
  'cost-line': { clip: 'cost-meter', at: 5.2 },
  gallery: { clip: 'carousel', at: 5.0 },
};
const SIZES = { og: [1200, 630, '1920x1080'], linkedin: [1200, 627, '1920x1080'], x: [1600, 900, '1920x1080'], reddit: [1200, 628, '1920x1080'], square: [1080, 1080, '1080x1080'], story: [1080, 1920, '1080x1920'] };

const ff = a => spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { encoding: 'utf8' });
const rows = [];
for (const [subject, { clip, at }] of Object.entries(SUBJECTS)) {
  for (const [size, [w, h, take]] of Object.entries(SIZES)) {
    const src = join(takes, `${clip}-${take}.mp4`);
    if (!existsSync(src)) { rows.push(`${subject}-${size}: no take ${clip}-${take}`); continue; }
    const file = join(out, `${subject}-${size}.png`);
    // Scale to cover, then crop to the exact size from the centre.
    const r = ff(['-ss', String(at), '-i', src, '-frames:v', '1', '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`, file]);
    rows.push(`${subject}-${size}: ${r.status === 0 ? Math.round(statSync(file).size / 1e3) + ' KB' : 'failed'}`);
    if (r.status === 0 && subject === 'hook' && size === 'og') { mkdirSync(join(here, 'media'), { recursive: true }); ff(['-i', file, join(here, 'media', 'og.png')]); }
  }
}
console.log(rows.join('\n'));
