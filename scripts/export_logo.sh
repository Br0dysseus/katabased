#!/usr/bin/env bash
# kataBased logo export pipeline
# Generates all required variants from source SVGs in public/
# Usage: bash scripts/export_logo.sh

set -euo pipefail

SVGO="$HOME/.local/bin/svgo"
PUBLIC="$(dirname "$0")/../public"
cd "$PUBLIC"

echo "── kataBased logo export ──────────────────"

# ── 1. Optimize SVGs in-place (backup first) ──
for svg in kata_logo_full.svg kata_logo.svg kata_logo_mark.svg; do
  if [ -f "$svg" ]; then
    cp "$svg" "${svg%.svg}_backup.svg"
    $SVGO "$svg" -o "${svg%.svg}_optimized.svg" --pretty
    echo "  ✓ Optimized → ${svg%.svg}_optimized.svg"
  fi
done

# ── 2. Export PNGs via Inkscape ────────────────
if command -v inkscape &>/dev/null; then
  # Full logo — 1200px, 600px, 300px
  for w in 1200 600 300; do
    inkscape kata_logo_full.svg \
      --export-type=png \
      --export-filename="kata_logo_full_${w}w.png" \
      --export-width=$w 2>/dev/null
    echo "  ✓ PNG ${w}px → kata_logo_full_${w}w.png"
  done

  # Mark only — 512px, 256px, 64px, 32px
  for w in 512 256 64 32; do
    inkscape kata_logo_mark.svg \
      --export-type=png \
      --export-filename="kata_logo_mark_${w}px.png" \
      --export-width=$w --export-height=$w 2>/dev/null
    echo "  ✓ Mark ${w}px → kata_logo_mark_${w}px.png"
  done

  # Favicon (32x32)
  inkscape kata_logo_mark.svg \
    --export-type=png \
    --export-filename="favicon_32.png" \
    --export-width=32 --export-height=32 2>/dev/null
  echo "  ✓ Favicon → favicon_32.png"
else
  echo "  ✗ Inkscape not found — PNG export skipped"
fi

echo "── Export complete ────────────────────────"
echo "Files in: $PUBLIC"
ls -lh *.png *.svg 2>/dev/null | grep -v backup
