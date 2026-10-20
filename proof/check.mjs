// The checks. Each returns failures a builder can act on. Pixels come from the background PNG (text hidden).
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const rgb = color => {
  const s = String(color).trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)).concat([1]);
  const m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (!m) return null;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
};
const lum = c => c.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const pixel = (png, x, y) => { const i = (y * png.width + x) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
const px = n => `${Math.round(n)}px`;
const short = t => t.length > 40 ? t.slice(0, 37) + '...' : t;

export function checkOverflow(dom, size = {}) {
  const f = [];
  const page = !!(size.page || size.fullPage);
  const maxH = page ? Infinity : dom.height;
  if (dom.scrollWidth > dom.width + 1) f.push({ check: 'overflow', text: '', reason: `the document is ${dom.scrollWidth}px wide on a ${dom.width}px canvas, something sits off the right edge (sideways scroll)` });
  if (!page && dom.scrollHeight > dom.height + 1) f.push({ check: 'overflow', text: '', reason: `the document is ${dom.scrollHeight}px tall on a ${dom.height}px canvas, something sits below the artboard` });
  for (const b of dom.boxes) {
    if (b.x < -0.5 || b.y < -0.5 || b.x + b.width > dom.width + 0.5 || b.y + b.height > maxH + 0.5) f.push({ check: 'overflow', text: short(b.text), reason: `runs off the canvas at ${px(b.x)},${px(b.y)} size ${px(b.width)}x${px(b.height)}` });
    for (const c of b.clips) {
      if ((c.clipX && (b.x < c.x - 0.5 || b.x + b.width > c.x + c.width + 0.5)) || (c.clipY && (b.y < c.y - 0.5 || b.y + b.height > c.y + c.height + 0.5))) { f.push({ check: 'overflow', text: short(b.text), reason: 'clipped by a container with overflow hidden' }); break; }
    }
  }
  return f;
}

export function checkSafeZone(dom, size) {
  const [t, r, b, l] = size.safe || [0, 0, 0, 0];
  if (!(t || r || b || l)) return [];
  const zone = { top: dom.height * t, right: dom.width * (1 - r), bottom: dom.height * (1 - b), left: dom.width * l };
  const f = [];
  for (const box of dom.boxes) {
    const where = [];
    if (box.x < zone.left) where.push(`${px(box.x)} from the left edge, the safe zone starts at ${px(zone.left)}`);
    if (box.y < zone.top) where.push(`${px(box.y)} from the top edge, the safe zone starts at ${px(zone.top)}`);
    if (box.x + box.width > zone.right) where.push(`ends ${px(dom.width - box.x - box.width)} from the right edge, the safe zone is ${px(dom.width - zone.right)}`);
    if (box.y + box.height > zone.bottom) where.push(`ends ${px(dom.height - box.y - box.height)} from the bottom edge, the safe zone is ${px(dom.height - zone.bottom)}`);
    if (where.length) f.push({ check: 'safe-zone', text: short(box.text), reason: where.join('; ') });
  }
  return f;
}

export function checkContrast(dom, backgroundPng) {
  const bg = PNG.sync.read(readFileSync(backgroundPng));
  const f = [];
  for (const b of dom.boxes) {
    const fg = rgb(b.color);
    if (!fg) continue;
    const alpha = (fg[3] ?? 1) * b.opacity;
    let worst = Infinity;
    for (let y = Math.max(0, Math.floor(b.y)); y < Math.min(bg.height, Math.ceil(b.y + b.height)); y += 2) {
      for (let x = Math.max(0, Math.floor(b.x)); x < Math.min(bg.width, Math.ceil(b.x + b.width)); x += 2) {
        const p = pixel(bg, x, y);
        const blended = fg.slice(0, 3).map((v, i) => v * alpha + p[i] * (1 - alpha));
        worst = Math.min(worst, contrast(blended, p));
      }
    }
    if (!Number.isFinite(worst)) continue;
    const large = b.fontSize >= 24 || (b.fontSize >= 18.67 && b.fontWeight >= 700);
    const need = large ? 3 : 4.5;
    if (worst < need) f.push({ check: 'contrast', text: short(b.text), reason: `${worst.toFixed(1)}:1 at its worst against the pixels behind it, needs ${need}:1 at ${px(b.fontSize)} weight ${b.fontWeight}` });
  }
  return f;
}

export function checkTypeScale(dom, brand, size) {
  const f = [];
  const base = brand.type.base || 16, ratio = brand.type.ratio || 1.25;
  const social = (size.safe || []).some(v => v > 0);
  const min = brand.type.minSize || (social ? 20 : 12);
  const seen = new Set();
  for (const b of dom.boxes) {
    const key = `${b.fontSize}|${short(b.text)}`;
    if (seen.has(key)) continue; seen.add(key);
    if (b.fontSize < min) { f.push({ check: 'type-scale', text: short(b.text), reason: `${px(b.fontSize)} is under the ${px(min)} minimum for this size` }); continue; }
    const step = Math.log(b.fontSize / base) / Math.log(ratio);
    if (Math.abs(step - Math.round(step)) > 0.12) {
      const lo = base * ratio ** Math.floor(step), hi = base * ratio ** Math.ceil(step);
      f.push({ check: 'type-scale', text: short(b.text), reason: `${px(b.fontSize)} is off the brand scale (base ${base}, ratio ${ratio}), use ${px(lo)} or ${px(hi)}` });
    }
  }
  return f;
}

export function checkPalette(renderPng, brand, { tolerance = 45, maxDrift = 0.05 } = {}) {
  const img = PNG.sync.read(readFileSync(renderPng));
  const palette = brand.colors.map(rgb);
  let drift = 0, total = 0;
  for (let y = 0; y < img.height; y += 4) for (let x = 0; x < img.width; x += 4) {
    const p = pixel(img, x, y); total++;
    let best = Infinity;
    for (const c of palette) { const d = dist(c, p); if (d < best) best = d; }
    if (best > tolerance) drift++;
  }
  const share = total ? drift / total : 0;
  return share > maxDrift ? [{ check: 'palette', text: '', reason: `${(share * 100).toFixed(0)}% of the pixels are not within ${tolerance} of any brand colour (limit ${maxDrift * 100}%). Images and gradients count, so use brand tints or a scrim` }] : [];
}

export function checkCopy(dom, mustAppear) {
  if (!mustAppear?.length) return [];
  const norm = s => String(s).toLowerCase().replace(/[\s’'"]+/g, '');
  const rendered = norm(dom.boxes.map(b => b.text).join(' '));
  return mustAppear.filter(m => !rendered.includes(norm(m))).map(m => ({ check: 'copy', text: short(m), reason: 'this copy is not in the rendered text, it must appear word for word' }));
}

// The brand's first family must be loaded in the page, not left to a system fallback.
export function checkFont(dom, brand) {
  const family = String(brand?.type?.family || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
  if (!family || !dom.fonts) return [];
  const generic = ['sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'arial', 'helvetica', 'georgia', 'times new roman'];
  if (generic.includes(family.toLowerCase())) return [];
  if (dom.fonts[family] === true) return [];
  const used = Object.keys(dom.fonts);
  return [{ check: 'font', text: family, reason: `the brand font "${family}" is not loaded in this file (families named: ${used.join(', ') || 'none'}), so it renders in a fallback. Inline it with font.mjs css "${family}" per procedures/fonts.md` }];
}

// A carousel reads as a series: the content slides share their type steps, and the set has one background
// family (or two, alternating on purpose). The cover and the close may sit one step off.
export function checkSeries(slides, { kind = 'carousel' } = {}) {
  if (slides.length < 3) return [];
  const f = [];
  const steps = s => [...new Set(s.dom.boxes.map(b => Math.round(b.fontSize)))].sort((a, b) => a - b);
  if (kind === 'deck') {
    // A deck holds four type sizes across every slide, plus one figure size on data slides.
    const all = [...new Set(slides.flatMap(steps))].sort((a, b) => a - b);
    if (all.length > 5) f.push({ check: 'series', text: '', reason: `${all.length} type sizes across the deck (${all.join(', ')}px), the standard allows four plus one figure size` });
    return f;
  }
  const content = slides.slice(1, -1);
  const first = steps(content[0]);
  for (const s of content.slice(1)) {
    const mine = steps(s);
    const headline = Math.max(...mine, 0), ref = Math.max(...first, 0);
    if (headline !== ref) f.push({ check: 'series', text: `slide ${s.slide}`, reason: `its headline is ${headline}px where slide ${content[0].slide} sets ${ref}px, every content slide uses the same headline size` });
    const extra = mine.filter(v => !first.includes(v));
    if (extra.length) f.push({ check: 'series', text: `slide ${s.slide}`, reason: `uses type sizes slide ${content[0].slide} does not (${extra.join(', ')}px), the set has three sizes shared by every slide` });
  }
  const families = [];
  for (const s of slides) {
    const bg = PNG.sync.read(readFileSync(s.backgroundPng));
    const p = pixel(bg, Math.min(8, bg.width - 1), Math.min(8, bg.height - 1));
    if (!families.some(c => dist(c, p) <= 45)) families.push(p);
  }
  if (families.length > 2) f.push({ check: 'series', text: '', reason: `${families.length} different background colours across the slides, a set keeps one background family, or two alternating` });
  return f;
}

export function runChecks({ dom, size, brand, renderPng, backgroundPng, mustAppear }) {
  const failures = [];
  if (!dom.boxes.length) failures.push({ check: 'copy', text: '', reason: 'no readable text found on the canvas' });
  if (brand) failures.push(...checkFont(dom, brand));
  failures.push(...checkOverflow(dom, size));
  failures.push(...checkSafeZone(dom, size));
  failures.push(...checkContrast(dom, backgroundPng));
  if (brand) failures.push(...checkTypeScale(dom, brand, size));
  if (brand) failures.push(...checkPalette(renderPng, brand));
  failures.push(...checkCopy(dom, mustAppear));
  return failures;
}
