#!/usr/bin/env python3
"""Draws "Desk Studio" as outlines, so the wordmark SVGs need no font.

  python scripts/outline-wordmark.py

Inter Variable at weight 600 is shaped with HarfBuzz (kerning on), tracked at -0.02em, and every glyph is written as a
path. brand/wordmark.svg, lockup-horizontal.svg and lockup-stacked.svg are rebuilt with the same viewBox, mark and
placement as before. Needs fonttools, brotli and uharfbuzz (pip install fonttools brotli uharfbuzz).
"""
import io, re, sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb

ROOT = Path(__file__).resolve().parent.parent
TEXT, WEIGHT, SIZE, TRACK = "Desk Studio", 600, 24.0, -0.02

font = TTFont(ROOT / "fonts" / "inter" / "Inter-Variable.woff2")
font = instancer.instantiateVariableFont(font, {"wght": WEIGHT})
upem = font["head"].unitsPerEm
buf = io.BytesIO(); font.flavor = None; font.save(buf)
face = hb.Face(hb.Blob(buf.getvalue())); hbfont = hb.Font(face)
hbbuf = hb.Buffer(); hbbuf.add_str(TEXT); hbbuf.guess_segment_properties()
hb.shape(hbfont, hbbuf, {"kern": True, "liga": False})
glyphs = font.getGlyphSet(); order = font.getGlyphOrder()
scale = SIZE / upem

def outline():
    """One path in the wordmark's own units, baseline at y=0, first glyph origin at x=0."""
    pen = SVGPathPen(glyphs, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
    x = 0.0
    for info, pos in zip(hbbuf.glyph_infos, hbbuf.glyph_positions):
        name = order[info.codepoint]
        tp = TransformPen(pen, (scale, 0, 0, -scale, x + pos.x_offset * scale, -pos.y_offset * scale))
        glyphs[name].draw(tp)
        x += pos.x_advance * scale + TRACK * SIZE
    return pen.getCommands()

d = outline()
PLACE = {"wordmark.svg": (0, 0), "lockup-horizontal.svg": (34.3, 24), "lockup-stacked.svg": (0, 108.3)}
for name, (tx, ty) in PLACE.items():
    p = ROOT / "brand" / name
    s = p.read_text(encoding="utf8")
    s = re.sub(r"<style>.*?</style>", "", s, flags=re.S)
    s = re.sub(r'<text[^>]*>Desk Studio</text>', f'<path transform="translate({tx} {ty})" d="{d}"/>', s)
    s = s.replace('<svg ', '<svg role="img" aria-label="Desk Studio" ', 1) if 'aria-label' not in s else s
    p.write_text(s, encoding="utf8", newline="\n")
    print(name, len(s), "bytes")
