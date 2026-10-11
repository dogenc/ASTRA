"""ASTRA – ASCII-Logo (ANSI Shadow) als Text und als SVG im Stil der Atlas-Familie erzeugen.

Aufruf: python3 scripts/make_logo.py
Schreibt docs/ascii-logo.txt und docs/logo.svg.
"""
from pathlib import Path

GLYPHS = {
    'S': ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
    'R': ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'],
    'T': ['████████╗', '╚══██╔══╝', '   ██║   ', '   ██║   ', '   ██║   ', '   ╚═╝   '],
    'A': [' █████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
}
WORD = 'ASTRA'
SUBTITLE = 'W E L T R A U M A T L A S  ·  3 D  ·  O P E N  S O U R C E'

rows = [' '.join(GLYPHS[c][r] for c in WORD).rstrip() for r in range(6)]
width = max(len(r) for r in rows)
text = '\n'.join(rows) + '\n' + SUBTITLE.center(width).rstrip() + '\n'

root = Path(__file__).resolve().parent.parent
(root / 'docs' / 'ascii-logo.txt').write_text(text, encoding='utf-8')

# SVG: gleiche Geometrie wie die Logos von CORPUS, CELLULA und TERRA
# (14 px Zeichenbreite, 26 px Zeilenhöhe, goldene Doppellinien für die Schatten).
CW, CH, X0, Y0 = 14, 26, 60, 40
GOLD = '#d2ad5c'
svg_w = X0 * 2 + width * CW
parts = []

def r(x, y, w, h, fill=GOLD):
    parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{fill}"/>')

for row, line in enumerate(rows):
    for col, ch in enumerate(line):
        x, y = X0 + col * CW, Y0 + row * CH
        if ch == '█':
            r(x, y, 14.4, 26.4, 'url(#g)')
        elif ch == '═':
            r(x, y + 7.2, 14.3, 2.2); r(x, y + 16.6, 14.3, 2.2)
        elif ch == '║':
            r(x + 3.4, y, 2.2, 26.4); r(x + 8.4, y, 2.2, 26.4)
        elif ch == '╗':
            r(x, y + 7.2, 10.6, 2.2); r(x + 8.4, y + 7.2, 2.2, 19.1)
            r(x, y + 16.6, 5.6, 2.2); r(x + 3.4, y + 16.6, 2.2, 9.7)
        elif ch == '╔':
            r(x + 3.4, y + 7.2, 10.9, 2.2); r(x + 3.4, y + 7.2, 2.2, 19.1)
            r(x + 8.4, y + 16.6, 5.9, 2.2); r(x + 8.4, y + 16.6, 2.2, 9.7)
        elif ch == '╝':
            r(x, y + 16.6, 10.6, 2.2); r(x + 8.4, y, 2.2, 18.8)
            r(x, y + 7.2, 5.6, 2.2); r(x + 3.4, y, 2.2, 9.4)
        elif ch == '╚':
            r(x + 3.4, y + 16.6, 10.9, 2.2); r(x + 3.4, y, 2.2, 18.8)
            r(x + 8.4, y + 7.2, 5.9, 2.2); r(x + 8.4, y, 2.2, 9.4)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{svg_w}" height="288" viewBox="0 0 {svg_w} 288" role="img" aria-labelledby="title desc">
<title id="title">ASTRA</title><desc id="desc">ASCII-Logo von ASTRA im Stil der Atlas-Familie. Weltraumatlas in 3D, Open Source.</desc>
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c2352"/><stop offset="1" stop-color="#0a0d26"/></linearGradient>
<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="196"><stop offset="0" stop-color="#f3f4ff"/><stop offset=".55" stop-color="#a9b2ff"/><stop offset="1" stop-color="#4a54b8"/></linearGradient></defs>
<rect width="{svg_w}" height="288" rx="14" fill="url(#bg)"/>
{''.join(parts)}
<text x="{svg_w / 2:.1f}" y="234" text-anchor="middle" fill="#c3c9f2" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="600" letter-spacing="7" xml:space="preserve">WELTRAUMATLAS  ·  3D  ·  OPEN SOURCE</text>
</svg>
'''
(root / 'docs' / 'logo.svg').write_text(svg, encoding='utf-8')
print(text)
