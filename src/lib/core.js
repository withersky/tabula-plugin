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
  const SYMBOL_DESC = {
    ru: {
      clearsky:                     "Ясно",
      fair:                         "Преимущественно ясно",
      partlycloudy:                 "Переменная облачность",
      cloudy:                       "Облачно",
      rainshowers:                  "Ливни",
      rainshowersandthunder:        "Гроза с ливнем",
      sleetshowers:                 "Мокрый снег",
      snowshowers:                  "Снегопад",
      rain:                         "Дождь",
      heavyrain:                    "Сильный дождь",
      sleet:                        "Мокрый снег",
      snow:                         "Снег",
      heavysnow:                    "Сильный снегопад",
      fog:                          "Туман",
      lightrain:                    "Небольшой дождь",
      lightsleet:                   "Слабый мокрый снег",
      heavysleet:                   "Сильный мокрый снег",
      lightsnow:                    "Небольшой снег",
      lightfog:                     "Лёгкий туман",
      lightrainshowers:             "Небольшие ливни",
      heavyrainshowers:             "Сильные ливни",
      lightsleetshowers:            "Слабый мокрый снег",
      heavysleetshowers:            "Сильный мокрый снег",
      lightsnowshowers:             "Небольшой снег",
      heavysnowshowers:             "Сильный снег",
      lightrainshowersandthunder:   "Небольшая гроза",
      heavyrainshowersandthunder:   "Сильная гроза",
      lightsleetshowersandthunder:  "Гроза, мокрый снег",
      heavysleetshowersandthunder:  "Сильная гроза с мокрым снегом",
      lightsnowshowersandthunder:   "Гроза со снегом",
      heavysnowshowersandthunder:   "Сильная гроза со снегом",
      rainandthunder:               "Дождь с грозой",
      heavyrainandthunder:          "Сильный дождь с грозой",
      snowandthunder:               "Снег с грозой",
      heavysnowandthunder:          "Сильный снег с грозой"
    },
    en: {
      clearsky:                     "Clear",
      fair:                         "Mostly clear",
      partlycloudy:                 "Partly cloudy",
      cloudy:                       "Cloudy",
      rainshowers:                  "Showers",
      rainshowersandthunder:        "Thunder showers",
      sleetshowers:                 "Sleet showers",
      snowshowers:                  "Snow showers",
      rain:                         "Rain",
      heavyrain:                    "Heavy rain",
      sleet:                        "Sleet",
      snow:                         "Snow",
      heavysnow:                    "Heavy snow",
      fog:                          "Fog",
      lightrain:                    "Light rain",
      lightsleet:                   "Light sleet",
      heavysleet:                   "Heavy sleet",
      lightsnow:                    "Light snow",
      lightfog:                     "Light fog",
      lightrainshowers:             "Light showers",
      heavyrainshowers:             "Heavy showers",
      lightsleetshowers:            "Light sleet showers",
      heavysleetshowers:            "Heavy sleet showers",
      lightsnowshowers:             "Light snow showers",
      heavysnowshowers:             "Heavy snow showers",
      lightrainshowersandthunder:   "Light thunder showers",
      heavyrainshowersandthunder:   "Heavy thunder showers",
      lightsleetshowersandthunder:  "Thunder with sleet",
      heavysleetshowersandthunder:  "Heavy thunder with sleet",
      lightsnowshowersandthunder:   "Thunder with snow",
      heavysnowshowersandthunder:   "Heavy thunder with snow",
      rainandthunder:               "Rain with thunder",
      heavyrainandthunder:          "Heavy rain with thunder",
      snowandthunder:               "Snow with thunder",
      heavysnowandthunder:          "Heavy snow with thunder"
    }
  };

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
  function dayLabel(date, idx, isToday, lang, translate) {
    const tr = (typeof translate === "function") ? translate : (k) => k;
    if (isToday) return tr("weatherToday");
    const d = date || new Date();
    const tomorrow = new Date(Date.now() + 86400000);
    if (d.toDateString() === tomorrow.toDateString()) return tr("weatherTomorrow");
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

  function faviconUrl(u) {
    try {
      const url = normalizeUrl(u);
      const host = new URL(url).hostname;
      if (!host) return "";
      return "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=64";
    } catch (_) {
      return "";
    }
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
  // День и «полдень» считаются по времени точки наблюдения (смещение указано
  // в ISO-строке), а не по часовому поясу машины, чтобы результат был
  // одинаковым на любом устройстве и в CI.
  function buildDailyForecast(timeseries, lang) {
    const days = [];
    let currentDayKey = null;
    let current = null;
    const push = () => {
      if (!current) return;
      current.symbol = current.symbol || null;
      current.code = symbolToCode(current.symbol);
      current.desc = current.symbol || (lang === "en" ? "Weather" : "Погода");
      days.push(current);
      current = null;
    };
    for (const item of timeseries) {
      const d = new Date(item.time);
      if (isNaN(d.getTime())) continue;
      // Дата и час из ISO-строки («2026-03-05T12:00:00+03:00» → день 2026-03-05,
      // час 12) — это локальное время точки, не зависящее от TZ окружения.
      const iso = typeof item.time === "string" ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):/.exec(item.time) : null;
      const key = iso ? iso[1] : (d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"));
      const hour = iso ? Number(iso[2]) : d.getHours();
      if (key !== currentDayKey) {
        push();
        currentDayKey = key;
        current = {
          date: key,
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
      // Берём символ на 12:00 дня (по времени точки) — он лучше всего
      // описывает «дневную» погоду.
      if (sym && hour === 12) current.symbol = sym;
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
    faviconUrl,
    letterChar,
    keyParts,
    rangeKeys,
    nextEmptyAfter,
    symbolToCode,
    num,
    buildDailyForecast
  };
});
