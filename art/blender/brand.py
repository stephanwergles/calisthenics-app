"""Lever – App-Icon (Variante B2) und Startbildschirm, flach gerendert mit exakten Markenfarben.

  art/vendor/Blender.app/Contents/MacOS/Blender -b --factory-startup --python art/blender/brand.py -- <ausgabeordner>

Icon: Volt-Fläche, schwarze Stange, „L“ aus Barlow Condensed Black Italic (art/fonts, SIL OFL),
Geometrie wie im Canvas-Entwurf (viewBox 0–100). iOS rundet die Ecken selbst – deshalb vollflächig.
Startbildschirm: Schwarz mit der Volt-Wortmarke LEVER.
"""
import bpy, os, sys
OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)
FONT = os.path.join(os.path.dirname(__file__), "..", "fonts", "BarlowCondensed-BlackItalic.ttf")

def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)

def clear():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)

def flat(name, hexcol):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = srgb(hexcol)
    return m

def setup(size_px, extent):
    """Orthografische Draufsicht auf das Quadrat 0..extent, Workbench flach (Farben 1:1)."""
    s = bpy.context.scene
    s.render.engine = "BLENDER_WORKBENCH"
    s.display.shading.light = "FLAT"; s.display.shading.color_type = "MATERIAL"
    s.display.render_aa = "32"
    s.view_settings.view_transform = "Standard"; s.view_settings.look = "None"
    s.render.resolution_x = s.render.resolution_y = size_px
    s.render.film_transparent = False
    s.render.image_settings.color_mode = "RGB"
    cd = bpy.data.cameras.new("cam"); cd.type = "ORTHO"; cd.ortho_scale = extent
    cam = bpy.data.objects.new("cam", cd); cam.location = (extent / 2, extent / 2, 10)
    s.collection.objects.link(cam); s.camera = cam

def rect(x, y, w, h, mat, z=0.0, round_ends=False):
    """Rechteck in viewBox-Koordinaten (y nach unten), optional mit runden Enden (Kapsel)."""
    s = bpy.context.scene
    cy = 100 - (y + h / 2)
    if round_ends:
        r = h / 2
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x + w / 2, cy, z)); o = bpy.context.object
        o.scale = (w - h, h, 1); o.data.materials.append(mat)
        for ex in (x + r, x + w - r):
            bpy.ops.mesh.primitive_circle_add(vertices=96, radius=r, fill_type="NGON", location=(ex, cy, z))
            bpy.context.object.data.materials.append(mat)
    else:
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x + w / 2, cy, z)); o = bpy.context.object
        o.scale = (w, h, 1); o.data.materials.append(mat)

def text(body, x, baseline, size, mat, z=0.1):
    font = bpy.data.fonts.load(FONT, check_existing=True)
    cu = bpy.data.curves.new("t", "FONT"); cu.body = body; cu.font = font; cu.size = size
    cu.align_x = "CENTER"; cu.align_y = "BOTTOM_BASELINE"
    o = bpy.data.objects.new("t", cu); o.location = (x, 100 - baseline, z)
    bpy.context.scene.collection.objects.link(o); o.data.materials.append(mat)
    return o

def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

VOLT, INK = flat("volt", "#d4ff3a"), flat("ink", "#101010")

# App-Icon (B2) – exakt wie im Entwurf
clear(); setup(1024, 100)
rect(0, 0, 100, 100, VOLT, z=-0.1)
rect(21, 17, 62, 7.5, INK, round_ends=True)
text("L", 50, 87, 112, INK)   # Blender misst die Größe anders als SVG: 112 ≙ font-size 84
render(os.path.join(OUT, "icon-1024.png"))
bpy.context.scene.render.resolution_x = bpy.context.scene.render.resolution_y = 180
render(os.path.join(OUT, "icon-180.png"))
bpy.context.scene.render.resolution_x = bpy.context.scene.render.resolution_y = 512
render(os.path.join(OUT, "icon-512.png"))

# Startbildschirm: Schwarz, Wortmarke mittig
clear(); setup(2732, 100)
rect(0, 0, 100, 100, INK, z=-0.1)
text("LEVER", 50, 55, 15, VOLT)
render(os.path.join(OUT, "splash-2732.png"))
print("FERTIG", OUT)
