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
#   ./build.sh yandex   -> build to dist/yandex/
#   ./build.sh all      -> build chrome + firefox + yandex
#
# The script copies the shared source tree and selects the right manifest
# for each target. The Firefox build uses manifest.firefox.json (which
# declares background.scripts instead of service_worker for compatibility
# with Firefox 140+). The Yandex build uses manifest.yandex.json: a Chromium
# MV3 manifest WITHOUT chrome_url_overrides — Яндекс Браузер не позволяет
# переопределять новую вкладку, поэтому расширение запускается кликом по
# иконке из панели (background.js слушает action.onClicked и открывает
# newtab/newtab.html).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$ROOT/dist"

# Содержимое src/ — это и есть пакет расширения (manifest.json, страницы,
# модули, lib, иконки). build.sh копирует его целиком и выбирает манифест.
SRC_DIR="$ROOT/src"

# Генерируем браузерные i18n-скрипты из JSON-словарей (src/i18n/*.json →
# src/i18n/generated/*.js). Нужен Node.js; без него сборка продолжается,
# но переводы могут устареть.
if command -v node >/dev/null 2>&1; then
  node "$ROOT/scripts/gen-i18n.mjs"
else
  echo "Warning: node not found, skipping i18n generation" >&2
fi

build_chrome() {
  local out="$DIST/chrome"
  rm -rf "$out"
  mkdir -p "$out"

  cp -R "$SRC_DIR/." "$out/"

  # Remove browser-specific manifests that don't apply to Chrome build.
  # manifest.json itself is already the Chrome one, so it stays.
  rm -f "$out/manifest.firefox.json" "$out/manifest.yandex.json"

  echo "Chrome build -> $out"
}

build_firefox() {
  local out="$DIST/firefox"
  rm -rf "$out"
  mkdir -p "$out"

  cp -R "$SRC_DIR/." "$out/"

  # Replace Chrome manifest with the Firefox-specific one.
  rm -f "$out/manifest.json" "$out/manifest.yandex.json"
  cp "$SRC_DIR/manifest.firefox.json" "$out/manifest.json"
  rm -f "$out/manifest.firefox.json"

  echo "Firefox build -> $out"
}

build_yandex() {
  local out="$DIST/yandex"
  rm -rf "$out"
  mkdir -p "$out"

  cp -R "$SRC_DIR/." "$out/"

  # Яндекс Браузер не поддерживает chrome_url_overrides для newtab, поэтому
  # используем манифест без переопределения страницы. Запуск — кликом по
  # иконке расширения (action.onClicked в background.js открывает newtab.html).
  rm -f "$out/manifest.json" "$out/manifest.firefox.json"
  cp "$SRC_DIR/manifest.yandex.json" "$out/manifest.json"
  rm -f "$out/manifest.yandex.json"

  echo "Yandex build -> $out"
}

case "${1:-}" in
  chrome)
    build_chrome
    ;;
  firefox)
    build_firefox
    ;;
  yandex)
    build_yandex
    ;;
  all)
    build_chrome
    build_firefox
    build_yandex
    ;;
  *)
    echo "Usage: $0 {chrome|firefox|yandex|all}" >&2
    exit 1
    ;;
esac
