# Tabula — spreadsheet-style new tab page browser extension.
#
# Copyright (C) 2026 withersky
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

#!/usr/bin/env bash
# Build script for Tabula extension.
#
# Usage:
#   ./build.sh chrome   -> build to dist/chrome/
#   ./build.sh firefox  -> build to dist/firefox/
#   ./build.sh all      -> build both
#
# The script copies the shared source tree and selects the right manifest
# for each target. The Firefox build uses manifest.firefox.json (which
# declares background.scripts instead of service_worker for compatibility
# with Firefox 140+).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$ROOT/dist"

# Содержимое src/ — это и есть пакет расширения (manifest.json, страницы,
# модули, lib, иконки). build.sh копирует его целиком и выбирает манифест.
SRC_DIR="$ROOT/src"

build_chrome() {
  local out="$DIST/chrome"
  rm -rf "$out"
  mkdir -p "$out"

  cp -R "$SRC_DIR/." "$out/"

  # Remove Firefox-specific manifest from Chrome build.
  rm -f "$out/manifest.firefox.json"

  echo "Chrome build -> $out"
}

build_firefox() {
  local out="$DIST/firefox"
  rm -rf "$out"
  mkdir -p "$out"

  cp -R "$SRC_DIR/." "$out/"

  # Replace Chrome manifest with the Firefox-specific one.
  rm -f "$out/manifest.json"
  cp "$SRC_DIR/manifest.firefox.json" "$out/manifest.json"
  rm -f "$out/manifest.firefox.json"

  echo "Firefox build -> $out"
}

case "${1:-}" in
  chrome)
    build_chrome
    ;;
  firefox)
    build_firefox
    ;;
  all)
    build_chrome
    build_firefox
    ;;
  *)
    echo "Usage: $0 {chrome|firefox|all}" >&2
    exit 1
    ;;
esac
