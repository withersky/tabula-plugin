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
 * Виджет погоды: текущая погода, несколько городов (settings.weatherCities +
 * weatherActiveCityId), кэш на город (state.weatherCaches), обновление по
 * таймеру и всплывающее окно с почасовым и дневным прогнозом.
 */

import { getState, setState, getLang } from "./state.js";
import { tx } from "./i18n.js";
import { toast, pad2 } from "./utils.js";

const weatherWidget = document.getElementById("weatherWidget");
const weatherIconEl = document.getElementById("weatherIcon");
const weatherTempEl = document.getElementById("weatherTemp");
const weatherDescEl = document.getElementById("weatherDesc");
const weatherCityEl = document.getElementById("weatherCity");

// ---------- weather forecast popup (like quick-go suggestions) ----------
const weatherPopupEl = document.getElementById("weatherPopup");
const weatherPopupDaysEl = document.getElementById("weatherPopupDays");
const weatherPopupCityEl = document.getElementById("weatherPopupCity");
const weatherPopupCitiesEl = document.getElementById("weatherPopupCities");
const weatherPopupHourlyWrapEl = document.getElementById("weatherPopupHourlyWrap");
const weatherPopupHourlyEl = document.getElementById("weatherPopupHourly");
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

/** Активный город погоды (или первый из списка). Легаси-поля — fallback. */
function activeWeatherCity(s) {
  const list = Array.isArray(s && s.weatherCities) ? s.weatherCities : [];
  const activeId = s && s.weatherActiveCityId;
  return list.find(c => c && c.id === activeId) || list[0] || null;
}

/** Кэш считается свежим только если у него валидный ok. */
function weatherCacheFresh(cache, ms) {
  return !!(cache && cache.ok && cache.fetchedAt && (Date.now() - cache.fetchedAt) <= ms);
}

function weatherCacheFor(state, city) {
  return (city && state && state.weatherCaches && state.weatherCaches[city.id]) || null;
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
  const city = activeWeatherCity(s);
  // Городов нет и нет легаси-имени — нейтральное состояние без загрузки/ошибок.
  if (!city && !((s && s.weatherCity || "").trim())) {
    _weatherHasError = false;
    setWeatherText("", "—", "", "");
    return;
  }
  const cache = weatherCacheFor(state, city);
  if (cache && cache.ok) {
    _weatherHasError = false;
    weatherIconEl.textContent = weatherIconFor(cache.code);
    const temp = (cache.tempC != null) ? (Math.round(cache.tempC) + "°") : "—";
    const desc = describeSymbol(cache.symbol, getLang()) || cache.desc || "";
    // Надпись города берём из АКТИВНОГО города (city.name), а не из
    // cache.city. Кэш погоды может временно отставать (гонка генераций
    // _weatherGen при быстрой смене городов, либо несвежий кэш), поэтому
    // опираться на cache.city значило бы показывать имя предыдущего города
    // до завершения загрузки. cache.city — лишь fallback, если города нет
    // в списке, но кэш уже есть (легаси-сценарий).
    const cityLabel = (city && city.name)
      ? ((city.name) + (city.country ? ", " + city.country : ""))
      : (cache.city ? (cache.city + (cache.country ? ", " + cache.country : "")) : ((s && s.weatherCity) || ""));
    setWeatherText(weatherIconEl.textContent, temp, desc, cityLabel);
    return;
  }
  // Нет валидного кэша — показываем либо загрузку, либо ошибку.
  const cityFallback = (city && city.name) || (s && s.weatherCity) || "";
  if (_weatherHasError) {
    setWeatherText("⚠️", "—", tx("weatherLoadFailed"), cityFallback);
  } else {
    setWeatherText("⏳", "—", tx("weatherLoading"), cityFallback);
  }
}

/** Геокодирует город и добавляет его в weatherCities (становится активным). */
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
    const newCity = {
      id: cryptoId(),
      name: r.name || city,
      country: r.country || "",
      lat: Number(r.lat),
      lon: Number(r.lon),
      timezone: r.timezone || ""
    };
    await Storage.update((d) => {
      const cities = Array.isArray(d.settings.weatherCities) ? d.settings.weatherCities.slice() : [];
      cities.push(newCity);
      d.settings.weatherCities = cities;
      d.settings.weatherActiveCityId = newCity.id;
      if (!d.weatherCaches || typeof d.weatherCaches !== "object") d.weatherCaches = {};
      d.weatherCaches[newCity.id] = null;
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
    let city = activeWeatherCity(s);
    if (!city) {
      const legacyName = (s && s.weatherCity || "").trim();
      if (legacyName) {
        const ok = await geocodeAndSave(legacyName);
        if (myGen !== _weatherGen) return;
        if (!ok) {
          _weatherHasError = true;
          renderWeather();
          toast(tx("weatherNoLocation"), true);
          return;
        }
        s = getState() && getState().settings;
        city = activeWeatherCity(s);
      } else {
        // Городов нет — тихий выход: виджет уже в нейтральном состоянии.
        return;
      }
    }
    const lat = Number(city && city.lat);
    const lon = Number(city && city.lon);
    if (!isFinite(lat) || !isFinite(lon)) {
      _weatherHasError = true;
      renderWeather();
      return;
    }
    const resp = await withTimeout(
      ext.runtime.sendMessage({ type: "weather", lat: lat, lon: lon, lang: getLang(), tz: (city && city.timezone) || "" }),
      8000
    );
    if (myGen !== _weatherGen) return;
    if (!resp || resp.error || !resp.ok) throw new Error(resp && resp.error || "no response");
    const humanDesc = describeSymbol(resp.symbol, getLang());
    if (humanDesc) resp.desc = humanDesc;
    const s2 = getState() && getState().settings;
    const c2 = activeWeatherCity(s2) || city;
    resp.city = (c2 && c2.name) || resp.city || "";
    resp.country = (c2 && c2.country) || "";
    const cityId = c2 && c2.id;
    await Storage.update((d) => {
      if (!d.weatherCaches || typeof d.weatherCaches !== "object") d.weatherCaches = {};
      if (cityId) d.weatherCaches[cityId] = resp;
    });
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
  weatherTimer = null;
  // Инвалидируем все текущие запросы — старые ответы не должны затирать новые настройки.
  _weatherGen++;
  _weatherInFlight = false;
  _weatherHasError = false;
  const state = getState();
  const city = activeWeatherCity(state && state.settings);
  if (!city) {
    // Городов нет — таймер не запускаем: onChanged перезапустит startWeather
    // при добавлении города (меняются weatherCities/weatherActiveCityId).
    renderWeather();
    return;
  }
  renderWeather();
  const minutes = Math.max(5, Number((state && state.settings && state.settings.weatherRefreshMin) || 30));
  const ms = minutes * 60 * 1000;
  weatherTimer = setInterval(refreshWeather, ms);
  const cache = weatherCacheFor(state, city);
  // Иначе виджет зависает в «⏳ Загружаем погоду» до перезапуска.
  if (!weatherCacheFresh(cache, ms)) {
    refreshWeather();
  }
}

function openWeatherAggregator() {
  const state = getState();
  const s = state && state.settings;
  const city = activeWeatherCity(s);
  const lat = (city && city.lat != null) ? city.lat : (s && s.weatherLat);
  const lon = (city && city.lon != null) ? city.lon : (s && s.weatherLon);
  // Города нет — нечего открывать.
  if (lat == null || lon == null) return;
  const name = (city && city.name) || (s && s.weatherCity) || "";
  const url = aggregatorUrl(lat, lon, name, getLang());
  window.open(url, "_blank", "noopener,noreferrer");
}

function closeWeatherPopup() {
  if (!weatherPopupEl || weatherPopupEl.hidden) return;
  closeWeatherCityMenu();
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
  const state = getState();
  const s = state && state.settings;
  // Городов нет — попап не открываем (как у часов с пустым списком).
  if (!activeWeatherCity(s) && !((s && s.weatherCity || "").trim())) return;
  if (!weatherPopupEl.hidden) {
    closeWeatherPopup();
    return;
  }
  renderWeatherPopup();
  clearTimeout(_weatherPopupTimer);
  weatherPopupEl.classList.remove("closing");
  _weatherPopupClosing = false;
  weatherPopupEl.hidden = false;
  // В режиме превью (iframe) position:absolute/top:100% работает в Firefox
  // иначе, чем в Chrome: попап уезжает за пределы вьюпорта. Позиционируем
  // явно через position:fixed и координаты виджета из getBoundingClientRect().
  if (window.TabulaPreview && weatherWidget) {
    positionPopupInIframe(weatherPopupEl, weatherWidget, "right");
  }
}

/** Список городов погоды из настроек (если есть). */
function weatherCitiesList(s) {
  return Array.isArray(s && s.weatherCities) ? s.weatherCities : [];
}

/**
 * Позиционирует попап внутри iframe-превью (режим Firefox-совместимости).
 * При position:absolute + top:100% внутри <iframe> Firefox привязывает
 * top:100% к другому containing block, и попап «уезжает» за нижнюю границу
 * вьюпорта. Решение — position:fixed + явные координаты из
 * getBoundingClientRect() виджета (внутри iframe clientRect уже в координатах
 * вьюпорта, поэтому fixed работает одинаково в Chrome и Firefox).
 * align: "right" — прижать правый край попапа к правому краю виджета
 * (для виджета погоды справа в топбаре), иначе — по левому краю.
 */
function positionPopupInIframe(popup, anchor, align) {
  if (!popup || !anchor) return;
  const r = anchor.getBoundingClientRect();
  popup.style.position = "fixed";
  popup.style.top = (r.bottom + 6) + "px";
  const pw = popup.offsetWidth || 240;
  if (align === "right") {
    popup.style.left = "auto";
    popup.style.right = Math.max(8, window.innerWidth - r.right) + "px";
  } else {
    popup.style.right = "auto";
    popup.style.left = Math.max(8, r.left) + "px";
  }
  // Не выпускаем попап за нижний край вьюпорта (прокрутка внутри попапа).
  const maxH = Math.max(120, window.innerHeight - r.bottom - 12);
  popup.style.maxHeight = maxH + "px";
}

/** Открыто ли выпадающее меню городов. */
function weatherCityMenuOpen() {
  return !!(weatherPopupCitiesEl && !weatherPopupCitiesEl.hidden);
}

/** Закрыть выпадающее меню городов. */
function closeWeatherCityMenu() {
  if (weatherCityMenuOpen()) weatherPopupCitiesEl.hidden = true;
}

/** Показать меню городов под кнопкой активного города (fixed-позиционирование). */
function openWeatherCityMenu() {
  if (!weatherPopupCitiesEl || !weatherPopupCityEl) return;
  const r = weatherPopupCityEl.getBoundingClientRect();
  // Меню не должно выходить за правый край вьюпорта (min-width меню ~200px).
  const left = Math.max(8, Math.min(r.left, window.innerWidth - 208));
  weatherPopupCitiesEl.style.left = left + "px";
  weatherPopupCitiesEl.style.top = (r.bottom + 4) + "px";
  weatherPopupCitiesEl.hidden = false;
}

function toggleWeatherCityMenu() {
  if (weatherCityMenuOpen()) closeWeatherCityMenu();
  else openWeatherCityMenu();
}

/** Рендер выпадающего меню городов в шапке попапа погоды. */
function renderWeatherPopupCities(s, city) {
  if (!weatherPopupCitiesEl || !weatherPopupCityEl) return;
  const list = weatherCitiesList(s);
  const cityBtn = weatherPopupCityEl;
  closeWeatherCityMenu();
  weatherPopupCitiesEl.textContent = "";
  if (list.length <= 1) {
    cityBtn.classList.add("single");
    cityBtn.classList.remove("has-menu");
    return;
  }
  cityBtn.classList.remove("single");
  cityBtn.classList.add("has-menu");
  list.forEach(c => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "weather-popup-chip" + (c.id === (city && city.id) ? " active" : "");
    item.textContent = c.name;
    item.title = c.name + (c.country ? ", " + c.country : "");
    item.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeWeatherCityMenu();
      if (c.id === (city && city.id)) return;
      await Storage.update((d) => { d.settings.weatherActiveCityId = c.id; });
      setState(await Storage.get());
      const minutes = Math.max(5, Number((getState() && getState().settings && getState().settings.weatherRefreshMin) || 30));
      const ms = minutes * 60 * 1000;
      if (!weatherCacheFresh(weatherCacheFor(getState(), c), ms)) {
        refreshWeather();
      } else {
        renderWeather();
        renderWeatherPopup();
      }
    });
    weatherPopupCitiesEl.appendChild(item);
  });
}

/** Горизонтальная лента почасового прогноза. tz — IANA-пояс активного города. */
function renderWeatherPopupHourly(cache, tz) {
  if (!weatherPopupHourlyEl || !weatherPopupHourlyWrapEl) return;
  const list = (cache && Array.isArray(cache.hourly)) ? cache.hourly : [];
  if (!list.length) {
    weatherPopupHourlyWrapEl.hidden = true;
    return;
  }
  weatherPopupHourlyWrapEl.hidden = false;
  weatherPopupHourlyEl.textContent = "";
  // «Сегодня» считаем в местном поясе города, а не пользователя, чтобы
  // подсветка первого дня совпадала с местной датой прогноза.
  let todayKey;
  if (tz) {
    try {
      const p = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date()).reduce((m, x) => { m[x.type] = x.value; return m; }, {});
      todayKey = p.year + "-" + p.month + "-" + p.day;
    } catch (_) { todayKey = null; }
  }
  if (!todayKey) {
    const now = new Date();
    todayKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  }
  // Шахматный порядок дней: чётные дни — обычный фон, нечётные — alt.
  let dayParity = 0;
  let prevDate = null;
  list.forEach((h, idx) => {
    const cell = document.createElement("div");
    cell.className = "weather-popup-hour";
    const day = h.date || "";
    if (prevDate !== null && day !== prevDate) {
      dayParity ^= 1;
      cell.classList.add("day-start");
    }
    prevDate = day;
    if (dayParity === 1) cell.classList.add("alt");
    if (idx === 0 || h.date === todayKey) cell.classList.add("today");
    const time = document.createElement("span");
    time.className = "weather-popup-hour-time";
    time.textContent = pad2(h.hour) + ":00";
    const icon = document.createElement("span");
    icon.className = "weather-popup-hour-icon";
    icon.textContent = weatherIconFor(h.code);
    const temp = document.createElement("span");
    temp.className = "weather-popup-hour-temp";
    temp.textContent = (h.tempC != null) ? Math.round(h.tempC) + "°" : "—";
    cell.appendChild(time);
    cell.appendChild(icon);
    cell.appendChild(temp);
    weatherPopupHourlyEl.appendChild(cell);
  });
}

function renderWeatherPopup() {
  if (!weatherPopupEl || !weatherPopupDaysEl) return;
  closeWeatherCityMenu();
  const state = getState();
  const s = state && state.settings;
  const city = activeWeatherCity(s);
  const cache = weatherCacheFor(state, city);
  const list = (cache && Array.isArray(cache.forecast)) ? cache.forecast : [];
  const maxDays = Math.max(1, Math.min(14, Number((s && s.weatherForecastDays) || 5)));
  if (weatherPopupCityEl) {
    // Приоритет — имя активного города, cache.city — только fallback (см.
    // обоснование в renderWeather).
    weatherPopupCityEl.textContent = (city && city.name)
      ? (city.name + (city.country ? ", " + city.country : ""))
      : ((cache && cache.city) || (s && s.weatherCity) || "");
  }
  renderWeatherPopupCities(s, city);
  renderWeatherPopupHourly(cache, (city && city.timezone) || "");
  weatherPopupDaysEl.textContent = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "weather-popup-empty";
    empty.textContent = tx("weatherNoData");
    weatherPopupDaysEl.appendChild(empty);
    return;
  }
  const cityTz = (city && city.timezone) || "";
  // «Сегодня» считаем в местном поясе города, чтобы подсветка первого дня
  // совпадала с первым днём прогноза (который теперь тоже начинается с
  // текущего дня города).
  let today;
  if (cityTz) {
    try {
      const p = new Intl.DateTimeFormat("en-CA", {
        timeZone: cityTz, year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date()).reduce((m, x) => { m[x.type] = x.value; return m; }, {});
      today = p.year + "-" + p.month + "-" + p.day;
    } catch (_) { today = null; }
  }
  if (!today) {
    const now = new Date();
    today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  }
  list.slice(0, maxDays).forEach((day, idx) => {
    const row = document.createElement("div");
    row.className = "weather-popup-day";
    const date = day.date ? new Date(day.date + "T12:00:00") : new Date(Date.now() + idx * 86400000);
    const isToday = idx === 0 || day.date === today;
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

/**
 * Слушает кнопку города в шапке попапа: клик раскрывает/закрывает меню
 * городов, клик внутри попапа вне меню и скролл попапа — закрывают меню.
 * Вызывается и в основном режиме (bindWeatherEvents), и в превью настроек,
 * где bindWeatherEvents целиком не запускается.
 */
export function bindWeatherCityMenu() {
  // Город в шапке попапа: клик раскрывает/закрывает меню городов.
  if (weatherPopupCityEl) {
    weatherPopupCityEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (weatherPopupCityEl.classList.contains("has-menu")) toggleWeatherCityMenu();
    });
  }
  // Клик внутри попапа, но вне кнопки города и вне меню — закрывает меню.
  if (weatherPopupEl) {
    weatherPopupEl.addEventListener("mousedown", (e) => {
      if (!weatherCityMenuOpen()) return;
      if (weatherPopupCityEl && weatherPopupCityEl.contains(e.target)) return;
      if (weatherPopupCitiesEl && weatherPopupCitiesEl.contains(e.target)) return;
      closeWeatherCityMenu();
    });
  }
  // Скролл попапа (колесо/тач/скроллбар) закрывает открытое меню городов.
  if (weatherPopupEl) {
    weatherPopupEl.addEventListener("scroll", () => closeWeatherCityMenu(), { passive: true });
  }
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
  // Клики внутри попапа не должны всплывать до weatherWidget и переключать
  // попап (toggleWeatherPopup). Иначе клик/короткий drag по ленте почасового
  // прогноза (или по дням/городам) закрывал бы попап в момент отпускания кнопки.
  if (weatherPopupEl) {
    weatherPopupEl.addEventListener("click", (e) => e.stopPropagation());
  }
  // Город в шапке попапа: меню городов (то же, что и в превью настроек).
  bindWeatherCityMenu();
  // Лента почасового прогноза: скролл перетаскиванием мышью (drag-to-scroll,
  // как слайд). ЛКМ и ПКМ скроллят одинаково, колесо мыши остаётся дефолтным,
  // тач скроллится нативно.
  if (weatherPopupHourlyEl) {
    let tapeDrag = null;
    weatherPopupHourlyEl.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || (e.button !== 0 && e.button !== 2)) return;
      tapeDrag = { startX: e.clientX, startLeft: weatherPopupHourlyEl.scrollLeft, moved: false };
      weatherPopupHourlyEl.classList.add("dragging");
      try { weatherPopupHourlyEl.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    // Меню браузера на ленте не нужно — ПКМ здесь скроллит ленту, а не открывает контекстное меню.
    weatherPopupHourlyEl.addEventListener("contextmenu", (e) => e.preventDefault());
    weatherPopupHourlyEl.addEventListener("pointermove", (e) => {
      if (!tapeDrag) return;
      const dx = e.clientX - tapeDrag.startX;
      if (!tapeDrag.moved && Math.abs(dx) > 4) tapeDrag.moved = true;
      weatherPopupHourlyEl.scrollLeft = tapeDrag.startLeft - dx;
    });
    const endTapeDrag = () => {
      tapeDrag = null;
      weatherPopupHourlyEl.classList.remove("dragging");
    };
    weatherPopupHourlyEl.addEventListener("pointerup", endTapeDrag);
    weatherPopupHourlyEl.addEventListener("pointercancel", endTapeDrag);
  }
  document.addEventListener("mousedown", (e) => {
    // Меню городов вынесено из попапа на уровень body, поэтому исключаем и его:
    // клик по чипу не должен закрывать попап (закрытие происходит уже в самом
    // обработчике чипа после смены активного города).
    if (weatherPopupEl && !weatherPopupEl.hidden && !weatherWidget.contains(e.target) && !weatherPopupOpenBtn.contains(e.target) &&
        !(weatherPopupCitiesEl && weatherPopupCitiesEl.contains(e.target))) {
      closeWeatherPopup();
    }
  });
}

/** Закрывает попап погоды при клике/тапе вне его (для режима превью). */
export function closeWeatherPopupOutside(e) {
  if (weatherPopupEl && !weatherPopupEl.hidden && !weatherWidget.contains(e.target) && !weatherPopupOpenBtn.contains(e.target) &&
      !(weatherPopupCitiesEl && weatherPopupCitiesEl.contains(e.target))) {
    closeWeatherPopup();
  }
}

export { weatherWidget };
