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
# Запуск юнит-тестов Tabula на Robot Framework.
#
# Требуется:
#   - Node.js (для выполнения чистой логики lib/core.js и lib/storage.js);
#   - Robot Framework (проверяется как: python3 -m robot --version).
#
# Результаты: tests/results/{log.html, report.html, output.xml}
cd "$(dirname "$0")/.." || exit 1

"${PYTHON:-python3}" -m robot --outputdir tests/results tests/suites "$@"
