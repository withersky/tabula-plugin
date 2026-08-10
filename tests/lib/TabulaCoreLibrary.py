"""Robot Framework библиотека для юнит-тестов Tabula.

Ключевые слова запускают чистые функции из ``src/lib/core.js`` и ``src/lib/storage.js``
в отдельном Node-процессе (``tests/lib/core_runner.js``) и возвращают результат
в виде Python-объекта (словари, списки, числа, строки, None).

Протокол: JSON-запрос -> stdin процесса, JSON-ответ <- stdout процесса.

Аргументы, переданные как строки, автоматически разбираются как JSON-литералы,
если выглядят как таковые: ``25`` -> int 25, ``true`` -> True, ``null`` -> None,
``[1, 2]`` -> список, ``{"a": 1}`` -> словарь. Обычные строки передаются как есть.
"""

import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUNNER = os.path.join(ROOT, "tests", "lib", "core_runner.js")

_NUMBER_RE = re.compile(r"^-?\d+(\.\d+)?([eE][+-]?\d+)?$")


class TabulaCoreLibrary:
    """Ключевые слова для вызова функций src/lib/core.js и src/lib/storage.js."""

    ROBOT_LIBRARY_SCOPE = "SUITE"

    def __init__(self, node="node", timeout=30):
        self._node = node
        self._timeout = int(timeout)

    # ------------------------------------------------------------------
    # Ключевые слова: вернуть значение
    # ------------------------------------------------------------------

    def call_core_function(self, fn_name, *args):
        """Вызывает функцию из src/lib/core.js и возвращает результат."""
        return self._call("core", fn_name, args)

    def call_storage_function(self, fn_name, *args):
        """Вызывает функцию из src/lib/storage.js и возвращает результат."""
        return self._call("storage", fn_name, args)

    # ------------------------------------------------------------------
    # Ключевые слова: вызов + сравнение с ожидаемым значением
    # ------------------------------------------------------------------

    def core_function_should_equal(self, fn_name, expected, *args):
        """Вызывает функцию из src/lib/core.js и сравнивает результат с expected."""
        actual = self._call("core", fn_name, args)
        self._assert_equal(fn_name, args, expected, actual)

    def storage_function_should_equal(self, fn_name, expected, *args):
        """Вызывает функцию из src/lib/storage.js и сравнивает результат с expected."""
        actual = self._call("storage", fn_name, args)
        self._assert_equal(fn_name, args, expected, actual)

    # ------------------------------------------------------------------
    # Ключевые слова: ожидаемая ошибка
    # ------------------------------------------------------------------

    def core_function_should_error(self, fn_name, *args):
        """Вызывает функцию из src/lib/core.js и ожидает исключение.

        Возвращает текст ошибки для дальнейших проверок.
        """
        return self._call_expect_error("core", fn_name, args)

    def storage_function_should_error(self, fn_name, *args):
        """Вызывает функцию из src/lib/storage.js и ожидает исключение.

        Возвращает текст ошибки для дальнейших проверок.
        """
        return self._call_expect_error("storage", fn_name, args)

    # ------------------------------------------------------------------
    # Внутренняя реализация
    # ------------------------------------------------------------------

    def _call(self, ns, fn_name, args):
        resp = self._run(ns, fn_name, args)
        if not resp.get("ok"):
            raise AssertionError(
                "%s(%s) завершилась ошибкой: %s" % (fn_name, _fmt_args(args), resp.get("error"))
            )
        return resp.get("value")

    def _call_expect_error(self, ns, fn_name, args):
        resp = self._run(ns, fn_name, args)
        if resp.get("ok"):
            raise AssertionError(
                "%s(%s): ожидалась ошибка, но вызов вернул %r"
                % (fn_name, _fmt_args(args), resp.get("value"))
            )
        return str(resp.get("error", "unknown error"))

    def _run(self, ns, fn_name, args):
        request = {
            "ns": ns,
            "fn": fn_name,
            "args": [self._convert(a) for a in args],
        }
        try:
            proc = subprocess.run(
                [self._node, RUNNER],
                input=json.dumps(request),
                capture_output=True,
                text=True,
                timeout=self._timeout,
            )
        except subprocess.TimeoutExpired:
            raise AssertionError("runner timeout for %s(%s)" % (fn_name, _fmt_args(args)))
        if proc.returncode != 0:
            raise AssertionError(
                "runner exit=%s, stderr: %s" % (proc.returncode, proc.stderr[:500])
            )
        try:
            return json.loads(proc.stdout)
        except ValueError:
            raise AssertionError("runner output is not JSON: %r" % proc.stdout[:500])

    def _assert_equal(self, fn_name, args, expected, actual):
        exp = self._convert(expected)
        a = json.dumps(actual, sort_keys=True, ensure_ascii=False, default=str)
        b = json.dumps(exp, sort_keys=True, ensure_ascii=False, default=str)
        if a != b:
            raise AssertionError(
                "%s(%s): ожидалось %s, получено %s" % (fn_name, _fmt_args(args), b, a)
            )

    def _convert(self, value):
        """Преобразует строку-аргумент Robot в JSON-значение, если это возможно."""
        if isinstance(value, str):
            s = value.strip()
            if s and (s.startswith(("{", "[", '"')) or s in ("true", "false", "null")
                     or _NUMBER_RE.match(s)):
                try:
                    return json.loads(s)
                except ValueError:
                    return value
        return value


def _fmt_args(args):
    return ", ".join(repr(a) for a in args)
