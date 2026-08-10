#!/usr/bin/env node
"use strict";

/*
 * core_runner.js — мост между Robot Framework и чистой логикой Tabula.
 *
 * Читает из stdin один JSON-запрос:
 *   { "ns": "core" | "storage", "fn": "имя функции или константы", "args": [...] }
 *
 * Выполняет функцию в Node и пишет в stdout JSON-ответ:
 *   { "ok": true,  "value": <результат> }       — успех
 *   { "ok": false, "error": "<текст ошибки>" }  — исключение (в т.ч. ожидаемое)
 *
 * Каждый вызов — отдельный процесс, поэтому состояние между вызовами
 * не разделяется (детерминированные юнит-тесты).
 *
 * Специальные маркеры в аргументах (передаются как JSON-объекты):
 *   {"$date": "ISO"}       -> new Date(ISO)                (для dayLabel / formatDateFmt)
 *   {"$resolve": value}    -> Promise.resolve(value)       (для withTimeout)
 *   {"$reject": "msg"}     -> Promise.reject(new Error(msg))
 *   {"$never": true}       -> Promise, который не резолвится (тест таймаута)
 *   {"$undefined": true}   -> undefined                    (например, "нет координат")
 */

const fs = require("fs");
const path = require("path");

const LIB_DIR = path.resolve(__dirname, "..", "..", "src", "lib");

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", async () => {
  let result;
  try {
    const req = JSON.parse(raw);
    if (!req || typeof req.ns !== "string" || typeof req.fn !== "string") {
      throw new Error("bad request: ns and fn are required");
    }

    let api;
    if (req.ns === "core") {
      api = require(path.join(LIB_DIR, "core.js"));
    } else if (req.ns === "storage") {
      // storage.js пишет экспорт в window.* (как в браузере) и в module.exports.
      globalThis.window = globalThis;
      api = require(path.join(LIB_DIR, "storage.js"));
    } else {
      throw new Error("unknown ns: " + req.ns);
    }

    const target = api[req.fn];
    if (target === undefined) {
      throw new Error("export not found: " + req.fn + " in ns " + req.ns);
    }

    let value;
    if (typeof target === "function") {
      const args = (req.args || []).map(convertArg);
      value = await target.apply(null, args);
    } else {
      if (req.args && req.args.length) {
        throw new Error("not callable: " + req.fn);
      }
      value = target; // константа (DEFAULT_DATA, FONT_FAMILIES, I18N, ...)
    }
    result = { ok: true, value: normalize(value) };
  } catch (e) {
    result = { ok: false, error: String((e && e.message) || e) };
  }
  process.stdout.write(JSON.stringify(result), () => process.exit(0));
});

// Преобразование специальных маркеров (см. шапку файла).
function convertArg(arg) {
  if (arg && typeof arg === "object" && !Array.isArray(arg)) {
    if ("$date" in arg) return new Date(arg["$date"]);
    if ("$resolve" in arg) return Promise.resolve(convertArg(arg["$resolve"]));
    if ("$reject" in arg) return Promise.reject(new Error(String(arg["$reject"])));
    if ("$never" in arg) return new Promise(() => {});
    if ("$undefined" in arg) return undefined;
    const out = {};
    for (const k of Object.keys(arg)) out[k] = convertArg(arg[k]);
    return out;
  }
  if (Array.isArray(arg)) return arg.map(convertArg);
  return arg;
}

// undefined не сериализуется в JSON — заменяем на null.
function normalize(v) {
  return v === undefined ? null : v;
}
