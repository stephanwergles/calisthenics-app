"""Lever – Markenrichtlinien als eine selbsttragende HTML-Seite, erzeugt aus mark.py.

  python3 art/brand/guidelines.py      → art/brand/guidelines.html

Alle Zeichnungen (Zeichen, Wortmarke, Konstruktion, Beispiele) kommen aus derselben Geometrie wie
Icons und App – die Richtlinien können also nicht von der echten Marke abweichen. Nach jeder
Änderung an mark.py neu erzeugen.
"""
import base64, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mark as K  # noqa: E402

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
VOLT, INK, CHALK, WHITE = K.VOLT, K.INK, K.CHALK, "#FFFFFF"
CARD, CARD2, LINE, TEXT, MUTED = "#1A1A1A", "#232323", "#2E2E2E", "#EDEDED", "#979797"

def mix(a, b, t):
    ca = [int(a[i:i + 2], 16) for i in (1, 3, 5)]; cb = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x * t + y * (1 - t)):02X}" for x, y in zip(ca, cb))
VOLT_40, VOLT_12 = mix(VOLT, INK, .40), mix(VOLT, INK, .12)

def lum(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True); return (la + .05) / (lb + .05)

# ── Zeichnen ─────────────────────────────────────────────────────────────────
M, H = K.M, K.H
X0, _, X1, _ = K.bbox()

def sym(fg, foot_m=3.0, gap=K.GAP, foot_color=None, extra=""):
    a, b = K.symbol_d(foot_m * M, gap)
    return f'<path d="{a}" fill="{fg}"{extra}/><path d="{b}" fill="{foot_color or fg}"{extra}/>'

def svg(vb, body, cls="", bg=None, aspect=None, label=None):
    x, y, w, h = vb
    r = f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" fill="{bg}"/>' if bg else ""
    par = f' preserveAspectRatio="{aspect}"' if aspect else ""
    a11y = f' role="img" aria-label="{label}"' if label else ' aria-hidden="true"'
    return f'<svg class="{cls}" viewBox="{x:.2f} {y:.2f} {w:.2f} {h:.2f}"{par}{a11y} xmlns="http://www.w3.org/2000/svg">{r}{body}</svg>'

def framed(fg, bg, pad=.3, foot_m=3.0, gap=K.GAP, foot_color=None, label=None, cls=""):
    x, y, S = K.icon_frame(pad=pad)
    return svg((x, y, S, S), sym(fg, foot_m, gap, foot_color), cls, bg, label=label)

def word(fill):
    w, (a, b), letters = K.word_layout()
    g = "".join(f'<path transform="translate({x:.1f} 700) scale(1 -1)" d="{d}"/>' for x, d in letters)
    return w, f'<g fill="{fill}"><path d="{a}"/><path d="{b}"/>{g}</g>'

def wordmark(fill, bg=None, pad=0, cls="wm", label="Lever"):
    w, g = word(fill)
    p = pad * 700
    return svg((-p, -p, w + 2 * p, 700 + 2 * p), g, cls, bg, label=label)

def icon(px, bg=INK, fg=VOLT, foot_color=None):
    gap = K.GAP_SMALL if px <= 32 else K.GAP
    return f'<div class="ico" style="width:{px}px;height:{px}px">{framed(fg, bg, .27, gap=gap, foot_color=foot_color, label="App-Icon")}</div>'

def stills(names):
    out = []
    for n, cap in names:
        p = os.path.join(ROOT, "public", "clip-stills", f"{n}.jpg")
        if not os.path.exists(p): continue
        b = base64.b64encode(open(p, "rb").read()).decode()
        out.append(f'<figure class="still"><img src="data:image/jpeg;base64,{b}" alt="3D-Clip: {cap}"><figcaption>{cap}</figcaption></figure>')
    return "".join(out)

SKETCHES = json.load(open(os.path.join(ROOT, "src", "seed", "sketches.json")))
def sketch(key, cap):
    return (f'<figure class="sk"><svg viewBox="0 0 120 90" role="img" aria-label="Kreide-Skizze: {cap}">{SKETCHES[key]}</svg>'
            f'<figcaption>{cap}</figcaption></figure>')

# ── Inhalte ──────────────────────────────────────────────────────────────────
S = []  # (id, Titel, HTML)

S.append(("haltung", "Haltung", f'''
<p class="lead">Lever ist eine Trainings-App für Calisthenics, die nach Progressionsleitern arbeitet: Skill-Arbeit zuerst, jede Stufe wird verdient, die Sehnen kommen mit. Die Marke sieht aus wie das Training sich anfühlen soll: präzise, ruhig, kraftvoll.</p>
<div class="claim">DER KÖRPER IST DER HEBEL.</div>
<p>Im Calisthenics ist der eigene Körper Gewicht und Werkzeug zugleich. Schwerer wird eine Übung, indem man den Hebel verlängert: vom Tuck über den Straddle zum Full Lever. Diese Mechanik ist der Kern der Marke. Sie steckt im Namen, im Zeichen und in der Art, wie die App Fortschritt zeigt.</p>
<div class="grid4">
  <div class="val"><b>Präzise</b><span>Zahlen statt Adjektive. Jede Form ist konstruiert, jede Aussage messbar.</span></div>
  <div class="val"><b>Verdient</b><span>Fortschritt wird freigeschaltet, nicht geschenkt. Kein falsches Lob.</span></div>
  <div class="val"><b>Ruhig-stark</b><span>Schwarz trägt, Volt setzt das Signal. Kraft durch Reduktion, nicht durch Lautstärke.</span></div>
  <div class="val"><b>Langfristig</b><span>Technik und Gelenke vor dem schnellen Ergebnis. Lever denkt in Monaten.</span></div>
</div>
<p class="note">Lever ist ein Trainer, kein Influencer: Die Marke zeigt Technik und Fortschritt, nie Körperideale.</p>'''))

ann = lambda x, y, t, a="start": f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{a}" class="ann">{t}</text>'
s_, f_ = K.polys()
mid = ((s_[3][0] + f_[3][0]) / 2, (s_[3][1] + f_[0][1]) / 2 + 6)
idea = svg((-34, -10, 160, 126),
    sym(VOLT, foot_color=CHALK)
    + f'<line x1="{s_[1][0] + 4:.1f}" y1="30" x2="{s_[1][0] + 30:.1f}" y2="30" class="ln"/>' + ann(s_[1][0] + 33, 31.4, "ARME")
    + f'<line x1="{f_[1][0] + 2:.1f}" y1="{H - K.FOOT_H / 2:.1f}" x2="{f_[1][0] + 20:.1f}" y2="{H - K.FOOT_H / 2:.1f}" class="ln"/>' + ann(f_[1][0] + 23, H - K.FOOT_H / 2 + 1.4, "KÖRPER")
    + f'<circle cx="{(s_[2][0] + s_[3][0]) / 2:.1f}" cy="{(s_[2][1] + s_[3][1]) / 2 + 1.5:.1f}" r="8" class="ring"/>'
    + f'<line x1="{(s_[2][0] + s_[3][0]) / 2 - 9:.1f}" y1="{(s_[2][1] + s_[3][1]) / 2 + 8:.1f}" x2="-14" y2="{H + 9:.1f}" class="ln"/>' + ann(-14, H + 14, "GELENK", "middle"),
    "diagram", label="Das Zeichen: Arme, Körper, Gelenk")
S.append(("zeichen", "Das Zeichen", f'''
<div class="split"><div class="txt">
<p class="lead">Zwei Hebelarme, verbunden über eine Gehrungsfuge.</p>
<p>Der Stamm sind die Arme, der Fuß ist der Körper, die Fuge ist das Gelenk dazwischen. Gelesen wird das Zeichen als L für Lever, gemeint ist die Mechanik: Wer den Körper verlängert, verlängert den Hebel.</p>
<p>Das Zeichen ist eigenständig konstruiert und keine gesetzte Schrift. Es steht frei, ohne Rahmen und ohne Fläche. Auf dem App-Icon liegt es auf Ink, sonst direkt auf dem Grund.</p>
</div><div class="art">{idea}</div></div>'''))

# Konstruktion
grid = "".join(f'<line x1="-14" y1="{i * M}" x2="{3 * M + 26}" y2="{i * M}" class="g"/>' for i in range(5))
grid += "".join(f'<line x1="{i * M + K.T * H:.2f}" y1="0" x2="{i * M:.2f}" y2="{H}" class="g"/>' for i in range(4))
outl = sym("none", extra=f' stroke="{VOLT}" stroke-width=".45"')
dims = (f'<text x="{(s_[0][0] + s_[1][0]) / 2:.1f}" y="-4" class="dim" text-anchor="middle">M</text>'
        f'<text x="-9" y="{H / 2:.1f}" class="dim" text-anchor="middle">4 M</text>'
        f'<text x="{(f_[3][0] + f_[2][0]) / 2:.1f}" y="{H + 9:.1f}" class="dim" text-anchor="middle">3 M</text>'
        f'<text x="{f_[1][0] + 6:.1f}" y="{H - K.FOOT_H / 2 + 1.5:.1f}" class="dim">0,92 M</text>'
        f'<text x="{s_[1][0] + 6:.1f}" y="8" class="dim">7°</text>'
        f'<text x="{mid[0] + 12:.1f}" y="{mid[1] - 10:.1f}" class="dim">Fuge M/6</text>')
cons = svg((-24, -14, 136, 128), f'<g opacity=".9">{sym(VOLT_12)}</g>{grid}{outl}{dims}', "diagram", label="Konstruktionsraster")
spec = [("Modul M", "Breite des Stamms, Grundeinheit aller Maße", "24 Einheiten"),
        ("Höhe", "Oberkante Stamm bis Grundlinie", "4 M"),
        ("Fußlänge", "Full Lever; Wortmarke: Straddle 2,5 M", "3 M"),
        ("Fußhöhe", "optisch korrigiert: Waagerechte wirken schwerer", "0,92 M"),
        ("Stamm", "senkrecht zur Achse gemessen", "0,985 M"),
        ("Neigung", "Kursivwinkel der Barlow Condensed Black Italic", "7°"),
        ("Gelenkfuge", "senkrecht gemessen, von Innen- zu Außenecke", "M/6 · klein M/3,6"),
        ("Ecken", "außen 1,1 · Gehrung stumpf 0,7 · spitz 0,9 Einheiten", "Mikro-Rundung")]
rows = "".join(f"<tr><th>{a}</th><td>{b}</td><td class='num'>{c}</td></tr>" for a, b, c in spec)
S.append(("konstruktion", "Konstruktion", f'''
<div class="split"><div class="art">{cons}</div><div class="txt">
<p>Alle Maße leiten sich aus einem Modul ab. Die Geometrie liegt als Skript in <code>art/brand/mark.py</code> und erzeugt Icons, SVG-Master und die Pfade der App. Geändert wird nur dort.</p>
<div class="tbl"><table><tbody>{rows}</tbody></table></div>
</div></div>
<p class="note">Die optischen Korrekturen sind kaum sichtbar, aber spürbar: Ohne sie wirkt der Fuß schwerer als der Stamm, und die spitzen Ecken an der Fuge laufen in kleinen Größen zu.</p>'''))

# Progression
lv = [("Tuck", 1.45), ("Adv. Tuck", 1.95), ("Straddle", 2.5), ("Full", 3.0)]
lvl = "".join(f'''<figure class="lvl"><div class="lvs">{svg((X0 - 8, -8, X1 - X0 + 16, H + 16), sym(VOLT if i >= 2 else VOLT_40, m), label=n)}</div>
  <figcaption><b>{n}</b><span>{str(m).replace(".", ",")} M</span></figcaption></figure>''' for i, (n, m) in enumerate(lv))
S.append(("progression", "Progressionsstufen", f'''
<p class="lead">Das Zeichen kann wachsen. Mit jeder Stufe wird der Fuß, also der Körper, länger.</p>
<div class="lvls">{lvl}</div>
<ul class="rules">
<li>In der App zeigt diese Form den Stand einer Skill-Leiter: <b>Volt</b> heißt erreicht, <b>Volt 40</b> heißt offen.</li>
<li>Der Startbildschirm beginnt in der Tuck-Stufe und verlängert den Hebel in drei Schritten bis Full.</li>
<li>Als Logo steht das Zeichen immer in der Full-Stufe. Die Wortmarke nutzt Straddle, damit das L so breit ist wie die übrigen Buchstaben.</li>
<li>Die viewBox umfasst immer das volle Zeichen. So springt nichts, wenn eine Stufe wächst.</li>
</ul>'''))

# Wortmarke
ww, _ = word(VOLT)
cap_line = (f'<line x1="-40" y1="0" x2="{ww + 40}" y2="0" class="g2"/><line x1="-40" y1="700" x2="{ww + 40}" y2="700" class="g2"/>'
            f'<text x="{ww + 50}" y="20" class="dim2">Versalhöhe</text><text x="{ww + 50}" y="710" class="dim2">Grundlinie</text>')
wm_cons = svg((-60, -80, ww + 420, 860), word(VOLT)[1] + cap_line, "wmc", label="Wortmarke mit Hilfslinien")
S.append(("wortmarke", "Wortmarke", f'''
<div class="hero-wm">{wordmark(VOLT)}</div>
<p class="lead">In der Wortmarke ist das Zeichen das L.</p>
<p>Das Zeichen steht auf Versalhöhe in der Straddle-Stufe, danach folgt EVER aus der Barlow Condensed Black Italic. Die Strichstärke des Zeichens entspricht der Schrift, der Kursivwinkel ist derselbe. So entsteht ein Wort und kein Symbol neben einem Wort.</p>
<div class="art wide">{wm_cons}</div>
<ul class="rules">
<li>Abstand Zeichen → E: 34 Einheiten bei Versalhöhe 700, Laufweite der Buchstaben +10.</li>
<li>Die Wortmarke wird nie aus Schrift nachgesetzt. Immer die Master-Datei oder die Komponente <code>Wordmark</code> verwenden.</li>
<li>Zeichen und Wortmarke stehen nie nebeneinander („L LEVER“). Das Zeichen steckt bereits im Wort.</li>
</ul>'''))

# Varianten
var = f'''<div class="vars">
<figure class="var"><div class="pane" style="background:{INK}">{wordmark(VOLT)}</div><figcaption><b>Wortmarke · Primär</b>Volt auf Ink. Überall, wo Lever genannt wird: App-Kopf, Website, Druck.</figcaption></figure>
<figure class="var"><div class="pane" style="background:{INK}">{svg((X0, 0, X1 - X0, H), sym(VOLT), "sym", label="Zeichen")}</div><figcaption><b>Zeichen</b>Wo der Name schon bekannt ist oder der Platz fehlt: Icon, Favicon, Merch, Supergrafik.</figcaption></figure>
<figure class="var"><div class="pane" style="background:{INK}">{icon(96)}</div><figcaption><b>App-Icon</b>Zeichen auf Ink, vollflächig. iOS rundet die Ecken selbst.</figcaption></figure>
</div>
<h3>Farbfassungen</h3>
<div class="cols">
<div class="pane sm" style="background:{INK}">{wordmark(VOLT)}</div>
<div class="pane sm" style="background:{VOLT}">{wordmark(INK)}</div>
<div class="pane sm" style="background:{WHITE}">{wordmark(INK)}</div>
<div class="pane sm" style="background:{INK}">{wordmark(CHALK)}</div>
<div class="pane sm" style="background:{CARD}">{wordmark(VOLT)}</div>
<div class="pane sm" style="background:{CHALK}">{wordmark(INK)}</div>
</div>
<p class="note">Erlaubt: Volt auf Ink oder Card, Ink auf Volt, Weiß oder Chalk, Chalk auf Ink. Einfarbig immer in Ink oder Weiß.</p>'''
S.append(("varianten", "Logo-Varianten", var))

# Schutzzone & Größen
p = M
cz = svg((X0 - 2 * p, -2 * p, X1 - X0 + 4 * p, H + 4 * p),
    f'<rect x="{X0 - p:.1f}" y="{-p}" width="{X1 - X0 + 2 * p:.1f}" height="{H + 2 * p}" class="zone"/>'
    f'<rect x="{X0:.1f}" y="0" width="{X1 - X0:.1f}" height="{H}" class="zone2"/>' + sym(VOLT)
    + f'<text x="{X0 - p / 2:.1f}" y="{H / 2:.1f}" class="dim" text-anchor="middle">M</text>'
    + f'<text x="{(X0 + X1) / 2:.1f}" y="{-p / 2 + 1.5:.1f}" class="dim" text-anchor="middle">M</text>', "diagram", label="Schutzzone Zeichen")
wz = svg((-430, -430, ww + 860, 1560),
    f'<rect x="-350" y="-350" width="{ww + 700}" height="1400" class="zone"/><rect x="0" y="0" width="{ww}" height="700" class="zone2"/>'
    + word(VOLT)[1] + f'<text x="-175" y="370" class="dim3" text-anchor="middle">½</text><text x="{ww / 2}" y="-160" class="dim3" text-anchor="middle">½ Versalhöhe</text>',
    "diagram", label="Schutzzone Wortmarke")
mins = (f'<div class="mins"><div><div style="height:16px">{svg((X0, 0, X1 - X0, H), sym(VOLT, gap=K.GAP_SMALL), "sym")}</div><span>Zeichen 16 px</span></div>'
        f'<div><div style="height:24px">{svg((X0, 0, X1 - X0, H), sym(VOLT, gap=K.GAP_SMALL), "sym")}</div><span>24 px · Kleinversion</span></div>'
        f'<div><div style="height:48px">{svg((X0, 0, X1 - X0, H), sym(VOLT), "sym")}</div><span>ab 33 px Standard</span></div>'
        f'<div><div style="height:10px">{wordmark(VOLT)}</div><span>Wortmarke 10 px Versalhöhe</span></div></div>')
S.append(("schutzzone", "Schutzzone & Mindestgrößen", f'''
<div class="cols2"><figure class="pane tall" style="background:{INK}">{cz}<figcaption>Zeichen: rundum 1 M frei</figcaption></figure>
<figure class="pane tall" style="background:{INK}">{wz}<figcaption>Wortmarke: rundum ½ Versalhöhe frei</figcaption></figure></div>
<h3>Mindestgrößen</h3>{mins}
<ul class="rules"><li>Bis 32 px Höhe die Kleinversion des Zeichens verwenden. Ihre Fuge ist breiter (M/3,6), sonst läuft sie zu. Das Favicon nutzt sie bereits.</li>
<li>Druck: Zeichen mindestens 5 mm hoch, Wortmarke mindestens 3 mm Versalhöhe.</li></ul>'''))

# Don'ts
x, y, Sz = K.icon_frame(pad=.3)
def wrong(body, cap, bg=INK):
    return f'<figure class="dont"><div class="pane sq" style="background:{bg}">{svg((x, y, Sz, Sz), body)}</div><figcaption><i>✕</i>{cap}</figcaption></figure>'
cx_, cy_ = (X0 + X1) / 2, H / 2
w_, wg_ = word(VOLT)
donts = "".join([
    wrong(f'<g transform="translate({cx_} {cy_}) scale(1.35 .85) translate({-cx_} {-cy_})">{sym(VOLT)}</g>', "Nicht verzerren"),
    wrong(f'<g transform="rotate(-18 {cx_} {cy_})">{sym(VOLT)}</g>', "Nicht drehen"),
    wrong(f'<g transform="translate({2 * cx_} 0) scale(-1 1)">{sym(VOLT)}</g>', "Nicht spiegeln"),
    wrong(sym(VOLT, gap=0), "Fuge nie schließen"),
    wrong(sym("none", extra=f' stroke="{VOLT}" stroke-width="1.6"'), "Keine Kontur"),
    wrong(f'<defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF36A"/><stop offset="1" stop-color="#4CC9A0"/></linearGradient>'
          f'<filter id="sh"><feDropShadow dx="2" dy="4" stdDeviation="2.5" flood-opacity=".8"/></filter></defs><g filter="url(#sh)">{sym("url(#gr)")}</g>', "Keine Verläufe, Schatten, Effekte"),
    wrong(sym("#FF4D00"), "Keine anderen Farben"),
    wrong(sym(VOLT), "Volt nie auf hellem Grund", CHALK),
    wrong(sym(VOLT, 1.45), "Stufen nicht als Logo"),
])
lldouble = (f'<figure class="dont wide"><div class="pane" style="background:{INK}">'
            + svg((-60, -60, 2 * (X1 - X0) * 700 / H + w_ + 120, 820),
                  f'<g transform="scale({700 / H:.4f}) translate({-X0:.2f} 0)">{sym(VOLT)}</g>'
                  f'<g transform="translate({(X1 - X0) * 700 / H + 240:.1f} 0)">{"".join(f"<path transform=\"translate({xx} 700) scale(1 -1)\" d=\"{K.GLYPHS[ch][1]}\" fill=\"{VOLT}\"/>" for xx, ch in zip([0, 443, 884, 1399], "LEVE"))}<path transform="translate(1840 700) scale(1 -1)" d="{K.GLYPHS["R"][1]}" fill="{VOLT}"/></g>', "wm")
            + '</div><figcaption><i>✕</i>Zeichen nie vor die Wortmarke stellen („L LEVER“)</figcaption></figure>')
S.append(("falsch", "Falsche Anwendung", f'<div class="donts">{donts}{lldouble}</div>'))

# Farbe
sw = [("Volt", VOLT, INK, "Signal · Fortschritt · Hauptaktion"), ("Ink", INK, TEXT, "Grund · Flächen"),
      ("Chalk", CHALK, INK, "Erledigtes · Text auf Ink"), ("Card", CARD, TEXT, "Ebenen · Karten"),
      ("Card 2", CARD2, TEXT, "Steuerelemente"), ("Line", LINE, TEXT, "Ränder · Trennlinien"),
      ("Muted", MUTED, INK, "Nebentext"), ("Volt 40", VOLT_40, TEXT, "offene Stufen"), ("Volt 12", VOLT_12, TEXT, "Muster · Supergrafik leise")]
def rgb(h): return ", ".join(str(int(h[i:i + 2], 16)) for i in (1, 3, 5))
swatches = "".join(f'<div class="swatch{" big" if n in ("Volt", "Ink") else ""}" style="background:{c};color:{t}"><b>{n}</b><span class="num">{c}</span><span class="num">RGB {rgb(c)}</span><small>{d}</small></div>' for n, c, t, d in sw)
pairs = [("Volt auf Ink", VOLT, INK), ("Ink auf Volt", INK, VOLT), ("Chalk auf Ink", CHALK, INK), ("Text auf Card", TEXT, CARD), ("Muted auf Ink", MUTED, INK), ("Volt auf Chalk", VOLT, CHALK)]
ctab = "".join(f'<tr><th><span class="chip" style="background:{b};color:{a}">Aa</span>{n}</th><td class="num">{contrast(a, b):.1f} : 1</td><td>{"AAA" if contrast(a, b) >= 7 else "AA" if contrast(a, b) >= 4.5 else "nur Grafik" if contrast(a, b) >= 3 else "nicht verwenden"}</td></tr>' for n, a, b in pairs)
S.append(("farbe", "Farbe", f'''
<p class="note">Stand Oktober 2026: Volt ist gesetzt, bleibt aber auf dem Prüfstand. Ein Wechsel betrifft nur <code>--accent</code> in <code>styles.css</code> und <code>VOLT</code> in <code>mark.py</code>.</p>
<p class="lead">Schwarz trägt, Volt setzt das Signal. Volt ist kein Hintergrund für Fließtext, sondern die eine Farbe, die zeigt, was jetzt zählt.</p>
<div class="swatches">{swatches}</div>
<div class="ratio" aria-label="Flächenverhältnis"><span style="flex:70;background:{INK}">Ink 70</span><span style="flex:15;background:{CARD}">Card 15</span><span style="flex:10;background:{CHALK};color:{INK}">10</span><span style="flex:5;background:{VOLT};color:{INK}">5</span></div>
<p class="note">Flächenverhältnis ungefähr 70 Ink · 15 Card · 10 Chalk · 5 Volt. Alle Grautöne sind neutrale Abstufungen von Ink, ohne Blaustich.</p>
<h3>Kontrast</h3><div class="tbl"><table><thead><tr><th>Paar</th><th>Kontrast</th><th>WCAG</th></tr></thead><tbody>{ctab}</tbody></table></div>'''))

# Typografie
S.append(("typografie", "Typografie", f'''
<p class="lead">Zwei Schnitte einer Familie: Barlow Condensed für Überschriften und Zahlen, Barlow für Text. Beide werden mit der App ausgeliefert, damit sie offline funktionieren.</p>
<div class="specimen">
<div class="spec"><span class="lab">Display · Barlow Condensed 800, Versalien</span><p class="t-xl">BEREIT FÜR <em>BEINE.</em></p></div>
<div class="spec"><span class="lab">Claim · Barlow Condensed 900 Italic</span><p class="t-claim">TUCK. STRADDLE. FULL.</p></div>
<div class="spec"><span class="lab">Zahlen · Barlow Condensed 800, tabellarisch</span><p class="t-num">12 × 3 · 90 s · 2,5 kg</p></div>
<div class="spec"><span class="lab">Text · Barlow 400 / 600</span><p class="t-body">Halte die Schulterblätter aktiv und zieh die Brust zur Stange. <b>Zwei Einheiten mit allen Sätzen über dem Ziel</b> schalten die nächste Stufe frei.</p></div>
<div class="spec"><span class="lab">Label · Barlow 700, Versalien, +12 % Laufweite</span><p class="t-label">HEUTE · TAG A</p></div>
</div>
<div class="tbl"><table><thead><tr><th>Stufe</th><th>Schrift</th><th>Größe / Zeilenhöhe</th></tr></thead><tbody>
<tr><th>Display XL</th><td>Condensed 800 Versalien</td><td class="num">44 / 0,95</td></tr>
<tr><th>Display L</th><td>Condensed 800 Versalien</td><td class="num">30 / 0,95</td></tr>
<tr><th>Display M</th><td>Condensed 800 Versalien</td><td class="num">22 / 1,0</td></tr>
<tr><th>Text</th><td>Barlow 400</td><td class="num">16 / 1,5</td></tr>
<tr><th>Klein</th><td>Barlow 500</td><td class="num">14 / 1,4</td></tr>
<tr><th>Label</th><td>Barlow 700 Versalien +0,12 em</td><td class="num">12 / 1,2</td></tr></tbody></table></div>
<ul class="rules"><li>Die kursive 900 ist der Wortmarke und kurzen Claims vorbehalten. Überschriften in der App stehen aufrecht.</li>
<li>Akzentwort in Volt, immer am Ende der Überschrift: „Bereit für <em class="v">Beine.</em>“</li>
<li>Zahlen, die untereinander stehen, immer tabellarisch.</li></ul>'''))

# Sprache
dd = [("Satz gespeichert. 90 s Pause.", "Super gemacht!!! Dein Satz wurde erfolgreich gespeichert."),
      ("Noch 2 Wdh. bis zur nächsten Stufe.", "Du bist fast da, gib alles!"),
      ("Heute erledigt.", "Mega Workout, Champion!"),
      ("Keine Verbindung. Deine Daten bleiben auf dem Gerät und gleichen sich später ab.", "Ups, da ist etwas schiefgelaufen."),
      ("Muscle-up freigeschaltet.", "Glückwunsch, du bist ein Biest!")]
ddt = "".join(f'<div class="do"><span class="y">So</span>{a}</div><div class="do no"><span class="n">Nicht so</span>{b}</div>' for a, b in dd)
S.append(("sprache", "Sprache", f'''
<p class="lead">Lever spricht wie ein guter Trainer: kurz, konkret und ehrlich.</p>
<div class="grid4">
<div class="val"><b>Du, auf Deutsch</b><span>Direkt und ohne Floskeln. Die Namen der Skills bleiben englisch: Tuck, Straddle, Front Lever, Muscle-up.</span></div>
<div class="val"><b>Zahlen statt Adjektive</b><span>„3 × 8“ sagt mehr als „starke Leistung“.</span></div>
<div class="val"><b>Verdient, nicht geschenkt</b><span>Lob gibt es nur für echten Fortschritt, also beim Freischalten einer Stufe.</span></div>
<div class="val"><b>Fehler erklären</b><span>Sagen, was passiert ist und was jetzt gilt. Keine Entschuldigung, kein „Ups“.</span></div>
</div>
<div class="dos">{ddt}</div>
<ul class="rules"><li>Deutsche Anführungszeichen „…“, Halbgeviertstrich – mit Leerzeichen, Zahlen und Einheiten mit schmalem Abstand: 90 s, 2,5 kg.</li>
<li>Keine Emoji, keine Ausrufezeichen-Ketten, keine Superlative.</li>
<li>Knöpfe sagen genau, was passiert: „Training starten“, „Satz speichern“, „Stufe freischalten“.</li></ul>'''))

# Bildsprache
S.append(("bildsprache", "Bildsprache", f'''
<p class="lead">Lever zeigt Technik, nicht Optik.</p>
<h3>3D-Clips</h3>
<p>Ein athletischer, neutraler Körper ohne Gesicht und ohne Marke, auf Card (#1A1A1A) im Studiolicht. Jede Übung als ruhiger Loop von 2 Sekunden. Die Bewegung ist die Information.</p>
<div class="stills">{stills([("pull-up", "Klimmzug"), ("l-sit-parallettes", "L-Sit an Parallettes"), ("tuck-front-lever-row", "Tuck Front Lever Row")])}</div>
<h3>Kreide-Skizzen</h3>
<p>Schematische Strichfiguren für kleine Flächen und Übersichten: Körper in Chalk, Gerät und Boden in Volt, runde Linienenden.</p>
<div class="sketches">{sketch("pullupTop", "Klimmzug")}{sketch("lsit", "L-Sit")}{sketch("tuckFL", "Tuck Front Lever")}{sketch("muTrans", "Muscle-up")}</div>
<ul class="rules"><li>Keine Stockfotos, keine Vorher-nachher-Körper, kein Oberkörperfrei-Marketing.</li>
<li>Fotos von echten Menschen nur dokumentarisch und im Training, nie gestellt und nie mit Fokus auf den Körper.</li></ul>'''))

# Grafische Elemente
def poster(bg, fg, head, sub, crop, foot=None, lc=None, cls=""):
    pc = svg(crop, sym(fg, foot_color=foot), "", aspect="xMidYMid slice")
    return (f'<div class="poster {cls}" style="background:{bg};color:{fg}"><div class="pc">{pc}</div>'
            f'<div class="ph"><p class="h">{head}</p><p class="sub">{sub}</p></div><div class="pl">{wordmark(lc or fg)}</div></div>')
tiles = "".join(f'<g transform="translate({c * 92 + (r % 2) * 46} {r * 108})">{sym(VOLT if (r, c) == (2, 3) else VOLT_12)}</g>' for r in range(5) for c in range(9))
S.append(("grafik", "Grafische Elemente", f'''
<h3>Supergrafik</h3>
<p>Das Zeichen darf riesig und angeschnitten als Fläche stehen. Es läuft dabei über höchstens zwei Kanten aus dem Format, und die Fuge bleibt immer sichtbar. Ohne Gelenk ist es nur ein L.</p>
<div class="posters">
{poster(INK, VOLT, "DER KÖRPER<br>IST DER HEBEL.", "Calisthenics mit Progressionsleitern", (-52, -40, 96, 128))}
{poster(VOLT, INK, "TUCK.<br>STRADDLE.<br>FULL.", "Jede Stufe verdient.", (-58, -70, 120, 160))}
{poster(CARD, CHALK, "SKILL<br>ZUERST.", "Muscle-up · L-Sit · Front Lever", (-48, -44, 96, 128), VOLT, VOLT)}
</div>
<h3>Muster</h3>
<div class="pat">{svg((0, 0, 820, 520), tiles, "", INK, label="Muster aus versetzten Zeichen")}</div>
<p class="note">Versetzte Reihen in Volt 12, genau ein Zeichen in Volt: Einer schafft die Stufe. Für Hintergründe, Verpackung und Social Media, nie hinter Text.</p>'''))

# App-Icon & Start
frames = "".join(f'<figure class="frame"><div class="scr">{svg((X0 - 30, -60, X1 - X0 + 60, H + 120), sym(VOLT, m))}</div><figcaption class="num">{t} ms</figcaption></figure>' for t, m in ((0, 1.45), (160, 1.95), (320, 2.5), (480, 3.0)))
S.append(("icon", "App-Icon & Start", f'''
<div class="icons">{icon(180)}{icon(120)}{icon(60)}{icon(40)}{icon(29)}{icon(20)}</div>
<ul class="rules"><li>Das Zeichen auf Ink, vollflächig, ohne Rahmen und ohne Text. iOS rundet die Ecken selbst.</li>
<li>Es sitzt leicht rechts und oberhalb der Mitte. Das L ist links unten schwer, so wirkt es optisch mittig.</li>
<li>Ab 32 px und kleiner die Kleinversion mit breiter Fuge.</li></ul>
<h3>Startbildschirm</h3>
<p>Das native Startbild zeigt das Zeichen in der Tuck-Stufe, mittig, mit 11 % der Bildschirmhöhe. Die App übernimmt es deckungsgleich und verlängert den Hebel in drei Schritten bis Full, dann blendet sie aus. Bei „Bewegung reduzieren“ entfällt die Animation.</p>
<div class="frames">{frames}</div>'''))

# Anwendungen
shirt = "M62,14 L84,6 Q100,22 116,6 L138,14 L192,44 L174,84 L150,72 L150,214 L50,214 L50,72 L26,84 L8,44 Z"
sc_w = 104 / ww
tee_f = f'<svg viewBox="0 0 200 220" class="mk" role="img" aria-label="Shirt vorn"><path d="{shirt}" fill="#151515"/><g transform="translate(118 50) scale(.2)">{sym(VOLT)}</g></svg>'
tee_b = (f'<svg viewBox="0 0 200 220" class="mk" role="img" aria-label="Shirt hinten"><path d="{shirt}" fill="#151515"/>'
         f'<g transform="translate(64 48) scale(.9)">{sym(VOLT)}</g><g transform="translate(48 172) scale({sc_w:.4f})">{word(CHALK)[1]}</g></svg>')
bag = (f'<svg viewBox="0 0 160 200" class="mk" role="img" aria-label="Kreidebeutel"><rect x="22" y="40" width="116" height="150" rx="24" fill="{VOLT}"/>'
       f'<rect x="22" y="40" width="116" height="26" rx="10" fill="{mix(VOLT, INK, .82)}"/><path d="M60,40 Q80,14 100,40" fill="none" stroke="{INK}" stroke-width="4"/>'
       f'<g transform="translate(52 86) scale(.66)">{sym(INK)}</g></svg>')
sticker = (f'<svg viewBox="0 0 160 160" class="mk" role="img" aria-label="Sticker"><circle cx="80" cy="80" r="70" fill="{INK}"/><circle cx="80" cy="80" r="70" fill="none" stroke="{CHALK}" stroke-width="5"/>'
           f'<g transform="translate(48 40) scale(.84)">{sym(VOLT, foot_color=CHALK)}</g></svg>')
post = (f'<div class="post"><div class="pc">{svg((-70, -110, 150, 190), sym(VOLT), "", aspect="xMidYMid slice")}</div>'
        f'<p class="h">FRONT LEVER<br><em>FREIGESCHALTET.</em></p><p class="sub">Stufe 4 von 4 · 2 Einheiten über dem Ziel</p><div class="pl">{wordmark(VOLT)}</div></div>')
S.append(("anwendung", "Anwendungen", f'''
<div class="merch">
<figure>{tee_f}<figcaption>Shirt vorn: Zeichen klein auf der Brust</figcaption></figure>
<figure>{tee_b}<figcaption>Shirt hinten: Zeichen groß, Wortmarke darunter</figcaption></figure>
<figure>{bag}<figcaption>Kreidebeutel: Ink auf Volt</figcaption></figure>
<figure>{sticker}<figcaption>Sticker: Körper in Chalk</figcaption></figure>
</div>
<h3>Social Media</h3>
<div class="posts">{post}<div class="txt"><p>Posts im Format 4:5. Die Überschrift steht oben links, das Akzentwort in Volt, die Wortmarke unten links. Eine angeschnittene Supergrafik trägt die Fläche. Inhalt sind echte Meilensteine mit echten Zahlen, kein Motivationsspruch ohne Bezug.</p></div></div>'''))

files = [("art/brand/mark.py", "Geometrie, einzige Quelle aller Formen"),
         ("art/brand/wordmark-volt.svg · wordmark-ink.svg", "Wortmarke"),
         ("art/brand/symbol-volt.svg · symbol-ink.svg", "Zeichen"),
         ("art/brand/app-icon.svg", "App-Icon (Vektor)"),
         ("public/favicon.svg", "Favicon, Kleinversion"),
         ("public/apple-touch-icon.png · icon-512.png", "Web-Icons (180 / 512 px)"),
         ("ios/…/AppIcon.appiconset · Splash.imageset", "iOS-Icon 1024 px und Startbild"),
         ("src/client/brandPaths.ts", "Pfade für LeverMark, Wordmark und Splash (erzeugt)"),
         ("art/blender/brand.py", "rendert die PNGs aus mark.py"),
         ("art/fonts/BarlowCondensed-BlackItalic.ttf", "Schrift der Wortmarke (SIL OFL)")]
ft = "".join(f"<tr><th><code>{a}</code></th><td>{b}</td></tr>" for a, b in files)
S.append(("dateien", "Dateien", f'''
<div class="tbl"><table><tbody>{ft}</tbody></table></div>
<pre class="cmd">python3 art/brand/mark.py
art/vendor/Blender.app/Contents/MacOS/Blender -b --factory-startup --python art/blender/brand.py -- art/out/brand
python3 art/brand/guidelines.py</pre>
<p class="note">Nach einer Änderung an der Marke alle drei Schritte ausführen, die PNGs an ihre Ziele kopieren, den Cache-Buster <code>?v=</code> in <code>layout.tsx</code> und den Service-Worker-Cache hochzählen.</p>'''))

# ── Seite ────────────────────────────────────────────────────────────────────
CSS = """
/* Layout: Inhaltsspalte mit fester Navigation links (ab 980 px), darunter einspaltig. Dunkel ist die Marke – eine Fassung. */
:root {
  --ink: #101010; --card: #1A1A1A; --card2: #232323; --line: #2E2E2E; --text: #EDEDED; --muted: #979797;
  --chalk: #F4F4F4; --volt: #D4FF3A; --volt40: VOLT40; --volt12: VOLT12;
  --display: "Barlow Condensed", "Arial Narrow", "Helvetica Neue", sans-serif;
  --body: "Barlow", "Helvetica Neue", Arial, sans-serif;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--ink); color: var(--text); font: 16px/1.6 var(--body); margin: 0; -webkit-font-smoothing: antialiased; }
a { color: var(--volt); }
code { font: 13px/1.4 ui-monospace, "SF Mono", Menlo, monospace; color: var(--chalk); background: var(--card2); padding: 1px 5px; border-radius: 4px; overflow-wrap: anywhere; }
.wrap { display: grid; grid-template-columns: 220px minmax(0, 1fr); max-width: 1320px; margin: 0 auto; padding-inline: 32px; gap: 56px; }
nav { position: sticky; top: env(safe-area-inset-top, 0px); align-self: start; padding-block: 36px; max-height: 100vh; overflow-y: auto; }
nav .nw { height: 18px; margin-bottom: 26px; display: block; }
nav ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; counter-reset: c; }
nav li { counter-increment: c; }
nav a { display: flex; gap: 10px; color: var(--muted); text-decoration: none; font-size: 14px; padding: 5px 0; }
nav a::before { content: counter(c, decimal-leading-zero); font: 700 12px/1.9 var(--display); color: var(--line); width: 18px; }
nav a:hover, nav a:focus-visible { color: var(--text); outline: none; }
nav a:focus-visible::before { color: var(--volt); }
main { min-width: 0; padding-block: 0 96px; }
.cover { padding-block: 72px 64px; border-bottom: 1px solid var(--line); position: relative; overflow: hidden; }
.cover .eyebrow { font: 700 12px/1 var(--body); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.cover .wm-big { height: clamp(56px, 11vw, 132px); margin-block: 26px 22px; display: block; }
.cover .claimline { font: italic 900 clamp(22px, 3vw, 30px)/1 var(--display); color: var(--chalk); letter-spacing: .01em; }
.cover .bg { position: absolute; right: -60px; top: -40px; height: 130%; opacity: 1; pointer-events: none; }
.cover .bg svg { height: 100%; width: auto; }
.cover > *:not(.bg) { position: relative; }
section { padding-block: 64px; border-bottom: 1px solid var(--line); counter-increment: s; }
main { counter-reset: s; }
section > h2 { font: 800 clamp(30px, 4vw, 44px)/.95 var(--display); text-transform: uppercase; letter-spacing: .01em; margin: 0 0 28px; text-wrap: balance; display: flex; gap: 16px; align-items: baseline; }
section > h2::before { content: counter(s, decimal-leading-zero); color: var(--volt); font-size: .5em; }
h3 { font: 700 12px/1 var(--body); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 44px 0 16px; }
p { margin: 0 0 14px; max-width: 66ch; }
.lead { font-size: 21px; line-height: 1.45; color: #fff; max-width: 52ch; }
.note { color: var(--muted); font-size: 14px; margin-top: 18px; }
b { color: #fff; font-weight: 600; }
em.v, .t-xl em { color: var(--volt); font-style: normal; }
.claim { font: italic 900 clamp(40px, 7vw, 84px)/.9 var(--display); color: var(--volt); margin: 34px 0 30px; letter-spacing: .01em; }
.grid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-block: 28px 8px; }
.val { background: var(--card); border-radius: 14px; padding: 20px; display: grid; gap: 6px; align-content: start; }
.val b { font: 800 22px/1 var(--display); text-transform: uppercase; color: var(--chalk); }
.val span { color: var(--muted); font-size: 14.5px; line-height: 1.5; }
.split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px; align-items: center; }
.art { background: var(--card); border-radius: 18px; display: flex; align-items: center; justify-content: center; padding: 28px; min-height: 360px; }
.art.wide { min-height: 0; margin-block: 26px; padding: 34px 24px; }
.diagram { width: 100%; max-height: 400px; }
.wmc { width: 100%; height: auto; }
.ann { font: 700 4px var(--body); letter-spacing: .2em; fill: var(--muted); }
.ln { stroke: #5b5b5b; stroke-width: .35; }
.ring { fill: none; stroke: var(--volt); stroke-width: .5; }
.g { stroke: #3a3a3a; stroke-width: .25; stroke-dasharray: 1 1; }
.g2 { stroke: #555; stroke-width: 3; stroke-dasharray: 12 10; }
.dim { font: 600 4.2px var(--body); fill: var(--volt); }
.dim2 { font: 600 34px var(--body); fill: var(--muted); }
.dim3 { font: 600 60px var(--body); fill: var(--volt); }
.zone { fill: none; stroke: var(--volt); stroke-width: .5; stroke-dasharray: 2 1.5; }
.wz .zone, svg .zone { vector-effect: non-scaling-stroke; }
.zone2 { fill: none; stroke: #444; stroke-width: .4; vector-effect: non-scaling-stroke; }
.tbl { overflow-x: auto; margin-top: 18px; }
table { border-collapse: collapse; width: 100%; font-size: 14.5px; }
th, td { text-align: left; padding: 10px 12px 10px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
thead th { color: var(--muted); font-weight: 600; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; }
tbody th { color: #fff; font-weight: 600; white-space: nowrap; }
td { color: var(--muted); }
.num { font-family: var(--display); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--chalk); white-space: nowrap; }
.rules { margin: 22px 0 0; padding: 0; list-style: none; display: grid; gap: 10px; max-width: 72ch; }
.rules li { padding-left: 22px; position: relative; }
.rules li::before { content: ""; position: absolute; left: 0; top: .72em; width: 10px; height: 2px; background: var(--volt); }
.lvls { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-block: 28px 8px; }
.lvl { margin: 0; background: var(--card); border-radius: 16px; padding: 26px 12px 18px; display: grid; gap: 14px; justify-items: center; }
.lvs { height: 150px; width: 100%; } .lvs svg { width: 100%; height: 100%; }
.lvl figcaption { display: grid; justify-items: center; }
.lvl b { font: 800 20px/1 var(--display); text-transform: uppercase; }
.lvl span { color: var(--muted); font-size: 13px; }
.hero-wm { background: var(--card); border-radius: 18px; padding: 56px 40px; margin-bottom: 30px; }
.hero-wm .wm { height: clamp(48px, 9vw, 110px); width: auto; display: block; max-width: 100%; }
.vars { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.var { margin: 0; display: grid; gap: 12px; align-content: start; }
.var figcaption { font-size: 14px; color: var(--muted); display: grid; gap: 4px; }
.pane { border-radius: 16px; display: flex; align-items: center; justify-content: center; padding: 34px; min-height: 190px; border: 1px solid var(--line); margin: 0; }
.pane .wm { width: 100%; max-height: 64px; }
.pane .sym { height: 104px; width: auto; }
.pane.sm { min-height: 120px; padding: 26px; } .pane.sm .wm { max-height: 40px; }
.pane.sq { aspect-ratio: 1; min-height: 0; padding: 0; overflow: hidden; } .pane.sq svg { width: 100%; height: 100%; }
.pane.tall { flex-direction: column; gap: 14px; min-height: 300px; } .pane.tall svg { width: 100%; max-height: 260px; } .pane.tall figcaption { color: var(--muted); font-size: 13px; }
.cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.cols2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.mins { display: flex; flex-wrap: wrap; gap: 36px; align-items: flex-end; background: var(--card); border-radius: 16px; padding: 30px; }
.mins > div { display: grid; gap: 10px; justify-items: start; }
.mins svg { height: 100%; width: auto; display: block; }
.mins span { font-size: 12.5px; color: var(--muted); }
.donts { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; }
.dont { margin: 0; display: grid; gap: 10px; align-content: start; }
.dont figcaption { font-size: 13.5px; color: var(--text); display: flex; gap: 8px; align-items: baseline; }
.dont i { font-style: normal; color: #FF6B5E; font-weight: 700; }
.dont.wide { grid-column: span 2; } .dont.wide .pane { aspect-ratio: auto; min-height: 0; height: calc(100% - 30px); padding: 26px; } .dont.wide .wm { max-height: 56px; }
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 26px; }
.swatch { border-radius: 14px; padding: 16px; min-height: 150px; display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--line); }
.swatch.big { grid-column: span 2; min-height: 190px; }
.swatch b { font: 800 26px/1 var(--display); color: inherit; text-transform: uppercase; margin-bottom: 6px; }
.swatch .num { color: inherit; font-size: 15px; } .swatch small { margin-top: auto; opacity: .75; font-size: 12.5px; }
.ratio { display: flex; height: 46px; border-radius: 10px; overflow: hidden; margin-top: 18px; border: 1px solid var(--line); }
.ratio span { display: flex; align-items: center; padding-inline: 10px; font: 700 12px/1 var(--body); color: var(--muted); white-space: nowrap; overflow: hidden; }
.chip { display: inline-flex; width: 30px; height: 22px; border-radius: 5px; align-items: center; justify-content: center; font: 800 13px/1 var(--display); margin-right: 10px; vertical-align: middle; }
.specimen { display: grid; gap: 2px; margin-block: 26px 10px; background: var(--line); border-radius: 16px; overflow: hidden; }
.spec { background: var(--card); padding: 22px 24px; display: grid; gap: 8px; }
.lab { font: 700 11px/1 var(--body); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.spec p { margin: 0; max-width: none; }
.t-xl { font: 800 clamp(34px, 5vw, 44px)/.95 var(--display); text-transform: uppercase; color: #fff; }
.t-claim { font: italic 900 34px/1 var(--display); color: var(--volt); }
.t-num { font: 800 30px/1 var(--display); font-variant-numeric: tabular-nums; color: var(--chalk); }
.t-body { font-size: 16px; color: var(--text); max-width: 60ch !important; }
.t-label { font: 700 12px/1 var(--body); letter-spacing: .12em; color: var(--volt); }
.dos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 26px; }
.do { background: var(--card); border-radius: 12px; padding: 16px 18px; display: grid; gap: 6px; font-size: 15.5px; color: #fff; }
.do.no { background: transparent; border: 1px dashed var(--line); color: var(--muted); text-decoration: line-through; text-decoration-color: #FF6B5E80; }
.do span { font: 700 11px/1 var(--body); letter-spacing: .12em; text-transform: uppercase; text-decoration: none; display: inline-block; }
.do .y { color: var(--volt); } .do .n { color: #FF6B5E; }
.stills { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.still { margin: 0; } .still img { width: 100%; border-radius: 12px; display: block; aspect-ratio: 4 / 3; object-fit: cover; }
.still figcaption, .sk figcaption, .frame figcaption { font-size: 13px; color: var(--muted); margin-top: 8px; }
.sketches { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.sk { margin: 0; } .sk svg { width: 100%; height: auto; background: var(--card); border-radius: 12px; padding: 10px; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.sk .f { stroke: var(--chalk); stroke-width: 5; fill: none; } .sk .a { stroke: var(--volt); stroke-width: 4; }
.posters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.poster, .post { aspect-ratio: 3 / 4; border-radius: 8px; position: relative; overflow: hidden; }
.post { aspect-ratio: 4 / 5; background: var(--ink); border: 1px solid var(--line); color: var(--volt); max-width: 420px; width: 100%; }
.pc { position: absolute; inset: 0; } .pc svg { width: 100%; height: 100%; }
.ph { position: absolute; left: 7%; top: 6%; right: 7%; z-index: 1; }
.poster .h, .post .h { font: italic 900 clamp(26px, 3.2vw, 42px)/.92 var(--display); margin: 0; letter-spacing: .01em; }
.post .h { position: absolute; left: 7%; top: 6%; z-index: 1; color: var(--chalk); } .post .h em { color: var(--volt); font-style: inherit; }
.poster .sub, .post .sub { font-size: 12px; letter-spacing: .04em; margin: 10px 0 0; opacity: .85; max-width: none; }
.post .sub { position: absolute; left: 7%; top: 27%; z-index: 1; color: var(--muted); }
.pl { position: absolute; left: 7%; bottom: 5%; z-index: 1; } .pl .wm { height: 22px; width: auto; display: block; }
.pat svg { width: 100%; height: auto; border-radius: 16px; display: block; }
.icons { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-end; }
.ico { border-radius: 22.37%; overflow: hidden; flex: none; box-shadow: 0 0 0 1px var(--line); } .ico svg { width: 100%; height: 100%; display: block; }
.frames { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
.frame { margin: 0; } .scr { aspect-ratio: 9 / 19.5; background: var(--ink); border: 2px solid var(--line); border-radius: 26px; display: flex; align-items: center; justify-content: center; }
.scr svg { width: 46%; }
.merch { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.merch figure { margin: 0; background: #E9E7E2; border-radius: 16px; padding: 22px; display: grid; gap: 10px; }
.merch .mk { width: 100%; height: 210px; }
.merch figcaption { color: #4a4a4a; font-size: 13px; text-align: center; }
.posts { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: 36px; align-items: center; }
.cmd { background: var(--card); border-radius: 12px; padding: 18px 20px; overflow-x: auto; font: 13px/1.7 ui-monospace, "SF Mono", Menlo, monospace; color: var(--chalk); margin-top: 22px; }
.foot { color: var(--muted); font-size: 13px; padding-block: 40px; }
@media (max-width: 980px) {
  .wrap { grid-template-columns: minmax(0, 1fr); gap: 0; padding-inline: 20px; }
  nav { position: static; max-height: none; padding-block: 24px 0; }
  nav ol { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  .split, .posts { grid-template-columns: minmax(0, 1fr); gap: 28px; }
}
@media (max-width: 640px) {
  .wrap { padding-inline: 16px; }
  .lvls, .frames, .sketches, .merch { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stills, .posters, .cols, .cols2, .dos { grid-template-columns: minmax(0, 1fr); }
  .dont.wide { grid-column: auto; }
  .swatch.big { grid-column: auto; }
  .art { min-height: 260px; padding: 18px; }
  section { padding-block: 44px; }
}
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
""".replace("VOLT40", VOLT_40).replace("VOLT12", VOLT_12)

def page():
    nav = "".join(f'<li><a href="#{i}">{t}</a></li>' for i, t, _ in S)
    body = "".join(f'<section id="{i}" aria-labelledby="h-{i}"><h2 id="h-{i}">{t}</h2>{h}</section>' for i, t, h in S)
    bg = svg((X0 - 4, -8, X1 - X0 + 8, H + 16), sym(VOLT_12), "")
    return f'''<title>Lever Markenrichtlinien</title>
<meta name="description" content="Zeichen, Wortmarke, Farbe, Typografie, Sprache und Anwendung der Marke Lever.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,800;1,900&family=Barlow:wght@400;500;600;700&display=swap">
<style>{CSS}</style>
<div class="wrap">
<nav aria-label="Inhalt">{wordmark(VOLT, cls="nw")}<ol>{nav}</ol></nav>
<main>
<header class="cover"><div class="bg">{bg}</div>
<span class="eyebrow">Markenrichtlinien · Version 1.0 · Oktober 2026</span>
{wordmark(VOLT, cls="wm-big")}
<p class="claimline">DER KÖRPER IST DER HEBEL.</p></header>
{body}
<p class="foot">Erzeugt aus <code>art/brand/mark.py</code> – Zeichnungen und Maße entsprechen exakt den ausgelieferten Dateien.</p>
</main></div>'''

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "guidelines.html")
    with open(out, "w") as fh: fh.write(page())
    print(out, f"{os.path.getsize(out) / 1024:.0f} KB")
