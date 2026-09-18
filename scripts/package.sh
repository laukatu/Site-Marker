#!/usr/bin/env bash
# Builds a Chrome Web Store ready zip with only the files the extension needs.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version")
OUT_DIR="dist"
OUT="$OUT_DIR/site-marker-$VERSION.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT"

zip -q -X -r "$OUT" \
    manifest.json \
    background.js \
    common.js \
    badge.js \
    ui.css \
    options.html \
    options.css \
    options.js \
    popup.html \
    popup.js \
    _locales \
    images/logo16.png \
    images/logo32.png \
    images/logo48.png \
    images/logo128.png

echo "Created $OUT"
unzip -l "$OUT"
