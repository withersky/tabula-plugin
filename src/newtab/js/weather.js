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
 *
 * Виджет погоды: текущая погода, геокодирование города, обновление по таймеру
 * и всплывающее окно прогноза на N дней.
 */

import { getState, setState, getLang } from "./state.js";
import { tx } from "./i18n.js";
import { toast } from "./utils.js";

const weatherWidget = document.getElementById("weatherWidget");
const weatherIconEl = document.getElementById("weatherIcon");
const weatherTempEl = document.getElementById("weatherTemp");
const weatherDescEl = document.getElementById("weatherDesc");
const weatherCityEl = document.getElementById("weatherCity");

// ---------- weather forecast popup (like quick-go suggestions) ----------
const weatherPopupEl = document.getElementById("weatherPopup");
const weatherPopupDaysEl = document.getElementById("weatherPopupDays");
const weatherPopupCityEl = document.getElementById("weatherPopupCity");
const weatherPopupOpenBtn = document.getElementById("weatherPopupOpenBtn");

let weatherTimer = null;
let _weatherGeoInFlight = false;
let _weatherHasError = false;
let _weatherInFlight = false;
let _weatherGen = 0;
let _weatherPopupTimer = null;
let _weatherPopupClosing = false;

function setWeatherText(icon, temp, desc, city) {
  if (weatherIconEl) weatherIconEl.textContent = icon;
  if (weatherTempEl) weatherTempEl.textContent = temp;
  if (weatherDescEl) weatherDescEl.textContent = desc;
  if (weatherCityEl) weatherCityEl.textContent = city;
}

export function renderWeather() {
  if (!weatherWidget) return;
  const state = getState();
  const s = state && state.settings;
  if (!s || s.showWeather === false) {
    setWeatherText("", "", "", "");
    return;
  }
  weatherIconEl.className = "weather-icon";
  const cache = state.weatherCache || null;
  if (cache && cache.ok) {
    _weatherHasError = false;
    weatherIconEl.textContent = weatherIconFor(cache.code);
    const temp = (cache.tempC != null) ? (Math.round(cache.tempC) + "°") : "—";
    const desc = describeSymbol(cache.symbol, getLang()) || cache.desc || "";
    const city = cache.city
      ? (cache.city + (cache.country ? ", " + cache.country : ""))
      : (s.weatherCity || "");
    setWeatherText(weatherIconEl.textContent, temp, desc, city);
    return;
  }
  // Нет валидного кэша — показываем либо загрузку, либо ошибку.
  const cityFallback = s.weatherCity || "";
  if (_weatherHasError) {
    setWeatherText("⚠️", "—", tx("weatherLoadFailed"), cityFallback);
  } else {
    setWeatherText("⏳", "—", tx("weatherLoading"), cityFallback);
  }
}

async function geocodeAndSave(city) {
  if (_weatherGeoInFlight) return false;
  _weatherGeoInFlight = true;
  try {
    const resp = await withTimeout(
      ext.runtime.sendMessage({ type: "weatherGeocode", city: city, lang: getLang() }),
      8000
    );
    const list = (resp && resp.results) || [];
    const r = list[0];
    if (!resp || resp.error || !resp.ok || !r) return false;
    await Storage.update((d) => {
      d.settings.weatherLat = r.lat;
      d.settings.weatherLon = r.lon;
      d.settings.weatherCity = r.name || city;
      d.weatherCache = null;
    });
    setState(await Storage.get());
    return true;
  } catch (_) {
    return false;
  } finally {
    _weatherGeoInFlight = false;
  }
}

export async function refreshWeather() {
  const state = getState();
  const s0 = state && state.settings;
  if (!s0 || s0.showWeather === false) return;
  const myGen = ++_weatherGen;
  _weatherInFlight = true;
  _weatherHasError = false;
  renderWeather();
  try {
    let s = getState() && getState().settings;
    let lat = Number(s && s.weatherLat);
    let lon = Number(s && s.weatherLon);
    if (!isFinite(lat) || !isFinite(lon)) {
      const city = (s && s.weatherCity || "").trim();
      if (city) {
        const ok = await geocodeAndSave(city);
        if (myGen !== _weatherGen) return;
        if (!ok) {
          _weatherHasError = true;
          renderWeather();
          toast(tx("weatherNoLocation"), true);
          return;
        }
        s = getState() && getState().settings;
        lat = Number(s && s.weatherLat);
        lon = Number(s && s.weatherLon);
      } else {
        _weatherHasError = true;
        renderWeather();
        toast(tx("weatherNoLocation"), true);
        return;
      }
    }
    if (!isFinite(lat) || !isFinite(lon)) {
      _weatherHasError = true;
      renderWeather();
      return;
    }
    const resp = await withTimeout(
      ext.runtime.sendMessage({ type: "weather", lat: lat, lon: lon, lang: getLang() }),
      8000
    );
    if (myGen !== _weatherGen) return;
    if (!resp || resp.error || !resp.ok) throw new Error(resp && resp.error || "no response");
    const humanDesc = describeSymbol(resp.symbol, getLang());
    if (humanDesc) resp.desc = humanDesc;
    const s2 = getState() && getState().settings;
    resp.city = (s2 && s2.weatherCity) || resp.city || "";
    await Storage.update((d) => { d.weatherCache = resp; });
    setState(await Storage.get());
    _weatherHasError = false;
  } catch (err) {
    if (myGen !== _weatherGen) return;
    console.warn("[Tabula] weather fetch failed:", err && err.message || err);
    _weatherHasError = true;
    toast(tx("weatherLoadFailed"), true);
  } finally {
    if (myGen === _weatherGen) {
      _weatherInFlight = false;
      renderWeather();
    }
  }
}

export function startWeather() {
  if (weatherTimer) clearInterval(weatherTimer);
  // Инвалидируем все текущие запросы — старые ответы не должны затирать новые настройки.
  _weatherGen++;
  _weatherInFlight = false;
  _weatherHasError = false;
  renderWeather();
  const state = getState();
  const minutes = Math.max(5, Number((state && state.settings && state.settings.weatherRefreshMin) || 30));
  const ms = minutes * 60 * 1000;
  weatherTimer = setInterval(refreshWeather, ms);
  // Кэш считается свежим только если у него валидный ok.
  // Иначе виджет зависает в «⏳ Загружаем погоду» до перезапуска.
  const cache = state && state.weatherCache;
  const cacheFresh =
    cache && cache.ok &&
    cache.fetchedAt &&
    (Date.now() - cache.fetchedAt) <= ms;
  if (!cacheFresh) {
    refreshWeather();
  }
}

function openWeatherAggregator() {
  const state = getState();
  const s = state && state.settings;
  const url = aggregatorUrl(s && s.weatherLat, s && s.weatherLon, (s && s.weatherCity) || "", getLang());
  window.open(url, "_blank", "noopener,noreferrer");
}

function closeWeatherPopup() {
  if (!weatherPopupEl || weatherPopupEl.hidden) return;
  _weatherPopupClosing = true;
  weatherPopupEl.classList.add("closing");
  clearTimeout(_weatherPopupTimer);
  _weatherPopupTimer = setTimeout(() => {
    weatherPopupEl.classList.remove("closing");
    _weatherPopupClosing = false;
    weatherPopupEl.hidden = true;
  }, 150);
}

export function toggleWeatherPopup() {
  if (!weatherPopupEl) return;
  if (!weatherPopupEl.hidden) {
    closeWeatherPopup();
    return;
  }
  renderWeatherPopup();
  clearTimeout(_weatherPopupTimer);
  weatherPopupEl.classList.remove("closing");
  _weatherPopupClosing = false;
  weatherPopupEl.hidden = false;
}

function renderWeatherPopup() {
  if (!weatherPopupEl || !weatherPopupDaysEl) return;
  const state = getState();
  const s = state && state.settings;
  const cache = state && state.weatherCache;
  const list = (cache && Array.isArray(cache.forecast)) ? cache.forecast : [];
  const maxDays = Math.max(1, Math.min(14, Number((s && s.weatherForecastDays) || 5)));
  if (weatherPopupCityEl) {
    weatherPopupCityEl.textContent = (cache && cache.city) ||
      ((s && s.weatherCity) || "");
  }
  weatherPopupDaysEl.textContent = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "weather-popup-empty";
    empty.textContent = tx("weatherNoData");
    weatherPopupDaysEl.appendChild(empty);
    return;
  }
  const now = new Date();
  const today = now.toDateString();
  list.slice(0, maxDays).forEach((day, idx) => {
    const row = document.createElement("div");
    row.className = "weather-popup-day";
    const date = day.date ? new Date(day.date + "T12:00:00") : new Date(now.getTime() + idx * 86400000);
    const isToday = idx === 0 || date.toDateString() === today;
    const label = document.createElement("span");
    label.className = "weather-popup-day-label" + (isToday ? " today" : "");
    label.textContent = dayLabel(date, idx, isToday, getLang(), tx);
    const fmt = (s && s.weatherDateFmt) || "dd.mm";
    if (fmt && fmt !== "off") {
      const dateEl = document.createElement("span");
      dateEl.className = "weather-popup-day-date";
      dateEl.textContent = formatDateFmt(date, fmt, getLang());
      label.appendChild(dateEl);
    }
    const icon = document.createElement("span");
    icon.className = "weather-popup-day-icon";
    icon.textContent = weatherIconFor(day.code);
    const descEl = document.createElement("span");
    descEl.className = "weather-popup-day-desc";
    descEl.textContent = describeSymbol(day.desc, getLang()) || describeSymbol(day.symbol, getLang()) || day.desc || "";
    const range = document.createElement("span");
    range.className = "weather-popup-day-range";
    const max = (day.maxC != null) ? Math.round(day.maxC) + "°" : "—";
    const min = (day.minC != null) ? Math.round(day.minC) + "°" : "—";
    range.textContent = max + " / ";
    const minSpan = document.createElement("span");
    minSpan.className = "min";
    minSpan.textContent = min;
    range.appendChild(minSpan);
    for (const el of [label, icon, descEl, range]) row.appendChild(el);
    weatherPopupDaysEl.appendChild(row);
  });
}

/** Слушает клики по виджету и кнопке «открыть агрегатор». */
export function bindWeatherEvents() {
  if (weatherWidget) {
    weatherWidget.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleWeatherPopup();
    });
    weatherWidget.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        toggleWeatherPopup();
      }
    });
  }
  if (weatherPopupOpenBtn) {
    weatherPopupOpenBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeWeatherPopup();
      openWeatherAggregator();
    });
  }
  document.addEventListener("mousedown", (e) => {
    if (weatherPopupEl && !weatherPopupEl.hidden && !weatherWidget.contains(e.target) && !weatherPopupOpenBtn.contains(e.target)) {
      closeWeatherPopup();
    }
  });
}

export { weatherWidget };
