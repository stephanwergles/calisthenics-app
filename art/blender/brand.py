"""Lever – App-Icon und Startbild der Marke „Gelenk“, flach gerendert mit exakten Markenfarben.

  art/vendor/Blender.app/Contents/MacOS/Blender -b --factory-startup --python art/blender/brand.py -- <ausgabeordner>

Geometrie kommt aus art/brand/mark.py (dieselbe Quelle wie die SVG-Master). Icon: Volt-Symbol auf
Ink, vollflächig – iOS rundet die Ecken selbst. Startbild: Ink, Symbol in der Tuck-Stufe; der
Splash in der App übernimmt genau dieses Bild und verlängert dann den Hebel bis Full.
"""
import bpy, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "brand"))
import mark  # noqa: E402

OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)

def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)

def flat(name, hexcol):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = srgb(hexcol)
    return m

VOLT, INK = flat("volt", mark.VOLT), flat("ink", mark.INK)

def clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)

def setup(size_px, x, y, side):
    """Orthografische Draufsicht auf das Quadrat (x, y, side) in Markenkoordinaten (y nach unten)."""
    s = bpy.context.scene
    s.render.engine = "BLENDER_WORKBENCH"
    s.display.shading.light = "FLAT"; s.display.shading.color_type = "MATERIAL"
    s.display.render_aa = "32"
    s.view_settings.view_transform = "Standard"; s.view_settings.look = "None"
    s.render.resolution_x = s.render.resolution_y = size_px
    s.render.film_transparent = False
    s.render.image_settings.color_mode = "RGB"
    cd = bpy.data.cameras.new("cam"); cd.type = "ORTHO"; cd.ortho_scale = side
    cam = bpy.data.objects.new("cam", cd); cam.location = (x + side / 2, -(y + side / 2), 10)
    s.collection.objects.link(cam); s.camera = cam
    # Grundfläche
    bpy.ops.mesh.primitive_plane_add(size=side * 1.2, location=(x + side / 2, -(y + side / 2), -0.1))
    bpy.context.object.data.materials.append(INK)

def polygon(pts, mat):
    me = bpy.data.meshes.new("p")
    me.from_pydata([(px, -py, 0) for px, py in pts], [], [list(range(len(pts)))])
    o = bpy.data.objects.new("p", me); o.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(o)

def render(path, size=None):
    if size: bpy.context.scene.render.resolution_x = bpy.context.scene.render.resolution_y = size
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

# App-Icon
clear(); x, y, side = mark.icon_frame(); setup(1024, x, y, side)
for p in mark.polys(): polygon(p, VOLT)
render(os.path.join(OUT, "icon-1024.png"))
render(os.path.join(OUT, "icon-512.png"), 512)
render(os.path.join(OUT, "icon-180.png"), 180)

# Startbild (quadratisch, iOS füllt per Aspect Fill → Bildhöhe = Bildschirmhöhe):
# Symbolhöhe = SPLASH_FRAC der Bildhöhe, Bounding-Box des vollen Zeichens mittig
x0, y0, x1, y1 = mark.bbox()
side = mark.H / mark.SPLASH_FRAC
clear(); setup(2732, (x0 + x1) / 2 - side / 2, mark.H / 2 - side / 2, side)
for p in mark.polys(mark.LEVELS["tuck"] * mark.M): polygon(p, VOLT)
render(os.path.join(OUT, "splash-2732.png"))
print("FERTIG", OUT)
