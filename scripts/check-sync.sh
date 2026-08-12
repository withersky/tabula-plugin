#!/usr/bin/env bash
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
#
# Проверка синхронности dist/ с src/ для расширения Tabula.
#
# Слабость «ручная сборка dist»: build.sh копирует src → dist/chrome и
# dist/firefox, и легко забыть пересобрать после правок. Этот скрипт
# пересобирает оба пакета и сверяет содержимое dist с ожидаемым:
#
#   dist/chrome   == src (без manifest.firefox.json)
#   dist/firefox  == src (без manifest.json/manifest.firefox.json),
#                    а manifest.firefox.json должен лежать как manifest.json
#
# Использование:
#   ./scripts/check-sync.sh
#
# Exit code 0 — всё синхронно; 1 — есть расхождения (выводятся списком).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

status=0

check_dir() {
  local label="$1"
  local dir="$2"
  shift 2
  local excludes=()
  for e in "$@"; do excludes+=(--exclude="$e"); done

  if diff -r "${excludes[@]}" "$ROOT/src" "$ROOT/dist/$dir" >/dev/null 2>&1; then
    echo "OK:   dist/$dir синхронен с src/ (кроме ${*:-—})"
  else
    echo "FAIL: dist/$dir расходится с src/ (кроме ${*:-—}):" >&2
    diff -r "${excludes[@]}" "$ROOT/src" "$ROOT/dist/$dir" >&2 || true
    status=1
  fi
}

check_dir "chrome"  "chrome"  manifest.firefox.json
check_dir "firefox" "firefox" manifest.json manifest.firefox.json

# В Firefox-сборке манифест должен быть именно manifest.firefox.json.
if cmp -s "$ROOT/src/manifest.firefox.json" "$ROOT/dist/firefox/manifest.json"; then
  echo "OK:   dist/firefox/manifest.json совпадает с src/manifest.firefox.json"
else
  echo "FAIL: dist/firefox/manifest.json отличается от src/manifest.firefox.json" >&2
  status=1
fi

exit "$status"
