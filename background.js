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

const METNO_USER_AGENT = "TabulaNewTab/1.0 (contact: extension-local)";

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
// День считается по локальному времени устройства, чтобы попап показывал
// «Сегодня / Завтра / …» так же, как их видит пользователь.
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
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
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
    // Берём символ на 12:00 дня — он лучше всего описывает «дневную» погоду.
    if (sym && d.getHours() === 12) current.symbol = sym;
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

async function fetchWeather(lat, lon, lang) {
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
  return {
    ok: true,
    source: "met.no",
    code: code,
    symbol: symbol,
    tempC: num(data.air_temperature),
    humidity: num(data.relative_humidity),
    windMs: num(data.wind_speed),
    windKmph: (data.wind_speed != null && isFinite(Number(data.wind_speed))) ? Number(data.wind_speed) * 3.6 : null,
    desc: symbol || (lang === "en" ? "Weather" : "Погода"),
    forecast: buildDailyForecast(ts, lang),
    lat: lat,
    lon: lon,
    fetchedAt: Date.now()
  };
}

async function geocodeCity(name, lang) {
  const params = new URLSearchParams({
    name: name,
    count: "5",
    language: (lang === "en" ? "en" : "ru"),
    format: "json"
  });
  const url = "https://geocoding-api.open-meteo.com/v1/search?" + params.toString();
  const resp = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!resp.ok) throw new Error("geocoder http " + resp.status);
  const j = await resp.json();
  const list = Array.isArray(j.results) ? j.results : [];
  return list.map(r => ({
    name: r.name || name,
    country: r.country || "",
    admin1: r.admin1 || "",
    lat: Number(r.latitude),
    lon: Number(r.longitude)
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

  if (msg && msg.type === "weather") {
    const lat = Number(msg.lat);
    const lon = Number(msg.lon);
    if (!isFinite(lat) || !isFinite(lon)) {
      sendResponse({ error: "no-coords" });
      return true;
    }
    fetchWeather(lat, lon, msg.lang)
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
      const url = ext._raw.runtime.getURL("newtab.html");
      const p = ext._raw.tabs.create({ url: url });
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) { /* ignore */ }
  });
}
