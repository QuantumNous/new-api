#!/usr/bin/env bash
# Turn the 2x PNGs Playwright just captured into the responsive .webp set the download page
# loads, and drop them straight into the web app's public assets — one source of truth, no
# hand-copied duplicates. Matches the existing inspiration-covers convention (480/960/1536).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
GUI="$(cd "$HERE/.." && pwd)"
SRC="$GUI/screenshots/out"
DEST="$(cd "$GUI/../../.." && pwd)/web/default/public/desktop-screenshots"

command -v cwebp >/dev/null || { echo "ERROR: cwebp not found (brew install webp)" >&2; exit 1; }
[ -d "$SRC" ] || { echo "ERROR: no captures in $SRC — run the playwright step first" >&2; exit 1; }

mkdir -p "$DEST"
for png in "$SRC"/*.png; do
  name="$(basename "$png" .png)"
  for width in 480 960 1536; do
    cwebp -quiet -q 82 -resize "$width" 0 "$png" -o "$DEST/$name-$width.webp"
  done
  echo "  $name → ${DEST##*/}/$name-{480,960,1536}.webp"
done

echo ""
du -sh "$DEST"
