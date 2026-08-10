#!/usr/bin/env bash
# Запуск юнит-тестов Tabula на Robot Framework.
#
# Требуется:
#   - Node.js (для выполнения чистой логики lib/core.js и lib/storage.js);
#   - Robot Framework (проверяется как: python3 -m robot --version).
#
# Результаты: tests/results/{log.html, report.html, output.xml}
cd "$(dirname "$0")/.." || exit 1

"${PYTHON:-python3}" -m robot --outputdir tests/results tests/suites "$@"
