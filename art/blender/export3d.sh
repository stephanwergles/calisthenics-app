#!/bin/zsh
# Echtzeit-3D für die App: art/blender/export3d.sh [<übung> …]   (ohne Argumente: alle Übungen aus src/seed/catalog.json)
# Ergebnis in art/out/3d (nicht im Repo):
#   figure.glb          Figur + Skelett in Ruhepose, einmal (dezimiert, KHR_mesh_quantization – kein Draco/Meshopt,
#                       die App hat unter Hermes kein WebAssembly). Neu erzeugen mit FIGURE=1.
#   anim/<id>.glb       nur Skelett-Animation (gleiche Knochennamen) + Geräte der Übung, resampled + quantisiert
#   anim/<id>.json      Dauer, Kamera-Vorschlag (wie im Clip), Ausmaße – zusammengeführt in index.json
# Wie clips.sh: Skriptstand eingefroren, vor dem Export muss die Anatomie-Prüfung bestehen (FORCE=1 übergeht sie).
set -e
cd "${0:A:h}/../.."
BL=art/vendor/Blender.app/Contents/MacOS/Blender
BLEND=(art/vendor/human-base-meshes-bundle-v*/human_base_meshes_bundle.blend)
OUT=art/out/3d; mkdir -p $OUT/anim
GT=(npx --yes @gltf-transform/cli@4.5.1)
snap=$(mktemp -d art/out/clips/.skripte.XXXX); cp art/blender/lever.py art/blender/moves.py $snap/
ids=("$@")
(( $#ids )) || ids=($(python3 -c "import json;print(' '.join(e['id'] for e in json.load(open('src/seed/catalog.json'))['exercises']))"))
if [[ ! -f $OUT/figure.glb || -n $FIGURE ]]; then
  LEVER_SUBDIV=1 LEVER_GLTF_VERTS=18000 LEVER_GLTF_PART=figure $BL -b $BLEND[1] --python $snap/lever.py -- gltf $ids[1] $OUT > $OUT/figure.log 2>&1
  $GT quantize $OUT/figure.glb $OUT/figure.glb > /dev/null
  echo "figure.glb: $(stat -f %z $OUT/figure.glb) Bytes"
fi
one() {   # eine Übung: prüfen, exportieren (Grundnetz reicht, die Figur steckt nicht in der Datei), verkleinern
  local ex=$1 dir=art/out/3d/.tmp/$1; rm -rf $dir; mkdir -p $dir
  if [[ -z $FORCE ]]; then          # FORCE=1: ohne Prüfung (z. B. direkt nach einem vollständigen check-Lauf)
    local verdict=$($BL -b $BLEND[1] --python $snap/lever.py -- check $ex $dir 2>&1 | grep "^PRUEFUNG")
    if [[ $verdict != *" ok" ]]; then echo "$ex: nicht exportiert – $verdict"; return; fi
  fi
  LEVER_SUBDIV=0 LEVER_GLTF_SUBDIV=0 LEVER_GLTF_PART=anim $BL -b $BLEND[1] --python $snap/lever.py -- gltf $ex $dir > $dir.log 2>&1 \
    || { echo "$ex: Blender-Fehler, siehe $dir.log"; return }
  $GT resample $dir/$ex.glb $dir/r.glb > /dev/null && $GT quantize $dir/r.glb $OUT/anim/$ex.glb > /dev/null
  mv $dir/$ex.json $OUT/anim/; rm -rf $dir $dir.log
  echo "$ex: $(stat -f %z $OUT/anim/$ex.glb) Bytes"
}
for ex in $ids; do
  while (( $(jobs -r | wc -l) >= ${JOBS:-4} )); do sleep 1; done
  one $ex &
done
wait
python3 - <<'EOF'
import json, glob
idx = {"figure": "figure.glb", "exercises": {}}
for f in sorted(glob.glob("art/out/3d/anim/*.json")):
    m = json.load(open(f)); idx["exercises"][m.pop("id")] = m
json.dump(idx, open("art/out/3d/index.json", "w"), indent=1)
print("index.json:", len(idx["exercises"]), "Übungen")
EOF
rm -rf $snap art/out/3d/.tmp
