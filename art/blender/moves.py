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
def muscle_up():          # follow: Kamera geht mit, die Figur füllt das Bild statt der ganzen Bahn
    return dict(hang_ex(mu_keys(PULL_H), sz=True), follow=True, fit=0.9)
def muscle_up_negative():
    """Oben starten, langsam durch den Übergang ablassen – Hochkommen (Sprung) im Zeitraffer."""
    return dict(hang_ex(mu_keys(PULL_H), sz=True, timing="fast"), follow=True, fit=0.9)
def muscle_up_band():
    ex = dict(hang_ex(mu_keys(PULL_H), sz=True), follow=True, fit=0.9)
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
    C = skin("head" if contact[2] > 1.45 else "chest", contact, (0, -1, 0))()
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
def biceps_curl():
    """Untergriff an der tiefen Stange, Oberarme zeigen zur Stange, Stirn zur Stange – nur die Unterarme beugen."""
    return row_ex(top=30, grip=0.16, contact=(0, -0.1, 1.6), palm=(0, 0.6, -0.8), curl=(0, 1, -0.9),
                  hint0=(0.2, 0.3, 1), hint1=(0.2, 0.45, 1))

# ── Stütz: Dips am Barren und an der geraden Stange ─────────────────────────
DIP_LEGS = sym({"thigh.L": (0.02, -0.18, -1), "shin.L": (0, 0.7, -0.72), "foot.L": (0, 0.25, -1)})   # Knie gebeugt, Füße hinten
def pbar_grip(h, gap, hint, y=0.0):
    """Neutralgriff am Holm (Holm entlang Y): Hand zeigt nach außen über den Holm, Finger umgreifen ihn außen."""
    return symh(dict(k=(gap + 0.03, y, h + 0.024), hdir=(1, 0, -0.5), palm=(0.25, 0, -1), curl=(0.45, 0, -1), hint=hint))
def dip_keys(h, gap):
    top = dict(rot=(5, 0, 0), pose={**SUPPORT, **DIP_LEGS}, place=("hang", dict(ext=STRAIGHT, up=True)),
               hands=pbar_grip(h, gap, (0.1, 1, -0.2)))
    bot = dict(rot=(22, 0, 0), pose={**SUPPORT, **DIP_LEGS, **sym({"clavicle.L": (1, 0.15, 0.05)})},
               place=("hang", dict(sz=0.1, dy=-0.07)), hands=pbar_grip(h, gap, (0.08, 1, 0.15)))
    return [hang_sz(top), bot]
def dip():
    h, gap = 1.25, 0.25; pbars(h, gap)
    return dict(keys=dip_keys(h, gap), view=(-38, 8))
def dip_weighted():
    ex = dip(); belt_plate(); return ex
def russian_dip():
    """Aus dem tiefen Dip auf die Unterarme ablegen, Gewicht zurück, dann wieder in den Stütz drücken."""
    h, gap = 1.25, 0.25; pbars(h, gap)
    top, bot = dip_keys(h, gap)
    hands = pbar_grip(h, gap, (0.05, 1, -0.6))
    K = Vector(hands["L"]["k"]); W = K - Vector(hands["L"]["hdir"]).normalized() * LEN["hand.L"]
    E = Vector((gap, W.y + LEN["forearm.L"] * 0.97, h + 0.045))                # Unterarm liegt auf dem Holm
    S = E + Vector((0, -0.75, 0.66)).normalized() * LEN["arm.L"]                  # Oberarm schräg nach vorn oben
    fore = dict(rot=(-4, 0, 0), pose={**SUPPORT, **DIP_LEGS}, place=("hang", dict(sz=S.z - K.z, dy=S.y - K.y)), hands=hands)
    return dict(keys=[top, bot, fore], view=(-38, 8))
def straight_bar_dip():
    H = 1.42; bar(H, half=0.6)
    hands = lambda hint: symh(dict(k=(0.27, -0.04, H + 0.012), hdir=(0, -1, -0.35), palm=(0, 0.15, -1),
                                   curl=(0, -0.25, -1), hint=hint))
    top = dict(rot=(8, 0, 0), pose={**SUPPORT, **DIP_LEGS}, place=("hang", dict(ext=STRAIGHT, up=True, dy=-0.03)),
               hands=hands((0.15, 1, -0.2)))
    bot = dict(rot=(32, 0, 0), pose={**SUPPORT, **DIP_LEGS}, place=("hang", dict(sz=0.12, dy=-0.12)), hands=hands((0.2, 1, -0.45)))
    return dict(keys=[hang_sz(top), bot], view=(-40, 8))

# ── Liegestütz-Familie: Körper kippt um die Zehen ───────────────────────────
PUSH = sym({"neck": (0, -0.12, 1), "head": (0, -0.22, 1), "foot.L": (0, -0.75, -0.65)})
def floor_hands(x, y, hdir=(0, -1, 0), hint=(0.5, 0.7, 0.5)):
    """Hand flach am Boden, Finger in Richtung hdir."""
    c = Vector(hdir).normalized() + Vector((0, 0, -0.12))
    return symh(dict(k=(x, y, 0.042), hdir=hdir, palm=(0, 0, -1), curl=tuple(c), hint=hint))
def push_ex(a_top=20, feet_h=0.0, hand_dy=0.0, hdir=(0, -1, 0), hint=(0.5, 0.7, 0.5), chest_z=0.07, gap=0.26,
            toe_y=0.75, view=(-32, 14), hands=None, pose=PUSH, timing="pp"):
    """Oben gestreckte Arme (Neigung gesucht), unten Brust chest_z über dem Boden. hand_dy > 0: Hände Richtung Füße."""
    T = Vector((0, toe_y, feet_h + 0.035))
    if feet_h: box((0, toe_y + 0.06, feet_h / 2), (0.62, 0.42, feet_h))
    k = dict(rot=(90 - a_top, 0, 0), pose=pose, place=("pin", "toe", T))
    pose_key(k, limbs=False); S = pt("shoulder")
    k1 = dict(k, hands=hands(S) if hands else floor_hands(gap, S.y + hand_dy, hdir, hint))
    solve(k1, 0, 90 - a_top - 30, 90 - a_top + 30, m_arm(), STRAIGHT)
    k0 = dict(k1); chest = skin("chest", (0, -0.15, 1.24), (0, -1, 0)); nose = skin("head", (0, -0.1, 1.56), (0, -1, 0))
    solve(k0, 0, k1["rot"][0], k1["rot"][0] + 45, lambda k: min(chest().z, nose().z - 0.03), chest_z)   # Brust oder Gesicht
    return dict(keys=[k1, k0], view=view, timing=timing)
def pseudo_planche_push_up():
    return push_ex(a_top=14, hand_dy=0.28, hdir=(0.75, 0.6, 0), hint=(0.25, 1, 0.5), chest_z=0.11)
def pseudo_planche_push_up_elevated():
    return push_ex(a_top=5, feet_h=0.42, hand_dy=0.28, hdir=(0.75, 0.6, 0), hint=(0.25, 1, 0.5), chest_z=0.11)
def decline_push_up():
    return push_ex(a_top=5, feet_h=0.45)
def ring_push_up():
    """Hände in tief hängenden Ringen (Neutralgriff)."""
    def hands(S):
        h = symh(dict(k=(0.24, S.y, 0.17), palm=(-1, 0, -0.3), curl=(-0.6, -0.2, -1), hint=(0.4, 0.8, 0.5)))
        return h
    ex = push_ex(a_top=20, hands=hands, chest_z=0.2)
    y = ex["keys"][0]["hands"]["L"]["k"][1]
    for n, x in (("L", 0.28), ("R", -0.28)): ring(n, (x, y, 3.2))
    return ex
def fly():
    """Schräg in den Ringen: Arme leicht gebeugt öffnen und vor der Brust schließen."""
    T = Vector((0, 0.95, 0.016))
    k = dict(rot=(42, 0, 0), pose=PUSH, place=("pin", "toe", T)); pose_key(k, limbs=False); S = pt("shoulder")
    y, z = S.y - 0.25, S.z - 0.5
    hand = lambda x, dz, hint: symh(dict(k=(x, y, z + dz), palm=(-1, 0, 0), curl=(-0.4, -0.3, -1), hint=hint))
    closed = dict(k, hands=hand(0.1, 0, (1, 0.3, 0.6))); solve(closed, 0, 20, 70, m_arm(), 0.94)
    opened = dict(k, hands=hand(0.62, -0.12, (0.3, 0.4, 1))); solve(opened, 0, closed["rot"][0], 85, m_arm(), 0.94)
    for n, x in (("L", 0.32), ("R", -0.32)): ring(n, (x, y, 3.2))
    return dict(keys=[closed, opened], view=(-50, 10))
def triceps_extension():
    """Band hinten unten fixiert, Ellbogen neben den Ohren, nur die Unterarme strecken."""
    A = Vector((0, 0.55, 0.3)); cyl((0, 0.55, 0), (0, 0.55, 0.36), 0.03)
    stand = sym({"spine": (0, -0.08, 1), "chest": (0, -0.04, 1), "thigh.L": (0.05, 0, -1), "shin.L": (0.03, 0, -1)})
    def key(dz, dy, hint):
        k = dict(pose=stand, place=("pin", "ankle", (0, 0.02, 0.085)))
        pose_key(k, limbs=False); S = pt("shoulder")
        k["hands"] = symh(dict(k=(0.07, S.y + dy, S.z + dz), palm=(-0.6, 0.6, 0), curl=(-0.3, 0.3, 1), hint=hint))
        return k
    for n in "LR": strand(lambda n=n: pt(f"knuckle.{n}"), lambda: A, 0.008)
    return dict(keys=[key(0.12, 0.2, (0.15, -0.5, 1)), key(0.64, 0.05, (0.15, -0.3, 1))], view=(-18, 6))

# ── Kopfüber: Handstand an der Wand, frei, HSPU, Pike ───────────────────────
INV = sym({"clavicle.L": (1, 0.05, 0.35), "neck": (0, -0.05, 1), "head": (0, -0.12, 1), "foot.L": (0, -0.35, -1)})
def inv_key(pitch, hands, pose=INV, **place):
    return dict(rot=(pitch, 180, 0), pose=pose, place=("hang", dict(ext=STRAIGHT, up=True, **place)), hands=hands)
def wall(y, side):
    """Wand bei y; side = −1: Wand vor der Figur (−Y), +1: dahinter."""
    box((0, y + side * 0.06, 1.35), (2.2, 0.12, 2.7), coll="wand")
def handstand_hands(y, hint=(0.3, -0.4, 0.2)):
    return floor_hands(0.26, y, (0, -1, 0), hint)
def chest_wall_keys():
    yw = -0.3; wall(yw, -1); H = handstand_hands(0.0)
    toe = lambda k: pt("toe").y - (yw + 0.015)
    k0 = inv_key(0, H); solve(k0, 0, -25, 25, toe, 0)
    return yw, H, k0
def handstand_wall():
    """Bauch zur Wand halten: aus den Schultern groß machen und wieder lösen."""
    yw, H, k0 = chest_wall_keys()
    k1 = dict(k0, pose=sym({**INV, "clavicle.L": (1, 0.05, 0.6)}))
    return dict(keys=[hang_sz(k0), hang_sz(k1)], timing="hold", view=(8, 6))   # seitlich von hinten, Wand verdeckt nichts
def handstand_heel_pull():
    """Fersen von der Wand lösen und über den Händen balancieren."""
    yw, H, k0 = chest_wall_keys()
    k1 = inv_key(-1.5, H)
    return dict(keys=[hang_sz(k0), hang_sz(k1)], timing="hold", view=(8, 6))   # seitlich von hinten, Wand verdeckt nichts
def handstand_free():
    """Freier Handstand: kleine Balance-Korrekturen über die Finger."""
    H = handstand_hands(0.0)
    return dict(keys=[hang_sz(inv_key(-2.5, H)), hang_sz(inv_key(2.5, H))], view=(-35, 6))
def handstand_push_up_wall():
    """Rücken zur Wand, Fersen an der Wand, Kopf bis knapp über den Boden."""
    yw = 0.28; wall(yw, 1); H = handstand_hands(0.0, hint=(0.35, -1, 0.05))   # Ellbogen schräg nach vorn
    heel = lambda k: pt("ankle").y - (yw - 0.07)
    k0 = inv_key(0, H); solve(k0, 0, -25, 25, heel, 0); k0 = hang_sz(k0)
    crown = skin("head", (0, -0.02, 1.69), (0, 0, 1))
    k1 = dict(k0); set_place(1, "dy")(k1, -0.08)          # Kopf landet vor den Händen (Dreieck)
    solve(k1, set_place(1, "sz"), k0["place"][1]["sz"], 0.0, lambda k: crown().z, 0.05)
    solve(k1, 0, -25, 25, heel, 0)
    return dict(keys=[k0, k1], view=(-40, 6))
PIKE = sym({"neck": (0, -0.05, 1), "head": (0, -0.1, 1), "thigh.L": (0.02, -1, -0.12), "shin.L": (0, -1, -0.12)})
def pike_ex(feet_h=0.0, a_top=130, hand_dy=-0.02):
    """Hüfte hoch, Kopf zwischen die Hände; Körper kippt um die Zehen."""
    T = Vector((0, 0.55 if not feet_h else 0.62, feet_h + 0.035))
    if feet_h: box((0, T.y + 0.08, feet_h / 2), (0.62, 0.42, feet_h))
    k = dict(rot=(a_top, 0, 0), pose=PIKE, wpose=sym({"foot.L": (0, -0.45, -0.9)}), place=("pin", "toe", T))
    pose_key(k, limbs=False); S = pt("shoulder")
    k1 = dict(k, hands=floor_hands(0.27, S.y + hand_dy, hint=(0.3, 1, 0.25)))   # Hände vor den Schultern
    solve(k1, 0, a_top - 35, a_top + 35, m_arm(), STRAIGHT)
    k0 = dict(k1); crown = skin("head", (0, -0.04, 1.69), (0, -0.4, 1)); nose = skin("head", (0, -0.1, 1.56), (0, -1, 0))
    solve(k0, 0, k1["rot"][0], k1["rot"][0] + 40, lambda k: min(crown().z, nose().z), 0.1)
    if os.environ.get("LEVER_DEBUG"):
        pose_key(k0); print("PIKE Kopf y", round(crown().y, 3), "Hände y", round(k1["hands"]["L"]["k"][1], 3), "Schulter y", round(pt("shoulder").y, 3))
    return dict(keys=[k1, k0], view=(-30, 10))
def pike_push_up(): return pike_ex()
def pike_push_up_elevated(): return pike_ex(feet_h=0.5, a_top=150)

# ── Stütz am Boden: L-Sit, V-Sit, Tuck Planche ──────────────────────────────
LSIT = sym({"spine": (0, -0.08, 1), "chest": (0, -0.02, 1), "neck": (0, -0.1, 1), "clavicle.L": (1, 0.1, -0.25),
            "thigh.L": (0.03, -1, 0.07), "shin.L": (0.0, -1, 0.09), "foot.L": (0, -1, -0.3)})
def lsit_ex(par=False, v=False):
    h = 0.17 if par else 0.0
    if par: parallettes(0.25, 0.0, h)
    hands = pbar_grip(h, 0.25, (0.2, 1, 0)) if par else floor_hands(0.24, 0.0, (0, -1, 0), (0.2, 1, 0))
    up = dict(pose=LSIT, place=("pin", "hip", (0, 0.03, 0.2 + h)), hands=hands)
    solve(up, set_place(2, 2), 0.05 + h, 0.5 + h, m_arm(), STRAIGHT)
    if par:          # vom Stütz mit Fersen am Boden in den L-Sit
        down = dict(up, pose=sym({**LSIT, "thigh.L": (0.03, -1, -0.3), "shin.L": (0, -1, -0.32), "foot.L": (0, -1, -0.05)}))
    else:            # aus dem Sitz abheben (Beine in Weltrichtung, damit sie beim Zurücklehnen am Boden bleiben)
        up["wpose"] = sym({"thigh.L": (0.03, -1, 0.15), "shin.L": (0, -1, 0.17), "foot.L": (0, -1, -0.25)})
        down = grounded(dict(up, rot=(-28, 0, 0), pose=sym({**LSIT, "neck": (0, -0.3, 1), "head": (0, -0.3, 1)}),
                             wpose=sym({"thigh.L": (0.03, -1, -0.03), "shin.L": (0, -1, -0.03), "foot.L": (0, -1, 0.3)}),
                             place=("ground", "hip", (0, 0.03)), hands=floor_hands(0.24, 0.22, (0, -1, 0), (0.2, 1, 0))), "hip")
    if v:            # L → Beine über die Waagerechte, Hüfte kippt nach hinten
        vk = dict(up, rot=(-14, 0, 0), pose=sym({**LSIT, "thigh.L": (0.03, -0.75, 0.66), "shin.L": (0, -0.75, 0.66)}))
        solve(vk, set_place(2, 2), up["place"][2][2] - 0.2, up["place"][2][2] + 0.2, m_arm(), STRAIGHT)
        return dict(keys=[up, vk], timing="hold", view=(-30, 8))
    return dict(keys=[down, up], timing="hold", view=(-30, 8))
def l_sit_floor(): return lsit_ex()
def l_sit_parallettes(): return lsit_ex(par=True)
def v_sit_prep(): return lsit_ex(par=True, v=True)
TPL = sym({"spine": (0, -0.3, 1), "chest": (0, -0.15, 1), "neck": (0, -0.3, 1), "head": (0, -0.5, 1),
           "clavicle.L": (1, -0.25, -0.1), "thigh.L": (0.12, -0.55, 0.84), "shin.L": (0, 0.85, -0.5), "foot.L": (0, 0.6, -0.8)})
def tuck_planche():
    """Schultern weit vor die Hände, Füße heben ab, Knie eng zur Brust."""
    H = floor_hands(0.25, 0.0, (0.35, -1, 0), (0.15, 1, 0.1))
    up = dict(rot=(68, 0, 0), pose=TPL, place=("hang", dict(ext=STRAIGHT, up=True, dy=-0.16)), hands=H)
    toe = lambda k: pt("toe").z
    down = dict(up, pose=sym({**TPL, "thigh.L": (0.12, -0.9, 0.15), "shin.L": (0, 0.5, -0.87), "foot.L": (0, 0.15, -1)}),
                place=("hang", dict(ext=STRAIGHT, up=True, dy=-0.04)))
    solve(down, 0, 5, 68, toe, 0.03)
    return dict(keys=[hang_sz(down), hang_sz(up)], timing="hold", view=(-25, 8))

# ── Rumpf ───────────────────────────────────────────────────────────────────
def hanging_leg_raise():
    up = sym({**ACTIVE, "spine": (0, -0.1, 1), "thigh.L": (0.03, -1, 0.12), "shin.L": (0, -1, 0.15), "foot.L": (0, -0.8, 0.2)})
    return hang_ex([dict(pose=ACTIVE, hang=dict(ext=STRAIGHT)), dict(rot=(-12, 0, 0), pose=up, hang=dict(ext=STRAIGHT, dy=0.05))],
                   view=(-30, 4))
def toes_to_bar():
    up = sym({**ACTIVE, "spine": (0, -0.25, 1), "chest": (0, -0.1, 1), "thigh.L": (0.05, -0.55, 0.84), "shin.L": (0, -0.5, 0.87),
              "foot.L": (0, -0.1, 1)})
    return hang_ex([dict(pose=ACTIVE, hang=dict(ext=STRAIGHT)), dict(rot=(-38, 0, 0), pose=up, hang=dict(ext=STRAIGHT, dy=0.22))],
                   view=(-30, 4))
FLAT = sym({"arm.L": (0.12, 0, 1), "forearm.L": (0.1, 0, 1), "hand.L": (0.08, 0, 1), "fingers.L": (0.08, 0, 1), "foot.L": (0, -0.3, -1)})
HOLLOW = sym({"spine": (0, -0.22, 1), "chest": (0, -0.3, 1), "neck": (0, -0.35, 1), "head": (0, -0.3, 1),
              "arm.L": (0.1, -0.3, 1), "forearm.L": (0.08, -0.3, 1), "hand.L": (0.06, -0.3, 1), "fingers.L": (0.06, -0.3, 1), "thigh.L": (0.02, -0.3, -1), "shin.L": (0, -0.3, -1),
              "foot.L": (0, -0.3, -1)})
def hollow_hold():
    return dict(keys=[grounded(dict(rot=(-90, 0, 0), pose=FLAT, place=("ground", "pelvis", (0, 0))), "pelvis"),
                      grounded(dict(rot=(-90, 0, 0), pose=HOLLOW, place=("ground", "pelvis", (0, 0))), "pelvis")],
                timing="hold", view=(-15, 12))
def hollow_rock():
    return dict(keys=[dict(rot=(-90 - 16, 0, 0), pose=HOLLOW, place=("ground", "pelvis", (0, 0.1))),
                      dict(rot=(-90 + 16, 0, 0), pose=HOLLOW, place=("ground", "pelvis", (0, -0.1)))], view=(-15, 12))
def side_plank_rotation():
    """Seitstütz auf dem linken Unterarm; der obere Arm fädelt unter dem Körper durch."""
    base = sym({"thigh.L": (-0.1, 0, -1), "shin.L": (-0.02, 0, -1), "foot.L": (-0.05, -0.5, -1)})   # Beine geschlossen
    def key(arm_up, twist, tilt):
        k = dict(rot=(0, 72, 0), pose={**base, "arm.R": arm_up, "forearm.R": arm_up}, twist={"chest": twist},
                 wpose={"arm.L": (0, -0.05, -1), "forearm.L": (0, -1, 0), "hand.L": (0, -1, -0.05)},
                 place=("pin", "elbow.L", (0, 0, 0.06)))
        solve(k, 1, 55, 89, lambda k: min(pt("ankle.L").z, pt("ankle.R").z), 0.11)
        return k
    return dict(keys=[key((-1, 0, 0.15), 0, 0), key((0.9, 0.25, -0.2), -38, 0)], view=(-90, 12))

# ── Pistol (alte Gelenkwinkel-Posen, Fuß verankert) ─────────────────────────
PISTOL = [("spine", X, 24), ("chest", X, 12), ("neck", X, -16), ("arm.L", X, -122), ("arm.R", X, -122),
          ("thigh.L", X, -112), ("shin.L", X, 148), ("foot.L", X, -36),
          ("thigh.R", X, -86), ("shin.R", X, 4), ("foot.R", X, -18)]
def pistol():
    return dict(keys=[dict(rots=[(b, a, 0) for b, a, d in PISTOL], place=("anchor", "L")),
                      dict(rots=PISTOL, place=("anchor", "L"))], view=(-47, 5))

def pistol_squat(): return pistol()
def pistol_squat_assisted():
    """Rechte Hand hält einen Pfosten seitlich vorn."""
    P = Vector((-0.46, -0.32, 0)); cyl(P, P + Vector((0, 0, 2.0)), 0.03, coll="pfosten")
    ex = pistol()
    grip = dict(k=(P.x + 0.02, P.y + 0.035, 1.0), palm=(-1, 0.3, 0), curl=(-0.5, 0.8, -0.2), hint=(-0.6, 0.3, -1))
    for k in ex["keys"]: k["hands"] = {"R": grip}
    return ex
def pistol_squat_weighted():
    """Scheibe mit gestreckten Armen vor der Brust als Gegengewicht."""
    ex = pistol(); pl = disc(0.17, 0.035); pl.rotation_mode = "QUATERNION"
    k0 = ex["keys"][0]                      # Scheibe von Anfang an vor der Brust, nicht erst in der Hocke
    k0["rots"] = [(b, a, -85 if b.startswith("arm.") else d) for b, a, d in k0["rots"]]
    def upd_plate():
        a, b = pt("knuckle.L"), pt("knuckle.R"); n = (pt("wrist.L") + pt("wrist.R")) / 2; c = (a + b) / 2
        pl.location = c; pl.rotation_quaternion = Z.rotation_difference((c - n).normalized())   # Scheibe quer zu den Armen
    DYN.append(upd_plate)
    return ex
SQUAT_ARMS = sym({"arm.L": (0.12, 0.02, -1), "forearm.L": (0.06, -0.25, -1)})
def bulgarian_split_squat():
    """Hinterer Fußrücken auf der Bank, vorderes Knie über dem Fuß."""
    box((0, 0.66, 0.22), (0.5, 0.42, 0.44))
    legs = {"L": dict(a=(0.11, -0.4, 0.085), hint=(0.1, -1, 0.3), fdir=(0, -1, -0.42)),
            "R": dict(a=(-0.1, 0.56, 0.545), hint=(0, -0.3, -1), fdir=(0, 1, -0.3))}
    k = lambda z, y, lean: dict(rot=(lean, 0, 0), pose=SQUAT_ARMS, place=("pin", "pelvis", (0, y, z)), legs=legs)
    return dict(keys=[k(0.9, -0.1, 4), k(0.52, -0.02, 14)], view=(-20, 8))
def calf_raise_single_leg():
    """Ballen auf der Stufenkante, Ferse tief und hoch; Hand an der Wand."""
    box((0, -0.27, 0.075), (0.5, 0.34, 0.15)); wall(-0.5, -1)       # Ferse hängt hinten über die Kante
    E = Vector((0.1, -0.16, 0.15 + 0.02))
    stand = sym({"thigh.L": (0.03, 0, -1), "shin.L": (0.03, 0, -1)})
    def key(fdir):
        return dict(pose={**stand, "thigh.R": (-0.02, 0.15, -1), "shin.R": (0, 0.9, -0.5), "foot.R": (0, 0.2, -1)},
                    wpose={"foot.L": fdir}, place=("pin", "toe.L", E),
                    hands={"L": dict(k=(0.28, -0.485, 1.32), hdir=(0, 0, 1), palm=(0, -1, 0), curl=(0, -0.2, 1), hint=(0.8, 0.3, -0.6))})
    return dict(keys=[key((0, -1, 0.35)), key((0, -0.45, -0.9))], timing="hold", view=(-10, 6))
def nordic_ex(band=False):
    """Kniend, Fersen fixiert, Körper gestreckt nach vorn ablassen; unten mit den Händen abfangen."""
    box((0, 0.2, 0.025), (0.5, 0.75, 0.05), coll="polster")
    K = Vector((0, 0, 0.12))
    legs = sym({"shin.L": (0, 1, -0.02), "foot.L": (0, 1, -0.45)})
    def key(lean, hands=None):
        k = dict(rot=(lean, 0, 0), pose=sym({"arm.L": (0.2, -0.6, -0.4), "forearm.L": (-0.7, -0.3, 0.4)}),
                 wpose=legs, place=("pin", "knee", K))
        if hands: k["hands"] = hands
        return k
    k0 = key(0); pose_key(k0, limbs=False); A = pt("ankle")
    cyl((-0.3, A.y + 0.03, A.z + 0.1), (0.3, A.y + 0.03, A.z + 0.1), 0.04, RUBBER, coll="fixierung")
    k1 = key(72, floor_hands(0.26, -0.95, hint=(0.6, 0.6, 0.4)))
    C = skin("chest", (0, -0.15, 1.2), (0, -1, 0))()                  # oben: Arme vor der Brust verschränkt
    k0["hands"] = symh(dict(k=(-0.12, C.y - 0.1, C.z + 0.02), palm=(0, 1, 0), curl=(-1, 0, -0.3), hint=(0.8, -0.2, -0.6)))
    if band:
        bar(2.4, -1.1, posts=False)
        for x in (0.1, -0.1):           # Schlaufe unter den Achseln, Stränge seitlich nach oben
            side = skin("chest", (x * 1.6, 0.0, 1.22), (x, 0, 0))
            strand(lambda x=x: Vector((x * 1.5, -1.1, 2.4)), side, 0.009)
        return dict(keys=[k0, key(55)], view=(-15, 8))
    return dict(keys=[k0, k1], timing="slow", view=(-15, 8))
def nordic_curl_negative(): return nordic_ex()
def nordic_curl_band(): return nordic_ex(band=True)

EXERCISES = {
    "dead-hang": dead_hang, "scapula-shrug": scapula_shrug, "pull-up": pull_up, "pull-up-weighted": pull_up_weighted,
    "explosive-pull-up": explosive_pull_up, "chest-to-bar-pull-up": chest_to_bar_pull_up,
    "archer-pull-up": archer_pull_up, "typewriter-pull-up": typewriter_pull_up, "uneven-pull-up": uneven_pull_up,
    "tuck-front-lever-row": tuck_front_lever_row,
    "muscle-up": muscle_up, "muscle-up-negative": muscle_up_negative, "muscle-up-band": muscle_up_band,
    "body-row": body_row, "biceps-curl": biceps_curl, "pistol": pistol,
    "dip": dip, "dip-weighted": dip_weighted, "russian-dip": russian_dip, "straight-bar-dip": straight_bar_dip,
    "pseudo-planche-push-up": pseudo_planche_push_up, "pseudo-planche-push-up-elevated": pseudo_planche_push_up_elevated,
    "decline-push-up": decline_push_up,
    "handstand-wall": handstand_wall, "handstand-heel-pull": handstand_heel_pull, "handstand-free": handstand_free,
    "handstand-push-up-wall": handstand_push_up_wall, "pike-push-up": pike_push_up, "pike-push-up-elevated": pike_push_up_elevated,
    "l-sit-floor": l_sit_floor, "l-sit-parallettes": l_sit_parallettes, "v-sit-prep": v_sit_prep, "tuck-planche": tuck_planche,
    "hanging-leg-raise": hanging_leg_raise, "toes-to-bar": toes_to_bar, "hollow-hold": hollow_hold, "hollow-rock": hollow_rock,
    "side-plank-rotation": side_plank_rotation,
    "pistol-squat": pistol_squat, "pistol-squat-assisted": pistol_squat_assisted, "pistol-squat-weighted": pistol_squat_weighted,
    "bulgarian-split-squat": bulgarian_split_squat, "calf-raise-single-leg": calf_raise_single_leg,
    "nordic-curl-negative": nordic_curl_negative, "nordic-curl-band": nordic_curl_band, "ring-push-up": ring_push_up, "fly": fly, "triceps-extension": triceps_extension,
}
