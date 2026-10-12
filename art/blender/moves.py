# Lever – Übungen als Schlüsselposen. Wird von lever.py eingelesen (exec) und nutzt dessen Werkzeuge.
#
# Jede Übung ist eine Funktion, die Geräte aufbaut und ein dict liefert:
#   keys    Schlüsselposen (≥ 2); der Clip läuft 0 → letzte → 0
#   timing  "pp" (gleichmäßig), "hold" (hoch, halten, runter), "fast" (schnell hoch, langsam runter), "slow"
#   view    (Azimut, Höhe) der Kamera in Grad; der Ausschnitt wird aus allen Posen berechnet
# Schlüsselpose: rot (Wurzel: Nicken um X, Rollen um Y, Gieren um Z), pose (Knochenrichtungen im
# Körperraum, Figur steht, blickt nach −Y, +X = links), wpose (Richtungen in Welt), place, hands, legs.

AZ_HANG = AZ0          # Dreiviertel von vorn links
AZ_SIDE = -12          # fast seitlich

# ── Grundposen (Körperraum) ─────────────────────────────────────────────────
HANG = sym({"clavicle.L": (1, 0.05, 0.42),                       # Schultern passiv hochgezogen
            "thigh.L": (0.02, -0.08, -1), "shin.L": (0, 0.06, -1), "foot.L": (0, -0.45, -1)})
ACTIVE = sym({"clavicle.L": (1, 0.12, -0.22),                    # Schulterblätter runter
              "thigh.L": (0.02, -0.12, -1), "shin.L": (0, 0.04, -1), "foot.L": (0, -0.45, -1)})
TOP = sym({"clavicle.L": (1, 0.15, -0.25), "spine": (0, 0.12, 1), "chest": (0, 0.22, 1), "neck": (0, -0.05, 1),
           "thigh.L": (0.02, -0.3, -1), "shin.L": (0, 0.0, -1), "foot.L": (0, -0.45, -1)})
PLANK = sym({"neck": (0, -0.12, 1), "head": (0, -0.2, 1), "foot.L": (0, -0.55, -1)})   # gestreckt, Kinn leicht eingezogen

def bar_hands(H, grip=0.27, y=0.0, hint=(0.5, 0, -1), palm=(0, -1, 0), curl=(0, -1, -0.9), **right):
    """Obergriff an einer Stange entlang X: Knöchel knapp über und hinter der Stangenmitte."""
    return symh(dict(k=(grip, y + 0.025, H + 0.028), hint=hint, palm=palm, curl=curl), **right)
def pulling(hands, n, w=1.0):
    """Zughand nah an der Schulter: Hand steht senkrecht über dem Handgelenk statt in Verlängerung der Schulter."""
    hands[n] = dict(hands[n], hdir=(0.1 if n == "L" else -0.1, -0.15, 1), hw=w); return hands

# ── Ziehen an der Klimmzugstange ────────────────────────────────────────────
PULL_H = 2.42
def hang_ex(keys, timing="pp", grip=0.27, view=(AZ_HANG, 3), sz=False, half=0.72):
    """Hängen an der Klimmzugstange. sz: alle Schlüssel auf feste Schulterhöhe umrechnen (nötig, wenn
    sich Bezugsseite oder seitlicher Versatz ändern, z. B. Archer)."""
    bar(PULL_H, half=half)
    FRAME.extend([Vector((s * (grip + 0.25), 0, PULL_H)) for s in (1, -1)])
    for k in keys:
        hint = k.pop("hint", (0.5, 0, -1))
        if "hands" not in k: k["hands"] = bar_hands(PULL_H, grip, hint=hint)
        k["place"] = ("hang", k.pop("hang"))
    if sz: keys = [hang_sz(k) for k in keys]
    return dict(keys=keys, timing=timing, view=view)

def dead_hang():
    return hang_ex([dict(pose=HANG, hang=dict(ext=STRAIGHT)),
                    dict(pose=sym({**HANG, "thigh.L": (0.02, -0.16, -1)}), hang=dict(ext=STRAIGHT))])
def scapula_shrug():
    return hang_ex([dict(pose=HANG, hang=dict(ext=STRAIGHT)), dict(pose=ACTIVE, hang=dict(ext=STRAIGHT))])
def pull_up():
    return hang_ex([dict(pose=ACTIVE, hang=dict(ext=STRAIGHT), hint=(0.6, -0.3, -1)),
                    dict(pose=TOP, hang=dict(ext=0.42, dy=0.2), hint=(0.3, -0.6, -1))])
def pull_up_weighted():
    ex = pull_up(); belt_plate(); return ex
ARCH = sym({**TOP, "spine": (0, 0.16, 1), "chest": (0, 0.32, 1), "neck": (0, -0.12, 1), "head": (0, -0.15, 1),
            "thigh.L": (0.02, -0.25, -1), "shin.L": (0, 0.12, -1)})
def explosive_pull_up():
    """Schnell und hoch (Stange bis unter die Brust), langsam zurück."""
    return hang_ex([dict(pose=ACTIVE, hang=dict(ext=STRAIGHT), hint=(0.6, -0.3, -1)),
                    dict(pose=ARCH, hang=dict(ext=0.33, dy=0.24), hint=(0.35, 0.2, -1))], timing="fast")
def chest_to_bar_pull_up():
    return hang_ex([dict(pose=ACTIVE, hang=dict(ext=STRAIGHT), hint=(0.6, -0.3, -1)),
                    dict(pose=ARCH, hang=dict(ext=0.36, dy=0.2), hint=(0.35, 0.2, -1))])
def archer_pull_up():
    """Weiter Griff, Zug zur linken Hand, rechter Arm bleibt gestreckt (eine Seite gezeigt)."""
    g = 0.55
    k0 = dict(pose=ACTIVE, hang=dict(ext=STRAIGHT), hands=bar_hands(PULL_H, g, hint=(0.7, -0.2, -1)))
    k1 = dict(pose=sym({**TOP, "neck": (0.15, -0.05, 1)}), hang=dict(ext=STRAIGHT, ref="R", sx=0.26, dy=0.14),
              hands=pulling(bar_hands(PULL_H, g, hint=(0.25, -0.6, -1)), "L"))
    km = dict(pose=sym({**TOP, "neck": (0.1, -0.05, 1)}), hang=dict(sz=-0.4, sx=0.12, dy=0.14),   # Kopf hinter der Stange hoch
              hands=pulling(bar_hands(PULL_H, g, hint=(0.4, -0.5, -1)), "L", 0.5))
    return hang_ex([k0, km, k1], grip=g, sz=True, half=0.9)
def typewriter_pull_up():
    """Oben von Hand zu Hand wandern."""
    g = 0.55
    side = lambda s: dict(pose=sym({**TOP, "neck": (0.15 * s, -0.05, 1)}),
                          hang=dict(ext=STRAIGHT, ref="R" if s > 0 else "L", sx=0.26 * s, dy=0.14),
                          hands=pulling(pulling(bar_hands(PULL_H, g, hint=(0.25, -0.6, -1)), "L" if s > 0 else "R"),
                                        "R" if s > 0 else "L", 0.0))
    mid = dict(pose=TOP, hang=dict(ext=0.5, dy=0.16),
               hands=pulling(pulling(bar_hands(PULL_H, g, hint=(0.4, -0.6, -1)), "L", 0.5), "R", 0.5))
    return hang_ex([side(1), mid, side(-1)], grip=g, sz=True, half=0.9)
def uneven_pull_up():
    """Linke Hand an der Stange, rechte am Handtuch (eine Seite gezeigt)."""
    tx, tz = -0.3, PULL_H - 0.44
    for y, ln in ((-0.021, 0.78), (0.021, 0.2)):          # Handtuch über der Stange, vorn lang
        box((tx, y, PULL_H + 0.02 - ln / 2), (0.12, 0.008, ln), CLOTH, coll=None, bevel=0.003)
    box((tx, 0, PULL_H + 0.021), (0.12, 0.05, 0.008), CLOTH, coll=None, bevel=0.003)
    towel = dict(k=(tx + 0.01, -0.03, tz), hint=(-0.6, -0.4, -1), palm=(1, 0, 0), curl=(1, -0.6, -0.2))
    def hands(hint): return {"L": bar_hands(PULL_H, 0.14, hint=hint)["L"], "R": towel}
    k0 = dict(pose=ACTIVE, hang=dict(ext=STRAIGHT, sx=0.1), hands=hands((0.6, -0.3, -1)))
    k1 = dict(pose=TOP, hang=dict(ext=0.42, dy=0.2, sx=0.1), hands=hands((0.3, -0.6, -1)))
    return hang_ex([k0, k1], grip=0.14)

# ── Muscle-up: Hang → Zug → hoch → Übergang → Stütz ─────────────────────────
OVER_BAR = sym({"spine": (0, -0.15, 1), "chest": (0, -0.22, 1), "neck": (0, -0.12, 1), "head": (0, -0.05, 1),
                "clavicle.L": (1, 0.1, 0.05), "thigh.L": (0.02, -0.45, -1), "shin.L": (0, 0.25, -1), "foot.L": (0, -0.3, -1)})
SUPPORT = sym({"spine": (0, -0.05, 1), "chest": (0, -0.08, 1), "neck": (0, -0.12, 1), "head": (0, -0.1, 1),
               "clavicle.L": (1, 0.1, -0.2), "thigh.L": (0.02, -0.18, -1), "shin.L": (0, 0.08, -1), "foot.L": (0, -0.45, -1)})
def mu_hands(H, w, hint, g=0.25):
    """Griff, der vom Hängen (w=0) in den Stütz (w=1) übergeht: Knöchel wandern über die Stange nach vorn."""
    return symh(dict(k=Vector((g, 0.025, H + 0.028)).lerp(Vector((g, -0.04, H + 0.012)), w),
                     hdir=(0, -1, -0.35), hw=w, hint=hint,
                     palm=Vector((0, -1, 0)).lerp(Vector((0, 0.15, -1)), w), curl=Vector((0, -1, -0.9)).lerp(Vector((0, -0.25, -1)), w)))
def mu_keys(H):
    # Seitlich gesehen: Ellbogen bleiben hinter dem Körper, die Schultern steigen erst hinter der Stange
    # hoch und schieben sich dann darüber; die Handgelenke kippen dabei über die Stange (w 0 → 1).
    return [dict(pose=ACTIVE, hang=dict(ext=STRAIGHT), hands=mu_hands(H, 0, (0.5, 0, -1))),
            dict(rot=(-8, 0, 0), pose=sym({**ARCH, "thigh.L": (0.02, -0.4, -1), "shin.L": (0, 0.15, -1)}),
                 hang=dict(ext=0.36, dy=0.2), hands=mu_hands(H, 0, (0.35, 0.3, -1))),
            dict(rot=(22, 0, 0), pose=OVER_BAR, hang=dict(sz=0.2, dy=0.1), hands=mu_hands(H, 0.6, (0.1, 1, -0.5))),
            dict(rot=(22, 0, 0), pose=OVER_BAR, hang=dict(sz=0.3, dy=0.0), hands=mu_hands(H, 1, (0.1, 1, -0.2))),
            dict(rot=(8, 0, 0), pose=SUPPORT, hang=dict(ext=STRAIGHT, up=True, dy=-0.04), hands=mu_hands(H, 1, (0.1, 1, -0.2)))]
def muscle_up():
    return hang_ex(mu_keys(PULL_H), sz=True)
def muscle_up_negative():
    """Oben starten, langsam durch den Übergang ablassen – Hochkommen (Sprung) im Zeitraffer."""
    return hang_ex(mu_keys(PULL_H), sz=True, timing="fast")
def muscle_up_band():
    ex = hang_ex(mu_keys(PULL_H), sz=True)
    knee = skin("shin.L", (0.13, -0.02, 0.47), (0, -1, 0))        # Band hängt im linken Knie
    chest = skin("chest", (0, -0.15, 1.25), (0, -1, 0))
    def via(x):                     # solange die Brust unter der Stange ist, liegt das Band vor ihr
        c = chest() + Vector((x * 0.6, -0.1, 0)); top = Vector((x, -0.02, PULL_H))
        t = min(max((PULL_H - 0.1 - c.z) / 0.25, 0), 1)
        return top.lerp(knee(), 0.5).lerp(c, t)
    for x in (0.06, -0.06):
        strand(lambda x=x: Vector((x, -0.02, PULL_H)), lambda x=x: via(x), 0.009)
        strand(lambda x=x: via(x), knee, 0.009)
    return ex

TUCK = sym({"spine": (0, -0.15, 1), "chest": (0, -0.05, 1), "neck": (0, -0.2, 1), "head": (0, -0.3, 1),
            "clavicle.L": (1, 0.2, -0.15),
            "thigh.L": (0.1, -0.6, 0.8), "shin.L": (0, 0.89, -0.45), "foot.L": (0, 0.7, -0.7)})
def tuck_front_lever_row():
    """Waagerecht im Tuck, Hüfte zur Stange ziehen."""
    return hang_ex([dict(rot=(-90, 0, 0), pose=TUCK, hang=dict(ext=STRAIGHT), hint=(0.5, -0.4, -1)),
                    dict(rot=(-90, 0, 0), pose=TUCK, hang=dict(ext=0.6, dy=0.24), hint=(0.4, -0.6, -1))],
                   view=(-25, 6))

# ── Rudern unter einer tiefen Stange (Fersen am Boden) ──────────────────────
def row_ex(top=40, grip=0.27, contact=(0, -0.2, 1.25), hint0=(0.5, -0.3, -1), hint1=(0.5, -0.45, -1),
           palm=(0, -1, 0), curl=(0, -1, -0.9), pose1=None, timing="pp"):
    """Körper kippt um die Fersen. Oben (Körper top° über der Waagerechten) berührt der Hautpunkt
    nahe contact (Ruhelage) die Stange; unten wird die Neigung für gestreckte Arme gesucht."""
    HEEL = Vector((0, -0.8, 0.095))
    k1 = dict(rot=(top - 90, 0, 0), pose=pose1 or PLANK, place=("pin", "ankle", HEEL))
    pose_key(k1, limbs=False)
    C = skin("chest", contact, (0, -1, 0))()
    n = rig.matrix_world.to_3x3() @ Vector((0, -1, 0))
    B = C + n * (0.017 + 0.006)
    bar(B.z, B.y)
    hands = lambda hint: symh(dict(k=(grip, B.y, B.z + 0.03), hint=hint, palm=palm, curl=curl))
    k1["hands"] = hands(hint1)
    k0 = dict(rot=(top - 90, 0, 0), pose=PLANK, place=("pin", "ankle", HEEL), hands=hands(hint0))
    solve(k0, 0, top - 90, top - 90 - 60, m_arm(), STRAIGHT)
    FRAME.extend([Vector((s * (grip + 0.2), B.y, B.z)) for s in (1, -1)])
    return dict(keys=[k0, k1], timing=timing, view=(-40, 14))

def body_row(): return row_ex()

# ── Pistol (alte Gelenkwinkel-Posen, Fuß verankert) ─────────────────────────
PISTOL = [("spine", X, 24), ("chest", X, 12), ("neck", X, -16), ("arm.L", X, -122), ("arm.R", X, -122),
          ("thigh.L", X, -112), ("shin.L", X, 148), ("foot.L", X, -36),
          ("thigh.R", X, -86), ("shin.R", X, 4), ("foot.R", X, -18)]
def pistol():
    return dict(keys=[dict(rots=[(b, a, 0) for b, a, d in PISTOL], place=("anchor", "L")),
                      dict(rots=PISTOL, place=("anchor", "L"))], view=(-47, 5))

EXERCISES = {
    "dead-hang": dead_hang, "scapula-shrug": scapula_shrug, "pull-up": pull_up, "pull-up-weighted": pull_up_weighted,
    "explosive-pull-up": explosive_pull_up, "chest-to-bar-pull-up": chest_to_bar_pull_up,
    "archer-pull-up": archer_pull_up, "typewriter-pull-up": typewriter_pull_up, "uneven-pull-up": uneven_pull_up,
    "tuck-front-lever-row": tuck_front_lever_row,
    "muscle-up": muscle_up, "muscle-up-negative": muscle_up_negative, "muscle-up-band": muscle_up_band,
    "body-row": body_row, "pistol": pistol,
}
