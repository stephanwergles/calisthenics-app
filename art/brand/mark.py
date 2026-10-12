"""Lever – Marke „Gelenk“: einzige Quelle der Geometrie für Symbol, Lockup, Icons und Startbild.

  python3 art/brand/mark.py        → SVG-Master in art/brand/ und public/favicon.svg

Das Zeichen: zwei Hebelarme (Arme = Stamm, Körper = Fuß), verbunden über eine Gehrungsfuge –
das Gelenk. Gelesen als „L“, gemeint ist die Mechanik: wer den Hebel verlängert, macht die Übung
schwerer. Konstruiert auf einem Modul M (= Stammbreite = Fußhöhe), um 7° geneigt wie die Kursive
der Wortmarke (Barlow Condensed Black Italic). Die PNGs rendert art/blender/brand.py aus denselben
Funktionen; src/client/components/LeverMark.tsx übernimmt die Maße – Änderungen an beiden Stellen.
"""
import math, os

VOLT, INK, CHALK = "#D4FF3A", "#101010", "#F4F4F4"
T = math.tan(math.radians(7))   # Kursivwinkel
M = 24                          # Modul
H = 4 * M                       # Höhe
FULL = 3 * M                    # Fußlänge (Full Lever)
GAP = M / 6                     # Gelenkfuge
GAP_SMALL = M / 3.6             # ≤ 32 px: breitere Fuge, sonst läuft sie zu
# Stufen der Progression (Fußlänge in M) – Tuck → Advanced Tuck → Straddle → Full
LEVELS = {"tuck": 1.45, "adv": 1.95, "straddle": 2.5, "full": 3.0}

def skew(p):
    x, y = p
    return (x + T * (H - y), y)

def polys(foot=FULL, gap=GAP):
    """Stamm und Fuß als Polygone (y nach unten, Grundlinie y = H), bereits geneigt."""
    # Gehrung von Innen- zu Außenecke (45°), Fuge = gap senkrecht gemessen; die Schnittkanten
    # treffen die Außenkanten genau (Versatz d entlang der Kante), nichts ragt über die Grundlinie
    d = gap / math.sqrt(2)
    stem = [(0, 0), (M, 0), (M, H - M - d), (0, H - d)]
    foot_ = [(M + d, H - M), (foot, H - M), (foot, H), (d, H)]
    return [skew(p) for p in stem], [skew(p) for p in foot_]

def bbox(foot=FULL):
    s, f = polys(foot)
    xs = [p[0] for p in s + f]
    return min(xs), 0.0, max(xs), float(H)

def icon_frame(pad=0.27, nudge=(0.12, 0.08), foot=FULL):
    """Quadratischer Ausschnitt fürs App-Icon (x, y, Seite). Optische Mitte: das L ist links unten
    schwer, deshalb sitzt es ein wenig rechts und höher als die geometrische Mitte."""
    x0, y0, x1, y1 = bbox(foot); w, h = x1 - x0, y1 - y0
    S = max(w, h) * (1 + 2 * pad)
    cx, cy = x0 + w / 2 - nudge[0] * M, y0 + h / 2 + nudge[1] * M
    return cx - S / 2, cy - S / 2, S

# Startbild: Symbol in der Tuck-Stufe, Höhe = SPLASH_FRAC × Bildschirmhöhe, mittig (Bounding-Box des
# vollen Zeichens). Der Splash in der App (Splash.tsx) startet exakt so und verlängert dann den Hebel.
SPLASH_FRAC = 0.11

def _pts(pts): return " ".join(f"{x:.3f},{y:.3f}" for x, y in pts)

def symbol_svg(fg=VOLT, foot_color=None, foot=FULL, gap=GAP):
    s, f = polys(foot, gap)
    return f'<polygon points="{_pts(s)}" fill="{fg}"/><polygon points="{_pts(f)}" fill="{foot_color or fg}"/>'

# Wortmarke: Umrisse aus Barlow Condensed Black Italic (SIL OFL), Laufweite +10 Einheiten wie in der App
GLYPHS = {
    "L": (433, "M8 15 90 685Q91 692 95.5 696.0Q100 700 106 700H260Q266 700 269.5 696.0Q273 692 272 685L209 166Q207 161 213 161H403Q410 161 413.5 157.0Q417 153 416 146L400 15Q397 0 383 0H20Q14 0 10.5 4.0Q7 8 8 15Z"),
    "E": (431, "M445 539H259Q254 539 254 534L242 436Q240 431 246 431H343Q350 431 353.5 427.0Q357 423 356 416L340 285Q337 270 323 270H226Q221 270 221 265L209 166Q207 161 213 161H399Q406 161 409.5 157.0Q413 153 412 146L396 15Q395 8 390.5 4.0Q386 0 379 0H20Q14 0 10.5 4.0Q7 8 8 15L90 685Q91 692 95.5 696.0Q100 700 106 700H465Q472 700 475.5 696.0Q479 692 478 685L462 554Q461 547 456.5 543.0Q452 539 445 539Z"),
    "V": (505, "M133 13 79 684Q79 700 95 700H262Q276 700 275 686V327Q274 324 277.0 324.0Q280 324 281 327L365 686Q368 700 382 700H544Q551 700 554.5 696.0Q558 692 555 684L335 13Q331 0 317 0H147Q133 0 133 13Z"),
    "R": (475, "M257 13 228 265Q228 269 225 269Q221 269 221 264L190 15Q189 8 184.5 4.0Q180 0 174 0H20Q14 0 10.5 4.0Q7 8 8 15L90 685Q91 692 95.5 696.0Q100 700 106 700H325Q405 700 451.5 649.0Q498 598 498 514Q498 490 496 477Q489 422 465.0 378.5Q441 335 403 308Q398 305 400 301L443 17V13Q443 7 439.0 3.5Q435 0 429 0H271Q259 0 257 13ZM259 539Q254 539 254 534L239 417Q239 412 244 412H257Q281 412 297.5 433.0Q314 454 314 491Q314 514 303.0 526.5Q292 539 273 539Z"),
}
def word_svg(fill):
    x, out = 0, []
    for ch in "LEVER":
        adv, d = GLYPHS[ch]
        out.append(f'<path transform="translate({x} 700) scale(1 -1)" d="{d}"/>'); x += adv + 10
    return x - 10, f'<g fill="{fill}">{"".join(out)}</g>'

def doc(vb, body, bg=None):
    x, y, w, h = vb
    r = f'<rect x="{x:.3f}" y="{y:.3f}" width="{w:.3f}" height="{h:.3f}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:.3f} {y:.3f} {w:.3f} {h:.3f}">{r}{body}</svg>\n'

def lockup_svg(fg):
    """Symbol : Versalhöhe = 1,3 : 1 · Abstand = 1 M."""
    x0, _, x1, _ = bbox()
    ww, wg = word_svg(fg)
    cap = H / 1.3; sc = cap / 700; gx = (x1 - x0) + M
    body = (f'<g transform="translate({-x0:.3f} 0)">{symbol_svg(fg)}</g>'
            f'<g transform="translate({gx:.3f} {H - cap:.3f}) scale({sc:.5f})">{wg}</g>')
    return doc((0, 0, gx + ww * sc, H), body)

def write_all(root):
    brand = os.path.join(root, "art", "brand")
    x0, y0, x1, y1 = bbox()
    files = {
        "symbol-volt.svg": doc((x0, y0, x1 - x0, y1 - y0), symbol_svg(VOLT)),
        "symbol-ink.svg": doc((x0, y0, x1 - x0, y1 - y0), symbol_svg(INK)),
        "lockup-volt.svg": lockup_svg(VOLT),
        "lockup-ink.svg": lockup_svg(INK),
        "app-icon.svg": doc((*icon_frame()[:2], icon_frame()[2], icon_frame()[2]), symbol_svg(VOLT), INK),
    }
    for name, svg in files.items():
        with open(os.path.join(brand, name), "w") as fh: fh.write(svg)
    # Favicon: Kleinversion (breite Fuge) auf Ink, leicht gerundet – trägt auf hellen und dunklen Tabs
    fx, fy, fs = icon_frame(pad=0.16)
    fav = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fx:.3f} {fy:.3f} {fs:.3f} {fs:.3f}">'
           f'<rect x="{fx:.3f}" y="{fy:.3f}" width="{fs:.3f}" height="{fs:.3f}" rx="{fs * 0.22:.3f}" fill="{INK}"/>'
           f'{symbol_svg(VOLT, gap=GAP_SMALL)}</svg>\n')
    with open(os.path.join(root, "public", "favicon.svg"), "w") as fh: fh.write(fav)
    return [os.path.join("art/brand", n) for n in files] + ["public/favicon.svg"]

if __name__ == "__main__":
    root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    for p in write_all(root): print(p)
