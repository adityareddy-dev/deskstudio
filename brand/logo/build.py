"""The Desk Studio logo: DS with a gold S over the desk bar. The letters are outlined from Inter, so the SVGs need no font.
   python brand/logo/build.py            writes the SVGs next to this file (needs fonttools and brotli)
The PNGs and favicon.ico are renders of logo.svg and the lockups."""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = Path(__file__).resolve().parent
FONT = HERE.parents[1] / 'fonts' / 'inter' / 'Inter-Variable.woff2'
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE
OUT.mkdir(parents=True, exist_ok=True)
BG, CREAM, GOLD = '#12110f', '#f4f0e8', '#ffaa1c'

_cache = {}
def font(weight):
    if weight not in _cache:
        _cache[weight] = instancer.instantiateVariableFont(TTFont(FONT), {'wght': weight})
    return _cache[weight]

def text_paths(s, weight, size, x_center, baseline, tracking, colours):
    """One SVG path per character, laid out like SVG text with text-anchor middle and letter-spacing."""
    f = font(weight); upm = f['head'].unitsPerEm; sc = size / upm
    cmap = f.getBestCmap(); gs = f.getGlyphSet(); hmtx = f['hmtx']
    names = [cmap[ord(c)] for c in s]
    total = sum(hmtx[n][0] * sc + tracking for n in names)
    x = x_center - total / 2 if x_center is not None else 0
    out = []
    for n, col in zip(names, colours):
        pen = SVGPathPen(gs)
        gs[n].draw(TransformPen(pen, (sc, 0, 0, -sc, x, baseline)))
        if pen.getCommands():
            out.append(f'<path d="{pen.getCommands()}" fill="{col}"/>')
        x += hmtx[n][0] * sc + tracking
    return ''.join(out), total

def mark(dark=True):
    """The DS mark on a 512 canvas, no tile."""
    d = CREAM if dark else BG
    letters, _ = text_paths('DS', 800, 230, 256, 330, -12, [d, GOLD])
    bar = f'<rect x="118" y="360" width="276" height="22" rx="6" fill="{d}" opacity=".9"/>'
    return letters + bar

def svg(w, h, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>\n'

files = {
    'logo.svg': svg(512, 512, f'<rect width="512" height="512" rx="112" fill="{BG}"/>' + mark(True)),
    'logo-light.svg': svg(512, 512, f'<rect width="512" height="512" rx="112" fill="{CREAM}"/>' + mark(False)),
    'mark-on-dark.svg': svg(512, 512, mark(True)),
    'mark-on-light.svg': svg(512, 512, mark(False)),
}
# Lockups: the tile at 200 high, then "Desk Studio" in Inter 600.
for name, tile, ink in (('lockup-dark.svg', BG, CREAM), ('lockup-light.svg', CREAM, BG)):
    words, width = text_paths('Desk Studio', 600, 120, None, 0, -3, [ink] * 11)
    W = int(200 + 48 + width + 64); H = 240
    icon = f'<g transform="translate(20,20) scale({200/512})"><rect width="512" height="512" rx="112" fill="{BG}"/>{mark(True)}</g>'
    body = f'<rect width="{W}" height="{H}" fill="{tile}"/>' + icon + f'<g transform="translate({20 + 200 + 48},{20 + 100 + 44})">{words}</g>'
    files[name] = svg(W, H, body)
for n, s in files.items():
    (OUT / n).write_text(s, encoding='utf-8')
print('\n'.join(f'{n} {len(s)} bytes' for n, s in files.items()))
