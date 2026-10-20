"""Lever – Übungsclips und Körperkarte aus den Human Base Meshes (Blender Foundation, CC0).

  art/vendor/Blender.app/Contents/MacOS/Blender -b \
    art/vendor/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend \
    --python art/blender/lever.py -- <modus> <übung|lasten> <ausgabeordner>

  modus: still (jede Schlüsselpose ein Bild) | clip (48 Bilder) | check (ohne Rendern: Durchdringung,
         Bodenkontakt, Reichweite, Sprung/Kippen je Bild) | heat (Körperkarte, „region=0..1,…“)
  Übungen: art/blender/moves.py

Grundlage: „realistic body male“ (Multires, 3 Stufen). Das Skript macht ihn athletischer
(Schultern, Arme, Brust, Rücken breiter, Taille schmaler), baut ein einfaches Skelett mit
Gelenkpunkten aus Querschnitten des Modells, bindet den Körper per automatischer Gewichtung
und posiert über Gelenkwinkel in Weltachsen. Figur blickt nach -Y, +X = ihre linke Seite.
"""
import bpy, math, os, sys
from mathutils import Matrix, Quaternion, Vector
from mathutils.geometry import intersect_point_line

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["still", "pistol", "/tmp/lever"]
MODE, ARG, OUT = args[0], args[1], args[2]
os.makedirs(OUT, exist_ok=True)
scene = bpy.context.scene

# ── Körper isolieren ────────────────────────────────────────────────────────
body = bpy.data.objects["GEO-body_male_realistic"]
eyes = [o for o in body.children if o.type == "MESH"]
keep = {body, *eyes}
for o in list(bpy.data.objects):
    if o not in keep: bpy.data.objects.remove(o, do_unlink=True)
for o in keep:
    if o.name not in scene.collection.all_objects: scene.collection.objects.link(o)
t = body.matrix_world.translation.copy()
body.location -= Vector((t.x, t.y, 0))
bpy.context.view_layer.update()
for m in body.modifiers:
    if m.type == "MULTIRES": m.render_levels = m.levels = int(os.environ.get("LEVER_SUBDIV", m.total_levels))

# ── Gelenke (aus Querschnitten des Modells, linke Seite; rechts gespiegelt) ──
J = {
    "pelvis": (0, 0.0, 0.93), "spine": (0, 0.0, 1.05), "chest": (0, 0.0, 1.22), "neck": (0, -0.01, 1.43),
    "head": (0, -0.03, 1.53), "head_top": (0, -0.03, 1.69),
    "clav": (0.02, -0.02, 1.42), "shoulder": (0.18, 0.0, 1.38), "elbow": (0.30, -0.01, 1.07),
    "wrist": (0.372, -0.066, 0.837), "knuckle": (0.395, -0.085, 0.78), "hand_tip": (0.42, -0.11, 0.71),
    "hip": (0.095, -0.01, 0.90), "knee": (0.13, 0.01, 0.47), "ankle": (0.17, 0.05, 0.09), "toe": (0.19, -0.10, 0.02),
}
def j(name, side=1):
    x, y, z = J[name]
    return Vector((x * side, y, z))

# ── Athletischer machen: radial um Knochenachsen aufpumpen, Taille schmaler ──
# Koordinaten hier lokal am Körper (Ursprung am Boden zwischen den Füßen)
def inflate(a, b, radius, factor, side_filter=None):
    """Punkte nahe der Strecke a–b vom Achsenpunkt wegschieben (weicher Abfall bis `radius`)."""
    for v in body.data.vertices:
        p = v.co.copy()
        if side_filter and not side_filter(p): continue
        q, f = intersect_point_line(p, a, b)
        if not 0.0 <= f <= 1.0: continue
        d = (p - q).length
        if d > radius or d < 1e-6: continue
        w = (1 - d / radius) ** 0.5 * math.sin(math.pi * min(max(f, 0.05), 0.95))
        v.co = q + (p - q) * (1 + (factor - 1) * w)

for s in (1, -1):
    side = (lambda p, s=s: p.x * s > 0.02)
    inflate(j("shoulder", s) + Vector((0, 0, 0.03)), j("elbow", s), 0.085, 1.16, side)   # Bizeps/Trizeps, Delta
    inflate(j("elbow", s), j("wrist", s), 0.065, 1.08, side)                              # Unterarm
    inflate(j("clav", s), j("shoulder", s) + Vector((0.03 * s, 0, 0)), 0.11, 1.10, side)  # Schulterkappe
    inflate(j("hip", s), j("knee", s), 0.11, 1.05, side)                                  # Oberschenkel
    inflate(j("knee", s) - Vector((0, 0, 0.05)), j("ankle", s), 0.075, 1.05, side)        # Wade
inflate(Vector((0, 0, 1.43)), Vector((0, 0, 1.53)), 0.08, 1.07)                            # Nacken/Trapez
for v in body.data.vertices:
    p = v.co
    torso = abs(p.x) < 0.2 and 0.95 < p.z < 1.45 and not (abs(p.x) > 0.16 and p.z < 1.2)
    if not torso: continue
    up = min(max((p.z - 1.0) / 0.35, 0), 1)
    p.x *= 0.965 + 0.085 * up                     # V-Form: oben breiter, Taille schmaler
    if p.y < -0.04 and 1.22 < p.z < 1.38 and abs(p.x) < 0.16:
        p.y -= 0.012 * math.sin(math.pi * (p.z - 1.22) / 0.16)   # Brust etwas voller
body.data.update()

# ── Skelett ─────────────────────────────────────────────────────────────────
arm_data = bpy.data.armatures.new("rig"); rig = bpy.data.objects.new("rig", arm_data)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
def bone(name, head, tail, parent=None):
    b = arm_data.edit_bones.new(name); b.head, b.tail = head, tail
    if parent: b.parent = arm_data.edit_bones[parent]; b.use_connect = False
bone("pelvis", j("pelvis"), j("spine")); bone("spine", j("spine"), j("chest"), "pelvis")
bone("chest", j("chest"), j("neck"), "spine"); bone("neck", j("neck"), j("head"), "chest")
bone("head", j("head"), j("head_top"), "neck")
for s, n in ((1, "L"), (-1, "R")):
    bone(f"clavicle.{n}", j("clav", s), j("shoulder", s), "chest")
    bone(f"arm.{n}", j("shoulder", s), j("elbow", s), f"clavicle.{n}")
    bone(f"forearm.{n}", j("elbow", s), j("wrist", s), f"arm.{n}")
    bone(f"hand.{n}", j("wrist", s), j("knuckle", s), f"forearm.{n}")
    bone(f"fingers.{n}", j("knuckle", s), j("hand_tip", s), f"hand.{n}")
    bone(f"thigh.{n}", j("hip", s), j("knee", s), "pelvis")
    bone(f"shin.{n}", j("knee", s), j("ankle", s), f"thigh.{n}")
    bone(f"foot.{n}", j("ankle", s), j("toe", s), f"shin.{n}")
bpy.ops.object.mode_set(mode="OBJECT")

bpy.ops.object.select_all(action="DESELECT")
body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
print("WEIGHTS", len(body.vertex_groups), [m.type for m in body.modifiers])
for e in eyes:
    mw = e.matrix_world.copy(); e.parent = rig; e.parent_type = "BONE"; e.parent_bone = "head"
    bpy.context.view_layer.update(); e.matrix_world = mw

# ── Look ────────────────────────────────────────────────────────────────────
def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)
def material(name, color, rough=0.45, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color; b.inputs["Roughness"].default_value = rough
    if emit: b.inputs["Emission Color"].default_value = color; b.inputs["Emission Strength"].default_value = emit
    return m
def paint(o, m): o.data.materials.clear(); o.data.materials.append(m)
STONE = material("stone", srgb("#b4afa5"))
for o in keep: paint(o, STONE)

world = bpy.data.worlds.new("bg"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = srgb("#202020")
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.12
bpy.ops.mesh.primitive_plane_add(size=20); bpy.context.object.is_shadow_catcher = True

light_target = bpy.data.objects.new("light_target", None); scene.collection.objects.link(light_target)
light_target.location = (0, 0, 0.8)
def light(name, loc, energy, color=(1, 1, 1), size=1.0):
    d = bpy.data.lights.new(name, "AREA"); d.energy = energy; d.color = color; d.size = size
    o = bpy.data.objects.new(name, d); o.location = loc; scene.collection.objects.link(o)
    c = o.constraints.new("TRACK_TO"); c.target = light_target; c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
light("key", (3.4, -0.6, 2.7), 520, size=0.7)
light("fill", (-2.5, -3.0, 1.2), 16, size=3)
light("rim", (-2.2, 2.2, 2.4), 280, color=srgb("#d4ff3a")[:3], size=0.6)
LIGHT_BASE = {o.name: o.location.copy() for o in scene.objects if o.type == "LIGHT"}
AZ0 = math.degrees(math.atan2(-4.6, 3.4))   # Blickrichtung (Grad), für die das Licht eingerichtet ist; dreht mit der Kamera

cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 60
cam = bpy.data.objects.new("cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
target = bpy.data.objects.new("cam_target", None); scene.collection.objects.link(target)
c = cam.constraints.new("TRACK_TO"); c.target = target; c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"

scene.render.engine = "CYCLES"; scene.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences; prefs.compute_device_type = "METAL"; prefs.get_devices()
for d in prefs.devices: d.use = True
scene.cycles.samples, scene.cycles.use_denoising, scene.cycles.max_bounces = 40, True, 4
scene.render.use_persistent_data = True
scene.render.film_transparent = True
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"

# ── Posen-Werkzeuge ─────────────────────────────────────────────────────────
# Eine Pose = Wurzel-Drehung des Skeletts (rot) + Knochenrichtungen im Körperraum (pose, wie im Stand)
# + Platzierung (place) + Hände/Beine per IK an Weltpunkte. Schlüsselposen werden pro Bild gemischt.
import numpy as np
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
PB = rig.pose.bones
for m in body.modifiers:
    if m.type == "MULTIRES": m.levels = 0      # Abfragen (Boden, Kollision, Bildausschnitt) am Grundnetz; Render voll
def upd(): bpy.context.view_layer.update()
def reset(rot=(0, 0, 0)):
    for pb in PB: pb.matrix_basis = Matrix()
    rig.rotation_mode = "XYZ"; rig.rotation_euler = [math.radians(a) for a in rot]; rig.location = (0, 0, 0)
    upd()
def world(p): return rig.matrix_world @ p
def to_pose(d): return rig.matrix_world.to_3x3().inverted() @ Vector(d)
def rot(b, axis, deg):
    """Alte Pistol-Posen: Knochen um Weltachse drehen (nur ohne Wurzel-Drehung)."""
    pb = PB[b]; h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-h) @ pb.matrix
    upd()
FLEXSIGN = {f"{b}.{n}" for b in ("shin", "forearm") for n in "LR"}   # Scharnier-Ketten (Knie, Ellbogen)
HINGE = {}            # Scharniergelenke: Beugeachse im Knochenraum (gefüllt nach dem Skelettbau)
def aim(b, d, local=False, hinge=None, prefer=None):
    """Knochen um seinen Kopf drehen, bis er in Richtung d zeigt (Welt, oder Körperraum mit local).
    Scharniere (Knie, Sprunggelenk, Ellbogen) beugen zuerst um ihre Achse – sonst kippt die Drehung
    um die Knochenachse, sobald die kürzeste Drehung nahe 180° liegt."""
    pb = PB[b]; h = pb.head.copy(); cur = (pb.tail - pb.head).normalized()
    d = (Vector(d) if local else to_pose(d)).normalized()
    if hinge is not None or b in HINGE:
        ax = to_pose(hinge).normalized() if hinge is not None else (pb.matrix.to_3x3() @ HINGE[b]).normalized()
        c1 = cur - ax * cur.dot(ax); t1 = d - ax * d.dot(ax)
        if c1.length > 1e-4 and t1.length > 1e-4:
            ang = math.atan2(ax.dot(c1.cross(t1)), c1.dot(t1))
            if prefer is not None:         # Beugerichtung bevorzugen: höchstens ~100° Streckung, sonst der lange Weg
                sg = 1 if ax.dot(cur.cross(to_pose(prefer))) >= 0 else -1
                if ang * sg < -math.radians(100): ang += sg * 2 * math.pi
            pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(ang, 4, ax) @ Matrix.Translation(-h) @ pb.matrix
            upd(); cur = (pb.tail - pb.head).normalized()
    q = cur.rotation_difference(d)
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
    upd()
def V(*a): return Vector(a).normalized()
def smooth(x):
    """Weiche Rampe 0 → 1 (smoothstep): ohne Knick, an dem eine Gewichtung schlagartig anspringt."""
    x = min(max(x, 0.0), 1.0); return x * x * (3 - 2 * x)
def slerp_dir(a, b, u):
    """Richtung sphärisch mischen (gleichmäßige Winkelgeschwindigkeit, Länge linear). Lineares Mischen fast
    entgegengesetzter Richtungen läuft durch einen sehr kurzen Vektor – dort springt die Richtung."""
    a, b = Vector(a), Vector(b); la, lb = a.length, b.length
    if la < 1e-9 or lb < 1e-9: return a.lerp(b, u)
    an, bn = a / la, b / lb; th = an.angle(bn)
    if th < 1e-4 or th > math.pi - 1e-3: return a.lerp(b, u)
    return (an * math.sin((1 - u) * th) + bn * math.sin(u * th)) / math.sin(th) * (la + (lb - la) * u)
def mirror(v): return (-v[0], v[1], v[2])
def sym(d):
    """Pose für die linke Seite angeben, rechte gespiegelt (x negiert)."""
    out = dict(d)
    for k, v in d.items():
        if k.endswith(".L"): out[k[:-2] + ".R"] = mirror(v)
    return out
def symh(spec, **right):
    """Hand-/Bein-Vorgabe links, rechts gespiegelt; right= überschreibt Einzelwerte rechts."""
    r = {k: (mirror(v) if isinstance(v, (tuple, list, Vector)) and len(v) == 3 else v) for k, v in spec.items()}
    r.update(right); return {"L": spec, "R": r}

ORDER = (["pelvis", "spine", "chest", "neck", "head"]
         + [f"{b}.{n}" for b in ("clavicle", "arm", "forearm", "hand", "fingers", "thigh", "shin", "foot") for n in "LR"])
reset()
REST = {b: (PB[b].tail - PB[b].head).normalized() for b in ORDER}
ORDER_ALL = ORDER[:5] + [f"{b}.{n}" for b in ("clavicle", "arm", "forearm", "hand", "fingers", "thigh", "shin", "foot") for n in "LR"]
LEN = {b: (pb.tail - pb.head).length for b, pb in PB.items()}
REACH = LEN["arm.L"] + LEN["forearm.L"]
STRAIGHT = 0.985
OVER = [0.0]          # größte Überdehnung eines IK-Ziels (Hand/Fuß erreicht ihr Ziel nicht) im Bild
# gelenk: Grad über der Gelenkgrenze · sprung: Grad je Bild (Sprung und Kippen) · griff, selbst, eindringen, auflage: m
# symmetrie: Grad links ↔ rechts
RULES = dict(gelenk=25, sprung=15, griff=0.03, selbst=0.05, symmetrie=8, eindringen=0.03, auflage=0.045, schulter=15, glieder=0.02)
RAW = []              # Gelenkverstöße der Rohpose im zuletzt gesetzten Bild (vor dem Begrenzen)
HINGE_OUT = {}        # Scharnierachsen (Körperraum) der zuletzt gesetzten Pose, je Unterarm/Unterschenkel

def align_hinge(up, lo, a, t, fallback, follow=True):
    """Oberarm/Oberschenkel um seine Achse a drehen, bis die Scharnierachse von Ellbogen/Knie auf der Beugeebene
    (a, t) senkrecht steht. Ist das Glied fast gestreckt, legt fallback (gewünschte Scharnierachse) die Drehung
    fest – sonst wäre sie bei Armen über Kopf oder Beinen nach oben unbestimmt und klappte um 180° um.
    follow=False: Achse = fallback, unabhängig von t. Gibt die gesetzte Achse zurück (Welt, senkrecht zu a)."""
    pu = PB[up]; R = rig.matrix_world.to_3x3() @ pu.matrix.to_3x3() @ pu.bone.matrix_local.to_3x3().inverted()
    c = a.cross(t); fb = Vector(fallback).normalized(); fb = fb - a * fb.dot(a)
    if fb.length < 1e-4: fb = c.copy()
    fb.normalize()
    # Gewicht der tatsächlichen Beugeebene: wächst mit der Beugung und nur, solange sie zur Wunschrichtung passt.
    # Überstrecken (c gegen fb) wird nie durch 180°-Verdrehen „geheilt“ – so hing einmal ein Bein falsch herum.
    # Die Richtung von c ist bei fast gestrecktem Glied beliebig: zwischen zwei Schlüsseln gilt deshalb nicht dieses
    # Gewicht, sondern die gemischte Achse der Schlüssel (pose_key, follow=False).
    cn = c.normalized() if c.length > 1e-6 else fb
    wgt = min(max((c.length - 0.05) / 0.2, 0), 1) * min(max(cn.dot(fb) / 0.3, 0), 1) if follow else 0.0
    want = cn * wgt + fb * (1 - wgt)
    cur = R @ flex_axis_rest(lo)
    cur, want = cur - a * cur.dot(a), want - a * want.dot(a)
    if cur.length < 1e-4 or want.length < 1e-4: return fb
    ang = math.atan2(a.dot(cur.cross(want)), cur.dot(want)); ap = to_pose(a); hd = pu.head.copy()
    pu.matrix = Matrix.Translation(hd) @ Matrix.Rotation(ang, 4, ap) @ Matrix.Translation(-hd) @ pu.matrix
    upd()
    return want.normalized()
def two_bone(up, lo, target, hint):
    """Analytische 2-Knochen-IK: Mittelgelenk in der Ebene zur Hinweisrichtung."""
    S = world(PB[up].head); a, b = LEN[up], LEN[lo]
    D = target - S; OVER[0] = max(OVER[0], D.length - (a + b))
    d = min(max(D.length, abs(a - b) + 1e-3), a + b - 1e-4); u = D.normalized()
    x = (a * a - b * b + d * d) / (2 * d); y = math.sqrt(max(a * a - x * x, 0))
    h = Vector(hint); w = (h - u * h.dot(u)).normalized()
    E = S + u * x + w * y
    aim(up, E - S)
    if lo in FLEXSIGN:
        PB[lo].matrix_basis = Matrix(); upd()                       # Unterschenkel/-arm neu aus der Ruhelage beugen
        align_hinge(up, lo, (E - S).normalized(), (target - E).normalized(), -u.cross(w))
    aim(lo, target - E)
def spin(b, rest_n, want):
    """Knochen b um seine Achse drehen, bis die Normale rest_n (Ruhelage, mit b mitgedreht) Richtung want zeigt.
    Bezug ist die Lage von b selbst (nicht die eines Kindknochens), und liegt want fast auf der Achse, ist die
    Drehung unbestimmt: dann stetig weniger drehen statt einer zufälligen Seite zu folgen."""
    pb = PB[b]; axis = (pb.tail - pb.head).normalized()
    n = (pb.matrix.to_3x3() @ pb.bone.matrix_local.to_3x3().inverted()) @ Vector(rest_n)
    w = to_pose(want).normalized(); n = n - axis * n.dot(axis); w = w - axis * w.dot(axis)
    if n.length < 1e-6 or w.length < 1e-6: return
    ang = math.atan2(axis.dot(n.cross(w)), n.dot(w)) * smooth((w.length - 0.1) / 0.25); h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(ang, 4, axis) @ Matrix.Translation(-h) @ pb.matrix
    upd()
PALM = {"L": (-1, 0, 0), "R": (1, 0, 0)}     # Handflächen-Normale in Ruhelage (zum Oberschenkel)
def hand(n, s):
    """Hand an Weltpunkt: k = Fingerknöchel, hdir = Richtung Handgelenk→Knöchel (sonst Verlängerung
    Schulter→Knöchel, wie beim Hängen), palm = Handflächen-Normale, curl/flex = Finger, hint = Ellbogen.
    Die Gelenkgrenzen gelten schon hier: Unterarm-Drehung wird begrenzt, und kann das Handgelenk die verlangte
    Richtung nicht erreichen, kippt die Hand Richtung Unterarm (Knöchel bleiben am Ziel, das Handgelenk wandert)."""
    K = Vector(s["k"]() if callable(s["k"]) else s["k"]); S = world(PB[f"arm.{n}"].head); u = (K - S).normalized()   # k darf mitwandern (Fuß halten)
    lim = JLIM["hand"]; fa = PB[f"forearm.{n}"]
    for _ in range(3):                         # Griff ohne Vorgabe: Handgelenk möglichst gerade (Hand verlängert Unterarm)
        two_bone(f"arm.{n}", f"forearm.{n}", K - u * LEN[f"hand.{n}"], s["hint"])
        u = (K - world(fa.head)).normalized()
    if s.get("hdir") is not None:              # Vorgabe stetig einblenden (hw: Übergang Hängen → Stütz)
        u = slerp_dir(u, Vector(s["hdir"]).normalized(), min(max(s.get("hw", 1.0), 0.0), 1.0)).normalized()
    for it in range(1):
        W = K - u * LEN[f"hand.{n}"]
        two_bone(f"arm.{n}", f"forearm.{n}", W, s["hint"])
        # Unterarm-Drehung: die gewünschte Handflächen-Normale um dieselbe Drehung zurückführen, die die Hand aus
        # der Unterarm-Verlängerung in ihre Richtung u bringt (eindeutig, auch bei Handfläche entlang des Unterarms).
        ax = rig.matrix_world.to_3x3() @ (fa.tail - fa.head).normalized()
        th0 = math.degrees(ax.angle(u))
        if th0 > 78:                           # mehr als ~80° Knick (beide Richtungen) vorab begrenzen; stetig
            u = slerp_dir(ax, u, 78 / th0).normalized(); W = K - u * LEN[f"hand.{n}"]
            two_bone(f"arm.{n}", f"forearm.{n}", W, s["hint"]); ax = rig.matrix_world.to_3x3() @ (fa.tail - fa.head).normalized()
        if s.get("bar"):                       # Griff um eine Stange: sie liegt quer in der Hand → Handfläche = ±Achse × Hand
            axs, sg = s["bar"]; A = {"x": X, "y": Y, "z": Z}[axs]
            if n == "R" and axs != "x": sg = -sg       # gespiegelt (Handfläche ist ein gewöhnlicher Vektor)
            pw0 = A.cross(u) * sg
            # Hand fast parallel zur Stange (gestreckter Arm beim weiten Griff): die Richtung des Kreuzprodukts dreht
            # dann schnell – stetig zur angegebenen Handfläche überblenden statt ihr zu folgen
            ps = Vector(s.get("palm", (0, -1, 0))); ps = ps - u * ps.dot(u)
            if ps.length < 1e-4: ps = pw0
            pw0 = slerp_dir(ps.normalized(), pw0.normalized() if pw0.length > 1e-6 else ps.normalized(),
                            smooth((pw0.length - 0.1) / 0.35)).normalized()
        else: pw0 = Vector(s.get("palm", (0, -1, 0))).normalized()
        pw = pw0 - u * pw0.dot(u)
        cur_p = palm_normal(n); cur_p = (cur_p - u * cur_p.dot(u)).normalized()
        # Liegt die gewünschte Handfläche fast entlang der Hand, ist sie unbestimmt: dann stetig die aktuelle behalten
        pw = slerp_dir(cur_p, pw.normalized(), min(max((pw.length - 0.05) / 0.25, 0), 1)) if pw.length > 1e-6 else cur_p
        pw.normalize()
        flex_goal = s.get("flex")
        if flex_goal is None and s.get("curl") is not None:   # Fingerkrümmung aus der Wunschhaltung, nicht aus der Raumrichtung
            cv = Vector(s["curl"]).normalized(); flex_goal = math.degrees(math.atan2(cv.dot(pw0 - u * pw0.dot(u)), cv.dot(u)))
        want = u.rotation_difference(ax) @ pw
        # Das Handgelenk beugt sich zur Handfläche hin oder von ihr weg, seitlich kaum: je stärker die Hand
        # abknickt, desto mehr muss die Handfläche in der Knickebene liegen.
        bend = u - ax * u.dot(ax); th = math.degrees(ax.angle(u))
        if bend.length > 1e-4 and th > 5:   # stetig: liegt die Handfläche quer zur Knickebene, nicht hineinzwingen
            c = bend.normalized().dot(want); pf = bend.normalized() * (1 if c >= 0 else -1)
            wgt = min(1.0, (th - 5) / 25) * min(1.0, abs(c) / 0.35)
            want = slerp_dir(want, pf, wgt).normalized()
        spin(f"forearm.{n}", PALM[n], want)
        clamp_joints([f"forearm.{n}"])        # Pro-/Supination begrenzen, bevor die Hand ausgerichtet wird
        for hb_ in (f"hand.{n}", f"fingers.{n}"): PB[hb_].matrix_basis = Matrix()
        upd()                                  # Hand aus der Ruhelage ausrichten: keine Restdrehung um die eigene Achse
        aim(f"hand.{n}", K - world(PB[f"hand.{n}"].head))     # kleinste Drehung = Beugen/Abknicken ohne Verdrehen
        ang = joint_angles(f"hand.{n}")
        over = max(lim["flex"][0] - ang["flex"], ang["flex"] - lim["flex"][1], abs(ang["dev"]) - lim["dev"][1], 0)
        if over < 1 or s.get("hdir") is None and it > 0: break
        ax = rig.matrix_world.to_3x3() @ (fa.tail - fa.head).normalized(); tot = math.degrees(ax.angle(u))
        if tot < 1: break
        u = slerp_dir(ax, u, max(0.0, (tot - over - 3) / tot)).normalized()   # Hand um den Überschuss zum Unterarm kippen
    hb = PB[f"hand.{n}"]; hd = rig.matrix_world.to_3x3() @ (hb.tail - hb.head).normalized(); pn = palm_normal(n)
    a = math.radians(flex_goal if flex_goal is not None else 0.0)   # Finger um festen Winkel zur Handfläche (dreht mit)
    curl = hd * math.cos(a) + pn * math.sin(a)
    # Finger: Beugewinkel in der Ebene (Hand, Handfläche) bestimmen, auf −60…170° begrenzen und als reine
    # Scharnier-Drehung setzen – ohne „kürzeste Drehung“, die bei rückwärts zeigender Richtung umspringt.
    side = hd.cross(pn).normalized(); curl = Vector(curl)
    a = math.degrees(math.atan2(curl.dot(pn), curl.dot(hd)))
    lo_, hi_ = JLIM["fingers"]["flex"]
    if a < lo_: a = lo_ + (lo_ - a) / (lo_ + 180) * (hi_ - lo_)   # weit nach hinten gemeint = eingerollt; stetig
    a = min(a, hi_)                                                # (bei ±180° treffen sich beide Äste)
    fb = PB[f"fingers.{n}"]; fd = rig.matrix_world.to_3x3() @ (fb.tail - fb.head).normalized()
    cur = math.degrees(math.atan2(fd.dot(pn), fd.dot(hd)))
    hdp = fb.head.copy()
    fb.matrix = Matrix.Translation(hdp) @ Matrix.Rotation(math.radians(a - cur), 4, to_pose(side)) @ Matrix.Translation(-hdp) @ fb.matrix
    upd()
def leg(n, s):
    """Bein an Weltpunkt: a = Sprunggelenk, hint = Knie, fdir = Fußrichtung (Welt)."""
    two_bone(f"thigh.{n}", f"shin.{n}", Vector(s["a"]), s["hint"])
    if s.get("fdir") is not None: aim(f"foot.{n}", s["fdir"])

# ── Gelenkgrenzen: jede Pose wird gegen anatomische Bereiche geprüft ─────────
# Winkel aus matrix_basis (Drehung gegenüber Ruhelage, relativ zum Elternknochen), in den Achsen der
# Ruhelage: X = seitlich, Y = nach hinten, Z = oben. Vorzeichen für links; rechts wird X-Rotation gleich,
# Y/Z gespiegelt. flex/side = Drehvektor-Anteile um die genannte Achse, twist = Drehung um die Knochenachse.
# Beugeachse je Knochen (Welt in Ruhelage, linke Seite; rechts axial gespiegelt), positive Drehung = Beugen.
FLEX_W = {"shin": X, "foot": X, "forearm": -X, "thigh": -X, "hand": Y, "fingers": Y,
          "spine": X, "chest": X, "neck": X, "head": X}
JLIM = {   # Knochen: {flex: Beugen, dev: seitlich (Abknicken/Abspreizen), tw: Drehung um die Knochenachse} in Grad
    "shin":    {"flex": (-8, 165), "dev": (-15, 15), "tw": (-40, 40)},     # Knie beugt nur nach hinten
    "foot":    {"flex": (-40, 70), "dev": (-35, 35), "tw": (-35, 35)},     # Sprunggelenk
    "forearm": {"flex": (-8, 160), "dev": (-15, 15), "tw": (-100, 100)},   # Ellbogen beugt nur nach vorn; tw = Pro-/Supination
    "hand":    {"flex": (-90, 85), "dev": (-40, 40), "tw": (-20, 20)},     # Handgelenk (Stütz: bis 90° gestreckt)
    "fingers": {"flex": (-60, 150), "dev": (-20, 20), "tw": (-20, 20)},   # ein Knochen für alle Fingerglieder; flach unter Last überstreckt
    "thigh":   {"flex": (-40, 150), "dev": (-35, 75), "tw": (-60, 60)},    # Hüfte; dev > 0: abspreizen
    "spine":   {"flex": (-45, 60), "dev": (-40, 40), "tw": (-45, 45)},
    "chest":   {"flex": (-45, 50), "dev": (-35, 35), "tw": (-45, 45)},
    "neck":    {"flex": (-60, 60), "dev": (-40, 40), "tw": (-70, 70)},
    "head":    {"flex": (-50, 50), "dev": (-35, 35), "tw": (-60, 60)},
}
def axial(v, b): return Vector((v.x, -v.y, -v.z)) if b.endswith(".R") else Vector(v)
def flex_axis_rest(b):
    """Beugeachse in Ruhelage (Armature-Raum), senkrecht auf den Knochen projiziert."""
    pb = PB[b]; d = (pb.bone.tail_local - pb.bone.head_local).normalized()
    if b.split(".")[0] in ("hand", "fingers"): a = d.cross(Vector(PALM[b[-1]]))   # Beugen zur Handfläche
    else: a = axial(FLEX_W.get(b.split(".")[0], X), b)
    a = a - d * a.dot(d)
    return a.normalized()
def joint_angles(b):
    pb = PB[b]; M = pb.bone.matrix_local.to_3x3()
    q = (M @ pb.matrix_basis.to_3x3() @ M.inverted()).to_quaternion()
    d = (pb.bone.tail_local - pb.bone.head_local).normalized()
    v = Vector((q.x, q.y, q.z)); p = d * v.dot(d)
    tw = Quaternion((q.w, p.x, p.y, p.z)); tw = tw.normalized() if tw.magnitude > 1e-9 else Quaternion()
    sw = q @ tw.inverted()
    a = math.degrees(2 * math.atan2(Vector((tw.x, tw.y, tw.z)).dot(d), tw.w))
    tw_deg = (a + 180) % 360 - 180
    rv = sw.to_axis_angle(); r = rv[0] * math.degrees(rv[1])
    f = flex_axis_rest(b); g = d.cross(f)
    side = -1 if b.endswith(".R") else 1
    dev = r.dot(g) * side
    if b.split(".")[0] == "thigh": dev = -dev                # Hüfte: positiv = abspreizen
    return {"flex": r.dot(f), "dev": dev, "tw": tw_deg * side}
for n in "LR":                         # Beugeachse im Knochenraum (senkrecht zum Knochen)
    for b in (f"shin.{n}", f"foot.{n}", f"forearm.{n}"):
        HINGE[b] = PB[b].bone.matrix_local.to_3x3().inverted() @ flex_axis_rest(b)
def soft_twist(t, hi):
    """Drehung um die Knochenachse stetig auf ±hi begrenzen: ab 0,9·hi weich abbremsen (tanh), über der Mitte
    zwischen hi und 180° zurück auf 0 falten. Ein hartes Falten ab hi drehte die Hand rückwärts, sobald die
    verlangte Drehung die Grenze überschritt (Handtuchgriff), ein hartes Kappen spränge bei ±180°."""
    a = abs(t); k = 0.9 * hi; m = (hi + 180) / 2
    soft = lambda x: k + (hi - k) * math.tanh((x - k) / (hi - k))
    if a <= k: f = a
    elif a <= m: f = soft(a)
    else: f = soft(m) * (180 - a) / (180 - m)
    return math.copysign(f, t)
def clamp_joints(bones=None, tol=0.0):
    """Jedes Gelenk (Eltern zuerst) in seinen Bereich holen: Beugen, seitlich und Drehung getrennt begrenzen."""
    for b in bones or ORDER_ALL:
        base = b.split(".")[0]
        if base not in JLIM: continue
        ang = joint_angles(b); lim = JLIM[base]
        cl = {k: min(max(v, lim[k][0] - tol), lim[k][1] + tol) if k in lim else v for k, v in ang.items()}
        if "tw" in lim and abs(ang["tw"]) > 0.9 * lim["tw"][1]:   # weich begrenzen, jenseits zurück zur Mitte falten:
            cl["tw"] = soft_twist(ang["tw"], lim["tw"][1])        # bei ±180° keine Kante, an der die Hand umspringt
        if all(abs(cl[k] - ang[k]) < 1e-3 for k in ang): continue
        pb = PB[b]; M = pb.bone.matrix_local.to_3x3(); d = (pb.bone.tail_local - pb.bone.head_local).normalized()
        f = flex_axis_rest(b); g = d.cross(f); side = -1 if b.endswith(".R") else 1
        dev = (-cl["dev"] if base == "thigh" else cl["dev"]) * side
        r = f * cl["flex"] + g * dev
        sw = Quaternion(r.normalized(), math.radians(r.length)) if r.length > 1e-6 else Quaternion()
        tw = Quaternion(d, math.radians(cl["tw"] * side))
        q = sw @ tw
        pb.matrix_basis = (M.inverted() @ q.to_matrix() @ M).to_4x4()
        upd()
# Körperteile als Kapseln (Knochenstrecke + Radius) für die Selbstdurchdringung
CAPS = {"rumpf": (("pelvis", "head"), ("chest", "tail"), 0.11), "kopf": (("head", "head"), ("head", "tail"), 0.085)}
for n in "LR":
    CAPS.update({f"oberarm.{n}": ((f"arm.{n}", "head"), (f"arm.{n}", "tail"), 0.042),
                 f"unterarm.{n}": ((f"forearm.{n}", "head"), (f"forearm.{n}", "tail"), 0.035),
                 f"oberschenkel.{n}": ((f"thigh.{n}", "head"), (f"thigh.{n}", "tail"), 0.065),
                 f"unterschenkel.{n}": ((f"shin.{n}", "head"), (f"shin.{n}", "tail"), 0.045),
                 f"hand.{n}": ((f"hand.{n}", "head"), (f"hand.{n}", "tail"), 0.03)})
CAP_PAIRS = [(f"unterarm.{n}", "rumpf") for n in "LR"] + [(f"unterarm.{n}", "kopf") for n in "LR"] + \
            [("oberschenkel.L", "oberschenkel.R"), ("unterschenkel.L", "unterschenkel.R"),
             ("unterschenkel.L", "oberschenkel.R"), ("unterschenkel.R", "oberschenkel.L"), ("unterarm.L", "unterarm.R")] + \
            [(f"unterschenkel.{n}", "rumpf") for n in "LR"] + [(f"unterschenkel.{n}", "kopf") for n in "LR"] + \
            [(f"unterarm.{n}", f"oberschenkel.{m}") for n in "LR" for m in "LR"] + \
            []                                # Oberarm/Kopf nicht: Arme über Kopf liegen an den Ohren an
def _seg_dist(p1, q1, p2, q2):
    """Kürzester Abstand zweier Strecken."""
    d1, d2, r = q1 - p1, q2 - p2, p1 - p2
    a, e, f = d1.dot(d1), d2.dot(d2), d2.dot(r)
    if a < 1e-9 and e < 1e-9: return r.length
    c = d1.dot(r); b = d1.dot(d2); den = a * e - b * b
    sp = min(max((b * f - c * e) / den, 0), 1) if den > 1e-9 else 0.0
    t = (b * sp + f) / e if e > 1e-9 else 0.0
    if t < 0: t, sp = 0.0, min(max(-c / a, 0), 1)
    elif t > 1: t, sp = 1.0, min(max((b - c) / a, 0), 1)
    return ((p1 + d1 * sp) - (p2 + d2 * t)).length
# Glieder durch Glieder: Unterarm/Hand ↔ Ober-/Unterschenkel. Die Kapseln sind hier eng am Modell (anders als der
# runde Rumpf), daher harte Regel statt Warnung – Arme dürfen nicht durch die Beine gehen (Russian Twist).
LIMB_PAIRS = [(f"{a}.{n}", f"{b}.{m}") for a in ("unterarm", "hand") for b in ("oberschenkel", "unterschenkel")
              for n in "LR" for m in "LR"]
def limb_overlap():
    """Tiefste Überlappung Arm ↔ Bein (m) und das Paar."""
    pos = {k: (world(getattr(PB[b0], e0)), world(getattr(PB[b1], e1)), r) for k, ((b0, e0), (b1, e1), r) in CAPS.items()}
    worst = (0.0, "")
    for a, b in LIMB_PAIRS:
        (p0, p1, ra), (q0, q1, rb) = pos[a], pos[b]
        depth = ra + rb - _seg_dist(p0, p1, q0, q1)
        if depth > worst[0]: worst = (depth, f"{a}/{b}")
    return worst
def self_overlap():
    """Tiefste Überlappung zweier Körperkapseln (m) und das Paar."""
    pos = {}
    for k, ((b0, e0), (b1, e1), r) in CAPS.items():
        pos[k] = (world(getattr(PB[b0], e0)), world(getattr(PB[b1], e1)), r)
    worst = (0.0, "")
    for a, b in CAP_PAIRS:
        (p0, p1, ra), (q0, q1, rb) = pos[a], pos[b]
        depth = ra + rb - _seg_dist(p0, p1, q0, q1)
        if depth > worst[0]: worst = (depth, f"{a}/{b}")
    return worst
def symmetry_gap():
    """Größter Unterschied links ↔ rechts (Grad) über die Gelenkwinkel."""
    g = (0.0, "")
    for base in ("arm", "forearm", "hand", "thigh", "shin", "foot"):
        aL, aR = joint_angles(f"{base}.L"), joint_angles(f"{base}.R")
        for k in aL:
            d = abs(aL[k] - aR[k]); d = min(d, 360 - d)
            if d > g[0]: g = (d, f"{base}:{k}")
    return g
# Schulter: wie weit der Oberarm hinter die Brustebene geht (Streckung bzw. horizontale Abduktion nach hinten).
# Grenze hängt von der Armhöhe ab – hängend ~55°, waagerecht ~35°, über Kopf ~15° (Rumpf misst, nicht die Welt:
# Drehung soll aus dem Rumpf kommen, nicht aus einer überstreckten Schulter). Ausnahme je Übung: EX["schulter"]
# (zusätzliche Grad, begründet), strenger: EX["arme"] = "vorn" (Grenze 0°, z. B. Russian Twist, Side Plank Rotation).
SHOULDER_BEHIND = ((-1.0, 55.0), (0.0, 35.0), (1.0, 15.0))
def shoulder_behind(n):
    """(Grad hinter der Brustebene, erlaubte Grad) für den Oberarm der Seite n."""
    pc = PB["chest"]; Rc = rig.matrix_world.to_3x3() @ (pc.matrix.to_3x3() @ pc.bone.matrix_local.to_3x3().inverted())
    front, up = (Rc @ Vector((0, -1, 0))).normalized(), (Rc @ Vector((0, 0, 1))).normalized()
    a = (pt(f"elbow.{n}") - pt(f"shoulder.{n}")).normalized()
    behind = math.degrees(math.asin(max(-1.0, min(1.0, -a.dot(front)))))
    u = max(-1.0, min(1.0, a.dot(up))); (u0, l0), (u1, l1) = (SHOULDER_BEHIND[0], SHOULDER_BEHIND[1]) if u < 0 else SHOULDER_BEHIND[1:]
    return behind, l0 + (l1 - l0) * (u - u0) / (u1 - u0)
def joint_violations():
    out = []
    for pb in PB:
        base = pb.name.split(".")[0]
        if base not in JLIM: continue
        ang = joint_angles(pb.name)
        for k, (lo, hi) in JLIM[base].items():
            v = ang[k]; over = max(lo - v, v - hi, 0)
            if over > 0: out.append((over, pb.name, k, v))
    return out

PTS = {"shoulder": ("arm", "head"), "elbow": ("forearm", "head"), "wrist": ("hand", "head"), "knuckle": ("hand", "tail"),
       "fingertip": ("fingers", "tail"), "hip": ("thigh", "head"), "knee": ("shin", "head"), "ankle": ("foot", "head"),
       "toe": ("foot", "tail")}
CENTER = {"pelvis": ("pelvis", "head"), "waist": ("spine", "head"), "chest": ("chest", "head"), "neck": ("neck", "head"),
          "head": ("head", "head"), "crown": ("head", "tail")}
def pt(name):
    """Gelenkpunkt in Welt: 'shoulder.L', 'knee' (Mitte beider Seiten), 'pelvis' …"""
    if name in CENTER: b, e = CENTER[name]; return world(getattr(PB[b], e))
    if name[-2:] in (".L", ".R"): b, e = PTS[name[:-2]]; return world(getattr(PB[b + name[-2:]], e))
    return (pt(name + ".L") + pt(name + ".R")) / 2
REST_CO = np.array([v.co[:] for v in body.data.vertices])
def skin(bone, near, d):
    """Hautpunkt (Ruhelage), der von near aus am weitesten in Richtung d liegt (Umkreis 4 cm), mitbewegt mit bone."""
    near = np.array(near); dd = np.array(d) / np.linalg.norm(d)
    sel = REST_CO[np.linalg.norm((REST_CO - near) - np.outer((REST_CO - near) @ dd, dd), axis=1) < 0.04]
    p = Vector(sel[np.argmax(sel @ dd)])
    pb = PB[bone]
    return lambda: world(pb.matrix @ pb.bone.matrix_local.inverted() @ p)

def mesh_np():
    dg = bpy.context.evaluated_depsgraph_get(); dg.update(); ev = body.evaluated_get(dg); me = ev.to_mesh()
    a = np.empty(len(me.vertices) * 3, dtype=np.float64); me.vertices.foreach_get("co", a)
    M = np.array(ev.matrix_world); ev.to_mesh_clear()
    return a.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
_gnames = {g.index: g.name for g in body.vertex_groups}
def _main_group(v):
    g = max(v.groups, key=lambda g: g.weight, default=None)
    return _gnames[g.group] if g else ""
HANDV = np.array([_main_group(v).split(".")[0] in ("hand", "fingers") for v in body.data.vertices])
GROUPV = [_main_group(v) for v in body.data.vertices]
FOOTV = np.array([_main_group(v).split(".")[0] == "foot" for v in body.data.vertices])

# ── Geräte ──────────────────────────────────────────────────────────────────
STEEL = material("steel", srgb("#4a4a48"), 0.32); STEEL.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.85
RUBBER = material("rubber", srgb("#262625"), 0.7)
WOOD = material("wood", srgb("#4a443c"), 0.6)          # Kasten, Wand, Polster: dunkel, damit die Figur vorn bleibt
BAND = material("band", srgb("#d4ff3a"), 0.55, emit=0.15)
CLOTH = material("cloth", srgb("#6a6762"), 0.95)
COLL = []             # Kollisionsprüfung: (name, sdf(P)→Abstand, Hände ausnehmen)
DYN = []              # pro Bild nachgeführte Teile (Band, Ringe, Gewicht)
FRAME = []            # zusätzliche Punkte für den Bildausschnitt

def sdf_seg(a, b, r):
    a, b = np.array(a, float), np.array(b, float); ab = b - a; L2 = ab @ ab
    def f(P):
        t = np.clip(((P - a) @ ab) / L2, 0, 1)
        return np.linalg.norm(P - (a + t[:, None] * ab), axis=1) - r
    return f
def sdf_box(c, size):
    c, h = np.array(c, float), np.array(size, float) / 2
    def f(P):
        q = np.abs(P - c) - h
        return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0)
    return f
def cyl(a, b, r, mat=STEEL, coll=None, verts=48):
    a, b = Vector(a), Vector(b); d = b - a
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, location=(a + b) / 2, vertices=verts)
    o = bpy.context.object; o.rotation_mode = "QUATERNION"; o.rotation_quaternion = Z.rotation_difference(d.normalized())
    bpy.ops.object.shade_smooth(); paint(o, mat)
    if coll: COLL.append((coll, sdf_seg(a, b, r), True))
    return o
def box(c, size, mat=WOOD, coll="box", bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c); o = bpy.context.object; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new("bevel", "BEVEL"); m.width = bevel; m.segments = 3
    paint(o, mat)
    if coll: COLL.append((coll, sdf_box(c, size), False))
    return o
def bar(h, y=0.0, half=0.72, r=0.017, posts=True):
    """Querstange entlang X (Klimmzug/Rudern)."""
    cyl((-half, y, h), (half, y, h), r, coll="stange")
    if posts:
        for s in (1, -1): cyl((s * half, y, 0), (s * half, y, h + 0.04), 0.028, coll="pfosten")
def pbars(h=1.18, gap=0.25, y0=0.0, half=0.75, r=0.022):
    """Barren: zwei Holme entlang Y bei x = ±gap."""
    for s in (1, -1):
        cyl((s * gap, y0 - half, h), (s * gap, y0 + half, h), r, coll="holm")
        for e in (-1, 1): cyl((s * gap, y0 + e * (half - 0.12), 0), (s * gap, y0 + e * (half - 0.12), h), 0.03, coll="pfosten")
def parallettes(gap=0.25, y0=0.0, h=0.17, half=0.22, r=0.017):
    for s in (1, -1):
        cyl((s * gap, y0 - half, h), (s * gap, y0 + half, h), r, coll="holm")
        for e in (-1, 1):
            cyl((s * gap, y0 + e * half, 0.015), (s * gap, y0 + e * half, h), r, coll="fuss")
            cyl((s * gap - 0.07, y0 + e * half, 0.015), (s * gap + 0.07, y0 + e * half, 0.015), r, coll="fuss")
class Stick:
    """Zylinder zwischen zwei Punkten, pro Bild neu gesetzt (Band, Gurt, Kette)."""
    def __init__(self, r, mat, verts=20):
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=1, vertices=verts); self.o = bpy.context.object
        bpy.ops.object.shade_smooth(); paint(self.o, mat); self.o.rotation_mode = "QUATERNION"; self.w = 1.0
    def set(self, a, b):
        a, b = Vector(a), Vector(b); d = b - a
        self.o.location = (a + b) / 2; self.o.scale = (self.w, 1, max(d.length, 1e-4))
        self.o.rotation_quaternion = Z.rotation_difference(d.normalized())
def attach(o, bone):
    """Objekt fest an einen Knochen hängen (Lage relativ zur aktuellen Pose bleibt)."""
    mw = o.matrix_world.copy(); o.parent = rig; o.parent_type = "BONE"; o.parent_bone = bone
    upd(); o.matrix_world = mw; upd()
def disc(r=0.16, t=0.045, mat=RUBBER):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=t, vertices=64); o = bpy.context.object
    m = o.modifiers.new("bevel", "BEVEL"); m.width = 0.008; m.segments = 3
    bpy.ops.object.shade_smooth(); paint(o, mat); return o

STRAP = material("strap", srgb("#2f2f2e"), 0.8)
def palm_normal(n):
    rb = PB[f"hand.{n}"]
    return (rig.matrix_world.to_3x3() @ rb.matrix.to_3x3() @ rb.bone.matrix_local.to_3x3().inverted() @ Vector(PALM[n])).normalized()
def ring(n, anchor, r=0.095):
    """Turnring in Hand n (folgt der Hand pro Bild), Gurt zum Aufhängepunkt anchor."""
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.014, major_segments=64, minor_segments=14)
    o = bpy.context.object; bpy.ops.object.shade_smooth(); paint(o, RUBBER); o.rotation_mode = "QUATERNION"
    strap = Stick(0.012, STRAP, 8); strap.w = 2.2      # flacher Gurt
    def upd_ring():
        h = pt(f"knuckle.{n}") - pt(f"wrist.{n}"); G = pt(f"knuckle.{n}") - palm_normal(n) * 0.01 - h * 0.25
        up = (Vector(anchor) - G).normalized(); line = h.cross(palm_normal(n)).normalized()
        nrm = line.cross(up).normalized()
        o.rotation_quaternion = Z.rotation_difference(nrm); o.location = G + up * (r - 0.01)
        strap.set(G + up * (2 * r - 0.01), anchor)
    DYN.append(upd_ring); return o
def strand(fa, fb, r=0.008, mat=BAND):
    """Band/Kette zwischen zwei pro Bild berechneten Punkten."""
    st = Stick(r, mat, 12); DYN.append(lambda: st.set(fa(), fb())); return st
def belt_plate(r=0.13, drop=0.36):
    """Zusatzgewicht: Scheibe an zwei Ketten vom Dip-Gürtel, hängt senkrecht nach unten."""
    pl = disc(r, 0.035); pl.rotation_mode = "XYZ"; pl.rotation_euler = (math.radians(90), 0, 0)
    hips = [skin("pelvis", (s * 0.12, -0.05, 0.98), (s * 0.4, -1, 0)) for s in (1, -1)]
    chains = [Stick(0.005, STEEL, 8) for _ in hips]
    thighs = [skin(f"thigh.{n}", (s * 0.11, -0.05, 0.72), (0, -1, 0)) for s, n in ((1, "L"), (-1, "R"))]
    def upd_plate():
        a, b = hips[0](), hips[1](); c = (a + b) / 2 + Vector((0, -0.05, -drop))
        c.y = min(c.y, min(t().y for t in thighs) - 0.035)        # liegt vor den Oberschenkeln, nicht in ihnen
        pl.location = c
        for ch, h in zip(chains, (a, b)): ch.set(h, c + Vector((0, 0, r - 0.02)))
    DYN.append(upd_plate); return pl

# ── Schlüsselposen mischen und anwenden ─────────────────────────────────────
DIRS = {"pose", "wpose", "hinge", "hdir", "palm", "hint", "curl", "fdir"}   # Werte sind Richtungen (sphärisch mischen)
def mix(a, b, u, d=False):
    if a is None and isinstance(b, (int, float)) and not isinstance(b, bool): a = 0.0   # fehlende Versätze = 0
    if b is None and isinstance(a, (int, float)) and not isinstance(a, bool): b = 0.0
    if a is None: return b
    if b is None: return a
    if isinstance(a, bool) or isinstance(a, str): return a if u < 0.5 else b
    if isinstance(a, (int, float)): return a + (b - a) * u
    if isinstance(a, Vector) or (isinstance(a, (tuple, list)) and len(a) == 3 and all(isinstance(x, (int, float)) for x in a)):
        return slerp_dir(a, b, u) if d else Vector(a).lerp(Vector(b), u)
    if isinstance(a, dict): return {k: mix(a.get(k), b.get(k), u, d or k in DIRS) for k in set(a) | set(b)}
    if isinstance(a, (tuple, list)) and len(a) == len(b): return tuple(mix(x, y, u) for x, y in zip(a, b))
    return a if u < 0.5 else b

def place(k):
    p = k.get("place")
    if not p: return
    if p[0] == "pin":                      # ("pin", Punkt, Ziel[, Achsen])
        d = Vector(p[2]) - pt(p[1]); axes = p[3] if len(p) > 3 else "xyz"
        rig.location += Vector([d[i] if "xyz"[i] in axes else 0 for i in range(3)]); upd()
    elif p[0] == "ground":                 # ("ground", Punkt, (x, y)[, Höhe]): Punkt über (x, y), tiefster Hautpunkt auf Höhe
        d = Vector(p[2]) - pt(p[1]).to_2d(); rig.location += Vector((d.x, d.y, 0)); upd()
        rig.location.z += (p[3] if len(p) > 3 else 0.0) - mesh_np()[:, 2].min(); upd()
    elif p[0] == "hang":                   # Schultern relativ zu den Händen (unter oder über der Stange)
        o = p[1]; K = {n: Vector(s["k"]) for n, s in k["hands"].items()}
        rig.location.x += o.get("sx", 0.0); upd()
        dy = o.get("dy", 0.0)
        if o.get("sz") is None:            # ext = Abstand Schulter–Knöchel / (Arm + Hand) auf Seite ref
            ref = o.get("ref", "L"); S = pt(f"shoulder.{ref}"); W = K[ref]; e = o["ext"] * (REACH + LEN["hand.L"])
            h = k["hands"][ref]
            if h.get("hdir") is not None and h.get("hw", 1.0) == 1.0:   # Stütz: Abstand Schulter–Handgelenk / Arm
                W = K[ref] - Vector(h["hdir"]).normalized() * LEN["hand.L"]; e = o["ext"] * REACH
            dx = W.x - S.x; dz = math.sqrt(max(e * e - dx * dx - dy * dy, 0))
            ty, tz = W.y + dy, W.z + (dz if o.get("up") else -dz)
        else:                              # sz = Schultermitte über (+) / unter (−) der Knöchelmitte
            S = pt("shoulder"); M = sum(K.values(), Vector()) / len(K); ty, tz = M.y + dy, M.z + o["sz"]
        rig.location += Vector((0, ty - S.y, tz - S.z)); upd()
    elif p[0] == "anchor":                 # alte Pistol-Posen: Fuß auf ANCHOR
        low = min((world(PB[f"foot.{p[1]}"].head), world(PB[f"foot.{p[1]}"].tail)), key=lambda q: q.z)
        rig.location += Vector((0, ANCHOR.y - low.y, ANCHOR.z - low.z)); upd()

def pose_key(k, limbs=True):
    reset(k.get("rot", (0, 0, 0)))
    if "rots" in k:
        for b, axis, deg in k["rots"]: rot(b, axis, deg)
    else:
        P = k.get("pose", {})
        for b in ORDER:                    # Hand/Finger ohne Angabe folgen dem Unterarm (keine feste Raumrichtung)
            if b in P or b.split(".")[0] not in ("hand", "fingers"): aim(b, P.get(b, REST[b]), local=True)
    W = k.get("wpose", {})
    for b in ORDER:                        # Eltern vor Kindern (gemischte dicts haben keine feste Reihenfolge)
        if b in W: aim(b, W[b])
    if "rots" not in k:                    # Knie/Ellbogen aus Richtungs-Posen als echtes Scharnier nachstellen
        HINGE_OUT.clear()
        for up, lo, ch in [(f"thigh.{n}", f"shin.{n}", f"foot.{n}") for n in "LR"] + [(f"arm.{n}", f"forearm.{n}", f"hand.{n}") for n in "LR"]:
            dirs = {b: (world(PB[b].tail) - world(PB[b].head)).normalized() for b in (up, lo, ch)}
            PB[lo].matrix_basis = Matrix(); upd()
            Rw = rig.matrix_world.to_3x3(); a_ = dirs[up]
            body_h = Rw @ flex_axis_rest(lo)   # gestreckt: Scharnier wie im Stand …
            fwd_ = Rw @ Vector((0, -1, 0)) * (1 if lo.endswith(".L") else -1)   # … bei seitlich gestrecktem Glied (Achse ∥ Scharnier) zusätzlich
            if lo.startswith("forearm"):     # (Arm seitlich gestreckt; Beine spreizen nie bis in die Scharnierachse)
                body_h = (body_h - a_ * body_h.dot(a_)) + (fwd_ - a_ * fwd_.dot(a_)) * 0.5
            kh = k.get("hinge", {}).get(lo)
            if kh is None:
                want = align_hinge(up, lo, a_, dirs[lo], body_h); aim(lo, dirs[lo])
            else:
                # Zwischen Schlüsseln: Scharnierachse sphärisch gemischt (stetige Drehung des Glieds über die ganze
                # Bewegung) und nur in ihrer Ebene beugen. Aus den Richtungen allein bliebe die Beugeebene bis kurz
                # vor dem Strecken stehen und das Glied drehte dann in wenigen Bildern um (Straddle aus der Hocke).
                h = Rw @ Vector(kh); h = h - a_ * h.dot(a_); bh = body_h - a_ * body_h.dot(a_)
                g = smooth((h.length - 0.1) / 0.3)          # Achse fast entlang des Glieds: stetig zum Stand-Scharnier
                fb_ = (h.normalized() if h.length > 1e-6 else bh) * g + bh.normalized() * (1 - g)
                want = align_hinge(up, lo, a_, dirs[lo], fb_, follow=False)
                t_ = dirs[lo]; tp = t_ - want * t_.dot(want)
                aim(lo, tp + want * t_.dot(want) * (1 - smooth((tp.length - 0.1) / 0.3)))
            HINGE_OUT[lo] = tuple(to_pose(want))
            aim(ch, dirs[ch])
    for b, deg in k.get("twist", {}).items():   # Drehung um die eigene Knochenachse (Rumpfrotation)
        pb = PB[b]; rot(b, (pb.tail - pb.head).normalized(), deg)
    place(k)
    if limbs:
        for n, s in k.get("legs", {}).items(): leg(n, s)
        for n, s in k.get("hands", {}).items(): hand(n, s)
        RAW[:] = joint_violations()        # Rohpose merken (Prüfung), dann anatomisch begrenzen
        clamp_joints()
        for f in DYN: f()
        upd()

def m_arm(side="L"):
    """Messgröße fürs Lösen: Abstand Schulter → Handgelenk-Ziel relativ zur Armlänge."""
    def f(k):
        s = k["hands"][side]; K = Vector(s["k"])
        if s.get("hdir") is not None and s.get("hw", 1.0) == 1.0: W = K - Vector(s["hdir"]).normalized() * LEN["hand.L"]; L = REACH
        else: W = K; L = REACH + LEN["hand.L"]
        return (W - pt(f"shoulder.{side}")).length / L
    return f
def set_rot(i):
    def f(k, x): r = list(k.get("rot", (0, 0, 0))); r[i] = x; k["rot"] = tuple(r)
    return f
def set_place(*path):
    """Wert in k['place'] setzen: set_place(2, 2) → Ziel-z eines pin, set_place(1, 'sz') → hang-Option."""
    def f(k, x):
        p = list(k["place"]); c = p
        for key in path[:-1]:
            nxt = c[key]; nxt = dict(nxt) if isinstance(nxt, dict) else list(nxt); c[key] = nxt; c = nxt
        c[path[-1]] = x
        k["place"] = tuple(tuple(e) if isinstance(e, list) else e for e in p)
    return f
def solve(k, idx, lo, hi, fn, value, steps=22, limbs=False):
    """Einen Wert per Halbierung so wählen, dass fn(k) = value. idx: Index in k['rot'] oder Setter."""
    setter = set_rot(idx) if isinstance(idx, int) else idx
    def at(x): setter(k, x); pose_key(k, limbs=limbs); return fn(k) - value
    flo = at(lo)
    for _ in range(steps):
        mid = (lo + hi) / 2; fm = at(mid)
        if (fm < 0) == (flo < 0): lo, flo = mid, fm
        else: hi = mid
    at((lo + hi) / 2)
    return (lo + hi) / 2
def hang_sz(k):
    """hang-Platzierung mit ext in feste Schulterhöhe (sz/dy) umrechnen – so mischen sich Schlüssel mit
    unterschiedlicher Bezugsseite oder seitlichem Versatz ohne Sprung."""
    pose_key(k, limbs=False); o = dict(k["place"][1])
    K = [Vector(s["k"]) for s in k["hands"].values()]; M = sum(K, Vector()) / len(K); S = pt("shoulder")
    o.pop("ext", None); o.pop("ref", None); o.pop("up", None); o["sz"] = S.z - M.z; o["dy"] = S.y - M.y
    k["place"] = ("hang", o)
    if os.environ.get("LEVER_DEBUG"):
        pose_key(k, limbs=False); print("HANG_SZ", o, "S", tuple(round(c, 3) for c in pt("shoulder")), "M", tuple(round(c, 3) for c in M))
    return k
def grounded(k, name):
    """("ground", …) einmal auswerten und als feste Lage (pin) speichern – mischbar mit anderen pins."""
    pose_key(k, limbs=False); k["place"] = ("pin", name, tuple(pt(name))); return k

def ease(t): return (1 - math.cos(math.pi * min(max(t, 0), 1))) / 2
def ease_flat(t, a=0.2):
    """Weich anfahren und abbremsen (je a), dazwischen gleichmäßig: Spitzentempo 1/(1−a) statt π/2 des Kosinus."""
    t = min(max(t, 0.0), 1.0); f = lambda x: x / 2 - a / (2 * math.pi) * math.sin(math.pi * x / a)
    if t < a: y = f(t)
    elif t > 1 - a: y = 1 - a - f(1 - t)
    else: y = a / 2 + (t - a)
    return y / (1 - a)
PROFILES = {"pp": (0.5, 0, 0.5), "hold": (0.3, 0.35, 0.3), "fast": (0.22, 0.08, 0.55), "slow": (0.55, 0.08, 0.22)}
def curve(x, prof, e=ease):
    """Bild x ∈ [0,1) → Fortschritt 0…1…0: Anstieg, Halten oben, Abstieg, Rest unten."""
    rise, top, fall = PROFILES[prof] if isinstance(prof, str) else prof
    if x < rise: return e(x / rise)
    x -= rise
    if x < top: return 1.0
    x -= top
    if x < fall: return 1 - e(x / fall)
    return 0.0
def _hands_compatible(a, b):
    """Hand-Vorgaben zweier Schlüssel angleichen, bevor gemischt wird: fehlt hdir auf einer Seite, gilt dort hw=0
    (sonst springt die Handrichtung beim Wechsel des Schlüssel-Paars schlagartig)."""
    a, b = dict(a), dict(b)
    for n in set(a.get("hands", {})) & set(b.get("hands", {})):
        ha, hb = dict(a["hands"][n]), dict(b["hands"][n])
        for x, y in ((ha, hb), (hb, ha)):
            if y.get("hdir") is not None and x.get("hdir") is None: x["hdir"] = y["hdir"]; x["hw"] = 0.0
            elif y.get("hdir") is not None: x.setdefault("hw", 1.0); y.setdefault("hw", 1.0)
        a["hands"] = {**a["hands"], n: ha}; b["hands"] = {**b["hands"], n: hb}
    return a, b
def key_at(keys, s):
    """s ∈ [0, len(keys)-1] → gemischte Schlüsselpose."""
    i = min(int(s), len(keys) - 2); a, b = _hands_compatible(keys[i], keys[i + 1]); return mix(a, b, s - i)

# ── Bildausschnitt ──────────────────────────────────────────────────────────
def frame_camera(view, pts, fit=0.86, lens=60, dist=None):
    """Kamera aus Blickwinkel view so setzen, dass alle Punkte mit Rand fit ins Bild passen.
    dist: Abstand vorgeben und nur zentrieren (mitgeführte Kamera). Gibt (Ziel, Abstand) zurück."""
    az, el = (math.radians(a) for a in view)
    off = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
    fwd = -off; right = fwd.cross(Z).normalized(); up = right.cross(fwd)
    F, R, U = np.array(fwd), np.array(right), np.array(up)
    tx = 18 / lens; ty = tx * scene.render.resolution_y / scene.render.resolution_x
    ctr = Vector(((pts.min(0) + pts.max(0)) / 2).tolist())
    def proj(c, d):
        rel = pts - np.array(c + off * d); z = rel @ F
        return (rel @ R) / z, (rel @ U) / z
    for _ in range(4):
        lo, hi = 0.5, 40.0
        for _ in range(40 if dist is None else 0):
            d = (lo + hi) / 2; x, y = proj(ctr, d)
            if max(np.abs(x).max() / tx, np.abs(y).max() / ty) > fit: lo = d
            else: hi = d
        if dist is not None: hi = dist
        x, y = proj(ctr, hi)
        ctr += right * ((x.max() + x.min()) / 2 * hi) + up * ((y.max() + y.min()) / 2 * hi)
    set_camera(view, ctr, hi, lens)
    return ctr, hi
def set_camera(view, ctr, dist, lens=60):
    az, el = (math.radians(a) for a in view)
    off = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
    ctr = Vector(ctr); hi = dist
    cam_d.lens = lens
    cam.location, target.location = ctr + off * hi, ctr
    light_target.location = ctr
    rz = Matrix.Rotation(math.radians(math.degrees(az) - AZ0), 3, Z)
    for o in scene.objects:
        if o.name in LIGHT_BASE: o.location = Vector((ctr.x, ctr.y, 0)) + rz @ (LIGHT_BASE[o.name] - Vector((0, 0, 0)))

def render(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "moves.py"), encoding="utf-8").read())

if MODE == "heat":
    # Belastung je Region (0–1) → ein Material je Region, zugeordnet über die Knochengewichte
    loads = dict((k, float(v)) for k, v in (kv.split("=") for kv in ARG.split(",")))
    REGION = {"chest": "chest", "spine": "core", "pelvis": "hips", "neck": None, "head": None}
    for n in "LR":
        REGION.update({f"clavicle.{n}": "shoulders", f"arm.{n}": "arms", f"forearm.{n}": "forearms",
                       f"hand.{n}": "forearms", f"fingers.{n}": "forearms",
                       f"thigh.{n}": "thighs", f"shin.{n}": "calves", f"foot.{n}": None})
    for o in scene.objects:      # Volt-Streiflicht würde wie Belastung aussehen → neutral
        if o.type == "LIGHT" and o.name == "rim": o.data.color = (1, 1, 1); o.data.energy = 160
    # Ein Material je Region (Material-Zuordnungen überstehen Multires, Farbattribute nicht zuverlässig)
    names = _gnames
    regions = sorted({r for r in REGION.values() if r}) + ["none"]
    body.data.materials.clear()
    for r in regions:
        x = loads.get(r, 0.0) if r != "none" else 0.0
        # in sRGB mischen (wie das Auge sieht), Last betont: wenig Last bleibt Stein, viel wird Volt
        lo, hi = (0x8a, 0x86, 0x7d), (0xd4, 0xff, 0x3a)
        k = x ** 1.6
        hexcol = "#" + "".join(f"{round(lo[i] + (hi[i] - lo[i]) * k):02x}" for i in range(3))
        body.data.materials.append(material(f"heat_{r}", srgb(hexcol), 0.45, emit=0.25 * k))
    def vregion(v):
        best = max(v.groups, key=lambda g: g.weight, default=None)
        return REGION.get(names[best.group]) if best else None
    vr = [vregion(v) or "none" for v in body.data.vertices]
    for poly in body.data.polygons:
        votes = {}
        for i in poly.vertices: votes[vr[i]] = votes.get(vr[i], 0) + 1
        poly.material_index = regions.index(max(votes, key=votes.get))
    body.data.update()
    reset()
    scene.render.resolution_x, scene.render.resolution_y = 900, 1200
    for name, loc in (("front", (1.1, -3.5, 1.2)), ("back", (-1.1, 3.5, 1.2))):
        cam.location, target.location = Vector(loc), Vector((0, 0, 0.9))
        render(os.path.join(OUT, f"heat_{name}.png"))
else:
    reset(); ANCHOR = min((world(PB["foot.L"].head), world(PB["foot.L"].tail)), key=lambda q: q.z)
    EX = EXERCISES[ARG]()
    keys = EX["keys"]
    for k in keys:                         # fehlende Knochen = Ruhelage, damit sich alle Schlüssel mischen lassen
        if "rots" not in k: k["pose"] = {b: k.get("pose", {}).get(b, REST[b]) for b in ORDER
                                         if b in k.get("pose", {}) or b.split(".")[0] not in ("hand", "fingers")}
        k.setdefault("rot", (0, 0, 0))
    for k in keys:                         # Scharnierachsen je Schlüssel (werden zwischen den Schlüsseln gemischt)
        if "rots" not in k: pose_key(k, limbs=False); k["hinge"] = dict(HINGE_OUT)
    frames = int(os.environ.get("LEVER_FRAMES") or EX.get("frames", 48)); prof = EX.get("timing", "pp")
    # Gleichmäßiges Tempo für Clips mit mehr als zwei Schlüsseln und für Clips, die mit dem einfachen Verlauf
    # die Sprung-Regel reißen: s nach Bogenlänge umrechnen, so dass der größte Sprung (Hand, Unterarm, Fuß) bzw.
    # das größte Kippen (auch Oberarm/-schenkel – sonst rauscht die Zeit durch Abschnitte, in denen nur sie sich
    # drehen) je Zeitschritt überall gleich ist, dazu ein Tempoverlauf mit gleichmäßiger Mitte
    # (ease_flat, Spitze −20 %). Gleich lange Abschnitte machten den Übergang beim Muscle-up so schnell, dass die
    # Hände in wenigen Bildern umklappten, während Zug und Stütz gemächlich liefen. Ruhige Clips behalten ihr Timing.
    DISTAL = [f"{b}.{n}" for b in ("forearm", "hand", "fingers", "shin", "foot") for n in "LR"]
    UPPER = [f"{b}.{n}" for b in ("arm", "thigh") for n in "LR"]
    def limb_q(s_):
        pose_key(key_at(keys, s_)); return {b: (rig.matrix_world @ PB[b].matrix).to_3x3().normalized() for b in DISTAL + UPPER}
    def step(qa, qb):                      # wie die Prüfung: Sprung der Hände/Füße, Kippen der Oberarme/-schenkel
        def ang(b):
            dq = qb[b].to_quaternion() @ qa[b].to_quaternion().inverted(); a = math.degrees(dq.angle); return min(a, 360 - a)
        def tw(b):
            dq = qb[b].to_quaternion() @ qa[b].to_quaternion().inverted(); ax = qa[b].col[1].normalized()
            return abs(math.degrees(2 * math.atan2(Vector((dq.x, dq.y, dq.z)).dot(ax), abs(dq.w))))
        return max(max(ang(b) for b in DISTAL), max(tw(b) for b in UPPER))
    def timing(flat):
        SS, LL = [0.0, len(keys) - 1.0], [0.0, 1.0]
        if flat:
            SS = [i / 48 for i in range(48 * (len(keys) - 1) + 1)]; Q = [limb_q(x) for x in SS]   # fein: IK nahe der Streckung
            LL = [0.0]
            for qa, qb in zip(Q, Q[1:]): LL.append(LL[-1] + step(qa, qb))
            LL = [x / max(LL[-1], 1e-9) for x in LL]
        def warp(p):
            j = max(i for i in range(len(LL) - 1) if LL[i] <= p + 1e-12) if p < 1 else len(LL) - 2
            return SS[j] + (SS[j + 1] - SS[j]) * min(max((p - LL[j]) / max(LL[j + 1] - LL[j], 1e-9), 0.0), 1.0)
        return [warp(curve(i / frames, prof, ease_flat if flat else ease)) for i in range(frames)]
    flat = len(keys) > 2
    S_OF = timing(flat)
    if not flat:
        Q = [limb_q(x) for x in S_OF]
        if max(step(Q[i - 1], Q[i]) for i in range(len(Q))) > RULES["sprung"]: S_OF = timing(True)
    top = [i for i, x in enumerate(S_OF) if x >= max(S_OF) - 1e-6]          # Schlüsselposition auf 1 s legen:
    shift = (top[0] + top[-1]) // 2 - frames // 2                           # Mitte des Loops = Vorschaubild der App
    S_OF = S_OF[shift:] + S_OF[:shift]
    scene.render.resolution_x, scene.render.resolution_y = 800, 600   # = Clip-Größe; höher bringt nach Skalierung nichts
    if os.environ.get("LEVER_RES"): scene.render.resolution_percentage = int(os.environ["LEVER_RES"])
    if os.environ.get("LEVER_SAMPLES"): scene.cycles.samples = int(os.environ["LEVER_SAMPLES"])
    # Bildausschnitt aus allen Posen der Bewegung (+ Geräte-Punkte)
    pts = []
    for s in sorted(set(round(x, 3) for x in S_OF[::3])) + list(range(len(keys))):
        pose_key(key_at(keys, s)); pts.append(mesh_np()[::5])
    pts = np.vstack(pts + [np.array([list(p) for p in FRAME])] if FRAME else pts)
    view, fit, lens = EX.get("view", (AZ0, 4)), EX.get("fit", 0.86), EX.get("lens", 60)
    frame_camera(view, pts, fit, lens)
    CAM = {}                               # mitgeführte Kamera: fester Abstand, Ziel folgt der Figur (geglättet)
    if EX.get("follow"):
        per = []
        for s in S_OF:
            pose_key(key_at(keys, s)); per.append(mesh_np()[::5])
        d = max(frame_camera(view, P, fit, lens)[1] for P in per)
        ctrs = [frame_camera(view, P, fit, lens, dist=d)[0] for P in per]
        n = len(ctrs)
        for i in range(n):
            CAM[i] = sum((ctrs[(i + j) % n] for j in range(-3, 4)), Vector()) / 7
        CAM["d"] = d
    if os.environ.get("LEVER_CAM"):   # Detailkontrolle: LEVER_CAM="x,y,z,zx,zy,zz"
        c = [float(x) for x in os.environ["LEVER_CAM"].split(",")]
        cam.location, target.location = Vector(c[:3]), Vector(c[3:])
    if MODE == "check":                    # ohne Rendern: Durchdringungen, Bodenkontakt, Reichweite pro Bild
        worst = {}; prev = {}; gelenk = {}; griff = [0.0, 0]; steps = {}
        selbst = [0.0, 0, ""]; symm = [0.0, 0, ""]; schulter = [-99.0, 0, ""]; glieder = [0.0, 0, ""]
        # Symmetrie nur prüfen, wenn die Schlüsselposen selbst beidseitig gleich sind (Archer, Pistol … sind es nicht)
        key_sym = 0.0
        for kk_ in keys:
            pose_key(kk_); key_sym = max(key_sym, symmetry_gap()[0])
        JB = [f"{b}.{n}" for b in ("arm", "forearm", "hand", "fingers", "thigh", "shin", "foot") for n in "LR"]
        for i, s in enumerate(S_OF + S_OF[:1]):      # letztes Bild → erstes: auch die Loop-Naht prüfen
            OVER[0] = 0.0; kk_ = key_at(keys, s); pose_key(kk_)
            for n, hs in kk_.get("hands", {}).items():     # Griff nach dem Begrenzen: Knöchel noch am Ziel?
                miss = (pt(f"knuckle.{n}") - Vector(hs["k"]() if callable(hs["k"]) else hs["k"])).length
                if miss > griff[0]: griff[:] = [miss, i, n]
            for b in JB:                     # Drehung je Bild (Grad) in Welt, davon um die eigene Achse (Kippen)
                M = (rig.matrix_world @ PB[b].matrix).to_3x3().normalized(); q = M.to_quaternion(); ax = M.col[1].normalized()
                if b in prev:
                    q0, ax0 = prev[b]; dq = q @ q0.inverted()
                    tot = math.degrees(dq.angle); tot = min(tot, 360 - tot)
                    tw = abs(math.degrees(2 * math.atan2(Vector((dq.x, dq.y, dq.z)).dot(ax0), abs(dq.w))))
                    steps.setdefault(b, []).append((tot, min(tw, tot)))
                prev[b] = (q, ax)
            if i == len(S_OF): break
            ov = self_overlap()
            if ov[0] > selbst[0]: selbst[:] = [ov[0], i, ov[1]]
            lo_ = limb_overlap()
            if lo_[0] > glieder[0]: glieder[:] = [lo_[0], i, lo_[1]]
            sg = symmetry_gap()
            if sg[0] > symm[0]: symm[:] = [sg[0], i, sg[1]]
            for n in "LR":                   # Oberarm hinter dem Rumpf (Schulter überstreckt)
                bh, lim_ = shoulder_behind(n)
                if EX.get("arme") == "vorn": lim_ = 0.0   # Rotationsübungen: Arme bleiben vor der Brust, die Drehung macht der Rumpf
                if bh - lim_ > schulter[0]: schulter[:] = [bh - lim_, i, f"arm.{n} {bh:.0f}° hinter (Grenze {lim_:.0f}°)"]
            for over, b, k, v in RAW:
                key = f"{b}:{k}"
                if over > gelenk.get(key, (0,))[0]: gelenk[key] = (over, i, v)
            P = mesh_np()
            row = {"boden": P[:, 2].min(), "reichweite": -OVER[0]}; where = {"boden": GROUPV[int(P[:, 2].argmin())]}
            for name, f, grip in COLL:
                d = f(P); d[HANDV & grip] = 9
                if d.min() < row.get(name, 9): row[name] = d.min(); where[name] = GROUPV[int(d.argmin())]
            for kk, v in row.items():
                if v < worst.get(kk, (9, 0))[0]: worst[kk] = (v, i, where.get(kk, ""))
            if os.environ.get("LEVER_DEBUG"): print("FRAME", i, {kk: round(v, 3) for kk, v in row.items()})
        # Sprung = größte Drehung von Unterarm, Hand, Fingern, Unterschenkel oder Fuß von einem Bild zum nächsten
        # (inklusive Loop-Naht), Kippen = Drehung eines Glieds um die eigene Achse (auch Ober-/Unterarm, Ober-/
        # Unterschenkel). Ruhige Clips bleiben unter 10°; darüber ruckelt oder kippt es bei 24 fps sichtbar.
        # Oberarm und Oberschenkel zählen beim Sprung nicht: sie schwingen bei großen Bewegungen (Skin the Cat,
        # Hebel aus dem Hang) legitim schneller und tragen keine Hand/keinen Fuß, die umklappen könnte.
        jumps = {b: max((a, i_ + 1) for i_, (a, _) in enumerate(st)) for b, st in steps.items() if b.split(".")[0] not in ("arm", "thigh")}
        twists = {b: max((t, i_ + 1) for i_, (_, t) in enumerate(st)) for b, st in steps.items()}
        bad = sorted(gelenk.items(), key=lambda x: -x[1][0])
        print("GRIFF", ARG, f"{griff[0] * 100:.1f}cm@{griff[1]}" + (f"({griff[2]})" if len(griff) > 2 else ""))
        print("GELENK", ARG, "ok" if not bad else " ".join(f"{k}={v:.0f}°(+{o:.0f})@{i}" for k, (o, i, v) in bad[:6]))
        print("SPRUNG", ARG, " ".join(f"{b}={a:.0f}°@{i}" for b, (a, i) in sorted(jumps.items(), key=lambda x: -x[1][0])[:4]))
        print("KIPPEN", ARG, " ".join(f"{b}={a:.0f}°@{i}" for b, (a, i) in sorted(twists.items(), key=lambda x: -x[1][0])[:4]))
        # Abnahme-Regeln: nur was alle erfüllt, wird gerendert (clips.sh bricht sonst ab)
        fails = []
        if bad and bad[0][1][0] > RULES["gelenk"]: fails.append(f"Gelenk {bad[0][0]} +{bad[0][1][0]:.0f}°")
        jmax = max(jumps.items(), key=lambda x: x[1][0], default=(None, (0, 0)))
        if jmax[1][0] > EX.get("tempo", RULES["sprung"]):   # tempo: begründete Ausnahme der Übung (sehr viel Bewegung in 2 s)
            fails.append(f"Sprung {jmax[0]} {jmax[1][0]:.0f}° je Bild @{jmax[1][1]}")
        tmax = max(twists.items(), key=lambda x: x[1][0], default=(None, (0, 0)))
        if tmax[1][0] > EX.get("tempo", RULES["sprung"]): fails.append(f"Kippen {tmax[0]} {tmax[1][0]:.0f}° je Bild @{tmax[1][1]}")
        if griff[0] > RULES["griff"]: fails.append(f"Griff {griff[0] * 100:.1f} cm daneben")
        print("GLIEDER", ARG, f"{glieder[0] * 100:.1f}cm@{glieder[1]}({glieder[2]})")
        if glieder[0] > RULES["glieder"] + EX.get("glieder", 0):   # Arm durch Bein (Ausnahme nur begründet, z. B. Hände auf den Knien)
            fails.append(f"Arm durch Bein {glieder[2]} {glieder[0] * 100:.1f} cm @{glieder[1]}")
        print("SCHULTER", ARG, f"{schulter[0]:+.0f}°@{schulter[1]} {schulter[2]}")      # Abstand zur Grenze (negativ = Reserve)
        if schulter[0] > RULES["schulter"] + EX.get("schulter", 0):   # schulter: begründete Ausnahme (Skin the Cat, Back Lever …)
            fails.append(f"Schulter +{schulter[0]:.0f}° @{schulter[1]} ({schulter[2]})")
        for kk, (v, i_, w_) in worst.items():   # Hände/Füße auf Auflage: Weichteile geben nach, etwas mehr erlaubt
            tol = RULES["auflage"] if w_.split(".")[0] in ("hand", "fingers", "foot") else RULES["eindringen"]
            if kk != "reichweite" and v < -tol: fails.append(f"{kk} {v * 100:.1f} cm ({w_})")
        if selbst[0] > RULES["selbst"]:    # Kapseln sind grob (Rumpf rund statt flach): erst Warnung, Sichtprüfung entscheidet
            print("WARNUNG", ARG, f"Selbstdurchdringung {selbst[2]} {selbst[0] * 100:.1f} cm @{selbst[1]}")
        if key_sym < 5 and symm[0] > RULES["symmetrie"]: fails.append(f"Asymmetrie {symm[2]} {symm[0]:.0f}°")
        print("SELBST", ARG, f"{selbst[0] * 100:.1f}cm@{selbst[1]}({selbst[2]})", "SYMM", f"{symm[0]:.0f}°@{symm[1]}({symm[2]})", f"schlüssel {key_sym:.0f}°")
        for ka, kb in zip(keys, keys[1:]):  # Weltrichtungen nur in einem Schlüssel → beim Mischen bleibt sie hängen
            wa, wb = set(ka.get("wpose", {})), set(kb.get("wpose", {}))
            if wa != wb: fails.append(f"wpose nur in einem Schlüssel: {sorted(wa ^ wb)}")
        print("PRUEFUNG", ARG, "ok" if not fails else "FEHLER " + "; ".join(fails))
        print("CHECK", ARG, " ".join(f"{kk}={v:+.3f}@{i}{'(' + w + ')' if w else ''}" for kk, (v, i, w) in worst.items()))
    elif MODE == "still":                  # jede Schlüsselpose als Bild: <übung>_k0.png …
        for i in range(len(keys)):
            pose_key(keys[i])
            if CAM: frame_camera(view, mesh_np()[::5], fit, lens, dist=CAM["d"])
            render(os.path.join(OUT, f"{ARG}_k{i}.png"))
    elif MODE == "gltf":                   # Echtzeit-3D (.glb). LEVER_GLTF_PART: "figure" (nur Figur + Skelett, Ruhepose),
        part = os.environ.get("LEVER_GLTF_PART", "all")   # "anim" (Skelett-Animation + Geräte, ohne Figur), sonst alles
        lv = int(os.environ.get("LEVER_GLTF_SUBDIV", 1))
        for m in body.modifiers:
            if m.type == "MULTIRES": m.levels = m.render_levels = min(lv, m.total_levels)
        scene.render.fps = 24; scene.frame_start, scene.frame_end = 0, len(S_OF)
        for pb in PB: pb.rotation_mode = "QUATERNION"
        props = [o for o in scene.objects if o.type == "MESH" and o is not body and o not in eyes
                 and not getattr(o, "is_shadow_catcher", False)]   # Geräte (auch mitbewegte)
        for o in props: o.rotation_mode = "QUATERNION"
        if part == "figure":
            reset(); [bpy.data.objects.remove(o, do_unlink=True) for o in props]
            target = int(os.environ.get("LEVER_GLTF_VERTS", 20000))
            dg = bpy.context.evaluated_depsgraph_get(); n0 = len(body.evaluated_get(dg).data.vertices)
            if n0 > target:                    # dezimieren vor dem Skelett-Modifier (Gewichte werden mit reduziert)
                dm = body.modifiers.new("decimate", "DECIMATE"); dm.ratio = target / n0
                bpy.context.view_layer.objects.active = body
                bpy.ops.object.modifier_move_to_index(modifier="decimate", index=[m.type for m in body.modifiers].index("ARMATURE"))
        else:
            # Erst alle Bilder posieren und merken, dann schlüsseln: eine vorhandene Aktion würde beim Auswerten
            # (Bildwechsel/Update) die frisch gesetzte Pose wieder überschreiben
            frames, pts = [], []
            for s in S_OF + S_OF[:1]:                 # letztes Bild = erstes: nahtloser Loop
                pose_key(key_at(keys, s)); pts.append(mesh_np()[::5])
                frames.append((rig.location.copy(), rig.rotation_euler.copy(),
                               {pb.name: pb.matrix_basis.decompose() for pb in PB},
                               {o.name: o.matrix_world.decompose() for o in props}))
            for o in props: o.parent = None
            for i, (rl, rr, bones, objs) in enumerate(frames):
                rig.location, rig.rotation_euler = rl, rr
                rig.keyframe_insert("location", frame=i); rig.keyframe_insert("rotation_euler", frame=i)
                for pb in PB:
                    pb.location, pb.rotation_quaternion, pb.scale = bones[pb.name]
                    for path in ("location", "rotation_quaternion", "scale"): pb.keyframe_insert(path, frame=i)
                for o in props:
                    o.location, o.rotation_quaternion, o.scale = objs[o.name]
                    for path in ("location", "rotation_quaternion", "scale"): o.keyframe_insert(path, frame=i)
            # Kamera-Vorschlag wie im Clip (Blickwinkel der Übung, alles im Bild), in glTF-Koordinaten (Y oben, Z = −Y Blender)
            P = np.vstack(pts + ([np.array([list(p) for p in FRAME])] if FRAME else []))
            view, fit, lens = EX.get("view", (AZ0, 4)), EX.get("fit", 0.86), EX.get("lens", 60)
            ctr, dist = frame_camera(view, P, fit, lens)
            az, el = (math.radians(a) for a in view)
            off = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
            g = lambda v: [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]
            # fov = vertikaler Öffnungswinkel (Grad) bei 4:3 wie der Clip; position = target + Blickrichtung · distance
            meta = {"id": ARG, "file": f"anim/{ARG}.glb", "duration": len(S_OF) / 24, "frames": len(S_OF),
                    "camera": {"target": g(ctr), "position": g(ctr + off * dist), "distance": round(dist, 4),
                               "fov": round(2 * math.degrees(math.atan(18 / lens * 0.75)), 2), "view": list(view)},
                    "bounds": {"min": [min(x, y) for x, y in zip(g(Vector(P.min(0))), g(Vector(P.max(0))))],
                               "max": [max(x, y) for x, y in zip(g(Vector(P.min(0))), g(Vector(P.max(0))))]}}
            if part == "anim":
                for o in [body, *eyes]: bpy.data.objects.remove(o, do_unlink=True)
            import json as _json
            with open(os.path.join(OUT, f"{ARG}.json"), "w") as fh: _json.dump(meta, fh, indent=1)
        for o in list(scene.objects):          # Licht, Kamera und Schattenfänger-Boden baut der Viewer selbst
            if o.type in ("LIGHT", "CAMERA") or getattr(o, "is_shadow_catcher", False): bpy.data.objects.remove(o, do_unlink=True)
            elif o.type == "EMPTY": bpy.data.objects.remove(o, do_unlink=True)
        path = os.path.join(OUT, f"{'figure' if part == 'figure' else ARG}.glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_animations=part != "figure",
                                  export_force_sampling=True, export_frame_range=True, export_anim_single_armature=True,
                                  export_yup=True, export_texcoords=False)   # keine Texturen: UV-Nähte würden Eckpunkte verdoppeln
        print("GLTF", part, path, os.path.getsize(path), "Bytes")
    elif MODE == "clip":
        for i, s in enumerate(S_OF):
            pose_key(key_at(keys, s))
            if CAM: set_camera(view, CAM[i], CAM["d"], lens)
            render(os.path.join(OUT, f"frame_{i:04d}.png"))
print("FERTIG", OUT)
