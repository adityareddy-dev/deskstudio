"""The Desk Studio logo: a studio bot's head with its one lens eye, the same bot that works the dashboard's desks.
The wordmark is outlined from Inter 800, so no SVG here needs a font.
   python brand/logo/build.py      writes brand/*.svg and brand/logo/*.svg (needs fonttools, brotli and uharfbuzz)
   node brand/logo/render.mjs      then renders the PNGs and favicon.ico from them."""
import io
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb

HERE = Path(__file__).resolve().parent
BRAND = HERE.parent
FONT = BRAND.parent / 'fonts' / 'inter' / 'Inter-Variable.woff2'
TILE, PAPER = '#1d150e', '#fbf3e6'
CREAM, CREAM_HI, SHADE = '#f6e9d6', '#fff8ec', '#dcc6a6'
LENS, PUPIL, AMBER, INK = '#2a1f18', '#120d09', '#ffaa1c', '#2b2017'
WORD_WEIGHT, TRACK = 800, -0.03


def wordmark(size):
    """'Desk Studio' as one path, baseline at y=0, kerned by HarfBuzz and tracked at -0.03em. Returns (d, width)."""
    font = instancer.instantiateVariableFont(TTFont(FONT), {'wght': WORD_WEIGHT})
    upem = font['head'].unitsPerEm
    buf = io.BytesIO(); font.flavor = None; font.save(buf)
    hbfont = hb.Font(hb.Face(hb.Blob(buf.getvalue())))
    b = hb.Buffer(); b.add_str('Desk Studio'); b.guess_segment_properties()
    hb.shape(hbfont, b, {'kern': True, 'liga': False})
    glyphs, order, sc = font.getGlyphSet(), font.getGlyphOrder(), size / upem
    pen = SVGPathPen(glyphs, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
    x = 0.0
    for info, pos in zip(b.glyph_infos, b.glyph_positions):
        glyphs[order[info.codepoint]].draw(TransformPen(pen, (sc, 0, 0, -sc, x + pos.x_offset * sc, -pos.y_offset * sc)))
        x += pos.x_advance * sc + TRACK * size
    return pen.getCommands(), x - TRACK * size


GRAD = (f'<defs><linearGradient id="dsHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{CREAM_HI}"/>'
        f'<stop offset=".62" stop-color="{CREAM}"/><stop offset="1" stop-color="{SHADE}"/></linearGradient>'
        f'<radialGradient id="dsDusk" cx=".2" cy="0" r="1"><stop offset="0" stop-color="{AMBER}" stop-opacity=".22"/>'
        f'<stop offset=".7" stop-color="{AMBER}" stop-opacity="0"/></radialGradient></defs>')


def head(outline=None):
    """The head on a 512 canvas: two ear bolts, the head, the lens with its amber iris, the pupil and the glint."""
    s = f' stroke="{outline}" stroke-width="16"' if outline else ''
    fill = '#fffaf1' if outline else 'url(#dsHead)'
    ear = SHADE if not outline else '#efdcc0'
    return (f'<rect x="44" y="226" width="48" height="96" rx="24" fill="{ear}"{s}/><rect x="420" y="226" width="48" height="96" rx="24" fill="{ear}"{s}/>'
            f'<rect x="76" y="118" width="360" height="300" rx="110" fill="{fill}"{s}/>'
            f'<circle cx="256" cy="266" r="116" fill="{LENS}"/><circle cx="256" cy="266" r="74" fill="none" stroke="{AMBER}" stroke-width="36"/>'
            f'<circle cx="256" cy="266" r="36" fill="{PUPIL}"/><circle cx="292" cy="230" r="19" fill="#fff"/>')


def head_mono():
    """One colour: the head in currentColor with the lens cut out, the iris a ring inside it."""
    return ('<path fill-rule="evenodd" d="M186 118H326A110 110 0 0 1 436 228V308A110 110 0 0 1 326 418H186A110 110 0 0 1 76 308V228A110 110 0 0 1 186 118Z'
            'M256 150A116 116 0 1 0 256 382A116 116 0 1 0 256 150Z"/>'
            '<rect x="44" y="226" width="48" height="96" rx="24"/><rect x="420" y="226" width="48" height="96" rx="24"/>'
            '<circle cx="256" cy="266" r="74" fill="none" stroke="currentColor" stroke-width="36"/><circle cx="292" cy="230" r="19"/>')


def tile(bg=TILE, outline=None):
    dusk = '<rect width="512" height="512" rx="116" fill="url(#dsDusk)"/>' if bg == TILE else ''
    return f'<rect width="512" height="512" rx="116" fill="{bg}"/>{dusk}<g transform="translate(0 -8)">{head(outline)}</g>'


def svg(w, h, body, view=None, extra=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{view or f"0 0 {w} {h}"}"{extra}>'
            f'{GRAD}{body}</svg>\n')


d, wmw = wordmark(120)
CAP = 120 * 0.727  # Inter's cap height, so the words sit on the tile's centre line
files = {}
# brand/: the kit
files[BRAND / 'mark.svg'] = svg(512, 512, f'<g transform="translate(0 -8)">{head()}</g>', extra=' role="img" aria-label="Desk Studio"')
files[BRAND / 'mark-mono.svg'] = svg(512, 512, f'<g fill="currentColor" transform="translate(0 -8)">{head_mono()}</g>', extra=' role="img" aria-label="Desk Studio"')
files[BRAND / 'mark-clear.svg'] = svg(768, 768, f'<g transform="translate(128 120)">{head()}</g>', extra=' role="img" aria-label="Desk Studio, with its clear space"')
files[BRAND / 'wordmark.svg'] = svg(round(wmw + 8), 150, f'<path fill="currentColor" transform="translate(4 112)" d="{d}"/>', extra=' role="img" aria-label="Desk Studio"')
LW = round(200 + 48 + wmw + 8)
files[BRAND / 'lockup-horizontal.svg'] = svg(LW, 200, f'<g transform="scale({200/512})">{tile()}</g><path fill="currentColor" transform="translate(248 {100 + CAP / 2:.1f})" d="{d}"/>', extra=' role="img" aria-label="Desk Studio"')
SW = round(max(wmw, 240) + 16)
files[BRAND / 'lockup-stacked.svg'] = svg(SW, 400, f'<g transform="translate({(SW - 240) / 2:.1f} 0) scale({240/512})">{tile()}</g><path fill="currentColor" transform="translate({(SW - wmw) / 2:.1f} 372)" d="{d}"/>', extra=' role="img" aria-label="Desk Studio"')
# brand/logo/: the app icon and the lockups the README, the site and the listings use
L = HERE
files[L / 'logo.svg'] = svg(512, 512, tile())
files[L / 'logo-light.svg'] = svg(512, 512, tile(PAPER, LENS))
files[L / 'mark-on-dark.svg'] = svg(512, 512, f'<g transform="translate(0 -8)">{head()}</g>')
files[L / 'mark-on-light.svg'] = svg(512, 512, f'<g transform="translate(0 -8)">{head(LENS)}</g>')
for name, bg, ink in (('lockup-dark.svg', TILE, CREAM), ('lockup-light.svg', PAPER, INK)):
    W = round(20 + 200 + 48 + wmw + 56)
    files[L / name] = svg(W, 240, f'<rect width="{W}" height="240" fill="{bg}"/><g transform="translate(20 20) scale({200/512})">{tile()}</g><path fill="{ink}" transform="translate(268 {120 + CAP / 2:.1f})" d="{d}"/>')
for name, ink in (('lockup-on-dark.svg', CREAM), ('lockup-on-light.svg', INK)):
    W = round(200 + 48 + wmw + 24)
    files[L / name] = svg(W, 200, f'<g transform="scale({200/512})">{tile()}</g><path fill="{ink}" transform="translate(248 {100 + CAP / 2:.1f})" d="{d}"/>')
for p, s in files.items():
    p.write_text(s, encoding='utf-8', newline='\n')
    print(p.relative_to(BRAND.parent), len(s), 'bytes')
