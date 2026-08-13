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

// Service worker: proxies Bing daily image + met.no weather (CORS workaround for extension pages).
// met.no требует заголовок User-Agent (с валидным контактом), поэтому запрос делается здесь.

// Load cross-browser API shim. Works in Chromium service workers and Firefox background scripts.
try { importScripts("lib/browser.js"); } catch (_) { /* ignore if not in worker context */ }
// i18n data (JSON → generated script) before lib/core.js, which reads the global.
try { importScripts("i18n/generated/symbols.js"); } catch (_) { /* ignore if not in worker context */ }
// Pure helpers (weather symbol mapping, forecast folding) live in lib/core.js.
try { importScripts("lib/core.js"); } catch (_) { /* ignore if not in worker context */ }
// Единый модуль работы с таймзонами (partsInTz, resolveTimezoneByName,
// ensureCityTimezone) — используется и здесь, и в newtab/options виджетах.
try { importScripts("lib/timezone.js"); } catch (_) { /* ignore if not in worker context */ }

const METNO_USER_AGENT = "TabulaNewTab/1.0 (contact: extension-local)";
const METNO_TTL_MS = 10 * 60 * 1000; // 10 минут: met.no обновляет прогнозы примерно раз в 10 минут
const METNO_CACHE_MAX = 8;           // предел записей кэша, чтобы не раздувать память воркера
const _metnoCache = new Map();       // "lat,lon,lang,tz" → { at: Date.now(), data: результат }

function metnoCacheKey(lat, lon, lang, tz) {
  // Округляем до 4 знаков (~11 м), чтобы координаты с шумом плавающей точки
  // не плодили дубликаты записей кэша.
  // ВАЖНО: ключ ОБЯЗАН включать tz. Прогноз (buildHourlyForecast/buildDailyForecast)
  // считается в местном поясе города, и для восточных поясов (UTC+12 и т.п.)
  // даты часов/дней отличаются от UTC. Если не учитывать tz, то прогноз,
  // однажды построенный в UTC для города без timezone, закэшируется и будет
  // отдаваться повторно даже после догеокодинга (когда город уже получил
  // timezone) — рендер же считает «сегодня» уже в местном поясе, возникает
  // рассинхрон: даты из кэша в UTC, а подсветка в местном времени (два «Сегодня»
  // и сдвиг часов, например 13:00 вместо 01:00).
  return Number(lat).toFixed(4) + "," + Number(lon).toFixed(4) + "," + (lang || "ru") + "," + (tz || "UTC");
}

async function fetchWeather(lat, lon, lang, tz, cityName) {
  // Нормализуем tz: открытый мет.no/геокодер возвращают чистую строку
  // ("Pacific/Tarawa"), но в старых данных или при двойной JSON-сериализации
  // поле может прийти как '"Pacific/Tarawa"' (строка с кавычками внутри).
  // Intl.DateTimeFormat с таким "поясом" бросает исключение → часы считаются
  // в UTC (13:00 вместо 01:00, два «Сегодня»). Срезаем обрамляющие кавычки.
  tz = normalizeTz(tz);
  // Если часовой пояс не передан (старые/мигрированные города без timezone),
  // пытаемся получить его по имени города через единый модуль timezone.js
  // (resolveTimezoneByName), чтобы почасовой/дневной прогноз считался в
  // местном времени города, а не в UTC. Делаем ДО проверки кэша: от этого
  // зависит ключ кэша (он включает tz), иначе прогноз не перестроился бы при
  // появлении timezone у города.
  if (!tz && cityName) {
    try { tz = normalizeTz(await resolveTimezoneByName(String(cityName), { fetchImpl: fetch })); } catch (_) { tz = ""; }
  }

  const cacheKey = metnoCacheKey(lat, lon, lang, tz);
  const cached = _metnoCache.get(cacheKey);
  if (cached && Date.now() - cached.at < METNO_TTL_MS) {
    return cached.data;
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon)
  });
  const url = "https://api.met.no/weatherapi/locationforecast/2.0/complete?" + params.toString();
  const resp = await fetch(url, {
    headers: { "User-Agent": METNO_USER_AGENT, "Accept": "application/json" }
  });
  if (!resp.ok) throw new Error("met.no http " + resp.status);
  const j = await resp.json();
  const ts = j && j.properties && j.properties.timeseries;
  if (!Array.isArray(ts) || ts.length === 0) throw new Error("met.no no-data");
  const cur = ts[0];
  const data = (cur.data && cur.data.instant && cur.data.instant.details) || {};
  const next1 = cur.data && cur.data.next_1_hours;
  const symbol = (next1 && next1.summary && next1.summary.symbol_code) ||
    (cur.data && cur.data.next_6_hours && cur.data.next_6_hours.summary && cur.data.next_6_hours.summary.symbol_code) ||
    null;
  const code = symbolToCode(symbol);
  const result = {
    ok: true,
    source: "met.no",
    code: code,
    symbol: symbol,
    tempC: num(data.air_temperature),
    humidity: num(data.relative_humidity),
    windMs: num(data.wind_speed),
    windKmph: (data.wind_speed != null && isFinite(Number(data.wind_speed))) ? Number(data.wind_speed) * 3.6 : null,
    desc: symbol || (lang === "en" ? "Weather" : "Погода"),
    forecast: buildDailyForecast(ts, lang, tz),
    hourly: buildHourlyForecast(ts, lang, 24, tz),
    tz: tz || "",
    lat: lat,
    lon: lon,
    fetchedAt: Date.now()
  };
  // Обновляем кэш только после успешного ответа мет.no.
  if (_metnoCache.size >= METNO_CACHE_MAX) {
    // Простой LRU: вытесняем самую старую запись.
    let oldestKey = null;
    let oldestAt = Infinity;
    for (const [k, v] of _metnoCache) {
      if (v.at < oldestAt) { oldestAt = v.at; oldestKey = k; }
    }
    if (oldestKey) _metnoCache.delete(oldestKey);
  }
  _metnoCache.set(cacheKey, { at: Date.now(), data: result });
  return result;
}

async function geocodeCity(name, lang) {
  const params = new URLSearchParams({
    name: name,
    count: "10",
    language: (lang === "en" ? "en" : "ru"),
    format: "json"
  });
  const url = "https://geocoding-api.open-meteo.com/v1/search?" + params.toString();
  const resp = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!resp.ok) throw new Error("geocoder http " + resp.status);
  const j = await resp.json();
  const list = Array.isArray(j.results) ? j.results : [];
  // Оставляем только населённые пункты/регионы. Страны (feature_code = "PCLI")
  // у Open-Meteo не отдают поле timezone, и для них почасовой прогноз погоды
  // не может быть посчитан в местном времени (считался бы в UTC). Поэтому
  // исключаем страны и любые записи без timezone.
  return list
    .filter(r => r.feature_code && r.feature_code !== "PCLI" && !!r.timezone)
    .map(r => ({
      name: r.name || name,
      country: r.country || "",
      admin1: r.admin1 || "",
      featureCode: r.feature_code || "",
      lat: Number(r.latitude),
      lon: Number(r.longitude),
      timezone: r.timezone || ""
    }));
}

const SUGGEST_ENDPOINTS = {
  google: "https://suggestqueries.google.com/complete/search?client=firefox&q=",
  yandex: "https://suggest.yandex.ru/suggest-ff.cgi?part=",
  bing: "https://api.bing.com/osjson.aspx?query="
};

async function fetchSuggestions(engine, q) {
  const base = SUGGEST_ENDPOINTS[engine] || SUGGEST_ENDPOINTS.google;
  const resp = await fetch(base + encodeURIComponent(q), {
    headers: { "Accept": "application/json" }
  });
  if (!resp.ok) throw new Error("suggest http " + resp.status);
  const j = await resp.json();
  if (Array.isArray(j) && j.length >= 2 && Array.isArray(j[1])) {
    return j[1].map(x => (typeof x === "string" ? x : String(x))).filter(Boolean);
  }
  if (j && typeof j === "object" && Array.isArray(j.s)) {
    return j.s.map(x => (typeof x === "string" ? x : String(x))).filter(Boolean);
  }
  return [];
}

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "bingDaily") {
    const mkt = (msg.mkt || "ru-RU").replace(/[^a-zA-Z0-9_-]/g, "");
    const url = "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=" + encodeURIComponent(mkt);
    fetch(url)
      .then(r => r.json())
      .then(j => {
        const img = j && j.images && j.images[0];
        if (!img || !img.url) {
          sendResponse({ error: "no-image" });
          return;
        }
        let fullUrl = img.url;
        if (!/^https?:\/\//i.test(fullUrl)) {
          fullUrl = "https://www.bing.com" + (fullUrl.startsWith("/") ? "" : "/") + fullUrl;
        }
        sendResponse({ url: fullUrl, copyright: img.copyright || "" });
      })
      .catch(err => sendResponse({ error: String(err && err.message || err) }));
    return true;
  }

  if (msg && msg.type === "suggest") {
    const engine = String(msg.engine || "google").replace(/[^a-z]/gi, "");
    const q = String(msg.q || "").trim();
    if (!q) { sendResponse({ ok: true, items: [] }); return true; }
    fetchSuggestions(engine, q)
      .then(items => sendResponse({ ok: true, items: items }))
      .catch(err => sendResponse({ error: String(err && err.message || err) }));
    return true;
  }

  if (msg && msg.type === "weatherGeocode") {
    const name = String(msg.city || "").trim();
    if (!name) { sendResponse({ error: "no-city" }); return true; }
    geocodeCity(name, msg.lang)
      .then(list => sendResponse({ ok: true, results: list }))
      .catch(err => sendResponse({ error: String(err && err.message || err) }));
    return true;
  }

  if (msg && msg.type === "weatherReverseGeocode") {
    const name = String(msg.name || (msg.city) || "").trim();
    if (!name) { sendResponse({ ok: true, timezone: "" }); return true; }
    // Open-Meteo geocoding возвращает timezone при поиске по имени города.
    // Единый расчёт через resolveTimezoneByName (lib/timezone.js), который
    // странам (feature_code = "PCLI") вернёт "" — timezone там нет.
    resolveTimezoneByName(name, { fetchImpl: fetch, lang: msg.lang })
      .then(tz => sendResponse({ ok: true, timezone: tz }))
      .catch(err => sendResponse({ error: String(err && err.message || err) }));
    return true;
  }

  if (msg && msg.type === "weather") {
    const lat = Number(msg.lat);
    const lon = Number(msg.lon);
    if (!isFinite(lat) || !isFinite(lon)) {
      sendResponse({ error: "no-coords" });
      return true;
    }
    // tz — IANA-пояс активного города (нужен, чтобы почасовой прогноз
    // отображался в местном времени города, а не в UTC). Если пуст —
    // fetchWeather сам догеокодирует по имени через lib/timezone.js.
    fetchWeather(lat, lon, msg.lang, msg.tz, msg.cityName)
      .then(r => sendResponse(r))
      .catch(err => sendResponse({ error: String(err && err.message || err) }));
    return true;
  }

  return false;
});

// Clicking the extension icon (toolbar / extensions menu) opens a new Tabula tab.
if (ext.action && ext.action.onClicked && ext.action.onClicked.addListener) {
  ext.action.onClicked.addListener(() => {
    try {
      // newtab.html живёт в подпапке newtab/ — путь от корня расширения.
      const url = ext._raw.runtime.getURL("newtab/newtab.html");
      const p = ext._raw.tabs.create({ url: url });
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) { /* ignore */ }
  });
}
