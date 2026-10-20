#!/usr/bin/env node
// The explainer: one command, then the studio as a little team passing the work along, then the work back in your terminal.
// It retells the real launch-card job (clips/fixtures/card): three roughs on Sonnet, the Art Director's pick on Opus,
// polish on Haiku, proof with no model, and the Creative Director sending it back at 8.4 and 8.5 before signing off at 8.9.
// Every frame is drawn from a fixed timeline, so every take comes out the same.
//   node clips/explainer.mjs [--size 16:9] [--out clips/takes] [--still 4,9.5,16]
// Output: explainer-<WxH>.mp4 and the poster frame explainer-<WxH>.png.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../proof/browser.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : []).filter(Boolean));
const [W, H] = [1920, 1080];
const out = resolve(args.out || join(here, 'takes'));
const FPS = 30, SECONDS = 30;
const JOB = join(here, 'fixtures', 'card', 'jobs', '20261019-0025-launch-card-desk-studio');
const job = JSON.parse(readFileSync(join(JOB, 'state.json'), 'utf8'));
const render = name => pathToFileURL(join(JOB, 'renders', name, 'linkedin.png')).href;
const IMG = Object.fromEntries(['rough-1', 'rough-2', 'rough-3', 'round-1', 'round-2', 'round-3'].map(n => [n, render(n)]));
const scores = job.scores.map(s => ({ round: s.round, average: s.average, low: Object.entries(s.axes).filter(([, v]) => v < 8) }));
const pick = job.pick.reason.split(',')[0];
const models = JSON.parse(readFileSync(join(root, 'runner', 'models.json'), 'utf8')).providers;
const cap = s => s[0].toUpperCase() + s.slice(1);
// What each tier shows when the badges cycle through the providers the runner reaches.
const BADGE = {
  anthropic: t => cap(models.anthropic.tiers[t]),
  openai: t => `OpenAI ${models.openai.tiers[t]}`,
  google: t => `Google ${models.google.tiers[t]}`,
};

const font = f => pathToFileURL(join(root, 'fonts', f)).href;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const BASE = 780;

// A desk worker: a little robot with a screen for a face and the studio's lamp for an antenna, at a desk with its name
// and model under it. Proof has no model, so its screen shows a scan line instead of eyes.
function worker({ id, x, color, name, badge, robot = false, scale = 1 }) {
  const face = robot
    ? `<rect class="scan" x="-24" y="-160" width="48" height="8" rx="4" fill="#56e0ff"/><rect x="-24" y="-160" width="48" height="8" rx="4" fill="#fff" opacity=".35"/>`
    : `<ellipse cx="-14" cy="-157" rx="8.5" ry="11" fill="#f4f0e8"/><ellipse cx="14" cy="-157" rx="8.5" ry="11" fill="#f4f0e8"/><circle cx="-11" cy="-161" r="3" fill="#fff"/><circle cx="17" cy="-161" r="3" fill="#fff"/>`;
  return `<g id="${id}" transform="translate(${x},${BASE}) scale(${scale})">
  <g class="bob">
    <rect x="-38" y="-120" width="76" height="72" rx="18" fill="${color}"/>
    <rect x="-17" y="-106" width="34" height="20" rx="6" fill="#fff" opacity=".22"/><circle cx="-7" cy="-96" r="3" fill="#17140f" opacity=".45"/><circle cx="7" cy="-96" r="3" fill="#17140f" opacity=".45"/>
    <rect x="-9" y="-130" width="18" height="12" rx="3" fill="#5a554b"/>
    <circle cx="-47" cy="-156" r="8" fill="${color}"/><circle cx="47" cy="-156" r="8" fill="${color}"/><circle cx="-47" cy="-156" r="3.5" fill="#17140f" opacity=".35"/><circle cx="47" cy="-156" r="3.5" fill="#17140f" opacity=".35"/>
    <rect x="-46" y="-190" width="92" height="64" rx="24" fill="${color}"/>
    <rect x="-36" y="-182" width="72" height="48" rx="16" fill="#17140f"/>
    <g class="eyes">${face}</g>
    ${robot ? '' : '<ellipse cx="-25" cy="-143" rx="6" ry="3.5" fill="#ff8fa3" opacity=".7"/><ellipse cx="25" cy="-143" rx="6" ry="3.5" fill="#ff8fa3" opacity=".7"/><path d="M -6 -143 Q 0 -137 6 -143" stroke="#f4f0e8" stroke-width="3" fill="none" stroke-linecap="round"/>'}
    <line x1="0" y1="-190" x2="0" y2="-206" stroke="#5a554b" stroke-width="4" stroke-linecap="round"/>
    <circle class="glow" cx="0" cy="-214" r="24" fill="#ffaa1c" opacity="0"/>
    <circle class="lamp" cx="0" cy="-214" r="10" fill="#3b3830"/>
    <g class="armL" transform="rotate(0 -38 -108)"><rect x="-52" y="-110" width="15" height="40" rx="7.5" fill="${color}"/><circle cx="-44.5" cy="-68" r="9" fill="#5a554b"/></g>
    <g class="armR" transform="rotate(0 38 -108)"><rect x="37" y="-110" width="15" height="40" rx="7.5" fill="${color}"/><circle cx="44.5" cy="-68" r="9" fill="#5a554b"/></g>
  </g>
  <rect x="-28" y="-78" width="56" height="28" rx="4" fill="#2a2620"/><circle cx="0" cy="-64" r="3" fill="#5a554b"/>
  <rect x="-82" y="-52" width="164" height="16" rx="6" fill="#f4f0e8"/>
  <rect x="-72" y="-36" width="10" height="36" rx="3" fill="#d9d4c8"/><rect x="62" y="-36" width="10" height="36" rx="3" fill="#d9d4c8"/>
  <text x="0" y="36" text-anchor="middle" class="name">${esc(name)}</text>
  <g class="badgebox"><rect class="pill" x="-70" y="50" width="140" height="32" rx="16" fill="#2a2620" stroke="#3b3830"/><text class="badge" x="0" y="72" text-anchor="middle">${esc(badge)}</text></g>
</g>`;
}

const D1 = 520, D2 = 650, D3 = 780, AD = 1030, B = 1270, P = 1500, CD = 1740, MGR = 250;
const team = [
  { id: 'mgr', x: MGR, color: '#ffd27a', name: 'Design Manager', badge: 'your agent' },
  { id: 'd1', x: D1, color: '#56b4e9', name: '', badge: '', scale: 0.86, tier: 'senior' },
  { id: 'd2', x: D2, color: '#56b4e9', name: 'UI Designers', badge: 'Sonnet', scale: 0.86, tier: 'senior' },
  { id: 'd3', x: D3, color: '#56b4e9', name: '', badge: '', scale: 0.86, tier: 'senior' },
  { id: 'ad', x: AD, color: '#cc79a7', name: 'Art Director', badge: 'Opus', tier: 'director' },
  { id: 'b', x: B, color: '#009e73', name: 'UI Designer', badge: 'Haiku', tier: 'builder' },
  { id: 'p', x: P, color: '#0072b2', name: 'Proof', badge: 'no model', robot: true },
  { id: 'cd', x: CD, color: '#d55e00', name: 'Creative Director', badge: 'Opus', tier: 'director' },
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 100 900; src: url("${font('inter/Inter-Variable.woff2')}") format("woff2"); }
@font-face { font-family: "Geist Mono"; font-weight: 100 900; src: url("${font('geist/GeistMono-Variable.woff2')}") format("woff2"); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #12110f; color: #f4f0e8; font-family: Inter, sans-serif; }
svg { position: absolute; inset: 0; }
.name { font: 600 22px Inter, sans-serif; fill: #f4f0e8; }
.badge { font: 500 17px "Geist Mono", monospace; fill: #ffaa1c; }
.bubble text { font: 600 22px Inter, sans-serif; }
.bubble text.mono { font: 500 19px "Geist Mono", monospace; }
.bubble text.score { font: 700 58px Inter, sans-serif; }
.stamp { font: 800 26px Inter, sans-serif; letter-spacing: .08em; }
#term { position: absolute; left: 50%; top: 50%; width: 1120px; background: #1c1a17; border: 1px solid #3b3830; border-radius: 12px; box-shadow: 0 40px 120px rgba(0,0,0,.65); transform-origin: 0 0; }
#term .bar { height: 48px; border-bottom: 1px solid #3b3830; display: flex; align-items: center; gap: 10px; padding: 0 20px; }
#term .bar i { width: 12px; height: 12px; border-radius: 50%; background: #3b3830; }
#term .bar span { margin-left: 12px; font: 400 18px "Geist Mono", monospace; color: #9a948a; }
#term .body { padding: 36px 40px; font: 400 34px/1.5 "Geist Mono", monospace; min-height: 190px; }
#term .prompt { color: #ffaa1c; margin-right: .6em; }
#cursor { display: inline-block; width: .6em; height: 1.15em; background: #f4f0e8; vertical-align: -0.2em; margin-left: 2px; }
#outlines div { font-size: 28px; color: #9a948a; white-space: nowrap; }
#outlines .ok { color: #f4f0e8; }
#outlines .ok b { color: #ffaa1c; font-weight: 400; }
#cap { position: absolute; left: 0; right: 0; bottom: 54px; text-align: center; font: 600 40px Inter, sans-serif; letter-spacing: -0.01em; }
#cap small { display: block; margin-top: 8px; font: 500 24px "Geist Mono", monospace; color: #9a948a; }
#hook { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; }
#hook svg { position: static; width: 104px; height: 104px; margin: 0 auto 48px; display: block; overflow: visible; }
#hook h1 { font-weight: 600; font-size: 104px; line-height: 1.06; letter-spacing: -0.025em; }
#hook .url { margin-top: 48px; font: 400 32px "Geist Mono", monospace; color: #9a948a; }
#fade { position: absolute; inset: 0; background: #12110f; opacity: 0; }
</style></head><body>
<svg id="scene" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".45"/></filter>
    <radialGradient id="room" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#221f1a"/><stop offset="1" stop-color="#12110f"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#room)"/>
  <rect x="0" y="${BASE}" width="${W}" height="${H - BASE}" fill="#171512"/>
  <line x1="0" y1="${BASE}" x2="${W}" y2="${BASE}" stroke="#3b3830" stroke-width="2"/>
  ${team.map(worker).join('\n')}
  <g id="confetti"></g>
  <g id="paper" opacity="0"><rect x="-34" y="-42" width="68" height="84" rx="6" fill="#f4f0e8" filter="url(#soft)"/><rect x="-22" y="-26" width="44" height="6" rx="3" fill="#9a948a"/><rect x="-22" y="-12" width="36" height="6" rx="3" fill="#d9d4c8"/><rect x="-22" y="2" width="40" height="6" rx="3" fill="#d9d4c8"/><rect x="-22" y="16" width="28" height="6" rx="3" fill="#d9d4c8"/></g>
  ${['r1', 'r2', 'r3'].map((id, i) => `<g id="${id}" opacity="0"><g class="in"><rect x="-84" y="-46" width="168" height="92" rx="8" fill="#1c1a17" stroke="#3b3830" filter="url(#soft)"/><image x="-80" y="-42" width="160" height="84" href="${IMG['rough-' + (i + 1)]}" preserveAspectRatio="xMidYMid slice"/></g></g>`).join('')}
  <g id="pickstamp" opacity="0"><rect x="-58" y="-22" width="116" height="44" rx="8" fill="none" stroke="#ffaa1c" stroke-width="4"/><text x="0" y="10" text-anchor="middle" class="stamp" fill="#ffaa1c">PICK</text></g>
  <g id="bubbles"></g>
  <g id="sparks"></g>
</svg>
<div id="term"><div class="bar"><i></i><i></i><i></i><span>~/my-app</span></div>
  <div class="body"><div><span class="prompt">&gt;</span><span id="typed"></span><span id="cursor"></span></div><div id="outlines"></div></div></div>
<div id="cap"></div>
<div id="hook" style="opacity:0"><svg viewBox="0 0 24 24"><rect id="desk" x="0" y="18" width="24" height="6" fill="#f4f0e8"/><circle id="lampmark" cx="17" cy="10" r="4" fill="#ffaa1c"/></svg>
  <h1><span id="l1">Your own design studio.</span><br><span id="l2">At your desk.</span></h1><div class="url" id="url">deskstudio.ai</div></div>
<div id="fade"></div>
<script>
const W = ${W}, H = ${H}, BASE = ${BASE}, END = ${SECONDS};
const IMG = ${JSON.stringify(IMG)}, SCORES = ${JSON.stringify(scores)}, PICK = ${JSON.stringify(pick)};
const TEAM = ${JSON.stringify(team.map(({ id, x, tier, scale }) => ({ id, x, tier, scale: scale || 1 })))};
const BADGES = ${JSON.stringify(Object.fromEntries(Object.entries(BADGE).map(([p, f]) => [p, { senior: f('senior'), director: f('director'), builder: f('builder') }])))};
const COMMAND = '/desk:design a launch card for my app';
const X = { MGR: ${MGR}, D1: ${D1}, D2: ${D2}, D3: ${D3}, AD: ${AD}, B: ${B}, P: ${P}, CD: ${CD} };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (t, a, b) => clamp((t - a) / (b - a));
const outCubic = x => 1 - Math.pow(1 - x, 3);
const inOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const outBack = x => { const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const pulse = (t, a, b) => t >= a && t < b;
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';

// Keystrokes, the same every take.
const keys = []; { let k = 0.5; for (let i = 0; i < COMMAND.length; i++) { keys.push(k); k += 0.036 + ((i * 37) % 11) / 450 + (COMMAND[i] === ' ' ? 0.025 : 0); } }
const ENTER = keys[keys.length - 1] + 0.25;
const ITEM_Y = BASE - 306;

// When each desk is working (its lamp on) and when it hands something on (its arm up).
const BUSY = {
  mgr: [[4.4, 5.5]], d1: [[7.7, 9.7]], d2: [[8.0, 9.7]], d3: [[8.3, 9.7]], ad: [[10.6, 12.6]],
  b: [[13.2, 14.4], [17.9, 18.6], [21.0, 21.7]], p: [[14.9, 15.6], [18.9, 19.3], [22.0, 22.4]], cd: [[16.1, 17.2], [19.6, 20.4], [22.7, 23.8]],
};
const HAND = {
  mgr: [5.5], d1: [9.8], d2: [9.8], d3: [9.8], ad: [12.6], b: [14.4, 18.6, 21.7], p: [15.6, 19.3, 22.4], cd: [17.2, 20.4, 23.8],
};
// The picked rough's trip down the line and back, [start, end, from, to, arc].
const R2 = [
  [9.8, 10.6, [X.D2, ITEM_Y - 40], [X.AD, ITEM_Y - 20], 90],
  [11.2, 11.6, [X.AD, ITEM_Y - 20], [X.AD, ITEM_Y - 40], 0],
  [12.6, 13.2, [X.AD, ITEM_Y - 40], [X.B, ITEM_Y], 90],
  [14.4, 14.9, [X.B, ITEM_Y], [X.P, ITEM_Y], 70],
  [15.6, 16.1, [X.P, ITEM_Y], [X.CD, ITEM_Y], 70],
  [17.2, 17.9, [X.CD, ITEM_Y], [X.B, ITEM_Y], 170],
  [18.6, 18.9, [X.B, ITEM_Y], [X.P, ITEM_Y], 60],
  [19.3, 19.6, [X.P, ITEM_Y], [X.CD, ITEM_Y], 60],
  [20.4, 21.0, [X.CD, ITEM_Y], [X.B, ITEM_Y], 170],
  [21.7, 22.0, [X.B, ITEM_Y], [X.P, ITEM_Y], 60],
  [22.4, 22.7, [X.P, ITEM_Y], [X.CD, ITEM_Y], 60],
  [23.8, 25.0, [X.CD, ITEM_Y], [250, 150], 260],
];
const R1 = [[9.8, 10.6, [X.D1, ITEM_Y - 40], [X.AD - 120, ITEM_Y - 20], 90]], R3 = [[9.8, 10.6, [X.D3, ITEM_Y - 40], [X.AD + 120, ITEM_Y - 20], 90]];
const along = (legs, t) => {
  let p = legs[0][2];
  for (const [a, b, from, to, arc] of legs) {
    if (t >= b) { p = to; continue; }
    if (t > a) { const u = inOut(span(t, a, b)); return [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u - arc * 4 * u * (1 - u)]; }
    break;
  }
  return p;
};
const setT = (el, x, y, s = 1, r = 0) => el.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + s.toFixed(3) + ') rotate(' + r.toFixed(2) + ')');

// Bubbles: [start, end, x, y, lines]. A line is text, or [text, colour, class].
const BUBBLES = [
  [4.6, 5.6, X.MGR + 40, BASE - 370, ['launch card', ['LinkedIn + Instagram', '#5a554b', 'mono']]],
  [11.3, 12.7, X.AD, BASE - 460, ['“' + PICK + '”']],
  [13.25, 14.4, X.B, BASE - 430, [['round 1', '#5a554b', 'mono'], 'polish']],
  [17.95, 18.6, X.B, BASE - 430, [['round 2', '#5a554b', 'mono'], 'more notes']],
  [21.05, 21.7, X.B, BASE - 430, [['round 3', '#5a554b', 'mono'], 'polish']],
  [14.95, 15.6, X.P, BASE - 440, [['contrast ✓', '#009e73', 'mono'], ['overflow ✓', '#009e73', 'mono'], ['safe zones ✓', '#009e73', 'mono']]],
  [18.95, 19.3, X.P, BASE - 440, [['proof ✓', '#009e73', 'mono']]],
  [22.05, 22.4, X.P, BASE - 440, [['proof ✓', '#009e73', 'mono']]],
];
const SCOREB = [[16.2, 17.2, 0], [19.65, 20.4, 1], [22.75, 23.8, 2]];
function bubble(x, y, lines) {
  const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'bubble');
  const widths = lines.map(l => (typeof l === 'string' ? l : l[0]).length * (typeof l !== 'string' && l[2] === 'mono' ? 11.6 : 11.8));
  const w = Math.max(...widths) + 44, h = lines.length * 32 + 28;
  g.innerHTML = '<rect x="' + (-w / 2) + '" y="' + (-h) + '" width="' + w + '" height="' + h + '" rx="16" fill="#f4f0e8" filter="url(#soft)"/><path d="M -12 -2 L 0 18 L 12 -2 Z" fill="#f4f0e8"/>' +
    lines.map((l, i) => { const [s, c, cls] = typeof l === 'string' ? [l, '#17140f', ''] : l; return '<text x="0" y="' + (-h + 40 + i * 32) + '" text-anchor="middle" fill="' + c + '" class="' + cls + '">' + s.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>'; }).join('');
  g.dataset.x = x; g.dataset.y = y; return g;
}
const bubbleEls = BUBBLES.map(([a, b, x, y, lines]) => { const g = bubble(x, y, lines); $('bubbles').appendChild(g); return [a, b, g]; });
const scoreEls = SCOREB.map(([a, b, i]) => {
  const s = SCORES[i], pass = !s.low.length;
  const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'bubble');
  const sub = pass ? 'signed off' : s.low.map(([k, v]) => k + ' ' + v).join(', ');
  const sub2 = pass ? 'every axis 8 or more' : 'back with notes';
  g.innerHTML = '<rect x="-150" y="-170" width="300" height="170" rx="18" fill="#f4f0e8" filter="url(#soft)"/><path d="M -12 -2 L 0 18 L 12 -2 Z" fill="#f4f0e8"/>' +
    '<text x="0" y="-100" text-anchor="middle" class="score" fill="#17140f">' + s.average.toFixed(1) + '</text>' +
    '<text x="0" y="-62" text-anchor="middle" class="mono" fill="' + (pass ? '#009e73' : '#c4281c') + '">' + sub + '</text>' +
    '<text x="0" y="-28" text-anchor="middle" fill="#5a554b" style="font:500 19px Inter">' + sub2 + '</text>';
  g.dataset.x = X.CD; g.dataset.y = BASE - 440; $('bubbles').appendChild(g); return [a, b, g];
});
// Sparkles while the builder polishes, confetti at the sign-off. Same positions every take.
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const sparks = Array.from({ length: 10 }, () => { const e = document.createElementNS(NS, 'path'); e.setAttribute('d', 'M0 -9 L2.5 -2.5 L9 0 L2.5 2.5 L0 9 L-2.5 2.5 L-9 0 L-2.5 -2.5 Z'); e.setAttribute('fill', '#ffd27a'); $('sparks').appendChild(e); return { e, a: rnd() * Math.PI * 2, r: 70 + rnd() * 50, ph: rnd() }; });
const COLS = ['#ffaa1c', '#56b4e9', '#009e73', '#cc79a7', '#f4f0e8', '#d55e00'];
const conf = Array.from({ length: 46 }, (_, i) => { const e = document.createElementNS(NS, 'rect'); e.setAttribute('width', 10); e.setAttribute('height', 16); e.setAttribute('rx', 2); e.setAttribute('fill', COLS[i % COLS.length]); $('confetti').appendChild(e); return { e, vx: (rnd() - 0.5) * 520, vy: -380 - rnd() * 320, spin: (rnd() - 0.5) * 900 }; });

const CAPS = [
  [3.7, 5.6, 'The Design Manager reads the brief', 'and staffs the job'],
  [5.6, 7.6, 'Every role runs the model you pick', 'Claude, OpenAI or Google'],
  [7.6, 10.4, 'Three roughs, three directions', 'UI Designers on Sonnet'],
  [10.4, 12.7, 'The Art Director picks one and writes notes', 'Opus'],
  [12.7, 14.5, 'A cheaper model polishes', 'UI Designer on Haiku'],
  [14.5, 16.0, 'Proof checks the rendered pixels', 'no model, just checks'],
  [16.0, 17.9, 'The Creative Director scores eight axes', 'every axis 8 or more, average 8.5'],
  [17.9, 22.6, 'Under the bar, it goes back with notes', 'round 2, round 3'],
  [22.6, 23.9, 'Signed off at 8.9', '3 rounds, $1.34 at list price'],
  [23.9, 26.4, 'And it comes back to you', ''],
];

window.seek = t => {
  // The terminal: typed, entered, then it steps back into the corner while the team works, and comes forward with the result.
  $('typed').textContent = COMMAND.slice(0, keys.filter(k => k <= t).length);
  $('cursor').style.opacity = t < ENTER ? (t < keys[0] || t > keys[keys.length - 1] ? (Math.floor(t * 2.2) % 2 ? 0 : 1) : 1) : 0;
  const dock = inOut(span(t, 3.0, 3.8)), undock = inOut(span(t, 24.7, 25.5));
  const k = dock * (1 - undock);
  const s = 1 - 0.62 * k, cx = -560 + (40 - (-560 + 960)) * 0, w = 1120;
  const x0 = W / 2 - w / 2, y0 = H / 2 - 150, x1 = 40, y1 = 36;
  const tx = x0 + (x1 - x0) * k, ty = y0 + (y1 - y0) * k;
  $('term').style.transform = 'translate(' + (tx - W / 2) + 'px,' + (ty - H / 2) + 'px) scale(' + s + ')';
  const termOut = span(t, 26.3, 26.8);
  $('term').style.opacity = span(t, 0, 0.3) * (1 - termOut);
  const outl = t < 25.4 ? [] : [
    ['ok', '✓ launch card signed off at <b>8.9</b>'],
    ['', '  3 rounds · $1.34 at list price'],
    ['', '  final-linkedin.png  final-ig-post.png'],
  ].filter((_, i) => t >= 25.4 + i * 0.3);
  $('outlines').innerHTML = outl.map(([c, h]) => '<div class="' + c + '">' + h + '</div>').join('');
  $('outlines').style.marginTop = outl.length ? '14px' : '0';

  // The room fades in under the terminal and out before the line.
  const room = span(t, 3.0, 3.6) * (1 - span(t, 25.6, 26.4));
  $('scene').style.opacity = room;

  TEAM.forEach((m, i) => {
    const g = $(m.id);
    const busy = (BUSY[m.id] || []).some(([a, b]) => pulse(t, a, b));
    const bob = Math.sin(t * (busy ? 9 : 2.2) + i * 1.3) * (busy ? 4 : 2.5);
    g.querySelector('.bob').setAttribute('transform', 'translate(0,' + bob.toFixed(2) + ')');
    const on = (BUSY[m.id] || []).reduce((v, [a, b]) => Math.max(v, span(t, a - 0.15, a) * (1 - span(t, b, b + 0.25))), 0);
    g.querySelector('.lamp').setAttribute('fill', on > 0.5 ? '#ffaa1c' : '#3b3830');
    g.querySelector('.glow').setAttribute('opacity', (on * 0.35).toFixed(2));
    // Blink every few seconds, each on its own beat.
    const bl = ((t + i * 0.77) % 3.3) < 0.12 ? 0.12 : 1;
    g.querySelector('.eyes').setAttribute('transform', 'translate(0,-157) scale(1,' + bl + ') translate(0,157)');
    // Working: little typing arms. Handing on: the right arm swings up.
    const hand = (HAND[m.id] || []).reduce((v, h) => Math.max(v, Math.sin(Math.PI * span(t, h - 0.25, h + 0.35))), 0);
    const type = busy ? Math.sin(t * 22 + i) * 14 : 0;
    g.querySelector('.armR').setAttribute('transform', 'rotate(' + (type - 120 * hand) + ' 38 -108)');
    g.querySelector('.armL').setAttribute('transform', 'rotate(' + (-type) + ' -38 -108)');
    // The badges cycle through the providers once, then settle on this job's models.
    if (m.tier) {
      const cyc = t >= 5.7 && t < 7.5 ? ['anthropic', 'openai', 'google'][Math.floor((t - 5.7) / 0.6) % 3] : 'anthropic';
      const label = m.id === 'd1' || m.id === 'd3' ? '' : BADGES[cyc][m.tier];
      const tx = g.querySelector('.badge'); if (tx.textContent !== label) tx.textContent = label;
      const box = g.querySelector('.badgebox'); box.style.display = label ? '' : 'none';
      const pw = Math.max(120, label.length * 11 + 36); const pill = g.querySelector('.pill'); pill.setAttribute('x', -pw / 2); pill.setAttribute('width', pw);
      const flip = t >= 5.7 && t < 7.5 ? Math.abs(Math.cos(Math.PI * ((t - 5.7) / 0.6))) : 1;
      box.setAttribute('transform', 'translate(0,66) scale(1,' + Math.max(0.05, flip).toFixed(2) + ') translate(0,-66)');
    }
    // Everyone pops in, left to right.
    const pop = outBack(span(t, 3.4 + i * 0.07, 3.85 + i * 0.07));
    g.setAttribute('transform', 'translate(' + m.x + ',' + BASE + ') scale(' + (m.scale * pop).toFixed(3) + ')');
  });

  // The brief drops from the terminal to the Design Manager.
  const pp = span(t, 3.7, 4.5), paper = $('paper');
  if (t < 3.7 || t > 5.6) paper.setAttribute('opacity', 0);
  else {
    const u = inOut(pp), x = 250 + (X.MGR + 60 - 250) * u, y = 150 + (BASE - 290 - 150) * u - 120 * 4 * u * (1 - u);
    paper.setAttribute('opacity', (1 - span(t, 5.3, 5.6)).toFixed(2)); setT(paper, x, y, 1, -8 + 16 * u);
  }

  // Three roughs pop up over the designers, fly to the Art Director, and one is picked.
  [['r1', R1, X.D1, 7.9], ['r2', R2, X.D2, 8.3], ['r3', R3, X.D3, 8.7]].forEach(([id, legs, x, pop]) => {
    const g = $(id), p = along(legs, t), appear = outBack(span(t, pop, pop + 0.45));
    let s = 0.82 * appear, o = span(t, pop, pop + 0.2);
    if (id !== 'r2') { const gone = span(t, 11.2, 11.7); o *= 1 - gone; s *= 1 - 0.4 * gone; }
    else {
      s = t > 10.6 ? 0.82 + 0.18 * span(t, 11.2, 11.6) : s;
      if (t > 24.4) s *= 1 - 0.75 * span(t, 24.4, 25.0);
      o *= 1 - span(t, 24.85, 25.05);
      const img = t < 14.2 ? IMG['rough-2'] : t < 18.4 ? IMG['round-1'] : t < 21.5 ? IMG['round-2'] : IMG['round-3'];
      const im = g.querySelector('image'); if (im.getAttribute('href') !== img) im.setAttribute('href', img);
    }
    const wob = id === 'r2' && (pulse(t, 13.3, 14.3) || pulse(t, 17.95, 18.5) || pulse(t, 21.05, 21.6)) ? Math.sin(t * 30) * 3 : 0;
    g.setAttribute('opacity', o.toFixed(2)); setT(g, p[0], p[1], s, wob);
  });
  const st = $('pickstamp'), sp = outBack(span(t, 11.3, 11.6));
  st.setAttribute('opacity', (span(t, 11.3, 11.4) * (1 - span(t, 12.4, 12.7))).toFixed(2)); setT(st, X.AD + 70, ITEM_Y - 100, 0.4 + 0.6 * sp, -12);

  // Bubbles grow in and shrink away.
  for (const [a, b, g] of [...bubbleEls, ...scoreEls]) {
    const v = outBack(span(t, a, a + 0.25)) * (1 - span(t, b - 0.15, b));
    g.setAttribute('opacity', v > 0.01 ? 1 : 0);
    setT(g, +g.dataset.x, +g.dataset.y, Math.max(0.001, v));
  }
  // Sparkles around the work while it's polished.
  const pol = pulse(t, 13.3, 14.3) || pulse(t, 17.95, 18.5) || pulse(t, 21.05, 21.6);
  sparks.forEach(({ e, a, r, ph }, i) => {
    const k2 = (t * 1.6 + ph) % 1, ang = a + t * 1.4;
    e.setAttribute('opacity', pol ? (Math.sin(Math.PI * k2)).toFixed(2) : 0);
    setT(e, X.B + Math.cos(ang) * r, ITEM_Y + Math.sin(ang) * r * 0.6, 0.6 + 0.6 * Math.sin(Math.PI * k2), t * 90);
  });
  // Confetti at the sign-off.
  const ct = t - 23.0;
  conf.forEach(({ e, vx, vy, spin }) => {
    if (ct < 0 || ct > 1.9) { e.setAttribute('opacity', 0); return; }
    e.setAttribute('opacity', (1 - span(ct, 1.4, 1.9)).toFixed(2));
    setT(e, X.CD + vx * ct, BASE - 230 + vy * ct + 900 * ct * ct, 1, spin * ct);
  });

  // Captions.
  const c = CAPS.find(([a, b]) => t >= a && t < b);
  const capEl = $('cap');
  if (c) { const [a, b, l1, l2] = c; capEl.innerHTML = l1 + (l2 ? '<small>' + l2 + '</small>' : ''); capEl.style.opacity = (span(t, a, a + 0.25) * (1 - span(t, b - 0.25, b))).toFixed(2); }
  else capEl.style.opacity = 0;

  // The line, same as the hero loop.
  const hk = span(t, 26.6, 27.1);
  $('hook').style.opacity = hk;
  const d = outCubic(span(t, 26.7, 27.2)); $('desk').setAttribute('width', 24 * d);
  const lamp = span(t, 28.3, 28.5); $('lampmark').style.opacity = lamp; $('lampmark').style.filter = lamp ? 'drop-shadow(0 0 ' + (6 * lamp) + 'px rgba(255,170,28,.9))' : 'none';
  for (const [id, a] of [['l1', 26.9], ['l2', 27.5], ['url', 28.2]]) {
    const p = outCubic(span(t, a, a + 0.5)); const el = $(id); el.style.opacity = p; el.style.display = id === 'url' ? 'block' : 'inline-block'; el.style.transform = 'translateY(' + (1 - p) * 24 + 'px)';
  }
  $('fade').style.opacity = span(t, END - 0.3, END);
};
</script></body></html>`;

const work = mkdtempSync(join(tmpdir(), 'explainer-'));
mkdirSync(out, { recursive: true });
const pagePath = join(work, 'index.html');
writeFileSync(pagePath, html);
const browser = await launch();
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(pathToFileURL(pagePath).href, { waitUntil: 'load' });
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
const name = `explainer-${W}x${H}`;
if (args.still) {
  for (const t of String(args.still).split(',').map(Number)) {
    await page.evaluate(t => window.seek(t), t);
    await page.waitForTimeout(30);
    await page.screenshot({ path: join(out, `${name}-at-${t}s.png`) });
  }
  await browser.close(); rmSync(work, { recursive: true, force: true }); process.exit(0);
}
const frames = join(work, 'frames');
mkdirSync(frames);
for (let i = 0; i < FPS * SECONDS; i++) {
  await page.evaluate(t => window.seek(t), i / FPS);
  await page.screenshot({ path: join(frames, `f-${String(i).padStart(4, '0')}.png`) });
}
await page.evaluate(t => window.seek(t), 11.5);
await page.screenshot({ path: join(out, `${name}.png`) });
await browser.close();
const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, 'f-%04d.png'), '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(out, `${name}.mp4`)], { encoding: 'utf8' });
rmSync(work, { recursive: true, force: true });
if (ff.status !== 0) { console.error(ff.stderr); process.exit(1); }
console.log(`${join(out, name)}.mp4  ${SECONDS}s at ${FPS} fps`);
