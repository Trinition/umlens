#!/usr/bin/env bash
set -euo pipefail

# Regenerates PWA PNG icons (512x512 and 192x192) from public/icon.svg
# Requires macOS QuickLook (qlmanage) and sips

SRC="public/icon.svg"
OUT_512="public/icon-512.png"
OUT_192="public/icon-192.png"

if [ ! -f "$SRC" ]; then
  echo "Error: $SRC not found." >&2
  exit 1
fi

qlmanage -t -s 512 -o public "$SRC" >/dev/null 2>&1
mv "public/$(basename "$SRC").png" "$OUT_512"
sips -z 192 192 "$OUT_512" --out "$OUT_192" >/dev/null

echo "Generated $OUT_512 and $OUT_192 from $SRC"
