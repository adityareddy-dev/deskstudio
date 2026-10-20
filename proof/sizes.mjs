// Named sizes and their safe zones. Keep in step with skills/desk/procedures/sizes.md.
// safe: fractions of the canvas kept clear of text, as [top, right, bottom, left].
export const SIZES = {
  'linkedin':     { width: 1200, height: 627,  safe: [0.06, 0.06, 0.06, 0.06] },
  'x':            { width: 1600, height: 900,  safe: [0.06, 0.06, 0.06, 0.06] },
  'og':           { width: 1200, height: 630,  safe: [0.06, 0.06, 0.06, 0.06] },
  'ig-post':      { width: 1080, height: 1350, safe: [0.06, 0.06, 0.10, 0.06] },
  'ig-square':    { width: 1080, height: 1080, safe: [0.06, 0.06, 0.06, 0.06] },
  'ig-story':     { width: 1080, height: 1920, safe: [0.15, 0.06, 0.15, 0.06] },
  'yt-thumb':     { width: 1280, height: 720,  safe: [0.06, 0.06, 0.06, 0.06] },
  'slide':        { width: 1920, height: 1080, safe: [0.05, 0.05, 0.05, 0.05] },
  'email-600':    { width: 600,  height: 0,    safe: [0, 0, 0, 0], fullPage: true },
  'phone':        { width: 390,  height: 844,  safe: [0, 0, 0, 0], page: true, fullPage: true },
  'tablet':       { width: 768,  height: 1024, safe: [0, 0, 0, 0], page: true, fullPage: true },
  'desktop':      { width: 1440, height: 900,  safe: [0, 0, 0, 0], page: true, fullPage: true },
  'desktop-wide': { width: 1920, height: 1080, safe: [0, 0, 0, 0], page: true, fullPage: true },
};

export function resolveSizes(list) {
  const names = (Array.isArray(list) ? list : String(list || '').split(',')).map(s => s.trim()).filter(Boolean);
  if (!names.length) throw new Error('No sizes given. Use --sizes linkedin,ig-post. Run "sizes" for the list.');
  return names.map(name => {
    const m = /^(\d+)x(\d+)$/.exec(name);
    if (m) return { name, width: Number(m[1]), height: Number(m[2]), safe: [0.06, 0.06, 0.06, 0.06] };
    const size = SIZES[name];
    if (!size) throw new Error(`Unknown size "${name}". Run "sizes" for the list, or give WIDTHxHEIGHT.`);
    return { name, ...size };
  });
}
