#!/bin/sh
# Shrinks the colour radar pictures of a site: *_RGB.png -> *_RGB.webp (about 6x smaller, display only).
# HH / HV stay lossless PNG because their pixel values are measurements.
# Usage: sh scripts/rgb-webp.sh <site>     (needs cwebp: brew install webp)
set -e
dir="public/data/${1:?site name}"
for f in "$dir"/*_RGB.png; do
  [ -e "$f" ] || { echo "no *_RGB.png in $dir"; exit 0; }
  cwebp -quiet -q 88 -alpha_q 100 "$f" -o "${f%.png}.webp"
  rm "$f"
done
sed -i.bak 's/_RGB\.png"/_RGB.webp"/' "$dir/manifest.json" && rm "$dir/manifest.json.bak"
echo "done: $dir"
