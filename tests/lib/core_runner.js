#!/usr/bin/env node
/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Copyright (C) 2026 withersky
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

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
 *   {"$fetch": {...}}      -> заглушка fetch для resolveTimezoneByName:
 *                              {"$fetch": {"results":[...]}} -> ответ 200 с JSON
 *                              {"$fetch": {"error": 500}}    -> ответ с HTTP-статусом
 *   {"$gecko": true}       -> симуляция движка Gecko/Firefox: formatToParts для
 *                              month/day "2-digit" НЕ добавляет ведущий ноль
 *                              (возвращает "8" вместо "08"). Нужно, чтобы
 *                              детерминированно воспроизвести баг Firefox, где
 *                              out.date в partsInTz получался "2026-8-14" и ломал
 *                              прогноз погоды для восточных поясов.
 *   {"$noLeadingZeroHour": true} -> как $gecko, но только для часа (имитация
 *                              Firefox, возвращающего "2" вместо "02" для hour "2-digit").
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
    } else if (req.ns === "timezone") {
      api = require(path.join(LIB_DIR, "timezone.js"));
    } else {
      throw new Error("unknown ns: " + req.ns);
    }

    const target = api[req.fn];
    if (target === undefined) {
      throw new Error("export not found: " + req.fn + " in ns " + req.ns);
    }

    let value;
    if (typeof target === "function") {
      // Маркеры симуляции движка ($gecko/$noLeadingZeroHour) обрабатываются
      // внутри convertArg: включают formatToParts-шим, но не удаляются из
      // аргументов (могут соседствовать с $date/$fetch).
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
    // Маркеры симуляции движка (Gecko/Firefox) включают formatToParts-шим
    // и затем продолжают обычное преобразование остальных полей объекта
    // (например $date/$fetch), чтобы не терять сам аргумент.
    const hasGecko = "$gecko" in arg;
    const hasNoZero = "$noLeadingZeroHour" in arg;
    if (hasGecko || hasNoZero) {
      installGeckoFormatShim(hasGecko, hasNoZero);
      const rest = {};
      for (const k of Object.keys(arg)) {
        if (k === "$gecko" || k === "$noLeadingZeroHour") continue;
        rest[k] = arg[k];
      }
      return convertArg(rest);
    }
    if ("$date" in arg) return new Date(arg["$date"]);
    if ("$resolve" in arg) return Promise.resolve(convertArg(arg["$resolve"]));
    if ("$reject" in arg) return Promise.reject(new Error(String(arg["$reject"])));
    if ("$never" in arg) return new Promise(() => {});
    if ("$undefined" in arg) return undefined;
    if ("$fetch" in arg) return makeFakeFetch(arg["$fetch"]);
    const out = {};
    for (const k of Object.keys(arg)) out[k] = convertArg(arg[k]);
    return out;
  }
  if (Array.isArray(arg)) return arg.map(convertArg);
  return arg;
}

// Заглушка fetch: {"results":[...]} -> 200 JSON, {"error":N} -> HTTP N.
function makeFakeFetch(spec) {
  const body = { results: Array.isArray(spec.results) ? spec.results : [] };
  const status = (typeof spec.error === "number") ? spec.error : 200;
  return async function fakeFetch(_url, _opts) {
    return {
      ok: status >= 200 && status < 300,
      status: status,
      async json() { return body; }
    };
  };
}

// undefined не сериализуется в JSON — заменяем на null.
function normalize(v) {
  return v === undefined ? null : v;
}

// Симуляция движка Gecko/Firefox: Intl.DateTimeFormat.prototype.formatToParts
// для month/day/hour "2-digit" НЕ добавляет ведущий ноль (возвращает "8"/"2").
// Подменяем прототип одним разом на процесс, чтобы partsInTz (и любая
// зависящая от него логика) считала дату так же, как в Firefox, — иначе
// баг Firefox (out.date = "2026-8-14" вместо "2026-08-14") не воспроизвести
// в детерминированном Node-харнесе.
let _geckoShimInstalled = false;
function installGeckoFormatShim(stripMonthDay, stripHour) {
  if (_geckoShimInstalled) return;
  _geckoShimInstalled = true;
  const orig = Intl.DateTimeFormat.prototype.formatToParts;
  Intl.DateTimeFormat.prototype.formatToParts = function (date) {
    const parts = orig.call(this, date);
    const opts = this.resolvedOptions();
    const has = (name) => (opts[name] === "2-digit" || opts[name] === "numeric");
    const stripIf = (type, on) => {
      if (!on) return;
      const p = parts.find(x => x.type === type);
      if (p) {
        const n = Number(p.value);
        if (Number.isFinite(n)) p.value = String(n); // убираем ведущий ноль
      }
    };
    if (stripMonthDay) {
      stripIf("month", has("month"));
      stripIf("day", has("day"));
    }
    if (stripHour) {
      stripIf("hour", has("hour") || has("2-digit") || true);
    }
    return parts;
  };
}
