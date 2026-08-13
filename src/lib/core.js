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

// Core — чистые (pure) функции Tabula: не зависят от DOM и API браузера.
//
// Загружается первым в newtab.html / options.html и в background.js, чтобы
// функции были доступны глобально (так же, как раньше были объявлены прямо
// в этих файлах). В Node (юнит-тесты на Robot Framework) модуль
// экспортируется через module.exports и подключается через require().
//
// Единый источник правды: НЕ дублируйте эти функции в других файлах.

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

  // partsInTz берётся ЛЕНИВО через _getPartsInTz(): в service worker
  // lib/timezone.js грузится ПОСЛЕ lib/core.js, поэтому на этапе
  // инициализации глобал partsInTz ещё не определён (и require недоступен) —
  // иначе buildHourlyForecast/buildDailyForecast всегда считали UTC.
  function _getPartsInTz() {
    if (typeof globalThis !== "undefined" && globalThis.partsInTz) return globalThis.partsInTz;
    if (typeof require === "function") {
      try { return require("./timezone.js").partsInTz; } catch (_) { /* ignore */ }
    }
    return null;
  }

  // ---------- погода: иконки и описания ----------

  const WEATHER_ICON_EMOJI = {
    113: "☀️", 116: "⛅️", 119: "☁️", 122: "☁️",
    143: "🌫", 176: "🌦", 179: "🌧", 182: "🌧", 185: "🌧",
    200: "⛈", 227: "🌨", 230: "❄️", 248: "🌫", 260: "🌫",
    263: "🌦", 266: "🌧", 281: "🌧", 284: "🌧", 293: "🌦",
    296: "🌧", 299: "🌧", 302: "🌧", 305: "🌧", 308: "🌧",
    311: "🌧", 314: "🌧", 317: "🌧", 320: "🌨", 323: "🌨",
    326: "🌨", 329: "❄️", 332: "❄️", 335: "❄️", 338: "❄️",
    350: "🌧", 353: "🌦", 356: "🌧", 359: "🌧", 362: "🌦",
    365: "🌧", 368: "🌨", 371: "❄️", 374: "🌧", 377: "🌧",
    386: "⛈", 389: "⛈", 392: "🌨", 395: "❄️"
  };

  // Человеко-понятные описания symbol_code met.no.
  // База — это symbol без суффиксов _day / _night / _polartwilight.
  // Словари вынесены в JSON (src/i18n/symbols.*.json), чтобы переводы
  // могло добавлять сообщество. В браузере данные подставляет
  // src/i18n/generated/symbols.js (глобал I18N_SYMBOLS); в Node — require.
  const SYMBOL_DESC =
    (typeof globalThis !== "undefined" && globalThis.I18N_SYMBOLS) ||
    (typeof require === "function"
      ? { ru: require("../i18n/symbols.ru.json"), en: require("../i18n/symbols.en.json") }
      : { ru: {}, en: {} });

  function describeSymbol(symbol, lang) {
    if (!symbol) return "";
    const base = String(symbol).replace(/_day$|_night$|_polartwilight$/, "");
    const dict = SYMBOL_DESC[lang] || SYMBOL_DESC.ru;
    if (dict[base]) return dict[base];
    // Если базовый ключ не нашёлся, попробуем снять префиксы light/heavy.
    const stripped = base.replace(/^(light|heavy)/, "");
    if (dict[stripped]) return dict[stripped];
    return base;
  }

  function weatherIconFor(code) {
    return WEATHER_ICON_EMOJI[code] || "⛅️";
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), ms);
      promise.then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); }
      );
    });
  }

  function aggregatorUrl(lat, lon, cityName, lang) {
    // Используем Яндекс.Погоду по координатам, формат вида
    // https://yandex.ru/pogoda/ru?lat=55.75581741&lon=37.61764526
    const hasCoords = isFinite(Number(lat)) && isFinite(Number(lon));
    if (hasCoords) {
      const langPath = (lang === "en") ? "en" : "ru";
      return "https://yandex.ru/pogoda/" + langPath + "?lat=" + encodeURIComponent(String(lat)) + "&lon=" + encodeURIComponent(String(lon));
    }
    const name = (cityName || "").trim();
    if (name) return "https://yandex.ru/pogoda/search?request=" + encodeURIComponent(name);
    return "https://yandex.ru/pogoda";
  }

  // Метка дня в попапе погоды. translate — функция (key) => строка (обычно tx).
  // tz — IANA-пояс города (необязательно): «завтра» считается в ЭТОМ же поясе,
  // что и дата прогноза (date). Иначе для восточных поясов (UTC+12 и т.п.) второй
  // день прогноза (городской «завтра») по часам пользователя — уже другая дата,
  // и метка вместо «Завтра» показывала день недели.
  function dayLabel(date, idx, isToday, lang, translate, tz) {
    const tr = (typeof translate === "function") ? translate : (k) => k;
    if (isToday) return tr("weatherToday");
    const d = date || new Date();
    // «Завтра» = следующий день после «сегодня» в поясе города (tz), иначе —
    // по локальному времени устройства (для обратной совместимости/без tz).
    let tomorrowKey = null;
    if (tz) {
      const pit = _getPartsInTz();
      if (typeof pit === "function") {
        try {
          const now = new Date(Date.now() + 86400000);
          tomorrowKey = pit(now, tz, { date: true, locale: "en-CA" }).date;
        } catch (_) { tomorrowKey = null; }
      }
    }
    if (!tomorrowKey) {
      const tomorrow = new Date(Date.now() + 86400000);
      tomorrowKey = tomorrow.getFullYear() + "-" + String(tomorrow.getMonth() + 1).padStart(2, "0") + "-" + String(tomorrow.getDate()).padStart(2, "0");
    }
    const dayKey = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    if (dayKey === tomorrowKey) return tr("weatherTomorrow");
    const opts = { weekday: "short" };
    const locale = (lang === "en") ? "en-GB" : "ru-RU";
    try {
      return d.toLocaleDateString(locale, opts).replace(/\.$/, "");
    } catch (_) {
      return d.toLocaleDateString("ru-RU", opts).replace(/\.$/, "");
    }
  }

  function formatDateFmt(d, fmt, lang) {
    if (!d || !fmt || fmt === "off") return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    if (fmt === "dd.mm.yyyy") return dd + "." + mm + "." + d.getFullYear();
    if (fmt === "dd.mm.yy") return dd + "." + mm + "." + String(d.getFullYear()).slice(-2);
    if (fmt === "dd.mon" || fmt === "dd.month") {
      const locale = (lang === "en") ? "en-GB" : "ru-RU";
      try {
        const s = d.toLocaleDateString(locale, {
          day: "2-digit",
          month: (fmt === "dd.mon") ? "short" : "long"
        });
        return s.replace(/\./g, "");
      } catch (_) {
        return dd + "." + mm;
      }
    }
    return dd + "." + mm;
  }

  // ---------- URL и бейджи ----------

  function normalizeUrl(u) {
    if (!u) return "#";
    let s = String(u).trim();
    if (!/^https?:\/\//i.test(s) && !s.startsWith("chrome://") && !s.startsWith("file://")) {
      s = "https://" + s;
    }
    return s;
  }

  // Хост сайта — ключ кэша фавиконок (github.com, mail.google.com).
  function faviconHost(u) {
    try {
      const host = new URL(normalizeUrl(u)).hostname;
      return host || "";
    } catch (_) {
      return "";
    }
  }

  // Прямой URL фавиконки сайта — без внешних сервисов (приватность):
  // иконка грузится с самого сайта и кэшируется в storage (offline).
  function faviconUrl(u) {
    try {
      const parsed = new URL(normalizeUrl(u));
      const host = parsed.hostname;
      if (!host) return "";
      const proto = parsed.protocol === "http:" ? "http:" : "https:";
      return proto + "//" + host + "/favicon.ico";
    } catch (_) {
      return "";
    }
  }

  // LRU-обрезка кэша фавиконок. Сначала удаляет записи старше maxAge,
  // затем вытесняет самые старые по ts, пока кэш не влезет в maxEntries
  // (число записей) и maxTotal (суммарная длина data в байтах).
  // Чистая функция: используется модулем newtab/js/favicons.js и тестами.
  function pruneFaviconCache(cache, now, opts) {
    opts = opts || {};
    const maxAge = opts.maxAge;
    const maxEntries = opts.maxEntries;
    const maxTotal = opts.maxTotal;
    const entries = [];
    for (const host of Object.keys(cache || {})) {
      const v = cache[host];
      if (!v || typeof v !== "object") continue;
      const data = (typeof v.data === "string") ? v.data : "";
      const ts = Number.isFinite(v.ts) ? v.ts : 0;
      if (maxAge != null && now - ts > maxAge) continue;
      entries.push({ host, data, ts });
    }
    entries.sort((a, b) => a.ts - b.ts); // старые первыми
    let total = 0;
    for (const e of entries) total += e.data.length;
    while (entries.length > 0 &&
           ((maxEntries != null && entries.length > maxEntries) ||
            (maxTotal != null && total > maxTotal))) {
      total -= entries.shift().data.length;
    }
    const out = {};
    for (const e of entries) out[e.host] = { data: e.data, ts: e.ts };
    return out;
  }

  // Первая буква названия для бейджа ячейки (когда фавиконка скрыта).
  function letterChar(title) {
    return (title || "?").trim().charAt(0).toUpperCase();
  }

  // ---------- сетка: ключи ячеек ----------

  function keyParts(key) {
    const p = String(key).split(",");
    return [parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0];
  }

  function rangeKeys(a, b) {
    const [r0, c0] = keyParts(a);
    const [r1, c1] = keyParts(b);
    const rmin = Math.min(r0, r1), rmax = Math.max(r0, r1);
    const cmin = Math.min(c0, c1), cmax = Math.max(c0, c1);
    const keys = [];
    for (let r = rmin; r <= rmax; r++) {
      for (let c = cmin; c <= cmax; c++) keys.push(r + "," + c);
    }
    return keys;
  }

  // Первая свободная ячейка после key в пределах строки (для дублирования).
  function nextEmptyAfter(sh, key, cols) {
    const parts = String(key).split(",");
    const r = parseInt(parts[0], 10) || 0;
    const c = parseInt(parts[1], 10) || 0;
    const colCount = cols || 8;
    for (let dr = 0; dr < 100; dr++) {
      for (let dc = 0; dc < colCount; dc++) {
        const rr = r + dr;
        const cc = (dr === 0 ? c + 1 : 0) + dc;
        if (cc >= colCount) continue;
        const k = rr + "," + cc;
        if (!sh.cells[k]) return k;
      }
    }
    return null;
  }

  // ---------- фон (service worker) ----------

  // Полный маппинг символов met.no (https://api.met.no/weatherapi/weathericon/2.0/documentation)
  // на коды погоды WorldWeatherOnline (используемые в словарях иконок).
  function symbolToCode(symbolCode) {
    if (!symbolCode || typeof symbolCode !== "string") return null;
    const exact = symbolCode.toLowerCase().replace(/_day$|_night$|_polartwilight$/, "");
    const MAP = {
      "clearsky": 113,
      "fair": 116,
      "partlycloudy": 116,
      "cloudy": 119,
      "rainshowers": 176,
      "lightrainshowers": 176,
      "heavyrainshowers": 182,
      "rainshowersandthunder": 200,
      "lightrainshowersandthunder": 200,
      "heavyrainshowersandthunder": 200,
      "sleetshowers": 179,
      "lightsleetshowers": 179,
      "heavysleetshowers": 182,
      "snowshowers": 227,
      "lightsnowshowers": 227,
      "heavysnowshowers": 230,
      "rain": 296,
      "lightrain": 296,
      "heavyrain": 302,
      "rainandthunder": 200,
      "heavyrainandthunder": 302,
      "sleet": 185,
      "lightsleet": 185,
      "heavysleet": 185,
      "snow": 332,
      "lightsnow": 332,
      "heavysnow": 338,
      "snowandthunder": 392,
      "heavysnowandthunder": 395,
      "fog": 248,
      "lightfog": 248
    };
    if (MAP[exact] != null) return MAP[exact];
    const stripped = exact.replace(/^(light|heavy)/, "");
    if (MAP[stripped] != null) return MAP[stripped];
    return null;
  }

  function num(v) {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  // Сворачивает почасовой timeseries met.no в прогноз по дням.
  // День и час считаются в часовом поясе города (tz, IANA), если он задан,
  // иначе — по UTC (прежнее поведение). Первый день начинается с ТЕКУЩЕГО
  // часа (прошедшие часы отбрасываются), а дни раньше текущего дня города —
  // тоже отбрасываются. Так при смене города на «вчерашний» (например, −13 ч
  // от пользователя) прогноз честно переигрывается с того дня, который сейчас
  // актуален в городе, и часы — с текущего часа местного времени города.
  // `now` — опциональный якорь «текущее время» (по умолчанию Date.now()),
  // нужен для детерминированных тестов (фиксирует «сегодня» и текущий час).
  function buildDailyForecast(timeseries, lang, tz, now) {
    const days = [];
    let currentDayKey = null;
    let current = null;
    // Фильтрация «только текущий день и вперёд» включается только при наличии
    // tz (прод-путь). Без tz (старые тесты/вызовы) поведение прежнее: весь
    // timeseries целиком, без отсечки по текущему часу.
    const nowHd = tz ? hourAndDateInTz({ time: (now != null ? now : Date.now()) }, tz) : null;
    const todayKey = nowHd ? nowHd.date : null;
    let started = false;
    const push = () => {
      if (!current) return;
      current.symbol = current.symbol || null;
      current.code = symbolToCode(current.symbol);
      current.desc = current.symbol || (lang === "en" ? "Weather" : "Погода");
      days.push(current);
      current = null;
    };
    if (!Array.isArray(timeseries)) return days;
    for (const item of timeseries) {
      const hd = hourAndDateInTz(item, tz);
      if (!hd) continue;
      if (todayKey && hd.date < todayKey) continue;
      if (!started) {
        if (todayKey && hd.date === todayKey && hd.hour < nowHd.hour) continue;
        started = true;
        currentDayKey = hd.date;
        current = {
          date: hd.date,
          tMin: Infinity,
          tMax: -Infinity,
          symbol: null,
          n: 0
        };
      }
      if (hd.date !== currentDayKey) {
        push();
        currentDayKey = hd.date;
        current = {
          date: hd.date,
          tMin: Infinity,
          tMax: -Infinity,
          symbol: null,
          n: 0
        };
      }
      if (!current) continue;
      const inst = item.data && item.data.instant && item.data.instant.details;
      const t = inst && Number(inst.air_temperature);
      if (isFinite(t)) {
        if (t < current.tMin) current.tMin = t;
        if (t > current.tMax) current.tMax = t;
      }
      const sym = (item.data && item.data.next_1_hours && item.data.next_1_hours.summary && item.data.next_1_hours.summary.symbol_code) ||
        (item.data && item.data.next_6_hours && item.data.next_6_hours.summary && item.data.next_6_hours.summary.symbol_code) ||
        null;
      // Берём символ на 12:00 дня — он лучше всего описывает «дневную» погоду.
      if (sym && hd.hour === 12) current.symbol = sym;
      if (!current.symbol && sym) current.symbol = sym;
      current.n++;
    }
    push();
    return days.map(d => ({
      date: d.date,
      minC: (isFinite(d.tMin) && d.n > 0) ? Math.round(d.tMin) : null,
      maxC: (isFinite(d.tMax) && d.n > 0) ? Math.round(d.tMax) : null,
      symbol: d.symbol,
      code: d.code,
      desc: d.desc
    }));
  }

  // Сворачивает почасовой timeseries met.no в почасовой прогноз.
  // Час и дата считаются в часовом поясе города (tz, IANA), если он задан,
  // иначе — по UTC. Прогноз начинается с ТЕКУЩЕГО часа (в поясе города) и
  // идёт вперёд — прошедшие часы отбрасываются. maxHours ограничивает число
  // точек (по умолчанию 24, максимум 48).
  // Возвращает час (0..23) и дату (YYYY-MM-DD) для момента времени в заданном
  // часовом поясе. item.time от met.no — всегда в UTC (формат ...T06:00:00Z).
  // Если tz задан (IANA, например "Asia/Tokyo"), считаем через единый модуль
  // timezone.js (partsInTz уже содержит коррекцию hourCycle/dayPeriod для
  // Firefox). Иначе — запасной вариант по UTC (прежнее поведение, нужно для
  // обратной совместимости и тестов без tz).
  function hourAndDateInTz(item, tz) {
    const d = new Date(item.time);
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    if (tz) {
      const pit = _getPartsInTz();
      if (typeof pit === "function") {
        try {
          const p = pit(d, tz, { date: true, locale: "en-CA" });
          return { hour: p.hour, date: p.date };
        } catch (_) { /* invalid tz falls through to UTC parse below */ }
      }
    }
    // без tz: час/дата из смещения в ISO-строке (например
    // 2026-03-05T12:00:00+03:00 -> час 12). met.no отдаёт Z/UTC, поэтому
    // фактически это UTC; старое поведение для обратной совместимости.
    const iso = typeof item.time === "string" ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):/.exec(item.time) : null;
    if (iso) return { hour: Number(iso[2]), date: iso[1] };
    const date = d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
    return { hour: d.getUTCHours(), date: date };
  }

  // `now` — опциональный якорь «текущее время» (по умолчанию Date.now()),
  // нужен для детерминированных тестов (фиксирует текущий час отсечки).
  function buildHourlyForecast(timeseries, lang, maxHours, tz, now) {
    const limit = Math.max(1, Math.min(48, Number(maxHours) || 24));
    const hours = [];
    if (!Array.isArray(timeseries)) return hours;
    // Фильтрация «текущий час и вперёд» включается только при наличии tz
    // (прод-путь). Без tz (старые тесты/вызовы) поведение прежнее: все точки
    // подряд, без отсечки по текущему времени.
    let nowKey = null;
    if (tz) {
      const nowHd = hourAndDateInTz({ time: (now != null ? now : Date.now()) }, tz);
      if (nowHd) nowKey = nowHd.date + "T" + String(nowHd.hour).padStart(2, "0");
    }
    for (const item of timeseries) {
      if (hours.length >= limit) break;
      const hd = hourAndDateInTz(item, tz);
      if (!hd) continue;
      if (nowKey) {
        const itemKey = hd.date + "T" + String(hd.hour).padStart(2, "0");
        if (itemKey < nowKey) continue; // уже прошедший час — пропускаем
      }
      const inst = item.data && item.data.instant && item.data.instant.details;
      const t = inst && Number(inst.air_temperature);
      if (!isFinite(t)) continue;
      const sym = (item.data && item.data.next_1_hours && item.data.next_1_hours.summary && item.data.next_1_hours.summary.symbol_code) ||
        (item.data && item.data.next_6_hours && item.data.next_6_hours.summary && item.data.next_6_hours.summary.symbol_code) ||
        null;
      hours.push({
        date: hd.date,
        hour: hd.hour,
        tempC: Math.round(t),
        symbol: sym,
        code: symbolToCode(sym),
        desc: sym || (lang === "en" ? "Weather" : "Погода")
      });
    }
    return hours;
  }

  // ---------- точечные диффы данных (для onChanged) ----------

  // Сравнивает prev (текущее состояние страницы) с next (новое значение из
  // chrome.storage.onChanged) и возвращает, какие именно части данных
  // изменились. Фоновые обновления (погода пишет weatherCaches, Bing —
  // bingCache) не должны перерисовывать всю сетку, поэтому диффы точечные,
  // а не по JSON.stringify всего объекта.
  //
  // Чистая функция: без DOM и API браузера, покрыта юнит-тестами
  // (tests/suites/test_diff.robot).
  //
  // Возвращает { sheetsChanged, activeChanged, settingsChanged, weatherChanged,
  // bingChanged, langChanged, nextSettings, prevSettings }.
  function diffTabulaData(prev, next, currentLang) {
    const prevData = (prev && typeof prev === "object") ? prev : {};
    const nextData = (next && typeof next === "object") ? next : {};
    const prevSettings = prevData.settings || {};
    const nextSettings = Object.assign({}, prevSettings, nextData.settings || {});
    // Частичные next (например, только activeSheetId) не должны давать ложных
    // диффов: отсутствующее поле считаем неизменным.
    const nextSheets = Array.isArray(nextData.sheets) ? nextData.sheets : prevData.sheets;
    const nextWeatherCaches = nextData.weatherCaches !== undefined ? nextData.weatherCaches : prevData.weatherCaches;
    const nextBingCache = nextData.bingCache !== undefined ? nextData.bingCache : prevData.bingCache;
    const sheetsChanged = JSON.stringify(prevData.sheets) !== JSON.stringify(nextSheets);
    const activeChanged = !!nextData.activeSheetId && nextData.activeSheetId !== prevData.activeSheetId;
    const settingsChanged = JSON.stringify(prevSettings) !== JSON.stringify(nextSettings);
    const weatherChanged = JSON.stringify(nextWeatherCaches) !== JSON.stringify(prevData.weatherCaches);
    const bingChanged = JSON.stringify(nextBingCache) !== JSON.stringify(prevData.bingCache);
    const langChanged = (nextSettings.language || "ru") !== (currentLang || "ru");
    return {
      sheetsChanged,
      activeChanged,
      settingsChanged,
      weatherChanged,
      bingChanged,
      langChanged,
      nextSettings,
      prevSettings
    };
  }

  return {
    WEATHER_ICON_EMOJI,
    SYMBOL_DESC,
    describeSymbol,
    weatherIconFor,
    withTimeout,
    aggregatorUrl,
    dayLabel,
    formatDateFmt,
    normalizeUrl,
    faviconHost,
    faviconUrl,
    pruneFaviconCache,
    letterChar,
    keyParts,
    rangeKeys,
    nextEmptyAfter,
    symbolToCode,
    num,
    buildDailyForecast,
    buildHourlyForecast,
    diffTabulaData
  };
});
