"""Lever – Marke „Gelenk“: einzige Quelle der Geometrie für Zeichen, Wortmarke, Icons und Startbild.

  python3 art/brand/mark.py
    → SVG-Master in art/brand/, public/favicon.svg und src/client/brandPaths.ts (Pfade für die App)

Das Zeichen: zwei Hebelarme (Arme = Stamm, Körper = Fuß), verbunden über eine Gehrungsfuge –
das Gelenk. Gelesen als „L“, gemeint ist die Mechanik: wer den Hebel verlängert, macht die Übung
schwerer. Konstruiert auf einem Modul M, um 7° geneigt wie die Kursive der Wortmarke (Barlow
Condensed Black Italic), mit optischen Korrekturen (siehe CORRECTIONS). In der Wortmarke ersetzt das
Zeichen das L (Fuß in der Straddle-Stufe). art/blender/brand.py rendert die PNGs aus denselben
Funktionen – Maße nur hier ändern.
"""
import math, os

VOLT, INK, CHALK = "#D4FF3A", "#101010", "#F4F4F4"
ANGLE = 7                        # Kursivwinkel in Grad
T = math.tan(math.radians(ANGLE))
M = 24                           # Modul
H = 4 * M                        # Höhe
FULL = 3 * M                     # Fußlänge (Full Lever)
GAP = M / 6                      # Gelenkfuge (senkrecht zur Schnittlinie gemessen)
GAP_SMALL = M / 3.6              # ≤ 32 px: breitere Fuge, sonst läuft sie zu
# Optische Korrekturen: Waagerechte wirken bei gleicher Dicke schwerer → Fuß 8 % flacher;
# der geneigte Stamm wird senkrecht zu seiner Achse gemessen (waagerecht also M / cos 7°).
FOOT_H = 0.92 * M
STEM_W = M / math.cos(math.radians(ANGLE)) * 0.985
# Ecken: außen ein Hauch Rundung, die spitzen Gehrungsecken leicht entschärft (Radius in Einheiten)
R_OUT, R_MITRE_OBTUSE, R_MITRE_ACUTE = 1.1, 0.7, 0.9
# Stufen der Progression (Fußlänge in M) – Tuck → Advanced Tuck → Straddle → Full
LEVELS = {"tuck": 1.45, "adv": 1.95, "straddle": 2.5, "full": 3.0}
SPLASH_FRAC = 0.11               # Startbild/Splash: Zeichenhöhe = 11 % der Bildschirmhöhe

def _skew(p):
    x, y = p
    return (x + T * (H - y), y)

def polys(foot=FULL, gap=GAP):
    """Stamm und Fuß als Eckpunkte (y nach unten, Grundlinie y = H), bereits geneigt.
    Gehrung von der Innenecke (STEM_W, H − FOOT_H) zur Außenecke (0, H), beidseitig um gap/2
    verschoben und mit den Außenkanten geschnitten – nichts ragt über Grundlinie oder Stamm."""
    sw, fh = STEM_W, FOOT_H
    dx, dy = -sw, fh
    L = math.hypot(dx, dy); nx, ny = dy / L, -dx / L
    def at_x(px, py, x): return py + (x - px) / dx * dy
    def at_y(px, py, y): return px + (y - py) / dy * dx
    a = (sw - gap / 2 * nx, H - fh - gap / 2 * ny)       # Schnittlinie auf der Stammseite
    b = (sw + gap / 2 * nx, H - fh + gap / 2 * ny)       # … auf der Fußseite
    stem = [(0, 0), (sw, 0), (sw, at_x(*a, sw)), (0, at_x(*a, 0))]
    foot_ = [(at_y(*b, H - fh), H - fh), (foot, H - fh), (foot, H), (at_y(*b, H), H)]
    return [_skew(p) for p in stem], [_skew(p) for p in foot_]

RADII = ([R_OUT, R_OUT, R_MITRE_OBTUSE, R_MITRE_ACUTE], [R_MITRE_OBTUSE, R_OUT, R_OUT, R_MITRE_ACUTE])

def _corners(pts, radii):
    """Je Ecke: (Einlauf, Ecke, Auslauf) für eine quadratische Rundung."""
    out = []
    for i, p in enumerate(pts):
        p0, p1, r = pts[i - 1], pts[(i + 1) % len(pts)], radii[i]
        def toward(q):
            l = math.hypot(q[0] - p[0], q[1] - p[1]); d = min(r, l * .45)
            return (p[0] + (q[0] - p[0]) * d / l, p[1] + (q[1] - p[1]) * d / l)
        out.append((toward(p0), p, toward(p1)))
    return out

def path_d(pts, radii, scale=1.0, dx=0.0):
    f = lambda q: f"{(q[0] + dx) * scale:.2f},{q[1] * scale:.2f}"
    c = _corners(pts, radii)
    d = f"M{f(c[0][2])}"
    for a, p, b in c[1:] + c[:1]:
        d += f"L{f(a)}Q{f(p)} {f(b)}"
    return d + "Z"

def outline(pts, radii, steps=10):
    """Rundungen als Polygonzug (für Blender)."""
    out = []
    for a, p, b in _corners(pts, radii):
        for k in range(steps + 1):
            t = k / steps
            out.append(((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * p[0] + t * t * b[0],
                        (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * p[1] + t * t * b[1]))
    return out

def symbol_d(foot=FULL, gap=GAP, scale=1.0, dx=0.0):
    s, f = polys(foot, gap)
    return path_d(s, RADII[0], scale, dx), path_d(f, RADII[1], scale, dx)

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

def symbol_svg(fg=VOLT, foot_color=None, foot=FULL, gap=GAP):
    a, b = symbol_d(foot, gap)
    return f'<path d="{a}" fill="{fg}"/><path d="{b}" fill="{foot_color or fg}"/>'

# Wortmarke: Zeichen (Straddle-Fuß) als L, danach EVER aus Barlow Condensed Black Italic (SIL OFL)
GLYPHS = {
    "L": (433, "M8 15 90 685Q91 692 95.5 696.0Q100 700 106 700H260Q266 700 269.5 696.0Q273 692 272 685L209 166Q207 161 213 161H403Q410 161 413.5 157.0Q417 153 416 146L400 15Q397 0 383 0H20Q14 0 10.5 4.0Q7 8 8 15Z"),
    "E": (431, "M445 539H259Q254 539 254 534L242 436Q240 431 246 431H343Q350 431 353.5 427.0Q357 423 356 416L340 285Q337 270 323 270H226Q221 270 221 265L209 166Q207 161 213 161H399Q406 161 409.5 157.0Q413 153 412 146L396 15Q395 8 390.5 4.0Q386 0 379 0H20Q14 0 10.5 4.0Q7 8 8 15L90 685Q91 692 95.5 696.0Q100 700 106 700H465Q472 700 475.5 696.0Q479 692 478 685L462 554Q461 547 456.5 543.0Q452 539 445 539Z"),
    "V": (505, "M133 13 79 684Q79 700 95 700H262Q276 700 275 686V327Q274 324 277.0 324.0Q280 324 281 327L365 686Q368 700 382 700H544Q551 700 554.5 696.0Q558 692 555 684L335 13Q331 0 317 0H147Q133 0 133 13Z"),
    "R": (475, "M257 13 228 265Q228 269 225 269Q221 269 221 264L190 15Q189 8 184.5 4.0Q180 0 174 0H20Q14 0 10.5 4.0Q7 8 8 15L90 685Q91 692 95.5 696.0Q100 700 106 700H325Q405 700 451.5 649.0Q498 598 498 514Q498 490 496 477Q489 422 465.0 378.5Q441 335 403 308Q398 305 400 301L443 17V13Q443 7 439.0 3.5Q435 0 429 0H271Q259 0 257 13ZM259 539Q254 539 254 534L239 417Q239 412 244 412H257Q281 412 297.5 433.0Q314 454 314 491Q314 514 303.0 526.5Q292 539 273 539Z"),
}
WORD_FOOT = LEVELS["straddle"] * M
WORD_SPACE = 34                  # Abstand Zeichen → E in Glyphen-Einheiten (Versalhöhe 700)
TRACK = 10                       # Laufweite wie in der App (.01em)

def ink_right(d):
    """rechteste x-Koordinate eines Glyphen-Pfads (absolute Befehle M/L/Q/H/V/Z) – die Kursive ragt
    über den Vorschub hinaus (R: Kontur bis 498, Vorschub 475), sonst wird der Buchstabe angeschnitten"""
    import re
    xs, cmd, nums = [], None, []
    def flush():
        if cmd and cmd in "MLQ": xs.extend(nums[0::2])
        elif cmd == "H": xs.extend(nums)
    for tok in re.findall(r"[MLQHVZ]|-?\d+(?:\.\d+)?", d):
        if tok.isalpha(): flush(); cmd, nums = tok, []
        else: nums.append(float(tok))
    flush()
    return max(xs)

def word_layout():
    """(viewBox-Breite, Zeichen-Pfade in Glyphen-Einheiten, [(x, d) je Buchstabe])"""
    sc = 700 / H
    x0 = bbox(WORD_FOOT)[0]
    sym = symbol_d(WORD_FOOT, GAP, sc, -x0)
    x = (bbox(WORD_FOOT)[2] - x0) * sc + WORD_SPACE
    letters = []
    for ch in "EVER":
        adv, d = GLYPHS[ch]; letters.append((x, d)); x += adv + TRACK
    # Breite bis zur Kontur des letzten Buchstabens, nicht nur bis zu seinem Vorschub
    last_x, last_d = letters[-1]
    return max(x - TRACK, last_x + ink_right(last_d)), sym, letters

def wordmark_svg(fill):
    w, (a, b), letters = word_layout()
    g = "".join(f'<path transform="translate({x:.1f} 700) scale(1 -1)" d="{d}"/>' for x, d in letters)
    return doc((0, 0, w, 700), f'<g fill="{fill}"><path d="{a}"/><path d="{b}"/>{g}</g>')

def doc(vb, body, bg=None, rx=0):
    x, y, w, h = vb
    r = f'<rect x="{x:.3f}" y="{y:.3f}" width="{w:.3f}" height="{h:.3f}" rx="{rx:.3f}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:.3f} {y:.3f} {w:.3f} {h:.3f}">{r}{body}</svg>\n'

def brand_ts():
    """Pfade für die App (LeverMark, Wordmark, Splash) – erzeugt, nicht von Hand ändern."""
    x0, _, x1, _ = bbox()
    stem = symbol_d()[0]
    feet = [symbol_d(LEVELS[k] * M)[1] for k in ("tuck", "adv", "straddle", "full")]
    w, (wa, wb), letters = word_layout()
    lines = [
        "/* Erzeugt von art/brand/mark.py – nicht von Hand ändern. */",
        f"/** viewBox des Zeichens (immer das volle Zeichen, damit es beim Wachsen der Stufen nicht springt) */",
        f"export const MARK_VIEWBOX = '{x0:.2f} 0 {x1 - x0:.2f} {H}'",
        f"export const MARK_STEM = '{stem}'",
        "/** Fuß je Stufe: Tuck, Advanced Tuck, Straddle, Full */",
        "export const MARK_FEET = [",
        *[f"  '{d}'," for d in feet],
        "] as const",
        f"/** Wortmarke: Zeichen als L (Straddle-Fuß) + EVER, Versalhöhe 700 */",
        f"export const WORD_VIEWBOX = '0 0 {w:.1f} 700'",
        f"export const WORD_MARK = ['{wa}', '{wb}'] as const",
        "export const WORD_LETTERS: readonly [number, string][] = [",
        *[f"  [{x:.1f}, '{d}']," for x, d in letters],
        "]",
    ]
    return "\n".join(lines) + "\n"

def write_all(root):
    brand = os.path.join(root, "art", "brand")
    x0, y0, x1, y1 = bbox()
    ix, iy, S = icon_frame()
    files = {
        "symbol-volt.svg": doc((x0, y0, x1 - x0, y1 - y0), symbol_svg(VOLT)),
        "symbol-ink.svg": doc((x0, y0, x1 - x0, y1 - y0), symbol_svg(INK)),
        "wordmark-volt.svg": wordmark_svg(VOLT),
        "wordmark-ink.svg": wordmark_svg(INK),
        "app-icon.svg": doc((ix, iy, S, S), symbol_svg(VOLT), INK),
    }
    for name, svg in files.items():
        with open(os.path.join(brand, name), "w") as fh: fh.write(svg)
    # Favicon: Kleinversion (breite Fuge) auf Ink, leicht gerundet – trägt auf hellen und dunklen Tabs
    fx, fy, fs = icon_frame(pad=0.16)
    with open(os.path.join(root, "public", "favicon.svg"), "w") as fh:
        fh.write(doc((fx, fy, fs, fs), symbol_svg(VOLT, gap=GAP_SMALL), INK, fs * 0.22))
    with open(os.path.join(root, "src", "client", "brandPaths.ts"), "w") as fh: fh.write(brand_ts())
    return [os.path.join("art/brand", n) for n in files] + ["public/favicon.svg", "src/client/brandPaths.ts"]

if __name__ == "__main__":
    root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    for p in write_all(root): print(p)
