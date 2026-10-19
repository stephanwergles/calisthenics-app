# Lever – Übungen als Schlüsselposen. Wird von lever.py eingelesen (exec) und nutzt dessen Werkzeuge.
#
# Jede Übung ist eine Funktion, die Geräte aufbaut und ein dict liefert:
#   keys    Schlüsselposen (≥ 2); der Clip läuft 0 → letzte → 0
#   timing  "pp" (gleichmäßig), "hold" (hoch, halten, runter), "fast" (schnell hoch, langsam runter), "slow"
#   view    (Azimut, Höhe) der Kamera in Grad; der Ausschnitt wird aus allen Posen berechnet
#   tempo   nur als begründete Ausnahme: erlaubte Drehung je Bild (Grad, Sprung und Kippen) statt RULES["sprung"] (15°)
# Schlüsselpose: rot (Wurzel: Nicken um X, Rollen um Y, Gieren um Z), pose (Knochenrichtungen im
# Körperraum, Figur steht, blickt nach −Y, +X = links), wpose (Richtungen in Welt), place, hands, legs.

AZ_HANG = AZ0          # Dreiviertel von vorn links
AZ_SIDE = -12          # fast seitlich
VIEW_PULL = (-26, 12)  # Zugübungen: schräg seitlich, leicht erhöht – Kinn über vs. Brust an der Stange ist erkennbar

# ── Grundposen (Körperraum) ─────────────────────────────────────────────────
HANG = sym({"clavicle.L": (1, 0.05, 0.42),                       # Schultern passiv hochgezogen
            "thigh.L": (0.02, -0.08, -1), "shin.L": (0, 0.06, -1), "foot.L": (0, -0.45, -1)})
ACTIVE = sym({"clavicle.L": (1, 0.12, -0.22),                    # Schulterblätter runter
              "thigh.L": (0.02, -0.12, -1), "shin.L": (0, 0.04, -1), "foot.L": (0, -0.45, -1)})
TOP = sym({"clavicle.L": (1, 0.15, -0.25), "spine": (0, 0.12, 1), "chest": (0, 0.22, 1), "neck": (0, -0.05, 1),
           "thigh.L": (0.02, -0.3, -1), "shin.L": (0, 0.0, -1), "foot.L": (0, -0.45, -1)})
def leg_angles(hip, knee, abd=0.0, ankle=0.0):
    """Beinrichtungen (Körperraum, linkes Bein) aus Gelenkwinkeln in Grad: hip = Hüftbeugung (Bein nach vorn),
    knee = Kniebeugung (immer ≥ 0, Unterschenkel nach hinten), abd = Abspreizen, ankle = Fußspitze strecken.
    So kann ein Knie nicht falsch herum stehen – Richtungen von Hand führten zu Kniebeugen über 180°."""
    base = Matrix.Rotation(math.radians(-hip), 3, X) @ Matrix.Rotation(math.radians(-abd), 3, Y)   # erst spreizen, dann beugen
    def r(deg): return base @ Matrix.Rotation(math.radians(deg), 3, X)
    foot0 = Vector((0.0, -0.9, -0.42)).normalized()
    down = Vector((0, 0, -1))
    return {"thigh.L": tuple(base @ down), "shin.L": tuple(r(knee) @ down), "foot.L": tuple(r(knee + ankle) @ foot0)}
def legs(*a, **k): return sym(leg_angles(*a, **k))
PLANK = sym({"neck": (0, -0.12, 1), "head": (0, -0.2, 1), "foot.L": (0, -0.55, -1)})   # gestreckt, Kinn leicht eingezogen

def bar_hands(H, grip=0.27, y=0.0, hint=(0.5, 0, -1), palm=(0, -1, 0), curl=(0, -1, -0.9), **right):
    """Obergriff an einer Stange entlang X: Knöchel knapp über und hinter der Stangenmitte."""
    return symh(dict(k=(grip, y + 0.025, H + 0.028), hint=hint, palm=palm, curl=curl, bar=("x", 1)), **right)
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
                    dict(pose=TOP, hang=dict(ext=0.42, dy=0.2), hint=(0.3, -0.6, -1))], view=VIEW_PULL)
def pull_up_weighted():
    ex = pull_up(); belt_plate(); return ex
ARCH = sym({**TOP, "spine": (0, 0.16, 1), "chest": (0, 0.32, 1), "neck": (0, -0.12, 1), "head": (0, -0.15, 1),
            "thigh.L": (0.02, -0.25, -1), "shin.L": (0, 0.12, -1)})
def explosive_pull_up():
    """Schnell und so hoch, dass die Schultern über die Stange kommen (Stange am Bauch), langsam zurück."""
    top = dict(rot=(8, 0, 0), pose=ARCH, hang=dict(sz=0.06, dy=0.2),
               hands=pulling(pulling(bar_hands(PULL_H, hint=(0.25, 1, -0.6)), "L"), "R"))
    mid = dict(pose=ARCH, hang=dict(ext=0.36, dy=0.21), hint=(0.35, 0.2, -1))   # Kopf bleibt hinter der Stange
    return hang_ex([dict(pose=ACTIVE, hang=dict(ext=STRAIGHT), hint=(0.6, -0.3, -1)), mid, top],
                   timing=(0.26, 0.08, 0.55), sz=True, view=VIEW_PULL)   # schnell hoch, aber ohne Ruckeln (≤ 15°/Bild)
def chest_to_bar_pull_up():
    """Brust an die Stange: Schultern auf Stangenhöhe (beim Klimmzug nur das Kinn darüber)."""
    return hang_ex([dict(pose=ACTIVE, hang=dict(ext=STRAIGHT), hint=(0.6, -0.3, -1)),
                    dict(pose=ARCH, hang=dict(ext=0.3, dy=0.19), hint=(0.35, 0.2, -1))], view=VIEW_PULL)
def archer_pull_up():
    """Weiter Griff, Zug zur linken Hand, rechter Arm bleibt gestreckt (eine Seite gezeigt)."""
    g = 0.55
    k0 = dict(pose=ACTIVE, hang=dict(ext=STRAIGHT), hands=bar_hands(PULL_H, g, hint=(0.7, -0.2, -1)))
    k1 = dict(pose=sym({**TOP, "neck": (0.15, -0.05, 1)}), hang=dict(ext=STRAIGHT, ref="R", sx=0.26, dy=0.14),
              hands=pulling(bar_hands(PULL_H, g, hint=(0.25, -0.6, -1)), "L"))
    km = dict(pose=sym({**TOP, "neck": (0.1, -0.05, 1)}), hang=dict(sz=-0.4, sx=0.12, dy=0.14),   # Kopf hinter der Stange hoch
              hands=pulling(bar_hands(PULL_H, g, hint=(0.4, -0.5, -1)), "L", 0.5))
    return hang_ex([k0, km, k1], grip=g, sz=True, half=0.9, view=VIEW_PULL)
def typewriter_pull_up():
    """Oben von Hand zu Hand wandern."""
    g = 0.55
    side = lambda s: dict(pose=sym({**TOP, "neck": (0.15 * s, -0.05, 1)}),
                          hang=dict(ext=STRAIGHT, ref="R" if s > 0 else "L", sx=0.26 * s, dy=0.14),
                          hands=pulling(pulling(bar_hands(PULL_H, g, hint=(0.25, -0.6, -1)), "L" if s > 0 else "R"),
                                        "R" if s > 0 else "L", 0.0))
    mid = dict(pose=TOP, hang=dict(ext=0.5, dy=0.16),
               hands=pulling(pulling(bar_hands(PULL_H, g, hint=(0.4, -0.6, -1)), "L", 0.5), "R", 0.5))
    return hang_ex([side(1), mid, side(-1)], grip=g, sz=True, half=0.9, view=VIEW_PULL)
def uneven_pull_up():
    """Linke Hand an der Stange, rechte am Handtuch (eine Seite gezeigt)."""
    tx, tz = -0.3, PULL_H - 0.44
    for y, ln in ((-0.021, 0.78), (0.021, 0.2)):          # Handtuch über der Stange, vorn lang
        box((tx, y, PULL_H + 0.02 - ln / 2), (0.12, 0.008, ln), CLOTH, coll=None, bevel=0.003)
    box((tx, 0, PULL_H + 0.021), (0.12, 0.05, 0.008), CLOTH, coll=None, bevel=0.003)
    towel = dict(k=(tx + 0.01, -0.03, tz), hint=(-1, 0.3, -0.2), palm=(0.4, -1, 0), flex=100, bar=("z", 1))   # Ellbogen seitlich
    def hands(hint): return {"L": bar_hands(PULL_H, 0.14, hint=hint)["L"], "R": towel}
    k0 = dict(pose=ACTIVE, hang=dict(ext=STRAIGHT, sx=0.1), hands=hands((0.6, -0.3, -1)))
    k1 = dict(pose=TOP, hang=dict(ext=0.42, dy=0.2, sx=0.1), hands=hands((0.3, -0.6, -1)))
    return hang_ex([k0, k1], grip=0.14, view=VIEW_PULL)

# ── Muscle-up: Hang → Zug → hoch → Übergang → Stütz ─────────────────────────
OVER_BAR = sym({"spine": (0, -0.15, 1), "chest": (0, -0.22, 1), "neck": (0, -0.12, 1), "head": (0, -0.05, 1),
                "clavicle.L": (1, 0.1, 0.05), "thigh.L": (0.02, -0.45, -1), "shin.L": (0, 0.25, -1), "foot.L": (0, -0.3, -1)})
SUPPORT = sym({"spine": (0, -0.05, 1), "chest": (0, -0.08, 1), "neck": (0, -0.12, 1), "head": (0, -0.1, 1),
               "clavicle.L": (1, 0.1, -0.2), "thigh.L": (0.02, -0.18, -1), "shin.L": (0, 0.08, -1), "foot.L": (0, -0.45, -1)})
def mu_hands(H, w, hint, g=0.25):
    """Griff, der vom Hängen (w=0) in den Stütz (w=1) übergeht: Knöchel wandern über die Stange nach vorn."""
    return symh(dict(k=Vector((g, 0.025, H + 0.028)).lerp(Vector((g, -0.04, H + 0.012)), w),
                     hdir=(0, -1, -0.35), hw=w, hint=hint,
                     palm=Vector((0, -1, 0)).lerp(Vector((0, 0.15, -1)), w), flex=115, bar=("x", 1)))
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
    return dict(hang_ex(mu_keys(PULL_H), sz=True, view=VIEW_PULL), follow=True, fit=0.9)
def muscle_up_negative():
    """Oben starten, langsam durch den Übergang ablassen – Hochkommen (Sprung) im Zeitraffer."""
    return dict(hang_ex(mu_keys(PULL_H), sz=True, timing=(0.35, 0.08, 0.5), view=VIEW_PULL), follow=True, fit=0.9,
                tempo=22)   # Zeitraffer: der ganze Muscle-up in 0,7 s, die Hände drehen dabei gut 300°
def muscle_up_band():
    ex = dict(hang_ex(mu_keys(PULL_H), sz=True, view=VIEW_PULL), follow=True, fit=0.9)
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
            **leg_angles(135, 140, abd=6, ankle=35)})
def tuck_front_lever_row():
    """Waagerecht im Tuck, Hüfte zur Stange ziehen."""
    return hang_ex([dict(rot=(-90, 0, 0), pose=TUCK, hang=dict(ext=STRAIGHT), hint=(0.5, -0.4, -1)),
                    dict(rot=(-90, 0, 0), pose=TUCK, hang=dict(ext=0.6, dy=0.24), hint=(0.4, -0.6, -1))],
                   view=(-25, 6))

# ── Hebel an der Stange: Front Lever (rücklings waagerecht), Back Lever (bäuchlings) ──
# Wurzel-Drehung um X: 0 Hang · −90 rücklings waagerecht · −180 kopfüber · −270 bäuchlings · −330 German Hang.
# Die Schultern sitzen so weit neben der Stange, dass der Körperschwerpunkt genau unter ihr liegt.
LEVER_SH = sym({"clavicle.L": (1, 0.15, -0.2)})
ADV_TUCK = sym({**LEVER_SH, **leg_angles(90, 95, abd=5, ankle=35)})
TUCKED = sym({**TUCK, **LEVER_SH})
STRADDLE = sym({**LEVER_SH, "thigh.L": (0.5, 0, -1), "shin.L": (0.5, 0, -1), "foot.L": (0.45, -0.35, -1)})
STRAIGHT_LEGS = sym({**LEVER_SH, "thigh.L": (-0.03, 0, -1), "shin.L": (-0.02, 0, -1), "foot.L": (0, -0.35, -1)})
def one_leg(pose):                          # linkes Bein gestreckt, rechtes im Advanced Tuck
    return {**pose, **{k: v for k, v in STRAIGHT_LEGS.items() if k.endswith(".L") and k.split(".")[0] in ("thigh", "shin", "foot")}}
def com_hang(pitch, pose):
    """Hebel-Schlüssel: Arme gestreckt, Schwerpunkt (Hautpunkte-Mittel) senkrecht unter den Händen."""
    k = dict(rot=(pitch, 0, 0), pose=pose, place=("hang", dict(ext=STRAIGHT, dy=0.0)), hands=bar_hands(PULL_H))
    solve(k, set_place(1, "dy"), -0.6, 0.6, lambda k: mesh_np()[:, 1].mean() - 0.025, 0.0)
    return hang_sz(k)
def lever_ex(keys, timing="hold", view=VIEW_PULL):
    bar(PULL_H); FRAME.extend([Vector((s * 0.55, 0, PULL_H)) for s in (1, -1)])
    return dict(keys=keys, timing=timing, view=view)
def hang0(): return hang_sz(dict(pose=ACTIVE, place=("hang", dict(ext=STRAIGHT)), hands=bar_hands(PULL_H)))
def front_lever_ex(pose): return lever_ex([hang0(), com_hang(-90, pose)])
def tuck_front_lever(): return front_lever_ex(TUCKED)
def adv_tuck_front_lever(): return front_lever_ex(ADV_TUCK)
def one_leg_front_lever(): return front_lever_ex(one_leg(ADV_TUCK))
def straddle_front_lever(): return front_lever_ex(STRADDLE)
def front_lever(): return front_lever_ex(STRAIGHT_LEGS)
GERMAN = sym({**STRAIGHT_LEGS, "clavicle.L": (1, -0.1, 0.3), "neck": (0, -0.15, 1), "thigh.L": (0, -0.15, -1)})
def skin_keys():                            # Hang → kopfüber gehockt → German Hang
    return [hang0(), com_hang(-180, TUCKED), com_hang(-330, GERMAN)]
# DEEP: Übungen, bei denen die tiefe Schulterstreckung selbst trainiert wird (Dips, German Hang, Skin the Cat,
# Korean Dip) – Ausnahme von der Schulterregel (RULES["schulter"]), Grad zusätzlich zur Toleranz
DEEP = dict(schulter=45)
def german_hang(): return dict(lever_ex(skin_keys()[1:]), **DEEP)          # aus der Umkehr langsam hinein und zurück
def skin_the_cat(): return dict(lever_ex(skin_keys(), timing="pp"), tempo=19, **DEEP)   # 330° Drehung in 2 s: Füße schneller
def back_lever_ex(pose): return lever_ex([com_hang(-180, TUCKED), com_hang(-270, pose)])   # aus der Umkehr
def tuck_back_lever(): return back_lever_ex(TUCKED)
def adv_tuck_back_lever(): return back_lever_ex(ADV_TUCK)
def straddle_back_lever(): return back_lever_ex(STRADDLE)
def back_lever(): return back_lever_ex(STRAIGHT_LEGS)

# ── Rudern unter einer tiefen Stange (Fersen am Boden) ──────────────────────
def row_ex(top=40, grip=0.27, contact=(0, -0.2, 1.25), hint0=(0.5, -0.3, -1), hint1=(0.5, -0.45, -1),
           palm=(0, -1, 0), curl=(0, -1, -0.9), pose1=None, timing="pp", table=False):
    """Körper kippt um die Fersen. Oben (Körper top° über der Waagerechten) berührt der Hautpunkt
    nahe contact (Ruhelage) die Stange; unten wird die Neigung für gestreckte Arme gesucht."""
    HEEL = Vector((0, -0.8, 0.095))
    k1 = dict(rot=(top - 90, 0, 0), pose=pose1 or PLANK, place=("pin", "ankle", HEEL))
    pose_key(k1, limbs=False)
    C = skin("head" if contact[2] > 1.45 else "chest", contact, (0, -1, 0))()
    n = rig.matrix_world.to_3x3() @ Vector((0, -1, 0))
    B = C + n * (0.017 + 0.006)
    if table:                              # Tischkante statt Stange; die Platte reicht über den Kopf
        hy = -1 if pt("head").y > B.y else 1            # Platte liegt über Hüfte und Beinen, der Kopf ist frei
        box((0, B.y + hy * 0.42, B.z + 0.02), (1.3, 0.84, 0.04), coll="tisch", bevel=0.006)
        for sx in (0.6, -0.6):
            for sy in (0.04, 0.8): box((sx, B.y + hy * sy, (B.z) / 2), (0.05, 0.05, B.z), coll="tischbein", bevel=0.004)
    else: bar(B.z, B.y)
    under = palm[2] < 0 and palm[1] > 0                                 # Untergriff (Bizeps-Curl)
    hands = lambda hint: symh(dict(k=(grip, B.y, B.z + 0.03), hint=hint, palm=palm, flex=115, bar=("x", -1 if under else 1)))
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
    return symh(dict(k=(gap + 0.03, y, h + 0.024), hdir=(1, 0, -1.1), palm=(-0.67, 0, -0.74), flex=100, bar=("y", 1), hint=hint))
def dip_keys(h, gap):
    top = dict(rot=(5, 0, 0), pose={**SUPPORT, **DIP_LEGS}, place=("hang", dict(ext=STRAIGHT, up=True)),
               hands=pbar_grip(h, gap, (0.1, 1, -0.2)))
    bot = dict(rot=(22, 0, 0), pose={**SUPPORT, **DIP_LEGS, **sym({"clavicle.L": (1, 0.15, 0.05)})},
               place=("hang", dict(sz=0.1, dy=-0.07)), hands=pbar_grip(h, gap, (0.08, 1, 0.15)))
    return [hang_sz(top), bot]
def dip():
    h, gap = 1.25, 0.25; pbars(h, gap)
    return dict(keys=dip_keys(h, gap), view=(-38, 8), **DEEP)
def dip_weighted():
    ex = dip(); belt_plate(); return ex
def russian_dip():
    """Aus dem tiefen Dip auf die Unterarme ablegen, Gewicht zurück, dann wieder in den Stütz drücken."""
    h, gap = 1.25, 0.25; pbars(h, gap)
    top, bot = dip_keys(h, gap)
    flat = lambda k: {n: dict(v, hdir=(0, -1, -0.6), palm=(-0.3 if n == "L" else 0.3, 0, -1)) for n, v in k["hands"].items()}
    for k in (top, bot): k["hands"] = flat(k)            # Handflächen längs auf dem Holm, die Hand bleibt so liegen
    hands = pbar_grip(h, gap, (0.05, 1, -0.6))
    K = Vector(hands["L"]["k"]); W = K - Vector(hands["L"]["hdir"]).normalized() * LEN["hand.L"]
    E = Vector((gap, W.y + LEN["forearm.L"] * 0.97, h + 0.045))                # Unterarm liegt auf dem Holm
    S = E + Vector((0, -0.75, 0.66)).normalized() * LEN["arm.L"]                  # Oberarm schräg nach vorn oben
    hands = {n: dict(v, hdir=(0, -1, -0.35), palm=(-0.3 if n == "L" else 0.3, 0, -1)) for n, v in hands.items()}   # Hand in Verlängerung des aufliegenden Unterarms
    fore = dict(rot=(-4, 0, 0), pose={**SUPPORT, **DIP_LEGS}, place=("hang", dict(sz=S.z - K.z, dy=S.y - K.y)), hands=hands)
    return dict(keys=[top, bot, fore], view=(-38, 8), **DEEP)
def straight_bar_dip():
    """Stütz auf der geraden Stange, Ellbogen gerade nach hinten (seitlich ausweichende Ellbogen knicken die Hand ab)."""
    H = 1.42; bar(H, half=0.6)
    hands = lambda hint: symh(dict(k=(0.25, -0.04, H + 0.012), hdir=(0, -1, -0.8), palm=(0, 0.15, -1),
                                   flex=110, bar=("x", 1), hint=hint))
    top = dict(rot=(8, 0, 0), pose={**SUPPORT, **DIP_LEGS}, place=("hang", dict(ext=STRAIGHT, up=True, dy=-0.03)),
               hands=hands((0.05, 1, -0.2)))
    bot = dict(rot=(32, 0, 0), pose={**SUPPORT, **DIP_LEGS}, place=("hang", dict(sz=0.12, dy=-0.12)), hands=hands((0.05, 1, -0.3)))
    return dict(keys=[hang_sz(top), bot], view=(-40, 8))

# ── Liegestütz-Familie: Körper kippt um die Zehen ───────────────────────────
PUSH = sym({"neck": (0, -0.12, 1), "head": (0, -0.22, 1), "foot.L": (0, -0.75, -0.65)})
def floor_hands(x, y, hdir=(0, -1, 0), hint=(0.5, 0.7, 0.5), z=0.042):
    """Hand flach am Boden, Finger in Richtung hdir (leicht in den Boden gedrückt)."""
    return symh(dict(k=(x, y, z), hdir=hdir, palm=(0, 0, -1), flex=-4, hint=hint))
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
        # Neutralgriff: Handflächen zueinander, quer zur Beugeebene – eine Handfläche mit Anteil nach hinten
        # müsste sich beim Strecken mit dem Unterarm um gut 100° eindrehen
        k["hands"] = symh(dict(k=(0.07, S.y + dy, S.z + dz), palm=(-1, 0.05, 0), flex=20, hint=hint))
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
            **leg_angles(94, 2, ankle=45)})
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
           "clavicle.L": (1, -0.25, -0.1), **leg_angles(140, 145, abd=8, ankle=35)})
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
    up = sym({**ACTIVE, "spine": (0, -0.25, 1), "chest": (0, -0.1, 1), **leg_angles(150, 8, ankle=40)})
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
    # Der obere Arm fädelt VOR der Brust unter dem Körper durch (Arm nach vorn, −Y) – mit +Y schwang er über den Rücken
    return dict(keys=[key((-1, 0, 0.15), 0, 0), key((0.8, -0.5, 0.2), -30, 0)], view=(-90, 12), arme="vorn")

# ── Einarmiger Liegestütz ───────────────────────────────────────────────────
def archer_push_up():
    """Sehr weiter Griff, zur linken Hand absenken: links beugt, rechts bleibt gestreckt (eine Seite gezeigt)."""
    T = Vector((0, 0.75, 0.035))
    k = dict(rot=(70, 0, 0), pose=PUSH, place=("pin", "toe", T)); pose_key(k, limbs=False); S = pt("shoulder")
    top = dict(k, hands=floor_hands(0.5, S.y, (0.55, -0.85, 0), hint=(0.15, 1, 0.5), z=0.06))
    solve(top, 0, 40, 100, m_arm(), STRAIGHT)
    chest = skin("chest", (0, -0.15, 1.24), (0, -1, 0))
    low = dict(top, rot=(top["rot"][0], -6, 11))                      # Körper dreht über den Zehen zur linken Hand
    solve(low, 0, top["rot"][0], top["rot"][0] + 40, lambda k: chest().z, 0.17)
    return dict(keys=[top, low], view=(-55, 24))
OAP = {**PUSH, **sym({"thigh.L": (0.3, 0, -1), "shin.L": (0.3, 0, -1)})}   # Füße weit
def back_hand(k):
    """Rechte Hand liegt auf dem unteren Rücken (Ziel aus der Pose des Schlüssels)."""
    pose_key(k, limbs=False); P = skin("spine", (-0.02, 0.13, 1.02), (0, 1, 0))()
    n = rig.matrix_world.to_3x3() @ Vector((0, 1, 0)); side = rig.matrix_world.to_3x3() @ Vector((1, 0, 0))
    return dict(k=tuple(P + n * 0.035 + side * 0.06), hdir=tuple(side), palm=tuple(-n), curl=tuple(side), hint=tuple(-side + n))
def one_arm_push_ex(h=0.0):
    T = Vector((0, 0.8, 0.06))
    k = dict(rot=(62 if h else 70, 8, 0), pose=OAP, place=("pin", "toe", T)); pose_key(k, limbs=False)
    S = pt("shoulder"); y = S.y + 0.1
    if h: box((0.05, y - 0.05, h / 2), (0.42, 0.36, h))
    hands = {"L": dict(k=(0.07, y, h + 0.042), hdir=(0.35, -1, 0), palm=(0, 0, -1), curl=(0.35, -1, -0.12), hint=(0.25, 1, 0.45))}
    top = dict(k, hands=hands); solve(top, 0, 20, 100, m_arm(), STRAIGHT)
    low = dict(top, hands=dict(hands)); chest = skin("chest", (0.05, -0.15, 1.24), (0, -1, 0))
    solve(low, 0, top["rot"][0], top["rot"][0] + 40, lambda k: chest().z, h + 0.1)
    for k in (top, low): k["hands"] = {**k["hands"], "R": back_hand(k)}
    return dict(keys=[top, low], view=(-35, 14))
def one_arm_push_up_elevated(): return one_arm_push_ex(0.45)
def one_arm_push_up(): return one_arm_push_ex()

# ── Shrimp Squat: Standbein links, hinteres Knie zum Boden ───────────────────
REAR = sym({"thigh.L": (0, 0, -1)})
def shrimp_ex(variant):
    A = Vector((0.1, 0.0, 0.085))
    legs = {"L": dict(a=A, hint=(0.1, -1, 0.25), fdir=(0, -1, -0.42))}
    arms = sym({"arm.L": (0.12, -1, 0.05), "forearm.L": (0.08, -1, 0.08)}) if variant != "adv" else {}
    rear = lambda bend: {"thigh.R": (-0.03, 0.12 + 0.2 * (1 - bend), -1), "shin.R": (0, 1, 0.1 - 0.6 * (1 - bend)),
                         "foot.R": (0, 0.85, -0.5)}
    top = dict(rot=(4, 0, 0), pose=arms, wpose=rear(0.7), legs=legs,
               place=("pin", "hip.L", (0.1, 0.03, A.z + 0.97 * (LEN["thigh.L"] + LEN["shin.L"]))))
    low = dict(top, rot=(32, 0, 0), wpose=rear(1.0), place=("pin", "hip.L", (0.1, 0.25, 0.5)))
    knee = skin("shin.R", (-0.13, -0.05, 0.47), (0, -1, -0.3))
    solve(low, set_place(2, 2), 0.2, 0.9, lambda k: knee().z, 0.012)
    if variant == "assisted":                                       # linke Hand am Pfosten seitlich vorn
        P = Vector((0.5, -0.3, 0)); cyl(P, P + Vector((0, 0, 2.0)), 0.03, coll="pfosten")
        g = dict(k=(P.x - 0.02, P.y + 0.035, 1.0), palm=(1, 0.3, 0), curl=(0.5, 0.8, -0.2), hint=(0.6, 0.3, -1))
        for k in (top, low): k["hands"] = {"L": g}
    if variant == "adv":                                            # rechte Hand hält den hinteren Fuß (wandert mit)
        held = lambda: tuple(pt("ankle.R") + Vector((0, 0.02, 0.06)))
        for k in (top, low):
            k["wpose"] = {**k["wpose"], "shin.R": (0.05, 0.3, 0.95), "foot.R": (0, 0.75, 0.65)}   # Ferse zum Gesäß, Zehen nach hinten
            k["hands"] = {"R": dict(k=held, palm=(1, 0, 0), flex=90, hint=(-0.4, 0.5, -0.6))}
    return dict(keys=[top, low], view=(-35, 8))
def shrimp_squat_assisted(): return shrimp_ex("assisted")
def shrimp_squat(): return shrimp_ex("free")
def shrimp_squat_advanced(): return shrimp_ex("adv")

# ── Dragon Flag: rücklings auf der Bank, Hände halten hinter dem Kopf ────────
def dragon_ex(tuck, timing):
    BH = 0.42                                                        # Bank: Kopfende bei y = +0.42
    box((0, -0.25, BH / 2), (0.36, 1.34, BH))
    pose = sym({"spine": (0, 0.02, 1), "foot.L": (0, -0.35, -1),
                **(leg_angles(10, 120, ankle=30) if tuck else {})})
    hands = symh(dict(k=(0.15, 0.41, BH + 0.03), hdir=(0, 1, -0.4), palm=(0, 0.3, -1), curl=(0, 0.2, -1), hint=(0.7, -0.1, 0.7)))
    key = lambda pitch: dict(rot=(pitch, 0, 0), pose=pose, wpose={"neck": (0, 1, 0.12), "head": (0, 1, 0.08)},
                             place=("pin", "shoulder", (0, 0.12, BH + 0.1)), hands=hands)
    low, top = key(-112 if tuck else -100), key(-158)                                  # knapp über der Bank · fast senkrecht auf den Schultern
    return dict(keys=[low, top], timing=timing, view=(-30, 10))
def dragon_flag_tuck_negative(): return dragon_ex(True, "fast")
def dragon_flag_negative(): return dragon_ex(False, "fast")
def dragon_flag(): return dragon_ex(False, "pp")

# ── Crow Pose, Elbow Lever ──────────────────────────────────────────────────
CROW = sym({"spine": (0, -0.3, 1), "chest": (0, -0.2, 1), "neck": (0, 0.35, 1), "head": (0, 0.45, 1),
            "clavicle.L": (1, -0.2, -0.05)})
CROW_UP = legs(125, 130, abd=32, ankle=30)                          # Knie an die Oberarme, Füße hoch
def crow_pose():
    """Knie an den Oberarmen, Gewicht nach vorn, bis die Füße abheben; Blick nach vorn."""
    H = floor_hands(0.24, 0.0, (0.25, -1, 0), (0.55, 0.7, 0.4))
    up = dict(rot=(100, 0, 0), pose={**CROW, **CROW_UP}, place=("hang", dict(sz=0.4, dy=-0.1)), hands=H)
    down = dict(up, place=("hang", dict(sz=0.4, dy=-0.02)),             # Hocke: Füße noch am Boden
                pose={**CROW, **legs(105, 125, abd=30, ankle=-10)})
    solve(down, 0, 30, 100, lambda k: mesh_np()[FOOTV][:, 2].min(), 0.0)
    return dict(keys=[down, up], timing="hold", view=(-35, 12))
def elbow_lever_ex(one):
    """Ellbogen in die Hüfte, Körper waagerecht über den Händen."""
    hd = (0.35, 1, 0)
    H = floor_hands(0.15, 0.0, hd, (0.15, 0.3, 1)) if not one else \
        {"L": floor_hands(0.06, 0.0, hd, (0.15, 0.3, 1))["L"]}
    pose = sym({"spine": (0, -0.05, 1), "neck": (0, -0.3, 1), "head": (0, -0.4, 1), "foot.L": (0, -0.4, -1)})
    if one: pose.update({"arm.R": (1, -0.1, -0.15), "forearm.R": (1, -0.1, -0.1), "hand.R": (1, -0.1, -0.1)})
    roll = 10 if one else 0
    up = dict(rot=(92, roll, 0), pose=pose, place=("pin", "waist", (0, 0.13, 0.4)), hands=H)
    down = dict(up); solve(down, 0, 40, 92, lambda k: pt("toe").z, 0.03)
    return dict(keys=[down, up], timing="hold", view=(-35, 14))
def elbow_lever(): return elbow_lever_ex(False)
def one_arm_elbow_lever(): return elbow_lever_ex(True)

# ── Ringe: False Grip, Transition, Ring-Muscle-up ───────────────────────────
RING_H = 2.3
def ring_hands(H, w, hint, g=0.22, y=0.0):
    """Neutralgriff im Ring; w: 0 normaler Hang · 0.4 False Grip · 1 Stütz. Im Neutralgriff zeigt die Handfläche
    zur Mitte – der False Grip ist deshalb ein Beugen der Hand zur Mitte hin (nicht nach vorn, das wäre Abknicken)."""
    fg, sup = Vector((-0.9, 0.0, 0.35)), Vector((-0.1, -0.12, -1))   # Stütz: Hand verlängert den Unterarm
    t = min(max((w - FG) / (1 - FG), 0), 1)
    hd = fg.normalized().slerp(sup.normalized(), t)
    if w <= FG: palm = Vector((-1, -0.2, 0)).lerp(Vector((-0.34, 0, -0.94)), w / FG)
    else: palm = Vector((-0.34, 0, -0.94)).lerp(Vector((-1, 0, -0.2)), t)
    return symh(dict(k=Vector((g, y, H + 0.02)).lerp(Vector((g, y - 0.03, H + 0.005)), w), hdir=tuple(hd),
                     hw=min(1.0, w / FG), palm=tuple(palm), flex=110, hint=hint))
def ring_ex(keys, H=RING_H, timing="pp", view=VIEW_PULL, g=0.22, **extra):
    for n, x in (("L", g + 0.08), ("R", -g - 0.08)): ring(n, (x, 0.0, H + 1.6))
    FRAME.extend([Vector((s * (g + 0.2), 0, H)) for s in (1, -1)])
    for k in keys: k["place"] = ("hang", k.pop("hang"))
    return dict(keys=[hang_sz(k) for k in keys], timing=timing, view=view, **extra)
FG = 0.4                                                            # False Grip
def false_grip_hang():
    return ring_ex([dict(pose=HANG, hang=dict(ext=STRAIGHT), hands=ring_hands(RING_H, FG, (0.5, 0, -1))),
                    dict(pose=ACTIVE, hang=dict(ext=STRAIGHT), hands=ring_hands(RING_H, FG, (0.5, 0, -1)))], timing="hold")
def false_grip_pull_up():
    return ring_ex([dict(pose=ACTIVE, hang=dict(ext=STRAIGHT), hands=ring_hands(RING_H, FG, (0.5, 0.2, -1))),
                    dict(pose=ARCH, hang=dict(ext=0.42, dy=0.17), hands=ring_hands(RING_H, FG, (0.3, 0.5, -1)))])
def ring_muscle_up():
    H = RING_H
    return ring_ex([dict(pose=ACTIVE, hang=dict(ext=STRAIGHT), hands=ring_hands(H, FG, (0.5, 0, -1))),
                    dict(rot=(-8, 0, 0), pose=sym({**ARCH, "thigh.L": (0.02, -0.4, -1), "shin.L": (0, 0.15, -1)}),
                         hang=dict(ext=0.4, dy=0.17), hands=ring_hands(H, FG, (0.3, 0.4, -1))),
                    dict(rot=(10, 0, 0), pose=OVER_BAR, hang=dict(sz=0.06, dy=0.25),           # Schultern hinter den Ringen hoch,
                         hands=ring_hands(H, 0.5, (0.15, 1, -0.4))),                            # Ellbogen weit nach hinten
                    dict(rot=(22, 0, 0), pose=OVER_BAR, hang=dict(sz=0.27, dy=0.1), hands=ring_hands(H, 0.7, (0.1, 1, -0.5))),
                    dict(rot=(22, 0, 0), pose=OVER_BAR, hang=dict(sz=0.38, dy=0.0), hands=ring_hands(H, 1, (0.1, 1, -0.2))),
                    dict(rot=(8, 0, 0), pose=SUPPORT, hang=dict(ext=STRAIGHT, up=True, dy=-0.04), hands=ring_hands(H, 1, (0.1, 1, -0.2)))],
                   follow=True, fit=0.9, tempo=22)   # der ganze Ring-Muscle-up in 1 s, Hände drehen über die Ringe
def ring_transition():
    """Ringe tief, Füße am Boden: aus dem Sitz über die Ringe kippen und in den Stütz hochdrücken; die Füße
    rutschen dabei unter den Körper."""
    H = 0.62                                                        # Ringe auf Brusthöhe im Sitzen
    def k(rot, pose, hang, w, hint, fy):
        fz = 0.85 + (-0.4 - 0.85) * min(max((fy + 0.62) / 0.22, 0), 1)       # Fuß stetig vom Aufstellen ins Stehen
        legs = {n: dict(a=(x, fy, 0.095), hint=(0, -0.3, 1), fdir=(0, -0.5, fz)) for n, x in (("L", 0.11), ("R", -0.11))}
        return dict(rot=(rot, 0, 0), pose=pose, hang=hang, hands=ring_hands(H, w, hint), legs=legs)
    return ring_ex([k(-12, ACTIVE, dict(sz=-0.04, dy=0.22), FG, (0.3, 0.6, -1), -0.62),
                    k(8, OVER_BAR, dict(sz=0.08, dy=0.26), 0.5, (0.15, 1, -0.4), -0.58),
                    k(24, OVER_BAR, dict(sz=0.3, dy=0.06), 0.8, (0.1, 1, -0.4), -0.5),
                    k(10, SUPPORT, dict(ext=STRAIGHT, up=True, dy=-0.03), 1, (0.1, 1, -0.2), -0.4)], H=H, view=(-30, 12))

# ── Planche auf Parallettes: Schwerpunkt über den Händen ────────────────────
PL_SH = sym({"clavicle.L": (1, -0.28, -0.1), "neck": (0, -0.05, 1), "head": (0, 0.1, 1)})
def planche_key(pitch, pose, h, H):
    k = dict(rot=(pitch, 0, 0), pose={**pose, **PL_SH}, place=("hang", dict(ext=STRAIGHT, up=True, dy=-0.2)), hands=H)
    solve(k, set_place(1, "dy"), -0.75, 0.25, lambda k: mesh_np()[:, 1].mean(), 0.0)
    return hang_sz(k)
def planche_ex(pose):
    h = 0.17; parallettes(0.25, 0.0, h); H = pbar_grip(h, 0.25, (0.15, 1, 0))
    return dict(keys=[planche_key(68, TPL, h, H), planche_key(88, pose, h, H)], timing="hold", view=(-30, 10))
def adv_tuck_planche(): return planche_ex(ADV_TUCK)
def straddle_planche(): return planche_ex(STRADDLE)
def full_planche(): return planche_ex(STRAIGHT_LEGS)

# ── Einarmiger Klimmzug ─────────────────────────────────────────────────────
FREE_R = {"arm.R": (-0.3, -0.55, -0.78), "forearm.R": (0.85, -0.35, 0.4), "hand.R": (0.85, -0.3, 0.3)}   # Hand an der Brust
def one_arm_keys():
    L = {"L": bar_hands(PULL_H, 0.12)["L"]}
    return [dict(pose={**ACTIVE, **FREE_R}, hang=dict(ext=STRAIGHT), hands={"L": dict(L["L"], hint=(0.6, -0.3, -1))}),
            dict(rot=(0, 0, 14), pose={**TOP, **FREE_R}, hang=dict(ext=0.42, dy=0.2), hands={"L": dict(L["L"], hint=(0.3, -0.6, -1))})]
def one_arm_pull_up(): return hang_ex(one_arm_keys(), grip=0.12, view=VIEW_PULL, sz=True)
def one_arm_negative(): return hang_ex(one_arm_keys(), grip=0.12, view=VIEW_PULL, sz=True, timing="fast")
def one_arm_pull_up_assisted():
    """Wie Handtuch-Klimmzüge, aber die Hilfshand greift deutlich tiefer."""
    tx, tz = -0.3, PULL_H - 0.68
    for y, ln in ((-0.021, 1.0), (0.021, 0.2)):
        box((tx, y, PULL_H + 0.02 - ln / 2), (0.12, 0.008, ln), CLOTH, coll=None, bevel=0.003)
    box((tx, 0, PULL_H + 0.021), (0.12, 0.05, 0.008), CLOTH, coll=None, bevel=0.003)
    towel = dict(k=(tx + 0.01, -0.03, tz), hint=(-1, 0.3, -0.2), palm=(0.4, -1, 0), flex=100, bar=("z", 1))   # Ellbogen seitlich
    hands = lambda hint: {"L": bar_hands(PULL_H, 0.14, hint=hint)["L"], "R": towel}
    k0 = dict(pose=ACTIVE, hang=dict(ext=STRAIGHT, sx=0.1), hands=hands((0.6, -0.3, -1)))
    k1 = dict(rot=(0, 0, 10), pose=TOP, hang=dict(ext=0.42, dy=0.2, sx=0.12), hands=hands((0.3, -0.6, -1)))
    return hang_ex([k0, k1], grip=0.14, view=VIEW_PULL)

# ── Handstand-Push-up mit Defizit und frei ──────────────────────────────────
def com_over_hands(k, lo=-12, hi=12):
    solve(k, 0, lo, hi, lambda k: mesh_np()[:, 1].mean() - 0.0, 0.0)
def hspu_ex(free, deficit=False, timing="pp"):
    h = 0.17 if deficit else 0.0
    if deficit:
        parallettes(0.26, 0.0, h)
        H = symh(dict(k=(0.26 + 0.02, 0.0, h + 0.02), hdir=(0.35, 0, -1), palm=(-1, 0, -0.35), flex=95, hint=(0.35, -1, 0.05)))
    else: H = handstand_hands(0.0, hint=(0.35, -1, 0.05))
    crown = skin("head", (0, -0.02, 1.69), (0, 0, 1))
    top = inv_key(0, H, pose=sym({**INV, "thigh.L": (-0.035, 0, -1), "shin.L": (-0.01, 0, -1)}))   # Beine geschlossen
    if free: com_over_hands(top)
    else:
        yw = 0.28; wall(yw, 1); heel = lambda k: pt("ankle").y - (yw - 0.07); solve(top, 0, -25, 25, heel, 0)
    top = hang_sz(top); low = dict(top); set_place(1, "dy")(low, -0.08)
    solve(low, set_place(1, "sz"), top["place"][1]["sz"], -0.3, lambda k: crown().z, 0.05)
    if free: com_over_hands(low)
    else: solve(low, 0, -25, 25, heel, 0)
    return dict(keys=[low, top], timing=timing, view=(-40, 6))
def deficit_wall_hspu(): return hspu_ex(False, deficit=True)
def freestanding_hspu_negative(): return hspu_ex(True, timing="fast")
def freestanding_hspu(): return hspu_ex(True)

# ── V-Sit, Tuck Manna ───────────────────────────────────────────────────────
VSIT = sym({**LSIT, **leg_angles(125, 2, ankle=45)})
def v_sit_parallettes():
    ex = lsit_ex(par=True); up = ex["keys"][1]
    vk = dict(up, rot=(-22, 0, 0), pose=VSIT)
    solve(vk, set_place(2, 2), up["place"][2][2] - 0.25, up["place"][2][2] + 0.2, m_arm(), STRAIGHT)
    return dict(ex, keys=[up, vk])
def v_sit_floor():
    ex = lsit_ex(); down, up = ex["keys"]
    # Beine als Weltrichtung (wie im Sitz-Schlüssel), sonst bliebe beim Mischen die Sitz-Richtung stehen
    vk = dict(up, rot=(-24, 0, 0), pose=VSIT,
              wpose=sym({"thigh.L": (0.04, -0.62, 0.78), "shin.L": (0.03, -0.62, 0.78), "foot.L": (0, -0.75, 0.55)}))
    solve(vk, set_place(2, 2), 0.05, 0.5, m_arm(), STRAIGHT)
    return dict(ex, keys=[down, vk])
MANNA = sym({"spine": (0, -0.25, 1), "chest": (0, -0.15, 1), "neck": (0, -0.3, 1), "head": (0, -0.35, 1),
             "clavicle.L": (1, -0.1, -0.25), **leg_angles(140, 145, abd=5, ankle=35)})
def tuck_manna():
    """Hände hinter der Hüfte (Finger nach hinten), Hüfte hinter die Hände, Knie zur Brust."""
    h = 0.17; parallettes(0.25, 0.0, h)
    H = symh(dict(k=(0.25 + 0.03, 0.0, h + 0.024), hdir=(1, 0.3, -0.5), palm=(0.25, 0, -1), curl=(0.45, 0.2, -1), hint=(0.1, -1, 0.1)))
    tuck = dict(pose=sym({**LSIT, **leg_angles(135, 140, abd=5, ankle=35)}),
                place=("pin", "hip", (0, -0.02, 0.3)), hands=H)
    solve(tuck, set_place(2, 2), 0.1, 0.6, m_arm(), STRAIGHT)
    manna = dict(tuck, rot=(24, 0, 0), pose=MANNA, place=("pin", "hip", (0, 0.16, 0.3)))   # Brust vor, Hüfte hinter die Hände
    solve(manna, set_place(2, 2), 0.1, 0.7, m_arm(), STRAIGHT)
    return dict(keys=[tuck, manna], timing="hold", view=(-25, 10))

# ── Press zum Handstand: Körper kippt über die Hände, Schwerpunkt über den Händen ─
def to_hang(k):
    """Beliebige Platzierung in hang (sz/dy relativ zur Knöchelmitte) umrechnen – damit sie mischbar wird."""
    pose_key(k, limbs=False); K = [Vector(s["k"]) for s in k["hands"].values()]; M = sum(K, Vector()) / len(K); S = pt("shoulder")
    k["place"] = ("hang", dict(sx=rig.location.x, sz=S.z - M.z, dy=S.y - M.y)); return k
def press_key(pitch, legs, H, feet=None):
    """Schultern über den Händen; feet: Füße auf Höhe feet (Stand), sonst Schwerpunkt über den Händen."""
    k = dict(rot=(pitch, 0, 0), pose={**PIKE, **legs, **sym({"clavicle.L": (1, 0.05, 0.35), "neck": (0, -0.1, 1)})},
             place=("hang", dict(ext=STRAIGHT, up=True, dy=0.0)), hands=H)
    if feet is None:
        for _ in range(12):                # Schwerpunkt über die Hände; Füße dürfen dabei nicht in den Boden
            solve(k, set_place(1, "dy"), -0.6, 0.6, lambda k: mesh_np()[:, 1].mean(), 0.0)
            pose_key(k, limbs=False)
            if mesh_np()[FOOTV][:, 2].min() >= 0.04: break
            set_rot(0)(k, k["rot"][0] + 3)
    else: solve(k, 0, pitch - 15, pitch + 25, lambda k: mesh_np()[FOOTV][:, 2].min(), feet)   # enger Bereich: eindeutig
    return hang_sz(k)
def pike_legs(hip, spread=0.0):
    a = math.radians(hip)                    # Hüftbeugung in Grad (0 = gestreckt)
    return sym({"thigh.L": (spread, -math.sin(a), -math.cos(a)), "shin.L": (spread, -math.sin(a), -math.cos(a)),
                "foot.L": (spread * 0.5, -math.sin(a) - 0.35, -math.cos(a))})
def press_ex(spread, wall_y=None, timing="pp"):
    H = floor_hands(0.26, 0.0, (0, -1, 0), (0.4, 0.6, 0.2))
    if wall_y is not None: wall(wall_y, 1)
    keys = [press_key(122, pike_legs(130, spread * 0.7), H, feet=0.0),      # gegrätschter Stand, Hände vor den Füßen
            press_key(126, pike_legs(128, spread * 0.85), H, feet=0.06),    # Füße lösen sich
            press_key(132, pike_legs(125, spread), H),                      # Schultern vor, Füße lösen sich
            press_key(155, pike_legs(95, spread), H),                       # Beine waagerecht gegrätscht
            press_key(180, pike_legs(0, 0.0), H)]                           # Handstand, Beine geschlossen
    return dict(keys=keys, timing=timing, view=(-35, 8))
def straddle_press(): return press_ex(0.42)
def wall_straddle_press(): return press_ex(0.42, wall_y=0.85)
def elevated_pike_press():
    """Füße auf der Box, Hüfte über die Hände schieben, bis die Füße abheben."""
    ex = pike_ex(feet_h=0.5, a_top=150); top = to_hang(ex["keys"][0])
    lift = press_key(165, pike_legs(100), top["hands"]); pose_key(lift, limbs=False)
    lift["wpose"] = {f"foot.{n}": tuple((world(PB[f"foot.{n}"].tail) - world(PB[f"foot.{n}"].head)).normalized()) for n in "LR"}
    return dict(ex, keys=[top, lift], timing="hold")
def pike_compression():
    """Langsitz, Hände neben den Knien, gestreckte Beine kurz vom Boden heben."""
    hands = floor_hands(0.2, -0.38, (0, -1, 0), (0.6, 0.3, 0.6))
    def key(lift, lean):
        k = dict(rot=(lean, 0, 0), pose=sym({"spine": (0, -0.35, 1), "chest": (0, -0.25, 1), "neck": (0, -0.2, 1)}),
                 wpose=sym({"thigh.L": (0.03, -1, lift), "shin.L": (0, -1, lift), "foot.L": (0, -0.8, 0.6)}),
                 place=("ground", "hip", (0, 0.03)), hands=hands)
        return grounded(k, "hip")
    return dict(keys=[key(-0.03, 22), key(0.16, 28)], timing="hold", view=(-35, 10))

# ── Human Flag an der senkrechten Stange ────────────────────────────────────
def flag_ex(stages, timing="hold", hands_z=(1.88, 0.95)):
    """Stange bei x = 0, Figur rechts davon (+X); obere Hand (links) zieht über dem Kopf, untere (rechts) drückt.
    Wurzel-Drehung um Y: 0 Stand · −90 waagerecht (Füße weg von der Stange) · −180 senkrecht kopfüber."""
    cyl((0, 0, 0), (0, 0, 2.7), 0.025, coll="stange")
    top, low = (0.03, -0.0, hands_z[0]), (0.03, 0.0, hands_z[1])
    hands = {"L": dict(k=top, palm=(-1, 0, 0.2), flex=105, bar=("z", 1), hint=(0.3, -0.4, 1)),
             "R": dict(k=low, palm=(-1, 0, -0.2), flex=105, bar=("z", -1), hint=(0.3, -0.4, -1))}
    keys = []
    for roll, pose, x in stages:           # Lage so suchen, dass beide Hände den Griff erreichen
        k = dict(rot=(0, roll, 0), pose={**LEVER_SH, **pose}, place=("pin", "shoulder", (x, 0, 1.42)), hands=hands)
        for _ in range(4):
            solve(k, set_place(2, 2), 0.6, 2.4, m_arm("L"), 0.93)
            pose_key(k, limbs=False)
            if m_arm("R")(k) > 0.95: solve(k, set_place(2, 0), 0.8, 0.1, m_arm("R"), 0.93)
        pose_key(k, limbs=False)
        if os.environ.get("LEVER_DEBUG"): print("FLAG", roll, k["place"], round(m_arm("L")(k), 3), round(m_arm("R")(k), 3))
        keys.append(k)
    FRAME.extend([Vector((0, 0, 0.9)), Vector((0, 0, 1.95))])
    return dict(keys=keys, timing=timing, view=(-72, 8))
STAND_FLAG = sym({"thigh.L": (-0.03, 0, -1), "shin.L": (-0.02, 0, -1)})
def vertical_flag(): return flag_ex([(0, STAND_FLAG, 0.3), (-180, STRAIGHT_LEGS, 0.42)], timing=(0.38, 0.2, 0.38))   # 180° Rolle
def tuck_flag(): return flag_ex([(-180, TUCKED, 0.42), (-90, TUCKED, 0.5)])
def straddle_flag(): return flag_ex([(-180, STRADDLE, 0.42), (-90, STRADDLE, 0.5)])
def human_flag(): return flag_ex([(-180, STRAIGHT_LEGS, 0.42), (-90, STRAIGHT_LEGS, 0.5)])

# ── Pistol (alte Gelenkwinkel-Posen, Fuß verankert) ─────────────────────────
def fwd(deg): return (0, -math.sin(math.radians(deg)), math.cos(math.radians(deg)))   # Rumpf nach vorn geneigt
def mirror_legs(d): return {k[:-2] + ".R": (-v[0], v[1], v[2]) for k, v in d.items()}
def pistol():
    """Stand → einbeinige tiefe Hocke auf links, rechtes Bein gestreckt nach vorn, Arme als Gegengewicht."""
    arms = sym({"arm.L": (0.08, -0.85, 0.52), "forearm.L": (0.06, -0.88, 0.47)})
    bot = {"spine": fwd(24), "chest": fwd(36), "neck": fwd(20), "head": fwd(15), **arms,
           **leg_angles(112, 145, ankle=-30), **mirror_legs(leg_angles(86, 4, ankle=-15))}
    return dict(keys=[dict(pose={}, place=("anchor", "L")), dict(pose=bot, place=("anchor", "L"))], view=(-47, 5))

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
    k0["pose"] = sym({"arm.L": (0.08, -1, 0.05), "forearm.L": (0.06, -1, 0.05)})
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
            "R": dict(a=(-0.1, 0.56, 0.57), hint=(0, -0.3, -1), fdir=(0, 1, -0.3))}
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

# ══ Katalog-Ausbau (45 Übungen) ═════════════════════════════════════════════

# ── Ringe: Stütz, Dips, RTO ─────────────────────────────────────────────────
RSUP_H = 1.32                                                       # Ringe so hoch, dass die Füße im Stütz frei sind
SUP_LEGS = sym({"thigh.L": (0.02, -0.08, -1), "shin.L": (0, 0.1, -1), "foot.L": (0, -0.45, -1)})
def rto(hands, k=1.0):
    """Ringe nach außen gedreht: Handfläche zeigt nach vorn statt zur Mitte (k = Anteil)."""
    return {n: dict(v, palm=tuple(Vector(v["palm"]).lerp(Vector((-0.25 if n == "L" else 0.25, -1, -0.1)), k))) for n, v in hands.items()}
def ring_sup_key(H, shrug=0.0, rot=4, out=0.0, **hang):
    pose = {**SUPPORT, **SUP_LEGS, **sym({"clavicle.L": (1, 0.1, -0.2 + 0.4 * shrug)})}
    rh = {n: dict(v, hw=0.0) for n, v in ring_hands(H, 1, (0.05, 1, -0.3)).items()}   # Ring dreht frei: Hand verlängert den Unterarm
    hands = rto(rh, out) if out else rh
    return dict(rot=(rot, 0, 0), pose=pose, hang=hang or dict(ext=STRAIGHT, up=True, dy=-0.02), hands=hands)
def ring_support_hold():
    """Stütz: aus leicht hängenden Schultern aktiv nach unten drücken und halten."""
    return ring_ex([ring_sup_key(RSUP_H, 0.6), ring_sup_key(RSUP_H)], H=RSUP_H, timing="hold", view=(-35, 8))
def rto_support_hold():
    """Aus dem Ringstütz die Ringe nach außen drehen und halten."""
    return ring_ex([ring_sup_key(RSUP_H), ring_sup_key(RSUP_H, out=1.0)], H=RSUP_H, timing="hold", view=(-35, 8))
def ring_dip_ex(out):
    top = ring_sup_key(RSUP_H, out=out)
    bot = dict(ring_sup_key(RSUP_H, rot=22, out=out, sz=0.1, dy=-0.07))
    bot["pose"] = {**bot["pose"], **sym({"clavicle.L": (1, 0.15, 0.05)}), **DIP_LEGS}
    top["pose"] = {**top["pose"], **DIP_LEGS}
    return ring_ex([top, bot], H=RSUP_H, view=(-35, 8), **DEEP)
def ring_dip(): return ring_dip_ex(0.0)
def rto_dip(): return ring_dip_ex(1.0)

# ── L-Sit-Stufen ────────────────────────────────────────────────────────────
TUCK_SIT = legs(135, 150, ankle=40)
def tuck_l_sit():
    ex = lsit_ex(par=True); down, up = ex["keys"]
    tk = dict(up, pose={**LSIT, **TUCK_SIT})
    solve(tk, set_place(2, 2), up["place"][2][2] - 0.25, up["place"][2][2] + 0.2, m_arm(), STRAIGHT)
    return dict(ex, keys=[down, tk])
def one_leg_l_sit():
    ex = lsit_ex(par=True); down, up = ex["keys"]
    tk = dict(up, pose={**LSIT, **TUCK_SIT})
    ol = dict(up, pose={**LSIT, **mirror_legs(leg_angles(135, 150, ankle=40))})   # rechts angezogen, links gestreckt
    return dict(ex, keys=[tk, ol])

# ── Handstand: Wall Walk, Shoulder Taps, Kick-up, negative HSPU ─────────────
def wall_walk():
    """Aus dem Liegestütz mit den Füßen die Wand hoch, Hände zur Wand – bis in den Bauch-zur-Wand-Handstand.
    Zwischenstufen: Füße per IK auf der Wand, Rumpfneigung so gewählt, dass die Beine gerade noch reichen."""
    H0 = floor_hands(0.26, 0.0, hint=(0.4, 0.8, 0.3))
    k0 = dict(rot=(70, 0, 0), pose=PUSH, place=("hang", dict(ext=STRAIGHT, up=True, dy=0.0)), hands=H0)
    solve(k0, 0, 50, 95, lambda k: mesh_np()[FOOTV][:, 2].min(), 0.0); k0 = hang_sz(k0)
    pose_key(k0); yw = mesh_np()[FOOTV][:, 1].max() + 0.01; wall(yw + 0.035, 1)
    reach = (LEN["thigh.L"] + LEN["shin.L"]) * 0.97
    keys, lo = [k0], k0["rot"][0]
    for f, zf in ((0.07, 0.14), (0.15, 0.28), (0.3, 0.52), (0.5, 0.85), (0.7, 1.15), (0.82, 1.38)):
        yh = (yw - 0.36) * f
        feet = {n: dict(a=(x, yw - 0.13, zf), hint=(0, f, -(1 - f))) for n, x in (("L", 0.1), ("R", -0.1))}   # Fuß folgt dem Unterschenkel
        k = dict(rot=(lo, 0, 0), pose=PUSH, place=("hang", dict(ext=STRAIGHT, up=True, dy=0.0)),
                 hands=floor_hands(0.26, yh, hint=(0.4, 0.8, 0.3)), legs=feet)
        best = None                                  # Neigung, bei der die Beine fast gestreckt die Wand erreichen
        for r in range(int(lo), 186, 2):             # (Hüfte gebeugt wie beim Pike, nichts überstreckt)
            set_rot(0)(k, r); pose_key(k)
            if any(o > 3 and b_.split(".")[0] in ("thigh", "shin") for o, b_, _, _ in RAW): continue
            d = max((pt(f"hip.{n}") - Vector(feet[n]["a"])).length for n in "LR")
            if d <= reach and (best is None or reach - d < best[0]): best = (reach - d, r)
        set_rot(0)(k, best[1] if best else lo)
        keys.append(hang_sz(k)); lo = k["rot"][0]
    top = dict(rot=(lo, 0, 0), pose=INV, place=("hang", dict(ext=STRAIGHT, up=True, dy=0.0)), hands=floor_hands(0.26, yw - 0.36, hint=(0.4, 0.8, 0.3)))
    toe = lambda k: mesh_np()[FOOTV][:, 1].max() - (yw + 0.01)          # Zehen berühren die Wand
    set_rot(0)(top, 186); pose_key(top, limbs=False); far = toe(top)
    set_rot(0)(top, lo); pose_key(top, limbs=False)
    if (toe(top) > 0) != (far > 0): solve(top, 0, lo, 186, toe, 0.0)
    else: set_rot(0)(top, 178)
    keys.append(hang_sz(top))
    for k, hint in ((keys[0], (0, 0, -1)), (keys[-1], (0, 1, 0))):   # Anfang und Ende: Füße dort, wo die Pose sie hat –
        pose_key(k, limbs=False)                                       # so tragen alle Schlüssel dieselben Bein-Ziele
        k["legs"] = {n: dict(a=tuple(pt(f"ankle.{n}")), hint=hint) for n in "LR"}
    return dict(keys=keys, timing="hold", view=(-20, 8), tempo=20)   # Füße laufen in 0,6 s die Wand hoch
def wall_shoulder_tap():
    """Bauch zur Wand: Gewicht auf die linke Hand, mit der rechten vorn an die linke Schulter tippen."""
    yw, H, k0 = chest_wall_keys(); k0 = hang_sz(k0)
    H = {n: dict(v, k=(v["k"][0], v["k"][1], 0.052)) for n, v in H.items()}; k0["hands"] = H
    pose_key(k0); S = tuple(pt("shoulder"))
    P = tuple(pt("shoulder.L") * 0.75 + pt("shoulder.R") * 0.25 + Vector((0, -0.09, 0)))   # vorn an die linke Schulter
    k0["place"] = ("pin", "shoulder", S)                                 # Schultern bleiben stehen (beide Schlüssel gleich)
    k1 = dict(k0, place=("pin", "shoulder", (S[0] + 0.03, S[1], S[2])),
              hands={"L": H["L"], "R": dict(k=P, palm=(1, 0, 0), flex=20, hint=(-0.3, -1, 0.3))})
    return dict(keys=[k0, k1], view=(12, 6))
def handstand_kick_up():
    """Vorgebeugt, Hände am Boden, ein Fuß steht, das andere Bein schwingt hoch – in den freien Handstand, halten."""
    H = handstand_hands(0.0)
    lunge = dict(rot=(95, 0, 0), pose={**INV, **leg_angles(75, 70, ankle=-10), **mirror_legs(leg_angles(-25, 5, ankle=30))},
                 place=("hang", dict(ext=STRAIGHT, up=True, dy=0.0)), hands=H)
    solve(lunge, 0, 70, 135, lambda k: mesh_np()[FOOTV][:, 2].min(), 0.0)    # Standfuß am Boden
    top = dict(rot=(180, 0, 0), pose=INV, place=("hang", dict(ext=STRAIGHT, up=True, dy=0.0)), hands=H)
    com_over_hands(top, 168, 192)
    return dict(keys=[hang_sz(lunge), hang_sz(top)], timing="hold", view=(-40, 6))
def wall_hspu_negative():
    ex = handstand_push_up_wall()
    return dict(ex, timing="fast")                                        # langsam hinunter, schnell zurück

# ── Muscle-up mit Absprung an tiefer Stange ─────────────────────────────────
def jumping_muscle_up():
    H = 1.45; bar(H)
    crouch = dict(rot=(-6, 0, 0), pose={**ACTIVE, **legs(60, 100, ankle=-20)},
                  hang=dict(sz=-0.32, dy=0.18), hands=mu_hands(H, 0, (0.35, 0.3, -1)))
    keys = [crouch] + mu_keys(H)[1:]
    for k in keys: k["place"] = ("hang", k.pop("hang"))
    keys = [hang_sz(k) for k in keys]
    solve(keys[0], set_place(1, "sz"), -0.6, 0.0, lambda k: mesh_np()[FOOTV][:, 2].min(), 0.0)   # Füße am Boden
    FRAME.extend([Vector((s * 0.5, 0, H)) for s in (1, -1)])
    return dict(keys=keys, view=VIEW_PULL, follow=True, fit=0.9)

# ── Planche- und Hebel-Varianten ────────────────────────────────────────────
def tuck_planche_push_up():
    ex = tuck_planche(); up = ex["keys"][1]
    low = dict(up, place=("hang", dict(up["place"][1], sz=up["place"][1]["sz"] - 0.12, dy=up["place"][1]["dy"] - 0.05)))
    return dict(ex, keys=[up, low], timing="pp")
def tuck_front_lever_raise():
    return lever_ex([com_hang(-180, TUCKED), com_hang(-90, TUCKED)], timing="pp")
def ice_cream_maker():
    top = hang_sz(dict(pose=TOP, place=("hang", dict(ext=0.42, dy=0.2)), hands=bar_hands(PULL_H, hint=(0.3, -0.6, -1))))
    return lever_ex([hang0(), top, com_hang(-90, TUCKED)], timing="pp")

# ── Liegestütz-Nebenübungen ─────────────────────────────────────────────────
def scapula_push_up():
    ex = push_ex(); top = ex["keys"][0]
    k_in = dict(top, pose={**PUSH, **sym({"clavicle.L": (1, 0.25, -0.05)})})     # Schulterblätter zusammen
    k_out = dict(top, pose={**PUSH, **sym({"clavicle.L": (1, -0.3, -0.05)}), "chest": (0, 0.1, 1)})   # oberer Rücken rund
    return dict(ex, keys=[k_in, k_out])
QUAD_LEGS = sym({"thigh.L": (0.03, 0, -1), "shin.L": (0.02, 1, -0.03), "foot.L": (0, 1, -0.4)})   # Oberschenkel senkrecht, Schienbeine liegen auf
def quadruped(hands, rock):
    """Vierfüßlerstand: Knie unter der Hüfte am Boden, Hände unter (rock=0) oder hinter den Schultern (rock>0: Gewicht vor)."""
    k = dict(rot=(85, 0, 0), pose={"neck": (0, -0.15, 1), "head": (0, -0.25, 1)}, wpose=QUAD_LEGS,
             place=("pin", "knee", (0, 0.0, 0.07)), hands=hands(rock))
    solve(k, 0, 60, 110, m_arm(), 0.97)                                   # Rumpfneigung: Arme gerade bis zum Boden
    return k
def wrist_prep():
    H = lambda r: floor_hands(0.24, -0.62 + r, hint=(0.3, 0.8, 0.4))
    return dict(keys=[quadruped(H, 0.06), quadruped(H, -0.08)], view=(-35, 14))
def wrist_push_up():
    """Handrücken auf dem Boden, Finger zu den Knien."""
    H = lambda r: symh(dict(k=(0.22, -0.5 + r, 0.035), hdir=(0, 1, 0), palm=(0, 0, 1), flex=10, hint=(0.6, -0.3, 0.6)))
    return dict(keys=[quadruped(H, 0.0), quadruped(H, -0.07)], view=(-35, 14))

# ── Stand: Band-Übungen ─────────────────────────────────────────────────────
STANCE = sym({"thigh.L": (0.08, 0, -1), "shin.L": (0.06, 0, -1)})
def stand_key(hands=None, pose=None, **extra):
    k = dict(pose={**STANCE, **(pose or {})}, place=("ground", "pelvis", (0, 0)), **extra)
    if hands: k["hands"] = hands
    return grounded(k, "pelvis")
def band_dislocate():
    """Band mit gestreckten Armen vor dem Körper über den Kopf nach hinten zur Hüfte und zurück."""
    k = stand_key(); pose_key(k); S = pt("shoulder"); r = LEN["arm.L"] + LEN["forearm.L"] + LEN["hand.L"]
    def at(d, palm, hint):
        d = Vector(d).normalized(); return symh(dict(k=tuple(Vector((0.58, S.y, S.z)) + Vector((0, d.y, d.z)) * (r * 0.62)),
                                                      palm=palm, flex=95, hint=hint))
    # Handfläche steht immer quer zum Arm und dreht mit ihm in der Seitenebene (stetig von vorn über oben nach hinten)
    keys = [dict(k, hands=at((0, -0.75, -0.65), (0, 0.65, -0.75), (1, 0.2, -0.3))),
            dict(k, hands=at((0, -0.1, 1), (0, -1, -0.1), (1, 0.1, 0.2))),
            dict(k, hands=at((0, 0.75, -0.65), (0, 0.65, 0.75), (1, -0.2, -0.3)))]
    st = Stick(0.008, BAND, 12); DYN.append(lambda: st.set(pt("knuckle.L"), pt("knuckle.R")))
    return dict(keys=keys, view=(-50, 10))
def band_external_rotation():
    """Befestigung links: rechter Unterarm dreht bei anliegendem Ellbogen nach außen."""
    k = stand_key(); pose_key(k); E = pt("elbow.R"); fl = LEN["forearm.R"] + LEN["hand.R"]
    def hand(d):                             # Handfläche zur Mitte, dreht mit dem Unterarm um die Senkrechte
        d = Vector(d).normalized()
        return {"R": dict(k=tuple(E + d * fl * 0.98), palm=(-d.y, d.x, 0), flex=90, hint=(0, 0.2, -1))}
    A = Vector((0.9, E.y - 0.3, E.z))
    st = Stick(0.008, BAND, 12); DYN.append(lambda: st.set(pt("knuckle.R"), A)); cyl((A.x, A.y, 0), (A.x, A.y, 1.6), 0.03, coll="pfosten")
    return dict(keys=[dict(k, hands=hand((0.15, -1, 0))), dict(k, hands=hand((-0.8, -0.6, 0)))], view=(-70, 12))
def face_pull():
    """Band auf Kopfhöhe vorn: zum Gesicht ziehen, Ellbogen hoch und weit."""
    k = stand_key(pose={"spine": (0, 0.08, 1)}); pose_key(k); S = pt("shoulder")
    A = Vector((0, S.y - 1.3, S.z + 0.15)); cyl((A.x, A.y, 0), (A.x, A.y, A.z + 0.2), 0.03, coll="pfosten")
    ext = symh(dict(k=(0.12, S.y - 0.62, S.z + 0.05), palm=(-1, 0, 0), flex=95, hint=(0.6, 0, -1)))
    pull = symh(dict(k=(0.24, S.y - 0.12, S.z + 0.2), palm=(-0.6, 0.6, 0), flex=95, hint=(1, 0.4, 0.4)))
    for n in "LR":
        st = Stick(0.008, BAND, 12); DYN.append(lambda st=st, n=n: st.set(pt(f"knuckle.{n}"), A))
    return dict(keys=[dict(k, hands=ext), dict(k, hands=pull)], view=(-60, 10))
def pallof_press():
    """Befestigung links: Band vor der Brust, Arme gerade nach vorn drücken, ohne mitzudrehen."""
    k = stand_key(pose=sym({"thigh.L": (0.15, -0.1, -1), "shin.L": (0.1, 0.1, -1)})); pose_key(k); S = pt("shoulder")
    A = Vector((1.3, S.y - 0.25, S.z - 0.2)); cyl((A.x, A.y, 0), (A.x, A.y, A.z + 0.2), 0.03, coll="pfosten")
    near = symh(dict(k=(0.04, S.y - 0.24, S.z - 0.18), palm=(-1, 0, 0), flex=110, hint=(0.6, 0.3, -1)))
    far = symh(dict(k=(0.05, S.y - 0.56, S.z - 0.12), palm=(-1, 0, 0), flex=110, hint=(0.6, 0.2, -1)))
    st = Stick(0.009, BAND, 12); DYN.append(lambda: st.set((pt("knuckle.L") + pt("knuckle.R")) / 2, A))
    return dict(keys=[dict(k, hands=near), dict(k, hands=far)], timing="hold", view=(-70, 12))

# ── Boden: Brücke, Leg Curl, Rollouts, Copenhagen ───────────────────────────
SUPINE_ARMS = {"wpose": sym({"arm.L": (0.25, -0.95, 0.0), "forearm.L": (0.2, -1, 0.0), "hand.L": (0.2, -1, 0.0)})}
def supine_key(rot, legs_, arms=True):
    k = dict(rot=(rot, 0, 0), pose={"neck": (0, -0.45, 1), "head": (0, -0.55, 1)}, place=("pin", "shoulder", (0, 0.55, 0.13)), legs=legs_)
    if arms: k.update(SUPINE_ARMS)
    return k
def single_leg_glute_bridge():
    """Rückenlage, linker Fuß aufgestellt, rechtes Bein gestreckt: Hüfte hoch bis zur Linie."""
    foot = {"L": dict(a=(0.12, -0.25, 0.09), hint=(0, -0.3, 1), fdir=(0, -1, -0.2))}
    def key(rot):
        k = supine_key(rot, foot); k["pose"] = {**k["pose"], **mirror_legs(leg_angles(35, 0, ankle=30))}
        return k
    return dict(keys=[key(-92), key(-122)], timing="hold", view=(-60, 14))
def sliding_leg_curl():
    """Hüfte oben, Fersen auf dem Handtuch vom gestreckten Bein zum Gesäß ziehen."""
    feet = lambda y: {n: dict(a=(x, y, 0.09), hint=(0, -0.3, 1), fdir=(0, -0.6, 0.8)) for n, x in (("L", 0.11), ("R", -0.11))}
    for n in "LR":
        pad = box((0, 0, 0.006), (0.14, 0.2, 0.012), CLOTH, coll=None, bevel=0.004)
        DYN.append(lambda pad=pad, n=n: setattr(pad, "location", (pt(f"ankle.{n}").x, pt(f"ankle.{n}").y - 0.02, 0.006)))
    return dict(keys=[supine_key(-100, feet(-1.05)), supine_key(-125, feet(-0.42))], view=(-60, 14))
def rollout_ex(depth):
    """Kniend mit Händen in den Ringen nach vorn ausrollen, Rücken flach, aus dem Bauch zurück."""
    box((0, 0.2, 0.025), (0.5, 0.75, 0.05), coll="polster")
    shins = sym({"shin.L": (0, 1, -0.02), "foot.L": (0, 1, -0.45)})
    def key(lean, arm):
        return dict(rot=(lean, 0, 0), pose=sym({"arm.L": arm, "forearm.L": arm, "neck": (0, -0.15, 1)}),
                    wpose=shins, place=("pin", "knee", (0, 0, 0.12)))
    k0, k1 = key(22, (0.12, -0.55, -0.85)), key(depth, (0.12, -0.1, 1))
    for n, x in (("L", 0.25), ("R", -0.25)): ring(n, (x, -1.6, 3.0))
    return dict(keys=[k0, k1], view=(-20, 10))
def kneeling_rollout(): return rollout_ex(62)
def ring_rollout(): return rollout_ex(76)
def copenhagen_plank():
    """Seitstütz auf dem linken Unterarm, oberes (rechtes) Bein auf dem Kasten, unteres frei."""
    base = {**mirror_legs(leg_angles(0, 0, ankle=20)), **leg_angles(10, 70, ankle=10)}
    def key(sag):
        k = dict(rot=(0, 72, 0), pose={**base, "spine": (-sag, 0, 1)},
                 wpose={"arm.L": (0, -0.05, -1), "forearm.L": (0, -1, 0), "hand.L": (0, -1, -0.05)},
                 place=("pin", "elbow.L", (0, 0, 0.06)))
        solve(k, 1, 40, 89, lambda k: pt("ankle.R").z, 0.5)
        return k
    up, low = key(0.0), key(0.3)
    pose_key(up); A = pt("ankle.R"); box((A.x, A.y, 0.23), (0.32, 0.4, 0.46))
    return dict(keys=[low, up], timing="hold", view=(-90, 12))

def single_leg_rdl():
    """Auf dem linken Bein aus der Hüfte nach vorn kippen, rechtes Bein gestreckt nach hinten, Rücken gerade."""
    foot = {"L": dict(a=(0.1, 0.0, 0.085), hint=(0, -1, 0.1), fdir=(0, -1, -0.42))}
    arms = sym({"arm.L": (0.1, 0.0, -1), "forearm.L": (0.08, -0.05, -1)})
    def key(lean, hip, rl):
        return dict(rot=(lean, 0, 0), pose=mirror_legs(rl), wpose=arms, place=("pin", "hip.L", hip), legs=foot)
    return dict(keys=[key(0, (0.1, 0.0, 0.88), leg_angles(-5, 65, ankle=20)), key(78, (0.1, 0.1, 0.8), leg_angles(0, 0, ankle=20))],
                view=(-80, 8))

# ── Ziehen: negative, Band, einarmig hängen, Tisch-Rudern ───────────────────
def pull_up_negative(): return dict(pull_up(), timing="fast")
def band_pull_up():
    ex = pull_up()
    knee = skin("shin.L", (0.13, -0.02, 0.47), (0, -1, 0))
    for x in (0.05, -0.05): strand(lambda x=x: Vector((x, 0.0, PULL_H)), knee, 0.009)
    return ex
def one_arm_hang():
    """Einarmig hängen: aus passiven Schultern aktiv nach unten ziehen."""
    L = {"L": dict(bar_hands(PULL_H, 0.12)["L"], hint=(0.6, -0.3, -1))}
    free = {"arm.R": (-0.15, -0.05, -1), "forearm.R": (-0.1, -0.15, -1)}
    return hang_ex([dict(rot=(0, 0, 8), pose={**HANG, **free}, hang=dict(ext=STRAIGHT), hands=L),
                    dict(rot=(0, 0, 8), pose={**ACTIVE, **free}, hang=dict(ext=STRAIGHT), hands=L)], grip=0.12, timing="hold", sz=True)
def table_row(): return row_ex(top=22, table=True)

# ── Stütz am Barren: halten, negativ; Korean Dip ────────────────────────────
def bar_support_hold():
    h, gap = 1.25, 0.25; pbars(h, gap)
    top, _ = dip_keys(h, gap)
    shrug = dict(top, pose={**top["pose"], **sym({"clavicle.L": (1, 0.1, 0.2)})})
    return dict(keys=[shrug, top], timing="hold", view=(-38, 8))
def dip_negative(): return dict(dip(), timing=(0.3, 0.08, 0.55))     # zügig hoch, langsam ab
def korean_dip_ex(timing):
    """Stange hinter dem Gesäß, Hände dahinter, Finger nach vorn; tief absenken in die Schulterstreckung."""
    H = 1.1; bar(H, half=0.6)
    hands = lambda hint: symh(dict(k=(0.24, 0.0, H + 0.012), hdir=(0, -1, -0.7), palm=(0, 0, -1), flex=100, bar=("x", 1), hint=hint))
    sit = legs(85, 95, ankle=-10)
    top = dict(rot=(8, 0, 0), pose={**SUPPORT, **sit}, place=("hang", dict(ext=STRAIGHT, up=True, dy=-0.16)), hands=hands((0.1, 1, -0.2)))
    bot = dict(rot=(30, 0, 0), pose={**SUPPORT, **sit, **sym({"clavicle.L": (1, 0.15, 0.1)})},
               place=("hang", dict(sz=0.05, dy=-0.3)), hands=hands((0.1, 1, 0.3)))
    return dict(keys=[hang_sz(top), bot], view=(-82, 8), timing=timing, **DEEP)   # seitlich: Stange hinter dem Gesäß sichtbar
def korean_dip(): return korean_dip_ex("pp")
def korean_dip_negative(): return korean_dip_ex("fast")

# ── Beine: Liegestütz am Kasten, Cossack, Sissy, Dragon, Tibialis, Spanish, Reverse Nordic ─
def incline_push_up():
    h = 0.6
    def hands(S):
        box((0, S.y, h / 2), (0.8, 0.36, h))
        return floor_hands(0.26, S.y, z=h + 0.042)
    return push_ex(a_top=42, hands=hands, chest_z=h + 0.12)
def push_up(): return push_ex()
def cossack_squat():
    """Breiter Stand, tief zur linken Seite, rechtes Bein gestreckt mit Fußspitze nach oben."""
    A = {"L": (0.42, 0.0, 0.085), "R": (-0.42, 0.0, 0.085)}
    lg = lambda fr: {"L": dict(a=A["L"], hint=(0.5, -1, 0.2), fdir=(0.2, -1, -0.42)),
                     "R": dict(a=A["R"], hint=(-0.2, -1, 0.3), fdir=fr)}
    arms = sym({"arm.L": (0.1, -1, 0.1), "forearm.L": (0.05, -1, 0.15)})
    up = dict(rot=(5, 0, 0), pose=arms, place=("pin", "pelvis", (0, 0.0, 0.84)), legs=lg((-0.2, -1, -0.42)))
    down = dict(rot=(22, 0, 0), pose=arms, place=("pin", "pelvis", (0.27, 0.1, 0.42)), legs=lg((-0.2, -0.8, 0.55)))
    return dict(keys=[up, down], view=(-80, 10))
def sissy_squat():
    """Auf den Fußballen, Knie weit nach vorn, Körper als Linie von Knie bis Kopf nach hinten (Hand am Pfosten)."""
    P = Vector((-0.36, 0.08, 0)); cyl(P, P + Vector((0, 0, 1.9)), 0.03, coll="pfosten")
    feet = {n: dict(a=(x, 0.0, 0.13), hint=(0, -1, 0.1), fdir=(0, -0.8, -0.6)) for n, x in (("L", 0.11), ("R", -0.11))}
    grip = {"R": dict(k=(P.x + 0.035, P.y, 0.95), palm=(-1, 0, 0), flex=110, bar=("z", 1), hint=(-0.3, 0.6, -1))}
    def key(lean, hip):
        return dict(rot=(-lean, 0, 0), pose={}, place=("pin", "hip", hip), legs=feet, hands=grip)
    return dict(keys=[key(3, (0, 0.02, 0.9)), key(48, (0, 0.18, 0.5))], view=(-80, 8))
def dragon_pistol():
    # Das freie Bein kreuzt hinter dem Standbein (Adduktion + leichte Streckung, Knie gebeugt); dafür bleibt die
    # Hocke etwas höher – tiefer ginge nur mit mehr Hüftbeweglichkeit, als die Gelenkgrenzen erlauben.
    ex = pistol(); stand, bot = ex["keys"]
    cross = mirror_legs(leg_angles(-15, 105, abd=-30, ankle=25))
    bot["pose"] = {**bot["pose"], **leg_angles(88, 105, ankle=-25), **cross}
    mid = dict(stand, pose={**bot["pose"], **leg_angles(35, 45, ankle=-10), "spine": fwd(12), "chest": fwd(18)})   # Bein zuerst hinter
    return dict(ex, keys=[stand, mid, bot])
def tibialis_raise():
    """Rücken an der Wand, Fersen vor der Wand: Fußspitzen hoch und langsam ab."""
    up = dict(rot=(-11, 0, 0), pose=STANCE, wpose=sym({"foot.L": (0, -1, 0.25)}), place=("pin", "ankle", (0, -0.32, 0.085)))
    down = dict(up, wpose=sym({"foot.L": (0, -0.95, -0.42)}))
    pose_key(up); yb = mesh_np()[:, 1].max(); wall(yb + 0.005, 1)
    return dict(keys=[down, up], timing="hold", view=(-75, 8))
def spanish_squat():
    """Band um den Pfosten vorn und hinter die Kniekehlen: aufrechte, tiefe Hocke mit senkrechten Schienbeinen."""
    feet = {n: dict(a=(x, 0.0, 0.085), hint=(0, -1, 0.1), fdir=(0.1 if x > 0 else -0.1, -1, -0.42)) for n, x in (("L", 0.16), ("R", -0.16))}
    arms = sym({"arm.L": (0.1, -1, 0.0), "forearm.L": (0.05, -1, 0.05)})
    up = dict(rot=(4, 0, 0), pose=arms, place=("pin", "pelvis", (0, 0.02, 0.86)), legs=feet)
    down = dict(rot=(-8, 0, 0), pose=arms, place=("pin", "pelvis", (0, 0.38, 0.52)), legs=feet)
    A = Vector((0, -1.1, 0.48)); cyl((0, A.y, 0), (0, A.y, 0.9), 0.04, coll="pfosten")
    for n, s in (("L", 1), ("R", -1)):
        side = lambda n=n, s=s: pt(f"knee.{n}") + Vector((s * 0.07, 0.02, 0))
        back = lambda n=n: pt(f"knee.{n}") + Vector((0, 0.07, 0))
        strand(lambda s=s: A + Vector((s * 0.04, 0, 0)), side, 0.009); strand(side, back, 0.009)
    return dict(keys=[up, down], timing="hold", view=(-80, 8))
def reverse_nordic():
    """Aufrechter Kniestand, Körper als Linie von den Knien zum Kopf nach hinten neigen."""
    box((0, 0.2, 0.025), (0.5, 0.75, 0.05), coll="polster")
    shins = sym({"shin.L": (0, 1, -0.02), "foot.L": (0, 1, -0.45)})
    arms = sym({"arm.L": (0.2, -0.6, -0.4), "forearm.L": (-0.7, -0.3, 0.4)})
    key = lambda lean: dict(rot=(-lean, 0, 0), pose=arms, wpose=shins, place=("pin", "knee", (0, 0, 0.12)))
    return dict(keys=[key(0), key(42)], view=(-80, 8))

# ── Side Lever an der senkrechten Stange ────────────────────────────────────
def side_lever_ex(pose):
    return flag_ex([(-55, pose, 0.45), (-90, pose, 0.5)], hands_z=(1.72, 1.2))
def tuck_side_lever(): return side_lever_ex(TUCKED)
def side_lever(): return side_lever_ex(STRAIGHT_LEGS)

# ── Kniebeuge, Sprungkniebeuge ──────────────────────────────────────────────
def squat_feet(z=0.085, fd=(0, -1, -0.42), w=0.17, out=0.25):
    return {n: dict(a=(x, 0.0, z), hint=(out * (1 if x > 0 else -1), -1, 0.1), fdir=(0.15 * (1 if x > 0 else -1), fd[1], fd[2]))
            for n, x in (("L", w), ("R", -w))}
ARMS_FWD = sym({"arm.L": (0.1, -1, 0.0), "forearm.L": (0.06, -1, 0.04)})
def air_squat():
    """Hüfte nach hinten-unten bis die Oberschenkel waagerecht sind, Fersen am Boden, Arme vorn."""
    up = dict(rot=(3, 0, 0), pose={**ARMS_FWD, "neck": (0, -0.05, 1)}, place=("pin", "pelvis", (0, 0.02, 0.86)), legs=squat_feet())
    down = dict(up, rot=(30, 0, 0), place=("pin", "pelvis", (0, 0.24, 0.47)),
                pose={**sym({"arm.L": (0.1, -1, 0.4), "forearm.L": (0.06, -1, 0.42)}), "neck": (0, -0.05, 1)})   # Arme bleiben waagerecht
    return dict(keys=[up, down], view=(-55, 8))
def jump_squat():
    """Tiefe Hocke mit Armen hinten → explosiv hoch, Füße verlassen den Boden, Arme schwingen nach oben."""
    back = sym({"arm.L": (0.08, 0.3, -0.95), "forearm.L": (0.06, 0.28, -0.96)})   # Schwung holen: Arme schräg hinter der Hüfte, nicht waagerecht nach hinten
    up_arms = sym({"arm.L": (0.12, -0.25, 1), "forearm.L": (0.1, -0.2, 1)})
    down = dict(rot=(32, 0, 0), pose={**back, "neck": (0, -0.05, 1)}, place=("pin", "pelvis", (0, 0.24, 0.47)), legs=squat_feet())
    tall = dict(rot=(4, 0, 0), pose={**up_arms, "neck": (0, -0.05, 1)}, place=("pin", "pelvis", (0, 0.02, 0.97)),
                legs=squat_feet(0.16, (0, -0.55, -0.85), 0.11, 0.35))                            # auf den Zehenspitzen
    air = dict(tall, place=("pin", "pelvis", (0, 0.02, 1.2)), legs=squat_feet(0.36, (0, -0.45, -0.9), 0.11, 0.35))
    return dict(keys=[down, tall, air], view=(-55, 8), timing="pp")

# ── Grundübungen (31, nach free-exercise-db) ────────────────────────────────
def chin_up():
    """Untergriff schulterbreit: Handflächen zum Körper, Ellbogen zeigen nach vorn-unten."""
    under = lambda hint: symh(dict(k=(0.2, -0.025, PULL_H + 0.028), hint=hint, palm=(0, 1, 0), curl=(0, 1, -0.9), bar=("x", -1)))
    return hang_ex([dict(pose=ACTIVE, hang=dict(ext=STRAIGHT), hands=under((0.3, -0.5, -1))),
                    dict(pose=TOP, hang=dict(ext=0.42, dy=0.2), hands=under((0.15, -0.9, -1)))], grip=0.2, view=VIEW_PULL)
def wide_push_up(): return push_ex(gap=0.42, hdir=(0.35, -1, 0), hint=(0.8, 0.5, 0.5))
def diamond_push_up():
    """Hände unter der Brust (Daumen und Zeigefinger bilden eine Raute), Ellbogen eng am Körper."""
    return push_ex(gap=0.07, hdir=(-0.7, -0.7, 0), hint=(0.25, 1, 0.4), chest_z=0.13, hand_dy=0.06)
def clap_push_up():
    """Unten → oben → Körper hebt über die Zehen ab, Hände klatschen unter der Brust."""
    ex = push_ex(); top, low = ex["keys"]
    air = dict(top, rot=(top["rot"][0] - 10, 0, 0)); pose_key(air, limbs=False); S = pt("shoulder")
    air["hands"] = symh(dict(k=(0.03, S.y - 0.12, S.z - 0.42), hdir=(0, -1, -0.3), palm=(-1, 0, -0.35), flex=5, hint=(0.6, 0.5, 0.3)))
    return dict(ex, keys=[low, top, air])
def bench_dip():
    """Hände hinter dem Körper auf der Bankkante, Beine gestreckt auf den Fersen: absenken bis die Oberarme waagerecht sind."""
    h = 0.45; box((0, 0.32, h / 2), (0.9, 0.4, h))                       # Kante bei y = 0.12
    hands = symh(dict(k=(0.2, 0.13, h + 0.04), hdir=(0, -1, 0), palm=(0, 0, -1), curl=(0, -0.2, -1), hint=(0.15, 1, 0.2)))
    feet = {n: dict(a=(x, -0.78, 0.085), hint=(0, 0, 1), fdir=(0, -0.55, 0.85)) for n, x in (("L", 0.11), ("R", -0.11))}
    up = dict(rot=(-4, 0, 0), pose={}, place=("pin", "pelvis", (0, -0.02, h)), hands=hands, legs=feet)
    solve(up, set_place(2, 2), h - 0.2, h + 0.3, m_arm(), STRAIGHT)
    low = dict(up); solve(low, set_place(2, 2), 0.05, up["place"][2][2], lambda k: pt("shoulder").z, h + 0.1)
    return dict(keys=[up, low], view=(-35, 12), **DEEP)
def front_plank():
    """Unterarmstütz: Ellbogen unter den Schultern, Körper eine Linie von Kopf bis Ferse (Hüfte erst etwas hoch, dann gerade)."""
    arms = sym({"arm.L": (0.04, 0, -1), "forearm.L": (-0.1, -1, 0), "hand.L": (-0.1, -1, -0.05)})
    def key(pike):
        k = dict(rot=(75, 0, 0), pose={**PLANK, "spine": (0, pike, 1), "thigh.L": (0.02, -pike, -1), "thigh.R": (-0.02, -pike, -1)},
                 wpose=arms, place=("pin", "toe", (0, 0.8, 0.035)))
        solve(k, 0, 50, 89, lambda k: pt("elbow").z, 0.065); return k
    return dict(keys=[key(-0.12), key(0.0)], timing="hold", view=(-35, 12))

# Rückenlage: Becken (oder Schulter) bleibt liegen, Füße aufgestellt
def lying(rot, pose, name="pelvis", **extra):
    """Rücken- (rot ≈ −90) oder Bauchlage (rot ≈ 90): tiefster Hautpunkt am Boden, Lage als pin auf name gespeichert."""
    return grounded(dict(rot=(rot, 0, 0), pose=pose, place=("ground", name, (0, 0)), **extra), name)
def bent_feet(y=-0.42, w=0.13):
    return {n: dict(a=(x, y, 0.09), hint=(0.15 * (1 if x > 0 else -1), 0, 1), fdir=(0, -1, -0.2)) for n, x in (("L", w), ("R", -w))}
FLOOR_HEAD = {"neck": (0, -0.3, 1), "head": (0, -0.35, 1)}
REACH_KNEES = sym({"arm.L": (0.15, -0.3, -1), "forearm.L": (0.12, -0.3, -1)})
CURL = {"spine": (0, -0.3, 1), "chest": (0, -0.65, 1), "neck": (0, -0.85, 1), "head": (0, -0.8, 1)}
def crunch():
    flat = lying(-90, {**FLOOR_HEAD, **sym({"arm.L": (0.15, 0, -1), "forearm.L": (0.12, 0, -1)}), **legs(50, 100)}, legs=bent_feet())
    up = dict(flat, pose={**CURL, **REACH_KNEES})
    return dict(keys=[flat, up], timing="hold", view=(-20, 16))
def reverse_crunch():
    head = {"neck": (0, 1, 0.3), "head": (0, 1, 0.35)}                     # Kopf liegt (Welt), auch wenn das Becken kippt
    arms = {"wpose": {**head, **sym({"arm.L": (0.2, -0.98, 0.0), "forearm.L": (0.18, -1, 0.0), "hand.L": (0.18, -1, 0.0)})}}
    flat = lying(-90, {**FLOOR_HEAD, **legs(90, 90, ankle=20)}, name="shoulder", **arms)
    up = dict(flat, rot=(-118, 0, 0), pose={"spine": (0, -0.45, 1), "chest": (0, -0.2, 1), **legs(115, 125, ankle=20)})
    return dict(keys=[flat, up], view=(-20, 16))
def sit_up():
    """Wirbel für Wirbel aufrollen bis zum Sitzen."""
    flat = lying(-90, {**FLOOR_HEAD, **REACH_KNEES, **legs(50, 100)}, legs=bent_feet(-0.4))
    mid = dict(flat, rot=(-62, 0, 0), pose={**CURL, **sym({"arm.L": (0.15, -0.6, -0.8), "forearm.L": (0.12, -0.6, -0.8)})})
    up = dict(flat, rot=(-14, 0, 0), pose={"spine": (0, -0.15, 1), "chest": (0, -0.25, 1), "neck": (0, -0.2, 1),
                                          **sym({"arm.L": (0.15, -0.9, -0.4), "forearm.L": (0.12, -0.95, -0.25)})})
    return dict(keys=[flat, mid, up], view=(-20, 12))
def v_up():
    """Aus der gestreckten Rückenlage Oberkörper und gestreckte Beine gleichzeitig heben, Hände zu den Füßen."""
    over = sym({"arm.L": (0.12, 0, 1), "forearm.L": (0.12, 0, 1)})
    flat = lying(-90, {**over, **FLOOR_HEAD, **legs(0, 0, ankle=30)})
    v = lying(-55, {"spine": (0, -0.1, 1), "chest": (0, -0.2, 1), "neck": (0, -0.2, 1), **legs(78, 0, ankle=30),
                    **sym({"arm.L": (0.1, -0.72, -0.68), "forearm.L": (0.1, -0.72, -0.68)})})
    return dict(keys=[flat, v], timing="hold", view=(-20, 12))
def dead_bug():
    """Arme senkrecht, Hüfte und Knie 90°: linker Arm nach hinten und rechtes Bein gestreckt Richtung Boden."""
    up_arms = sym({"arm.L": (0.1, -1, 0.02), "forearm.L": (0.08, -1, 0.04)})
    base = lying(-90, {**FLOOR_HEAD, **up_arms, **legs(90, 90, ankle=15)})
    ext = dict(base, pose={**base["pose"], "arm.L": (0.1, -0.12, 1), "forearm.L": (0.08, -0.1, 1),
                           **mirror_legs(leg_angles(18, 0, ankle=20))})
    return dict(keys=[base, ext], timing="slow", view=(-25, 18))
def russian_twist():
    """Sitz mit zurückgelehntem Oberkörper, Füße am Boden: Oberkörper dreht, beide Hände zum Boden neben die Hüfte.
    Die Drehung kommt aus dem Rumpf, die Arme bleiben vor der Brust (arme="vorn")."""
    feet = bent_feet(-0.5, 0.12)
    def key(s):                                       # s = +1: zur linken Seite (+X), −1: zur rechten
        k = lying(-45, {"spine": (0, -0.12, 1), "chest": (0, -0.15, 1), "neck": (0, -0.55, 1), "head": (0, -0.6, 1), **legs(45, 0),
                      **sym({"arm.L": (0.1, -1, 0.2), "forearm.L": (0.1, -1, 0.2)})},
                  legs=feet, twist={"spine": s * 20, "chest": s * 34})   # Arme/Beine nur zum Aufsetzen nach vorn (sonst sitzt das Gesäß in der Luft)
        pose_key(k, limbs=False); H = pt("hip.L" if s >= 0 else "hip.R")   # Ziel an der gedrehten Figur: neben und vor der Hüfte
        h = lambda n, dx, dy, dz: dict(k=(H.x + s * (0.2 + dx), H.y - 0.12 + dy, 0.16 + dz), palm=(0, 0, -1), flex=10,
                                       hint=(0.6 if n == "L" else -0.6, 0.5, 0.2))   # Ellbogen bleibt auf seiner Seite (kein Umklappen)
        a, c = ("L", "R") if s > 0 else ("R", "L")
        k["hands"] = {a: h(a, 0, 0, 0), c: h(c, -0.08, -0.04, 0.12)}       # gegenüberliegende Hand liegt darüber
        if s == 0: k["hands"] = symh(dict(k=(0.06, -0.3, 0.4), palm=(0, 0, -1), flex=10, hint=(0.6, 0.5, 0.2)))   # Mitte: Hände vor dem Bauch
        return k
    return dict(keys=[key(1), key(0), key(-1)], view=(-60, 20), arme="vorn")
def flutter_kick():
    """Rückenlage, gestreckte Beine knapp über dem Boden abwechselnd klein auf und ab."""
    arms = {"wpose": sym({"arm.L": (0.2, -0.98, 0.0), "forearm.L": (0.18, -1, 0.0), "hand.L": (0.18, -1, 0.0)})}
    a = lying(-90, {**FLOOR_HEAD, **leg_angles(32, 0, ankle=30), **mirror_legs(leg_angles(12, 0, ankle=30))}, **arms)
    b = dict(a, pose={**FLOOR_HEAD, **leg_angles(12, 0, ankle=30), **mirror_legs(leg_angles(32, 0, ankle=30))})
    return dict(keys=[a, b], view=(-20, 14))
def superman():
    """Bauchlage, Arme gestreckt über dem Kopf: Arme, Brust und Beine gleichzeitig leicht anheben."""
    flat = lying(90, {"neck": (0, 0.12, 1), "head": (0, 0.12, 1), **sym({"arm.L": (0.15, 0, 1), "forearm.L": (0.12, 0, 1),
                  "hand.L": (0.1, 0, 1), "fingers.L": (0.1, 0, 1), "foot.L": (0, 0.1, -1)})})
    up = lying(90, {"spine": (0, 0.18, 1), "chest": (0, 0.32, 1), "neck": (0, 0.42, 1), "head": (0, 0.45, 1),
                    **sym({"arm.L": (0.15, 0.4, 1), "forearm.L": (0.12, 0.42, 1), "hand.L": (0.1, 0.42, 1), "fingers.L": (0.1, 0.42, 1),
                           "thigh.L": (0.03, 0.22, -1), "shin.L": (0, 0.25, -1), "foot.L": (0, 0.35, -1)})})
    return dict(keys=[flat, up], timing="hold", view=(-20, 14))
def glute_bridge():
    feet = bent_feet(-0.25, 0.13)
    return dict(keys=[supine_key(-92, feet), supine_key(-122, feet)], timing="hold", view=(-20, 14))

# Stand, Ausfallschritt, Springen: beide Füße immer als Ziel (sonst springt das Bein beim Wechsel der Vorgabe)
HANG_ARMS = sym({"arm.L": (0.12, 0.02, -1), "forearm.L": (0.06, -0.25, -1)})
def foot(x, y, z=0.085, fd=(0, -1, -0.42), hint=(0, -1, 0.1)):
    s = 1 if x > 0 else -1
    return dict(a=(x, y, z), hint=(hint[0] * s, hint[1], hint[2]), fdir=(fd[0] * s, fd[1], fd[2]))
TOES = (0, -0.62, -0.78)                          # auf dem Fußballen (Sprunggelenk auf TOE_Z)
TOE_Z = 0.16
BACK, BACK_Z = (0, -0.25, -0.97), 0.19             # hinterer Fuß im Ausfallschritt: Ferse hoch, Fuß fast senkrecht
def lunge_key(yl, yr, P, rot=3, arms=HANG_ARMS, zl=0.085, zr=0.085, fl=(0, -1, -0.42), fr=(0, -1, -0.42), hl=(0, -1, 0.1), hr=(0, -1, 0.1)):
    return dict(rot=(rot, 0, 0), pose=arms, place=("pin", "pelvis", P),
                legs={"L": foot(0.1, yl, zl, fl, hl), "R": foot(-0.1, yr, zr, fr, hr)})
def reverse_lunge():
    """Linkes Bein bleibt stehen, rechtes geht weit zurück: hinteres Knie Richtung Boden, vorderes Schienbein steil."""
    stand = lunge_key(0, 0, (0, 0.02, 0.89))
    low = lunge_key(0, 0.78, (0, 0.36, 0.52), zr=BACK_Z, fr=BACK, hr=(0, -1, -0.5))
    return dict(keys=[stand, low], view=(-15, 8))
def walking_lunge():
    """Großer Schritt nach vorn mit links, hinteres Knie Richtung Boden."""
    stand = lunge_key(0, 0, (0, 0.02, 0.89))
    low = lunge_key(-0.8, -0.02, (0, -0.44, 0.52), zr=BACK_Z, fr=BACK, hr=(0, -1, -0.5))
    return dict(keys=[stand, low], view=(-15, 8))
RUN_L = sym({"arm.L": (0.1, 0.45, -0.88), "forearm.L": (0.05, -0.55, -0.85)})          # linker Arm hinten …
RUN_ARMS = {**RUN_L, "arm.R": (-0.1, -0.45, -0.88), "forearm.R": (-0.05, -0.95, 0.25)}   # … rechter vorn (Ellbogen 90°)
def mirror_pose(d): return {(k[:-2] + (".R" if k.endswith(".L") else ".L") if k[-2:] in (".L", ".R") else k): mirror(v) for k, v in d.items()}
def split_jump():
    """Ausfallschritt links vorn → Sprung, Beine wechseln in der Luft → Ausfallschritt rechts vorn."""
    a = lunge_key(-0.4, 0.38, (0, 0.0, 0.52), arms=RUN_ARMS, zr=BACK_Z, fr=BACK, hr=(0, -1, -0.5))
    air = lunge_key(-0.05, 0.05, (0, 0.0, 1.08), arms=HANG_ARMS, zl=0.36, zr=0.36, fl=TOES, fr=TOES, hl=(0, -1, 0.3), hr=(0, -1, 0.3))
    b = lunge_key(0.38, -0.4, (0, 0.0, 0.52), arms=mirror_pose(RUN_ARMS), zl=BACK_Z, fl=BACK, hl=(0, -1, -0.5))
    return dict(keys=[a, air, b], view=(-15, 8))
def wall_sit():
    """Rücken an der Wand, Oberschenkel waagerecht, Knie über den Fersen."""
    feet = {"L": foot(0.15, -0.46), "R": foot(-0.15, -0.46)}
    up = dict(rot=(-2, 0, 0), pose=sym({"arm.L": (0.18, 0.05, -1), "forearm.L": (0.1, -0.3, -1)}), place=("pin", "pelvis", (0, 0, 0.74)), legs=feet)
    down = dict(up, place=("pin", "pelvis", (0, 0, 0.52)))
    pose_key(down); yb = mesh_np()[:, 1].max(); wall(yb + 0.004, 1)
    return dict(keys=[up, down], timing="hold", view=(-35, 8))
def step_up():
    """Linker Fuß auf der Box, über das linke Bein aufsteigen, oben strecken."""
    box((0, -0.32, 0.2), (0.55, 0.42, 0.4))
    low = lunge_key(-0.3, 0.1, (0, 0.06, 0.86), rot=14, zl=0.485)
    top = lunge_key(-0.3, 0.02, (0, -0.28, 1.26), rot=3, zl=0.485, zr=0.6, fr=(0, -0.5, -0.86), hr=(0, -1, -0.2))   # hinteres Bein löst sich nur
    return dict(keys=[low, top], view=(-30, 8))
def calf_raise():
    """Beide Fußballen auf der Stufenkante, Fersen tief unter die Stufe und hoch auf die Zehenspitzen."""
    box((0, -0.16, 0.075), (0.6, 0.3, 0.15))                            # Stufe vorn, Fersen hängen nach hinten frei
    E = Vector((0, -0.075, 0.17)); stand = sym({"thigh.L": (0.03, 0, -1), "shin.L": (0.03, 0, -1)})
    def key(fdir): return dict(pose={**stand, **HANG_ARMS}, wpose=sym({"foot.L": fdir}), place=("pin", "toe", E))
    return dict(keys=[key((0, -1, 0.35)), key((0, -0.45, -0.9))], timing="hold", view=(-15, 6))

# Stütz am Boden mit Stand/Hocke gemischt: Lage als pin auf dem Becken, Füße und Hände immer als Ziel
def as_targets(k):
    """Fertige Pose (z. B. Liegestütz auf den Zehen) so umschreiben, dass sie sich mit Stand und Hocke mischt."""
    pose_key(k); k = dict(k, place=("pin", "pelvis", tuple(pt("pelvis"))))
    front = rig.matrix_world.to_3x3() @ Vector((0, -1, 0)); lg = {}
    for n in "LR":
        H, K, A = pt(f"hip.{n}"), pt(f"knee.{n}"), pt(f"ankle.{n}")
        lg[n] = dict(a=tuple(A), hint=tuple((K - (H + A) / 2) + front * 0.05), fdir=tuple((pt(f"toe.{n}") - A).normalized()))
    k["legs"] = lg; return k
def plank_key(toe_y=0.75, pose=PUSH, toe_z=0.035):
    T = Vector((0, toe_y, toe_z)); k = dict(rot=(70, 0, 0), pose=pose, place=("pin", "toe", T)); pose_key(k, limbs=False)
    k = dict(k, hands=floor_hands(0.26, pt("shoulder").y)); solve(k, 0, 50, 90, m_arm(), STRAIGHT)
    return k
def side_hands(y=0.0, z=0.72): return symh(dict(k=(0.24, y + 0.02, z), hdir=(0.05, 0, -1), palm=(-0.3, 1, 0), flex=15, hint=(0.3, 0.6, 0)))
SIDE_HANDS = side_hands()
def squat_hands_key(hy, P):
    """Hocke mit Händen am Boden vor den Füßen."""
    k = dict(rot=(45, 0, 0), pose={"neck": (0, -0.3, 1)}, place=("pin", "pelvis", P), hands=floor_hands(0.24, hy),
             legs={"L": foot(0.15, hy + 0.45, TOE_Z, TOES), "R": foot(-0.15, hy + 0.45, TOE_Z, TOES)})
    solve(k, 0, 15, 80, m_arm(), 0.95); return k
def stand_at(y, hands=SIDE_HANDS, z=0.89, arms=None):
    k = dict(rot=(2, 0, 0), pose=arms or {}, place=("pin", "pelvis", (0, y + 0.02, z)), legs={"L": foot(0.13, y), "R": foot(-0.13, y)})
    if hands: k["hands"] = hands
    return k
def squat_thrust():
    """Stand → Hocke, Hände auf den Boden → Füße zurück in den Liegestütz (und zurück)."""
    pl = as_targets(plank_key()); hy = pl["hands"]["L"]["k"][1]
    sq = squat_hands_key(hy, (0, hy + 0.62, 0.5))
    st = stand_at(hy + 0.45, hands=side_hands(hy + 0.45))
    return dict(keys=[st, sq, pl], view=(-25, 10))
def burpee():
    """Strecksprung → Hocke → Liegestütz → Brust zum Boden (und zurück)."""
    ex = push_ex(); top, low = ex["keys"]; pl, lo = as_targets(top), as_targets(low)
    hy = pl["hands"]["L"]["k"][1]
    sq = squat_hands_key(hy, (0, hy + 0.62, 0.5))
    air = dict(rot=(2, 0, 0), pose={}, place=("pin", "pelvis", (0, hy + 0.47, 1.12)),
               legs={"L": foot(0.13, hy + 0.45, 0.32, TOES), "R": foot(-0.13, hy + 0.45, 0.32, TOES)},
               hands=side_hands(hy + 0.47, 0.98))   # Arme lang am Körper
    return dict(keys=[air, sq, pl, lo], view=(-25, 10), tempo=20)   # vier Phasen in 2 s
def mountain_climber():
    """Liegestütz oben, Knie abwechselnd zur Brust, Hüfte bleibt tief."""
    pl = as_targets(plank_key()); P = pt("pelvis"); lg = pl["legs"]
    def drawn(n):
        x = 0.11 if n == "L" else -0.11
        return dict(a=(x, P.y - 0.02, 0.22), hint=(0, -1, -0.4), fdir=(0, -0.45, -0.89))   # Knie unter der Brust, Fuß hinter dem Knie
    a = dict(pl, legs={"L": drawn("L"), "R": lg["R"]}); b = dict(pl, legs={"L": lg["L"], "R": drawn("R")})
    return dict(keys=[a, b], view=(-25, 10))
def bear_crawl():
    """Vierfüßler mit schwebenden Knien: diagonal Hand und Fuß kleine Schritte."""
    def key(d):
        k = dict(rot=(84, 0, 0), pose={"neck": (0, -0.2, 1), "head": (0, -0.3, 1)}, place=("pin", "pelvis", (0, 0, 0.56)),
                 legs={"L": foot(0.13, 0.42 + d, TOE_Z, TOES, (0, -1, -0.6)), "R": foot(-0.13, 0.42 - d, TOE_Z, TOES, (0, -1, -0.6))})
        pose_key(k, limbs=False); Sy = pt("shoulder").y
        k["hands"] = {"L": dict(floor_hands(0.24, Sy - d)["L"]), "R": dict(floor_hands(0.24, Sy + d)["R"])}
        solve(k, 0, 70, 100, m_arm(), 0.96); return k
    return dict(keys=[key(0.09), key(-0.09)], view=(-35, 12))
def inchworm():
    """Aus der Hüfte gebeugt, Hände am Boden → mit den Händen in den Liegestütz laufen (Füße bleiben)."""
    fold = dict(rot=(118, 0, 0), pose={"neck": (0, -0.2, 1)}, place=("pin", "pelvis", (0, 0.12, 0.8)),
                hands=floor_hands(0.2, -0.3), legs={"L": foot(0.13, 0), "R": foot(-0.13, 0)})
    solve(fold, 0, 95, 150, m_arm(), 0.97)
    pose_key(fold); T = pt("toe")
    pl = as_targets(plank_key(T.y, toe_z=0.05))                           # Zehen bleiben, die Füße rollen nur ab
    return dict(keys=[fold, pl], view=(-20, 10))
def skater_jump():
    """Seitlich auf das linke Bein springen, rechtes Bein kreuzt hinter dem Standbein; Arme schwingen mit."""
    def land(s):
        k = dict(rot=(22, 0, 0), pose=sym({"arm.L": (0.1, -0.6, -0.8), "forearm.L": (-0.3, -0.85, -0.4)}), place=("pin", "pelvis", (0.42 * s, 0.1, 0.66)))
        st, fr = foot(0.45 * s, 0.0), dict(a=(0.5 * s, 0.34, 0.22), hint=(0, -1, -0.4), fdir=(0, -0.4, -0.9))
        k["legs"] = {"L": st, "R": fr} if s > 0 else {"L": fr, "R": st}
        return k
    a = land(1); b = land(-1)
    air = dict(rot=(10, 0, 0), pose=HANG_ARMS, place=("pin", "pelvis", (0, 0.05, 0.98)), legs={"L": foot(0.12, 0.05, 0.3, TOES), "R": foot(-0.12, 0.05, 0.3, TOES)})
    return dict(keys=[a, air, b], view=(-75, 8))
def broad_jump():
    """Ausholen mit Armen hinten → Absprung schräg nach vorn → Flug mit angezogenen Beinen."""
    back = sym({"arm.L": (0.08, 0.6, -0.8), "forearm.L": (0.06, 0.55, -0.83)})
    load = dict(rot=(38, 0, 0), pose={**back, "neck": (0, -0.15, 1)}, place=("pin", "pelvis", (0, 0.26, 0.5)), legs=squat_feet())
    push = dict(rot=(28, 0, 0), pose=sym({"arm.L": (0.1, -0.8, 0.6), "forearm.L": (0.08, -0.75, 0.66)}), place=("pin", "pelvis", (0, -0.12, 0.88)),
                legs=squat_feet(0.16, (0, -0.55, -0.85), 0.13, 0.35))
    air = dict(rot=(20, 0, 0), pose=sym({"arm.L": (0.1, -0.95, 0.3), "forearm.L": (0.08, -0.9, 0.4)}), place=("pin", "pelvis", (0, -0.55, 1.05)),
               legs={"L": foot(0.14, -0.5, 0.5, (0, -0.8, -0.6), (0, -1, 0.5)), "R": foot(-0.14, -0.5, 0.5, (0, -0.8, -0.6), (0, -1, 0.5))})
    return dict(keys=[load, push, air], view=(-15, 8))
def tuck_jump():
    """Aus der Hocke hochspringen und die Knie zur Brust ziehen."""
    ex = jump_squat(); down, tall, air = ex["keys"]
    tuck = dict(air, rot=(8, 0, 0), pose={**sym({"arm.L": (0.12, -0.85, 0.1), "forearm.L": (0.02, -0.85, 0.5)}), "neck": (0, -0.1, 1)},
                place=("pin", "pelvis", (0, 0.02, 1.2)),
                legs={"L": foot(0.13, 0.0, 0.88, (0, -0.6, -0.8), (0, -1, 0.8)), "R": foot(-0.13, 0.0, 0.88, (0, -0.6, -0.8), (0, -1, 0.8))})
    return dict(ex, keys=[down, tall, tuck], view=(-20, 8), tempo=18)   # explosiv: Hocke → Streckung → Knie zur Brust in 1 s
def jumping_jack():
    """Im Sprung Beine grätschen und Arme seitlich über den Kopf (und zurück)."""
    def key(w, arm, z):
        return dict(rot=(0, 0, 0), pose=sym({"arm.L": arm, "forearm.L": arm}), place=("pin", "pelvis", (0, 0.02, z)),
                    legs={"L": foot(w, 0, 0.085 if z < 0.9 else 0.2, (0, -1, -0.42) if z < 0.9 else TOES, (0.2, -1, 0.1)),
                          "R": foot(-w, 0, 0.085 if z < 0.9 else 0.2, (0, -1, -0.42) if z < 0.9 else TOES, (0.2, -1, 0.1))})
    return dict(keys=[key(0.1, (0.12, 0, -1), 0.87), key(0.24, (1, 0, 0.05), 0.98), key(0.38, (0.3, 0, 1), 0.83)], view=(-80, 8))
def high_knees():
    """Laufen auf der Stelle: Knie bis Hüfthöhe, Arme schwingen gegengleich."""
    def key(s):
        up = dict(a=(0.1 * s, -0.42, 0.5), hint=(0, -1, 0.6), fdir=(0, -0.35, -0.94))
        sup = foot(-0.1 * s, 0.02, TOE_Z, TOES)
        arms = RUN_ARMS if s > 0 else mirror_pose(RUN_ARMS)
        return dict(rot=(4, 0, 0), pose=arms, place=("pin", "pelvis", (0, 0.04, 0.9)), legs={"L": up, "R": sup} if s > 0 else {"L": sup, "R": up})
    return dict(keys=[key(1), key(-1)], view=(-30, 8))

# ── Ab-Roller ───────────────────────────────────────────────────────────────
AB_R = 0.09                                         # Radius des Rads, Griffe auf Achshöhe
def ab_wheel():
    """Ab-Roller: Rad mit durchgehender Achse und zwei Griffen; rollt mit den Händen (Mitte der Knöchel) mit."""
    wheel = cyl((-0.035, 0, AB_R), (0.035, 0, AB_R), AB_R, RUBBER)
    hub = cyl((-0.045, 0, AB_R), (0.045, 0, AB_R), 0.03, STEEL)
    grips = [cyl((s * 0.07, 0, AB_R), (s * 0.18, 0, AB_R), 0.017, RUBBER, verts=24) for s in (1, -1)]
    axle = cyl((-0.07, 0, AB_R), (0.07, 0, AB_R), 0.011, STEEL, verts=16)
    parts = [wheel, hub, axle] + grips
    def upd():
        y = (pt("knuckle.L").y + pt("knuckle.R").y) / 2 + 0.024
        for o in parts: o.location.y = y
    DYN.append(upd)
def ab_hands(y):
    """Obergriff an den Griffen: Knöchel vorn-oben auf dem Griff, Handfläche zur Achse."""
    return symh(dict(k=(0.125, y - 0.024, AB_R + 0.022), palm=(0, 0.8, -0.6), curl=(0, 0.5, -1), bar=("x", 1), hint=(0.5, 0.5, 0.0)))
AB_REACH = 0.97                                     # Arme fast gestreckt (Anteil an Arm + Hand)
def ab_wheel_y(k):
    """Wo das Rad steht, damit die Arme aus der Schulterhöhe des Schlüssels gerade bis zum Griff reichen."""
    pose_key(k, limbs=False); S = pt("shoulder"); L = AB_REACH * (REACH + LEN["hand.L"])
    dz = S.z - (AB_R + 0.022); return S.y - math.sqrt(max(L * L - dz * dz, 0.0))
def ab_wheel_rollout():
    """Kniend: Hüfte etwas zurück, Arme senkrecht → ausrollen, bis Oberschenkel, Rumpf und Arme fast eine Linie sind."""
    box((0, 0.2, 0.025), (0.5, 0.75, 0.05), coll="polster"); ab_wheel()
    shins = sym({"shin.L": (0, 1, -0.02), "foot.L": (0, 1, -0.45)})
    hz = AB_R + 0.022; L = AB_REACH * (REACH + LEN["hand.L"])
    def key(lean, thigh):
        return dict(rot=(lean, 0, 0), pose={"neck": (0, -0.2, 1), "head": (0, -0.3, 1), "spine": (0, -0.08, 1)},
                    wpose={**shins, **sym({"thigh.L": thigh})}, place=("pin", "knee", (0, 0, 0.12)))
    k0 = key(50, (0.02, -0.25, -1)); solve(k0, 0, 20, 85, lambda k: pt("shoulder").z, hz + L)   # Arme senkrecht unter den Schultern
    k1 = key(71, (0.02, 0.88, -0.48))                                                         # fast gestreckt, Becken eingerollt
    for k in (k0, k1): k["hands"] = ab_hands(ab_wheel_y(k))
    return dict(keys=[k0, k1], timing="slow", view=(-15, 10))
def ab_wheel_rollout_standing():
    """Stehend mit gestreckten Beinen: aus der tiefen Vorbeuge ausrollen, bis der Körper fast parallel zum Boden ist."""
    ab_wheel()
    fold = dict(rot=(120, 0, 0), pose={"neck": (0, -0.2, 1)}, place=("pin", "pelvis", (0, 0.12, 0.8)),
                legs={"L": foot(0.12, 0), "R": foot(-0.12, 0)})
    fold["hands"] = ab_hands(-0.32); solve(fold, 0, 95, 150, m_arm(), 0.97)
    pose_key(fold); T = pt("toe")
    ext = dict(rot=(76, 0, 0), pose={**PUSH, "spine": (0, -0.05, 1)}, place=("pin", "toe", (0, T.y, 0.065)))   # auf den Zehen (etwas höher: beim Abrollen sinkt der Fuß sonst ein)
    ext["hands"] = ab_hands(ab_wheel_y(ext))
    return dict(keys=[fold, as_targets(ext)], view=(-15, 10))

# ── Pull-Through auf Parallettes ────────────────────────────────────────────
def pull_through(straight):
    """Stütz mit Füßen hinten am Boden → Hüfte hoch → Beine zwischen den Händen nach vorn → Tuck-Sit bzw. L-Sit.
    Alle Schlüssel an der Schulter verankert (sie bleibt über den Händen), Beine über Gelenkwinkel."""
    h = 0.3 if straight else 0.17                         # gestreckt: hohe Parallettes, sonst passen die Beine nicht durch
    parallettes(0.25, 0.0, h); hands = pbar_grip(h, 0.25, (0.2, 1, 0))
    def at_shoulder(k): pose_key(k, limbs=False); k["place"] = ("pin", "shoulder", tuple(pt("shoulder"))); return k
    pl = dict(rot=(72, 0, 0), pose=PUSH, place=("pin", "toe", (0, 0.9, 0.035)), hands=hands)
    for _ in range(3):                                    # Füße hinten am Boden, Schultern über den Händen, Arme gestreckt
        pose_key(pl, limbs=False); T = pl["place"][2]
        pl["place"] = ("pin", "toe", (0, T[1] - pt("shoulder").y, 0.035)); solve(pl, 0, 35, 89, m_arm(), STRAIGHT)
    pl = at_shoulder(pl)
    end = dict(rot=(0, 0, 0), pose=LSIT if straight else {**LSIT, **TUCK_SIT}, place=("pin", "hip", (0, 0.03, 0.4)), hands=hands)
    solve(end, set_place(2, 2), 0.2, 1.3, m_arm(), STRAIGHT); end = at_shoulder(end)
    S = (0, -0.06, h + 0.1 + 0.97 * REACH)                # Schultern etwas vor den Händen, Arme gestreckt
    lean = {"spine": (0, -0.3, 1), "chest": (0, -0.15, 1), "neck": (0, -0.3, 1), "head": (0, -0.45, 1)}
    # Erst die Hüfte hoch (Füße lösen sich hinten vom Boden), dann die Beine durchziehen – sonst schwingen sie durch den Boden
    if straight:
        up = dict(rot=(88, 0, 0), pose={**lean, **legs(50, 0, ankle=40)}, place=("pin", "shoulder", S), hands=hands)
        comp = dict(rot=(100, 0, 0), pose={**lean, **legs(148, 0, ankle=40)}, place=("pin", "shoulder", S), hands=hands)
    else:
        up = dict(rot=(78, 0, 0), pose={**lean, **legs(60, 95, ankle=40)}, place=("pin", "shoulder", S), hands=hands)
        comp = dict(rot=(85, 0, 0), pose={**lean, **legs(135, 150, ankle=40)}, place=("pin", "shoulder", S), hands=hands)
    return dict(keys=[pl, up, comp, end], timing=(0.4, 0.2, 0.4), view=(-20, 10))
def tuck_pull_through(): return pull_through(False)
def l_sit_pull_through(): return pull_through(True)

NEW_EXERCISES = {
    "ring-support-hold": ring_support_hold, "rto-support-hold": rto_support_hold, "ring-dip": ring_dip, "rto-dip": rto_dip,
    "tuck-l-sit": tuck_l_sit, "one-leg-l-sit": one_leg_l_sit, "wall-walk": wall_walk, "wall-shoulder-tap": wall_shoulder_tap,
    "handstand-kick-up": handstand_kick_up, "wall-hspu-negative": wall_hspu_negative, "jumping-muscle-up": jumping_muscle_up,
    "tuck-planche-push-up": tuck_planche_push_up, "tuck-front-lever-raise": tuck_front_lever_raise, "ice-cream-maker": ice_cream_maker,
    "scapula-push-up": scapula_push_up, "wrist-prep": wrist_prep, "wrist-push-up": wrist_push_up, "band-dislocate": band_dislocate,
    "band-external-rotation": band_external_rotation, "face-pull": face_pull, "single-leg-glute-bridge": single_leg_glute_bridge,
    "single-leg-rdl": single_leg_rdl, "sliding-leg-curl": sliding_leg_curl, "kneeling-rollout": kneeling_rollout, "ring-rollout": ring_rollout,
    "pallof-press": pallof_press, "copenhagen-plank": copenhagen_plank, "pull-up-negative": pull_up_negative,
    "band-pull-up": band_pull_up, "bar-support-hold": bar_support_hold, "dip-negative": dip_negative,
    "incline-push-up": incline_push_up, "push-up": push_up, "cossack-squat": cossack_squat, "sissy-squat": sissy_squat,
    "dragon-pistol": dragon_pistol, "tibialis-raise": tibialis_raise, "spanish-squat": spanish_squat,
    "reverse-nordic": reverse_nordic, "one-arm-hang": one_arm_hang, "table-row": table_row,
    "korean-dip-negative": korean_dip_negative, "korean-dip": korean_dip, "tuck-side-lever": tuck_side_lever, "side-lever": side_lever,
    "air-squat": air_squat, "jump-squat": jump_squat,
    "tuck-pull-through": tuck_pull_through, "l-sit-pull-through": l_sit_pull_through,
    "ab-wheel-rollout": ab_wheel_rollout, "ab-wheel-rollout-standing": ab_wheel_rollout_standing,
    "chin-up": chin_up, "wide-push-up": wide_push_up, "diamond-push-up": diamond_push_up, "clap-push-up": clap_push_up, "bench-dip": bench_dip, "front-plank": front_plank, "crunch": crunch, "reverse-crunch": reverse_crunch, "sit-up": sit_up, "v-up": v_up, "dead-bug": dead_bug, "russian-twist": russian_twist, "flutter-kick": flutter_kick, "superman": superman, "reverse-lunge": reverse_lunge, "walking-lunge": walking_lunge, "split-jump": split_jump, "glute-bridge": glute_bridge, "wall-sit": wall_sit, "step-up": step_up, "calf-raise": calf_raise, "squat-thrust": squat_thrust, "burpee": burpee, "mountain-climber": mountain_climber, "jumping-jack": jumping_jack, "high-knees": high_knees, "bear-crawl": bear_crawl, "inchworm": inchworm, "skater-jump": skater_jump, "broad-jump": broad_jump, "tuck-jump": tuck_jump,
}

EXERCISES = {
    "v-sit-parallettes": v_sit_parallettes, "v-sit-floor": v_sit_floor, "tuck-manna": tuck_manna,
    "pike-compression": pike_compression, "elevated-pike-press": elevated_pike_press,
    "wall-straddle-press": wall_straddle_press, "straddle-press": straddle_press,
    "vertical-flag": vertical_flag, "tuck-flag": tuck_flag, "straddle-flag": straddle_flag, "human-flag": human_flag,
    "false-grip-hang": false_grip_hang, "false-grip-pull-up": false_grip_pull_up, "ring-transition": ring_transition,
    "ring-muscle-up": ring_muscle_up, "adv-tuck-planche": adv_tuck_planche, "straddle-planche": straddle_planche,
    "full-planche": full_planche, "one-arm-negative": one_arm_negative, "one-arm-pull-up-assisted": one_arm_pull_up_assisted,
    "one-arm-pull-up": one_arm_pull_up, "deficit-wall-hspu": deficit_wall_hspu,
    "freestanding-hspu-negative": freestanding_hspu_negative, "freestanding-hspu": freestanding_hspu,
    "dragon-flag-tuck-negative": dragon_flag_tuck_negative, "dragon-flag-negative": dragon_flag_negative,
    "dragon-flag": dragon_flag, "crow-pose": crow_pose, "elbow-lever": elbow_lever, "one-arm-elbow-lever": one_arm_elbow_lever,
    "archer-push-up": archer_push_up, "one-arm-push-up-elevated": one_arm_push_up_elevated, "one-arm-push-up": one_arm_push_up,
    "shrimp-squat-assisted": shrimp_squat_assisted, "shrimp-squat": shrimp_squat, "shrimp-squat-advanced": shrimp_squat_advanced,
    "tuck-front-lever": tuck_front_lever, "adv-tuck-front-lever": adv_tuck_front_lever,
    "one-leg-front-lever": one_leg_front_lever, "straddle-front-lever": straddle_front_lever, "front-lever": front_lever,
    "german-hang": german_hang, "skin-the-cat": skin_the_cat, "tuck-back-lever": tuck_back_lever,
    "adv-tuck-back-lever": adv_tuck_back_lever, "straddle-back-lever": straddle_back_lever, "back-lever": back_lever,
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
    **NEW_EXERCISES,
}
