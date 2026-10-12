#!/bin/zsh
# Übungsclips rendern und kodieren: art/blender/clips.sh <übung> [<übung> …]
# Ergebnis: public/clips/<übung>.mp4 (800×600, 24 fps, Loop) und art/out/clips/<übung>-contact.png zur Kontrolle.
set -e
cd "${0:A:h}/../.."
BL=art/vendor/Blender.app/Contents/MacOS/Blender
BLEND=(art/vendor/human-base-meshes-bundle-v*/human_base_meshes_bundle.blend)
mkdir -p public/clips art/out/clips
snap=$(mktemp -d art/out/clips/.skripte.XXXX)       # Skriptstand einfrieren: Änderungen während des Laufs wirken nicht
cp art/blender/lever.py art/blender/moves.py $snap/
for ex in "$@"; do
  dir=art/out/clips/$ex; rm -rf $dir; mkdir -p $dir
  $BL -b $BLEND[1] --python $snap/lever.py -- clip $ex $dir > $dir.log 2>&1 || { echo "$ex: Blender-Fehler, siehe $dir.log"; continue }
  ffmpeg -y -loglevel error -f lavfi -i color=c=0x1a1a1a:s=800x600:r=24 -framerate 24 -i $dir/frame_%04d.png \
    -filter_complex "[0][1]overlay=shortest=1,format=yuv420p" \
    -c:v libx264 -preset slow -crf 24 -movflags +faststart -an public/clips/$ex.mp4
  ffmpeg -y -loglevel error -i public/clips/$ex.mp4 -vf "select='not(mod(n\,8))',scale=400:-1,tile=3x2" -frames:v 1 art/out/clips/$ex-contact.png
  echo "$ex: $(stat -f %z public/clips/$ex.mp4) Bytes"
done
rm -rf $snap
