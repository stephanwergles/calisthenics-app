"""Lever – Übungsclips und Körperkarte aus den Human Base Meshes (Blender Foundation, CC0).

  art/vendor/Blender.app/Contents/MacOS/Blender -b \
    art/vendor/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend \
    --python art/blender/lever.py -- <modus> <übung|lasten> <ausgabeordner>

  modus: still (Stand + tiefste Position) | clip (48 Bilder) | heat (Körperkarte, „region=0..1,…“)

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
    if m.type == "MULTIRES": m.render_levels = m.levels = m.total_levels

# ── Gelenke (aus Querschnitten des Modells, linke Seite; rechts gespiegelt) ──
J = {
    "pelvis": (0, 0.0, 0.93), "spine": (0, 0.0, 1.05), "chest": (0, 0.0, 1.22), "neck": (0, -0.01, 1.43),
    "head": (0, -0.03, 1.53), "head_top": (0, -0.03, 1.69),
    "clav": (0.02, -0.02, 1.42), "shoulder": (0.18, 0.0, 1.38), "elbow": (0.30, -0.01, 1.07),
    "wrist": (0.365, -0.06, 0.86), "hand_tip": (0.42, -0.11, 0.71),
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
    bone(f"hand.{n}", j("wrist", s), j("hand_tip", s), f"forearm.{n}")
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

# ── Posen ───────────────────────────────────────────────────────────────────
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
PB = rig.pose.bones
def reset():
    for pb in PB: pb.matrix_basis = Matrix()
    rig.location = (0, 0, 0)
    bpy.context.view_layer.update()
def rot(b, axis, deg):
    pb = PB[b]; h = pb.head.copy()   # Pose-Raum = Welt, solange das Skelett nicht rotiert ist
    pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()
def foot_low(n):
    pb = PB[f"foot.{n}"]
    return min((rig.matrix_world @ pb.head, rig.matrix_world @ pb.tail), key=lambda p: p.z)
def ground(n):
    low = foot_low(n)
    rig.location += Vector((0, ANCHOR.y - low.y, ANCHOR.z - low.z))
    bpy.context.view_layer.update()

EXERCISES = {
    "pistol": dict(anchor="L", cam=((3.3, -3.7, 1.25), (0.02, -0.2, 0.8)), pose=[
        ("spine", X, 24), ("chest", X, 12), ("neck", X, -16),
        ("arm.L", X, -122), ("arm.R", X, -122),
        ("thigh.L", X, -112), ("shin.L", X, 148), ("foot.L", X, -36),
        ("thigh.R", X, -86), ("shin.R", X, 4), ("foot.R", X, -18),
    ]),
}

def render(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

if MODE == "heat":
    # Belastung je Region (0–1) → ein Material je Region, zugeordnet über die Knochengewichte
    loads = dict((k, float(v)) for k, v in (kv.split("=") for kv in ARG.split(",")))
    REGION = {"chest": "chest", "spine": "core", "pelvis": "hips", "neck": None, "head": None}
    for n in "LR":
        REGION.update({f"clavicle.{n}": "shoulders", f"arm.{n}": "arms", f"forearm.{n}": "forearms",
                       f"hand.{n}": "forearms", f"thigh.{n}": "thighs", f"shin.{n}": "calves", f"foot.{n}": None})
    low, high = srgb("#55534d"), srgb("#d4ff3a")
    for o in scene.objects:      # Volt-Streiflicht würde wie Belastung aussehen → neutral
        if o.type == "LIGHT" and o.name == "rim": o.data.color = (1, 1, 1); o.data.energy = 160
    # Ein Material je Region (Material-Zuordnungen überstehen Multires, Farbattribute nicht zuverlässig)
    names = {g.index: g.name for g in body.vertex_groups}
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
    EX = EXERCISES[ARG]
    reset(); ANCHOR = foot_low(EX["anchor"])
    def pose(f):
        reset()
        for b, axis, deg in EX["pose"]: rot(b, axis, deg * f)
        ground(EX["anchor"])
    cam.location, target.location = Vector(EX["cam"][0]), Vector(EX["cam"][1])
    scene.render.resolution_x, scene.render.resolution_y = 1200, 900
    if MODE == "still":
        pose(1.0); render(os.path.join(OUT, f"{ARG}_bottom.png"))
        pose(0.0); render(os.path.join(OUT, f"{ARG}_top.png"))
    elif MODE == "clip":
        frames = 48
        for i in range(frames):
            f = (1 - math.cos(2 * math.pi * i / frames)) / 2
            pose(f); render(os.path.join(OUT, f"frame_{i:04d}.png"))
print("FERTIG", OUT)
