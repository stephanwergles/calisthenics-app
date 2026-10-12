"""Lever – Übungsclips und Körperkarte aus den Human Base Meshes (Blender Foundation, CC0).

  art/vendor/Blender.app/Contents/MacOS/Blender -b \
    art/vendor/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend \
    --python art/blender/lever.py -- <modus> <übung|lasten> <ausgabeordner>

  modus: still (jede Schlüsselpose ein Bild) | clip (48 Bilder) | check (ohne Rendern: Durchdringung,
         Bodenkontakt, Reichweite) | heat (Körperkarte, „region=0..1,…“)
  Übungen: art/blender/moves.py

Grundlage: „realistic body male“ (Multires, 3 Stufen). Das Skript macht ihn athletischer
(Schultern, Arme, Brust, Rücken breiter, Taille schmaler), baut ein einfaches Skelett mit
Gelenkpunkten aus Querschnitten des Modells, bindet den Körper per automatischer Gewichtung
und posiert über Gelenkwinkel in Weltachsen. Figur blickt nach -Y, +X = ihre linke Seite.
"""
import bpy, math, os, sys
from mathutils import Matrix, Vector
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
    "wrist": (0.365, -0.06, 0.86), "knuckle": (0.395, -0.085, 0.78), "hand_tip": (0.42, -0.11, 0.71),
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
def aim(b, d, local=False):
    """Knochen um seinen Kopf drehen, bis er in Richtung d zeigt (Welt, oder Körperraum mit local)."""
    pb = PB[b]; h = pb.head.copy(); cur = (pb.tail - pb.head).normalized()
    d = Vector(d) if local else to_pose(d)
    q = cur.rotation_difference(d.normalized())
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
    upd()
def V(*a): return Vector(a).normalized()
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
LEN = {b: (pb.tail - pb.head).length for b, pb in PB.items()}
REACH = LEN["arm.L"] + LEN["forearm.L"]
STRAIGHT = 0.985
OVER = [0.0]          # größte Überdehnung eines IK-Ziels (Hand/Fuß erreicht ihr Ziel nicht) im Bild

def two_bone(up, lo, target, hint):
    """Analytische 2-Knochen-IK: Mittelgelenk in der Ebene zur Hinweisrichtung."""
    S = world(PB[up].head); a, b = LEN[up], LEN[lo]
    D = target - S; OVER[0] = max(OVER[0], D.length - (a + b))
    d = min(max(D.length, abs(a - b) + 1e-3), a + b - 1e-4); u = D.normalized()
    x = (a * a - b * b + d * d) / (2 * d); y = math.sqrt(max(a * a - x * x, 0))
    h = Vector(hint); w = (h - u * h.dot(u)).normalized()
    E = S + u * x + w * y
    aim(up, E - S); aim(lo, target - E)
def spin(b, ref_bone, rest_n, want):
    """Knochen b um seine Achse drehen, bis die Normale rest_n (Ruhelage von ref_bone) Richtung want zeigt."""
    pb = PB[b]; axis = (pb.tail - pb.head).normalized(); rb = PB[ref_bone]
    n = (rb.matrix.to_3x3() @ rb.bone.matrix_local.to_3x3().inverted()) @ Vector(rest_n)
    w = to_pose(want); n = (n - axis * n.dot(axis)).normalized(); w = (w - axis * w.dot(axis)).normalized()
    ang = math.atan2(axis.dot(n.cross(w)), n.dot(w)); h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(ang, 4, axis) @ Matrix.Translation(-h) @ pb.matrix
    upd()
PALM = {"L": (-1, 0, 0), "R": (1, 0, 0)}     # Handflächen-Normale in Ruhelage (zum Oberschenkel)
def hand(n, s):
    """Hand an Weltpunkt: k = Fingerknöchel, hdir = Richtung Handgelenk→Knöchel (sonst Verlängerung
    Schulter→Knöchel, wie beim Hängen), palm = Handflächen-Normale, curl = Fingerrichtung, hint = Ellbogen."""
    K = Vector(s["k"]); S = world(PB[f"arm.{n}"].head); u = (K - S).normalized()
    if s.get("hdir") is not None: u = u.lerp(Vector(s["hdir"]).normalized(), s.get("hw", 1.0)).normalized()   # hw: Übergang Hängen → Stütz
    W = K - u * LEN[f"hand.{n}"]
    two_bone(f"arm.{n}", f"forearm.{n}", W, s["hint"])
    spin(f"forearm.{n}", f"hand.{n}", PALM[n], s.get("palm", (0, -1, 0)))   # erst Unterarm drehen, sonst schwenkt die Hand weg
    aim(f"hand.{n}", K - world(PB[f"hand.{n}"].head))
    aim(f"fingers.{n}", s.get("curl", u))
def leg(n, s):
    """Bein an Weltpunkt: a = Sprunggelenk, hint = Knie, fdir = Fußrichtung (Welt)."""
    two_bone(f"thigh.{n}", f"shin.{n}", Vector(s["a"]), s["hint"])
    if s.get("fdir") is not None: aim(f"foot.{n}", s["fdir"])

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
    dg = bpy.context.evaluated_depsgraph_get(); ev = body.evaluated_get(dg); me = ev.to_mesh()
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
def mix(a, b, u):
    if a is None and isinstance(b, (int, float)) and not isinstance(b, bool): a = 0.0   # fehlende Versätze = 0
    if b is None and isinstance(a, (int, float)) and not isinstance(a, bool): b = 0.0
    if a is None: return b
    if b is None: return a
    if isinstance(a, bool) or isinstance(a, str): return a if u < 0.5 else b
    if isinstance(a, (int, float)): return a + (b - a) * u
    if isinstance(a, Vector) or (isinstance(a, (tuple, list)) and len(a) == 3 and all(isinstance(x, (int, float)) for x in a)):
        return Vector(a).lerp(Vector(b), u)
    if isinstance(a, dict): return {k: mix(a.get(k), b.get(k), u) for k in set(a) | set(b)}
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
            S = pt("shoulder"); M = (K["L"] + K["R"]) / 2; ty, tz = M.y + dy, M.z + o["sz"]
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
        for b in ORDER: aim(b, P.get(b, REST[b]), local=True)
    for b, d in k.get("wpose", {}).items(): aim(b, d)
    for b, deg in k.get("twist", {}).items():   # Drehung um die eigene Knochenachse (Rumpfrotation)
        pb = PB[b]; rot(b, (pb.tail - pb.head).normalized(), deg)
    place(k)
    if limbs:
        for n, s in k.get("legs", {}).items(): leg(n, s)
        for n, s in k.get("hands", {}).items(): hand(n, s)
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
PROFILES = {"pp": (0.5, 0, 0.5), "hold": (0.3, 0.35, 0.3), "fast": (0.22, 0.08, 0.55), "slow": (0.55, 0.08, 0.22)}
def curve(x, prof):
    """Bild x ∈ [0,1) → Fortschritt 0…1…0: Anstieg, Halten oben, Abstieg, Rest unten."""
    rise, top, fall = PROFILES[prof] if isinstance(prof, str) else prof
    if x < rise: return ease(x / rise)
    x -= rise
    if x < top: return 1.0
    x -= top
    if x < fall: return 1 - ease(x / fall)
    return 0.0
def key_at(keys, s):
    """s ∈ [0, len(keys)-1] → gemischte Schlüsselpose."""
    i = min(int(s), len(keys) - 2); return mix(keys[i], keys[i + 1], s - i)

# ── Bildausschnitt ──────────────────────────────────────────────────────────
def frame_camera(view, pts, fit=0.86, lens=60):
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
        for _ in range(40):
            d = (lo + hi) / 2; x, y = proj(ctr, d)
            if max(np.abs(x).max() / tx, np.abs(y).max() / ty) > fit: lo = d
            else: hi = d
        x, y = proj(ctr, hi)
        ctr += right * ((x.max() + x.min()) / 2 * hi) + up * ((y.max() + y.min()) / 2 * hi)
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
        if "rots" not in k: k["pose"] = {b: k.get("pose", {}).get(b, REST[b]) for b in ORDER}
    frames = int(os.environ.get("LEVER_FRAMES") or EX.get("frames", 48)); prof = EX.get("timing", "pp")
    S_OF = [curve(i / frames, prof) * (len(keys) - 1) for i in range(frames)]
    scene.render.resolution_x, scene.render.resolution_y = 800, 600   # = Clip-Größe; höher bringt nach Skalierung nichts
    if os.environ.get("LEVER_RES"): scene.render.resolution_percentage = int(os.environ["LEVER_RES"])
    if os.environ.get("LEVER_SAMPLES"): scene.cycles.samples = int(os.environ["LEVER_SAMPLES"])
    # Bildausschnitt aus allen Posen der Bewegung (+ Geräte-Punkte)
    pts = []
    for s in sorted(set(round(x, 3) for x in S_OF[::3])) + list(range(len(keys))):
        pose_key(key_at(keys, s)); pts.append(mesh_np()[::5])
    pts = np.vstack(pts + [np.array([list(p) for p in FRAME])] if FRAME else pts)
    frame_camera(EX.get("view", (AZ0, 4)), pts, EX.get("fit", 0.86), EX.get("lens", 60))
    if os.environ.get("LEVER_CAM"):   # Detailkontrolle: LEVER_CAM="x,y,z,zx,zy,zz"
        c = [float(x) for x in os.environ["LEVER_CAM"].split(",")]
        cam.location, target.location = Vector(c[:3]), Vector(c[3:])
    if MODE == "check":                    # ohne Rendern: Durchdringungen, Bodenkontakt, Reichweite pro Bild
        worst = {}
        for i, s in enumerate(S_OF):
            OVER[0] = 0.0; pose_key(key_at(keys, s)); P = mesh_np()
            row = {"boden": P[:, 2].min(), "reichweite": -OVER[0]}; where = {"boden": GROUPV[int(P[:, 2].argmin())]}
            for name, f, grip in COLL:
                d = f(P); d[HANDV & grip] = 9
                if d.min() < row.get(name, 9): row[name] = d.min(); where[name] = GROUPV[int(d.argmin())]
            for kk, v in row.items():
                if v < worst.get(kk, (9, 0))[0]: worst[kk] = (v, i, where.get(kk, ""))
            if os.environ.get("LEVER_DEBUG"): print("FRAME", i, {kk: round(v, 3) for kk, v in row.items()})
        print("CHECK", ARG, " ".join(f"{kk}={v:+.3f}@{i}{'(' + w + ')' if w else ''}" for kk, (v, i, w) in worst.items()))
    elif MODE == "still":                  # jede Schlüsselpose als Bild: <übung>_k0.png …
        for i in range(len(keys)):
            pose_key(keys[i]); render(os.path.join(OUT, f"{ARG}_k{i}.png"))
    elif MODE == "clip":
        for i, s in enumerate(S_OF):
            pose_key(key_at(keys, s)); render(os.path.join(OUT, f"frame_{i:04d}.png"))
print("FERTIG", OUT)
