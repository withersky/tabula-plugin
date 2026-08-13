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
 * along with this program.  If not in see <https://www.gnu.org/licenses/>.
 */

// timezone.js — ЕДИНЫЙ источник правды по работе с часовыми поясами.
//
// Раньше логика таймзон дублировалась между виджетами часов (clock.js) и
// погоды (weather.js / core.js), а также background-скриптом
// (reverseGeocodeTz). Везде была своя копия Intl.DateTimeFormat с
// hourCycle:"h23" + коррекцией dayPeriod, и догеокодинг пустого timezone
// работал только для погоды — из-за чего в попапе часов у городов без
// timezone показывалось локальное время устройства, а не время города.
//
// Теперь всё общее здесь:
//   • partsInTz(date, tz, opts)    — числовые части даты/времени в поясе tz
//   • resolveTimezoneByName(name)  — timezone города по имени (open-meteo)
//   • ensureCityTimezone(city, deps) — догеокодинг + запись в Storage
//
// Модуль гибридный (как core.js / storage.js): в Node экспортируется через
// module.exports, в браузере — глобально (работает и в ES-модулях newtab/
// options, и в service worker background.js через importScripts).

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    const api = factory();
    for (const key of Object.keys(api)) {
      root[key] = api[key];
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // ---------- partsInTz: единый форматтер по таймзоне ----------

  // Кэш Intl.DateTimeFormat по ключу "локаль|пояс|опции". Конструктор дорогой,
  // а форматтер вызывается каждые 15 секунд для часов и при каждом рендере
  // прогноза погоды.
  const _fmtCache = new Map();

  function _fmtKey(locale, tz, useDate) {
    return locale + "|" + (tz || "local") + "|" + (useDate ? "d" : "t");
  }

  function _getFormatter(locale, tz, useDate) {
    const key = _fmtKey(locale, tz, useDate);
    let f = _fmtCache.get(key);
    if (!f) {
      const opts = { hour: "2-digit", hourCycle: "h23", minute: "2-digit" };
      if (useDate) {
        opts.year = "numeric";
        opts.month = "2-digit";
        opts.day = "2-digit";
        opts.weekday = "short";
      }
      if (tz) opts.timeZone = tz;
      f = new Intl.DateTimeFormat(locale || "en-CA", opts);
      _fmtCache.set(key, f);
    }
    return f;
  }

  /**
   * Нормализует IANA-таймзон: срезает обрамляющие кавычки и пробелы, которые
   * могут появиться при двойной JSON-сериализации (поле сохранено как строка
   * внутри строки: '"Pacific/Tarawa"'). Intl.DateTimeFormat с таким "поясом"
   * бросает исключение → часы/прогноз считаются в UTC (13:00 вместо 01:00,
   * два «Сегодня»). Возвращает "" для пустых/некорректных значений.
   * @param {string} tz
   * @returns {string}
   */
  function normalizeTz(tz) {
    if (typeof tz !== "string") return "";
    let t = tz.trim();
    if (t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') {
      try {
        const p = JSON.parse(t);
        t = (typeof p === "string") ? p.trim() : t.slice(1, -1).trim();
      } catch (_) {
        t = t.slice(1, -1).trim();
      }
    }
    return t;
  }

  /**
   * Возвращает числовые части даты/времени в таймзоне tz.
   * @param {Date} date исходная дата (обычно new Date())
   * @param {string} tz IANA-пояс ("Europe/Moscow") или "" (локальное время)
   * @param {{locale?: string, date?: boolean, weekdayNames?: string[]}} [opts]
   *   date — включать year/month/day/weekday (для часов нужно)
   *   weekdayNames — массив имён дней (0=Вс) для индекса weekday (иначе число)
   * @returns {{hour:number,minute:number,year?:number,month?:number,day?:number,weekday?:number,date?:string}}
   */
  function partsInTz(date, tz, opts) {
    tz = normalizeTz(tz);
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      date = new Date();
    }
    const o = opts || {};
    const locale = o.locale || "en-CA";
    const includeDate = !!o.date;
    const local = !tz; // пустой tz → локальное время устройства

    const fmt = _getFormatter(locale, local ? null : tz, includeDate);
    const parts = {};
    for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;

    let hour = Number(parts.hour);
    // Защита: некоторые движки (расширение в Firefox) игнорируют hourCycle и
    // возвращают 12-часовой формат с маркером AM/PM. Корректируем час.
    if (parts.dayPeriod === "PM" && hour < 12) hour += 12;
    else if (parts.dayPeriod === "AM" && hour === 12) hour = 0;
    if (hour === 24) hour = 0; // полночь в ряде движков

    const out = { hour: hour, minute: Number(parts.minute) || 0 };
    if (includeDate) {
      const WEEKDAY_INDEX = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };
      let weekday = (WEEKDAY_INDEX[parts.weekday] != null) ? WEEKDAY_INDEX[parts.weekday] : date.getDay();
      if (Array.isArray(o.weekdayNames) && o.weekdayNames[weekday]) {
        // нормализуем к индексу по переданному массиву (совместимо с tx())
        weekday = o.weekdayNames.indexOf(o.weekdayNames[weekday]);
        if (weekday < 0) weekday = WEEKDAY_INDEX[parts.weekday] != null ? WEEKDAY_INDEX[parts.weekday] : date.getDay();
      }
      out.weekday = weekday;
      out.year = Number(parts.year);
      out.month = Number(parts.month) - 1; // 0-based для консистентности
      out.day = Number(parts.day);
      // ВАЖНО: собираем date явно с ведущими нулями. Ряд движков
      // (в т.ч. Gecko/Firefox) для month/day: "2-digit" НЕ добавляет
      // ведущий ноль (возвращает "8", а не "08"). Без нормализации
      // out.date получался бы вида "2026-8-14", что ломает лексические
      // сравнения дат в buildDailyForecast/buildHourlyForecast (фильтр
      // «только текущий день и вперёд») и new Date(day.date + "T12:00:00")
      // → Invalid Date → прогноз погоды для восточных поясов
      // (UTC+12..+14, «уже следующий день») не рендерится («не удалось
      // получить прогноз» на Firefox). Фиксируем YYYY-MM-DD вручную.
      const y = Number(parts.year);
      const m = Number(parts.month);
      const d = Number(parts.day);
      out.date = y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    }
    return out;
  }

  // ---------- resolveTimezoneByName: timezone по имени города ----------

  /**
   * Возвращает IANA-таймзон города по его имени (open-meteo geocoding search).
   * Страны (feature_code = "PCLI") timezone не отдают — для них вернёт "".
   * @param {string} name
   * @param {{fetchImpl?: Function, lang?: string}} [opts] — fetchImpl для тестов
   * @returns {Promise<string>}
   */
  async function resolveTimezoneByName(name, opts) {
    opts = opts || {};
    const _fetch = opts.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
    if (!_fetch) return "";
    const nm = (name || "").trim();
    if (!nm) return "";
    const params = new URLSearchParams({
      name: nm,
      count: "1",
      language: (opts.lang === "en" ? "en" : "ru"),
      format: "json"
    });
    const url = "https://geocoding-api.open-meteo.com/v1/search?" + params.toString();
    const resp = await _fetch(url, { headers: { "Accept": "application/json" } });
    if (!resp.ok) throw new Error("geocoder http " + resp.status);
    const j = await resp.json();
    const list = Array.isArray(j.results) ? j.results : [];
    return (list[0] && list[0].timezone) || "";
  }

  // ---------- ensureCityTimezone: догеокодинг пустого timezone ----------

  /**
   * Если у города пустой timezone — пытается определить его по имени и
   * записать в Storage. Общий для часов и погоды.
   *
   * @param {object} city — {id, name, timezone, ...}
   * @param {object} deps — обязательные зависимости:
   *   sendMessage(msg) — отправка сообщения background (для resolveTimezoneByName
   *                      через weatherReverseGeocode); если не передан, будет
   *                      прямой вызов resolveTimezoneByName (в background).
   *   storage — объект с async update(mutator) и get()
   *   getState() — текущий state (для перечитывания после записи)
   *   setState(s) — обновление state
   *   lang — "ru" | "en"
   * @returns {Promise<string>} итоговый timezone (может остаться "")
   */
  async function ensureCityTimezone(city, deps) {
    if (!city || city.timezone) return city && city.timezone || "";
    const name = (city.name || "").trim();
    if (!name) return "";
    const d = deps || {};
    const lang = d.lang || "ru";
    let tz = "";
    try {
      if (typeof d.sendMessage === "function") {
        const resp = await d.sendMessage({ type: "weatherReverseGeocode", name: name, lang: lang });
        tz = (resp && resp.timezone) || "";
      } else if (typeof resolveTimezoneByName === "function") {
        tz = await resolveTimezoneByName(name, { lang: lang, fetchImpl: d.fetchImpl });
      }
    } catch (_) { tz = ""; }
    if (!tz) return "";
    if (d.storage && typeof d.storage.update === "function") {
      try {
        await d.storage.update((data) => {
          const cities = Array.isArray(data.settings.clockCities) ? data.settings.clockCities : [];
          const c = cities.find(x => x && x.id === city.id);
          if (c) c.timezone = tz;
          const wCities = Array.isArray(data.settings.weatherCities) ? data.settings.weatherCities : [];
          const w = wCities.find(x => x && x.id === city.id);
          if (w) w.timezone = tz;
          // Кэш прогноза (weatherCaches[cityId]) мог быть построен в UTC, пока
          // у города ещё не было timezone (см. рассинхрон tz в background).
          // Сбрасываем его, чтобы следующий refreshWeather перестроил прогноз
          // уже в местном поясе — иначе даты в кэше (UTC) и подсветка
          // «сегодня» (местное время) разъедутся (два «Сегодня» и сдвиг часов).
          if (data.weatherCaches && typeof data.weatherCaches === "object" && w) {
            data.weatherCaches[w.id] = null;
          }
        });
        if (d.setState && d.getState && typeof d.getState === "function") {
          d.setState(await d.getState());
        }
      } catch (_) { /* не критично */ }
    }
    return tz;
  }

  function localTimeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; }
    catch (_) { return ""; }
  }

  return {
    partsInTz,
    normalizeTz,
    resolveTimezoneByName,
    ensureCityTimezone,
    localTimeZone
  };
});
