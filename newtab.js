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

(() => {
  "use strict";

  // Режим предпросмотра: newtab.html?preview=1 открывается в iframe настроек.
  // Применяет настройки из options по postMessage и ничего не пишет в storage.
  const PREVIEW_MODE = new URLSearchParams(location.search).get("preview") === "1";

  const gridEl     = document.getElementById("grid");
  const bgEl       = document.getElementById("bg");
  const sheetTabsEl= document.getElementById("sheetTabs");
  const addSheetBtn= document.getElementById("addSheetBtn");
  const sheetBar   = document.getElementById("sheetBar");
  const sheetScrollLeft  = document.getElementById("sheetScrollLeft");
  const sheetScrollRight = document.getElementById("sheetScrollRight");
  const modalEl    = document.getElementById("modal");
  const modalTitle = document.getElementById("modalTitle");
  const tabForm    = document.getElementById("tabForm");
  const sheetModal = document.getElementById("sheetModal");
  const sheetForm  = document.getElementById("sheetForm");
  const confirmModal    = document.getElementById("confirmModal");
  const confirmText     = document.getElementById("confirmText");
  const confirmOkBtn    = document.getElementById("confirmOkBtn");
  const confirmCancelBtn= document.getElementById("confirmCancelBtn");
  const ctxMenu    = document.getElementById("ctxMenu");
  const ctxEmpty   = document.getElementById("ctxMenuEmpty");
  const sheetCtx   = document.getElementById("sheetCtx");
  const toastEl    = document.getElementById("toast");
  const quickGo    = document.getElementById("quickGo");
  const quickInput = document.getElementById("quickGoInput");
  const quickSuggestEl = document.getElementById("quickSuggest");
  const clockWidget   = document.getElementById("clockWidget");
  const clockTimeEl   = document.getElementById("clockTime");
  const clockDateEl   = document.getElementById("clockDate");
  const weatherWidget = document.getElementById("weatherWidget");
  const weatherIconEl = document.getElementById("weatherIcon");
  const weatherTempEl = document.getElementById("weatherTemp");
  const weatherDescEl = document.getElementById("weatherDesc");
  const weatherCityEl = document.getElementById("weatherCity");

  let state = null;
  let lang = "ru";
  let editingBookmark = null;
  let editingTargetKey = null;
  let ctxCellKey = null;
  let ctxBookmarkId = null;
  let sheetCtxTargetId = null;
  let sheetDragId = null;
  let sheetDragPtr = null;       // активная pointer-сессия на вкладке листа
  let suppressSheetClick = false; // подавление click после перетаскивания вкладки
  let sheetDropLine = null;      // индикатор позиции вставки в лист-баре
  let selectedCellKey = null;
  let suppressClick = false;
  let selAnchorKey = null;   // якорная ячейка текущего выделения
  let selRange = [];         // ключи ячеек в выделении (в т.ч. диапазон)
  let pointerState = null;   // активная pointer-сессия на сетке
  let moveDrag = null;       // данные переноса выделенного блока
  let clockTimer = null;
  let weatherTimer = null;
  let _weatherGeoInFlight = false;
  let _weatherHasError = false;
  let _weatherInFlight = false;
  let _weatherGen = 0;
  let _suggestTimer = null;
  let _suggestGen = 0;
  let _suggestItems = [];
  let _suggestIndex = -1;
  let _suggestHideTimer = null;

  function tx(key) { return t(key, lang); }

  function applyI18nStatic() {
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = tx(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = tx(el.dataset.i18nPlaceholder); });
    document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = tx(el.dataset.i18nTitle); });
    document.documentElement.lang = lang;
    applyPageTitle();
  }

  function applyPageTitle() {
    const custom = state && state.settings && state.settings.pageTitle;
    document.title = (custom && String(custom).trim()) || tx("newTabTitle");
  }

  function pad2(n) { n = String(n); return n.length < 2 ? "0" + n : n; }

  function updateClock() {
    if (!clockTimeEl || !clockDateEl) return;
    const s = state && state.settings;
    if (s && s.showClock === false) {
      clockTimeEl.textContent = "";
      clockDateEl.textContent = "";
      return;
    }
    const d = new Date();
    clockTimeEl.textContent = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    const days   = tx("clockDays");
    const months = tx("clockMonths");
    let dayName = "";
    if (Array.isArray(days) && days[d.getDay()]) dayName = days[d.getDay()];
    let monthName = "";
    if (Array.isArray(months) && months[d.getMonth()]) monthName = months[d.getMonth()];
    clockDateEl.textContent = (dayName ? dayName + ", " : "") + d.getDate() + " " + monthName;
  }

  function startClock() {
    if (clockTimer) clearInterval(clockTimer);
    updateClock();
    clockTimer = setInterval(updateClock, 15 * 1000);
  }


  function setWeatherText(icon, temp, desc, city) {
    if (weatherIconEl) weatherIconEl.textContent = icon;
    if (weatherTempEl) weatherTempEl.textContent = temp;
    if (weatherDescEl) weatherDescEl.textContent = desc;
    if (weatherCityEl) weatherCityEl.textContent = city;
  }

  function renderQuickGoIcon() {
    const el = document.getElementById("quickGoIcon");
    if (!el) return;
    const se = state && state.settings && state.settings.searchEngine;
    const maps = { google: "icons/se-google.svg", yandex: "icons/se-yandex.svg", bing: "icons/se-bing.svg" };
    const src = maps[se] || maps.google;
    if (el.dataset.src === src) return;
    el.dataset.src = src;
    el.innerHTML = "";
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    el.appendChild(img);
  }

  function renderWeather() {
    if (!weatherWidget) return;
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
      const desc = describeSymbol(cache.symbol, lang) || cache.desc || "";
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
        ext.runtime.sendMessage({ type: "weatherGeocode", city: city, lang: lang }),
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
      state = await Storage.get();
      return true;
    } catch (_) {
      return false;
    } finally {
      _weatherGeoInFlight = false;
    }
  }

  async function refreshWeather() {
    const s0 = state && state.settings;
    if (!s0 || s0.showWeather === false) return;
    const myGen = ++_weatherGen;
    _weatherInFlight = true;
    _weatherHasError = false;
    renderWeather();
    try {
      let s = state && state.settings;
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
          s = state && state.settings;
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
        ext.runtime.sendMessage({ type: "weather", lat: lat, lon: lon, lang: lang }),
        8000
      );
      if (myGen !== _weatherGen) return;
      if (!resp || resp.error || !resp.ok) throw new Error(resp && resp.error || "no response");
      const humanDesc = describeSymbol(resp.symbol, lang);
      if (humanDesc) resp.desc = humanDesc;
      const s2 = state && state.settings;
      resp.city = (s2 && s2.weatherCity) || resp.city || "";
      await Storage.update((d) => { d.weatherCache = resp; });
      state = await Storage.get();
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

  function startWeather() {
    if (weatherTimer) clearInterval(weatherTimer);
    // Инвалидируем все текущие запросы — старые ответы не должны затирать новые настройки.
    _weatherGen++;
    _weatherInFlight = false;
    _weatherHasError = false;
    renderWeather();
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
const s = state && state.settings;
const url = aggregatorUrl(s && s.weatherLat, s && s.weatherLon, (s && s.weatherCity) || "", lang);
window.open(url, "_blank", "noopener,noreferrer");
}

// ---------- weather forecast popup (like quick-go suggestions) ----------
const weatherPopupEl = document.getElementById("weatherPopup");
const weatherPopupDaysEl = document.getElementById("weatherPopupDays");
const weatherPopupCityEl = document.getElementById("weatherPopupCity");
const weatherPopupOpenBtn = document.getElementById("weatherPopupOpenBtn");
let _weatherPopupTimer = null;
let _weatherPopupClosing = false;

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

function toggleWeatherPopup() {
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
label.textContent = dayLabel(date, idx, isToday, lang, tx);
const fmt = (s && s.weatherDateFmt) || "dd.mm";
if (fmt && fmt !== "off") {
const dateEl = document.createElement("span");
dateEl.className = "weather-popup-day-date";
dateEl.textContent = formatDateFmt(date, fmt, lang);
label.appendChild(dateEl);
}
const icon = document.createElement("span");
icon.className = "weather-popup-day-icon";
icon.textContent = weatherIconFor(day.code);
const descEl = document.createElement("span");
descEl.className = "weather-popup-day-desc";
descEl.textContent = describeSymbol(day.desc, lang) || describeSymbol(day.symbol, lang) || day.desc || "";
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

  function cssEscape(v) { return String(v).replace(/"/g, '\\"'); }

  function letterBadge(title) {
    const span = document.createElement("span");
    span.className = "letter";
    span.textContent = letterChar(title);
    return span;
  }

  function activeSheet() {
    if (!state || !Array.isArray(state.sheets) || state.sheets.length === 0) return null;
    return state.sheets.find(s => s.id === state.activeSheetId) || state.sheets[0];
  }

  async function init() {
    state = await Storage.get();
    if (PREVIEW_MODE) {
      // Превью ничего не пишет в chrome.storage: все «сохранения» (погода, фон,
      // активный лист) мутируют state в памяти и исчезают при закрытии настроек.
      Storage.update = async (mutator) => { mutator(state); };
    }
    lang = state.settings.language || "ru";
    applySettings();
    applyLayoutFlags();
    applyI18nStatic();
    renderGrid();
    renderSheetBar();
    applySheetBarHeight();
    if (PREVIEW_MODE) {
      bindPreview();
    } else {
      bindEvents();
    }
    maybeLoadBingBackground();
    startClock();
    startWeather();

    // Динамический отступ ячеек от топбара (часы могут менять высоту).
    const tb = document.querySelector(".topbar");
    if (tb && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => applyTopbarHeight());
      ro.observe(tb);
    } else {
      window.addEventListener("resize", applyTopbarHeight);
    }
    const sb = document.querySelector(".sheet-bar");
    if (sb && typeof ResizeObserver !== "undefined") {
      const ro2 = new ResizeObserver(() => applySheetBarHeight());
      ro2.observe(sb);
    }
    requestAnimationFrame(() => { applyTopbarHeight(); applySheetBarHeight(); });

    if (PREVIEW_MODE) {
      window.addEventListener("message", onPreviewMessage);
      return;
    }

    Storage.onChanged((next) => {
      if (!next) return;
      const langChanged = (next.settings && next.settings.language) !== lang;
      const prevSettings = state.settings || {};
      const nextSettings = Object.assign({}, prevSettings, next.settings || {});
      state = {
        sheets:        Array.isArray(next.sheets) ? next.sheets : state.sheets,
        activeSheetId: next.activeSheetId || state.activeSheetId,
        settings:      nextSettings,
        bingCache:     next.bingCache !== undefined ? next.bingCache : state.bingCache,
        weatherCache:  next.weatherCache !== undefined ? next.weatherCache : state.weatherCache
      };
      lang = nextSettings.language || "ru";
      applySettings();
      applyLayoutFlags();
      if (langChanged) applyI18nStatic();
      else applyPageTitle();
      renderGrid();
      renderSheetBar();
      refreshSheetCtx();
      startClock();
      // Рестартим погоду только при изменении значимых полей,
      // иначе каждый апдейт weatherCache зацикливает себя.
      const weatherSettingsChanged =
        nextSettings.showWeather   !== prevSettings.showWeather   ||
        nextSettings.weatherLat    !== prevSettings.weatherLat    ||
        nextSettings.weatherLon    !== prevSettings.weatherLon    ||
        nextSettings.weatherCity   !== prevSettings.weatherCity   ||
        nextSettings.weatherRefreshMin !== prevSettings.weatherRefreshMin;
      if (weatherSettingsChanged) {
        startWeather();
      } else {
        renderWeather();
      }
    });
  }

  // ---------- preview mode (newtab.html?preview=1 inside options iframe) ----------
  function onPreviewMessage(e) {
    const d = e.data;
    if (!d || d.type !== "tabula-preview-settings") return;
    const incoming = d.settings;
    if (!incoming || typeof incoming !== "object") return;
    const prev = state.settings || {};
    const merged = Object.assign({}, prev, incoming);
    const langChanged = (merged.language || "ru") !== lang;
    state.settings = merged;
    lang = merged.language || "ru";
    applySettings();
    applyLayoutFlags();
    if (langChanged) applyI18nStatic();
    else applyPageTitle();
    renderGrid();
    renderSheetBar();
    refreshSheetCtx();
    startClock();
    const weatherSettingsChanged =
      merged.showWeather       !== prev.showWeather       ||
      merged.weatherLat        !== prev.weatherLat        ||
      merged.weatherLon        !== prev.weatherLon        ||
      merged.weatherCity       !== prev.weatherCity       ||
      merged.weatherRefreshMin !== prev.weatherRefreshMin;
    if (weatherSettingsChanged) startWeather();
    else renderWeather();
    requestAnimationFrame(() => { applyTopbarHeight(); applySheetBarHeight(); });
  }

  function bindPreview() {
    // Превью неинтерактивно: не открываем закладки, листы и меню,
    // но оставляем hover-состояния и всплывающее окно погоды.
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.closest &&
          t.closest(".cell, .sheet-tab, .sheet-add, .sheet-scroll, .quick-go, .icon-btn, .opts-fab, .clock-widget")) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    document.addEventListener("contextmenu", (e) => e.preventDefault(), true);
    document.addEventListener("auxclick", (e) => e.preventDefault(), true);
    if (quickGo) quickGo.addEventListener("submit", (e) => e.preventDefault());
    if (weatherWidget) {
      weatherWidget.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWeatherPopup();
      });
    }
  }

  function applySettings() {
    const s = state.settings;
    const root = document.documentElement.style;
    // Число колонок сетки всегда зажимается clampCols (см. renderGrid):
    // CSS-треки должны совпадать с количеством букв и ячеек.
    root.setProperty("--columns",     String(clampCols(s.defaultColumns)));
    root.setProperty("--font-family", resolveFont(s.fontFamilyKey, s.fontFamily));
    root.setProperty("--font-size",   s.fontSize + "px");
    root.setProperty("--text-color",  s.textColor);
    root.setProperty("--clock-size",  (s.clockSize || 28) + "px");
 root.setProperty("--weather-size", (s.weatherSize || 13) + "px");
 // Единая прозрачность панелей (выпадайки, модалки, контекстное меню),
 // виджетов и ячеек: 0 = полностью прозрачно, 100 = непрозрачная поверхность.
 // Значение задаётся одним ползунком "Прозрачность панелей и ячеек".
 const uop = Number(s.uiOpacity);
 const uopA = (isFinite(uop)? Math.max(0, Math.min(100, uop)): 90) / 100;
 root.setProperty("--ui-bg-opacity", String(uopA));
 // Блюр ячеек включаем только при непрозрачной подложке, чтобы не жечь GPU впустую.
 document.body.classList.toggle("ui-frost", uopA > 0);
 // Цвет выделения ячейки (используется в .cell.selected / .cell.drop-target).
 root.setProperty("--cell-selected-color", s.cellSelectedColor || "#788cff");
 // Общий масштаб виджетов и нижнего бара (50%..150%), задаётся ползунком uiScale.
 const usc = Number(s.uiScale);
 const uscV = (isFinite(usc) && usc > 0) ? Math.min(1.5, Math.max(0.5, usc / 100)) : 1;
 root.setProperty("--ui-scale", String(uscV));
   applyBackground();
    renderQuickGoIcon();
    requestAnimationFrame(applyTopbarHeight);
  }

  function applyLayoutFlags() {
    const s = state.settings;
    document.body.classList.toggle("no-quick-go", !s.showQuickGo);
    document.body.classList.toggle("no-sheet-bar", !s.showSheetTabs);
    document.body.classList.toggle("no-row-nums", !s.showRowNumbers);
    document.body.classList.toggle("no-col-letters", !s.showColLetters);
    document.body.classList.toggle("no-clock", !s.showClock);
    document.body.classList.toggle("no-weather", !s.showWeather);
    // Выравнивание содержимого ячейки: слева / по центру / справа.
    // Класс cell-align-left добавляется всегда, чтобы CSS-комбинации с
    // favicon-pos-* (row-reverse / column) работали для всех трёх состояний.
    const align = ["left", "center", "right"].includes(s.cellTextAlign) ? s.cellTextAlign : "left";
    document.body.classList.remove("cell-align-left", "cell-align-center", "cell-align-right");
    document.body.classList.add("cell-align-" + align);
    // Расположение иконки в ячейке: слева (по умолчанию), справа, над/под текстом.
    const fpos = ["left", "right", "top", "bottom"].includes(s.faviconPosition) ? s.faviconPosition : "left";
    document.body.classList.remove("favicon-pos-right", "favicon-pos-top", "favicon-pos-bottom");
    if (fpos !== "left") document.body.classList.add("favicon-pos-" + fpos);
    // Виджеты остаются в DOM, чтобы сохранять колонки топбара и не «прыгать» строке поиска.
    // Скрываем только визуально через CSS-класс is-off.
    if (clockWidget)   clockWidget.classList.toggle("is-off",   !s.showClock);
    if (weatherWidget) weatherWidget.classList.toggle("is-off", !s.showWeather);
    applyTopbarHeight();
    applySheetBarHeight();
  }

  function applyTopbarHeight() {
    const tb = document.querySelector(".topbar");
    if (!tb) return;
    const s = state && state.settings;
    const hidden = s && (s.showClock === false && s.showWeather === false && s.showQuickGo === false);
    const h = hidden ? 0 : tb.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--topbar-height", Math.ceil(h) + "px");
  }

  // Обновляет --sheet-bar-height по реальной высоте sheet-bar.
  // Нужно, потому что вкладки теперь переносятся на новую строку и бар растёт.
  function applySheetBarHeight() {
    const bar = document.querySelector(".sheet-bar");
    if (!bar) return;
    const s = state && state.settings;
    if (!s || s.showSheetTabs === false) {
      document.documentElement.style.setProperty("--sheet-bar-height", "0px");
      return;
    }
    const h = bar.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--sheet-bar-height", Math.ceil(h) + "px");
  }

  function applyBackground() {
    const s = state.settings;
    if (s.backgroundType === "bing") {
      const cached = state.bingCache;
      if (cached && cached.url && cached.date === todayKey()) {
        bgEl.style.background = `url("${cssEscape(cached.url)}") center / cover no-repeat, ${s.backgroundColor}`;
      } else {
        bgEl.style.background = s.backgroundColor;
      }
    } else if ((s.backgroundType === "imageUrl" || s.backgroundType === "imageUpload") && s.backgroundImage) {
      bgEl.style.background = `url("${cssEscape(s.backgroundImage)}") center / cover no-repeat, ${s.backgroundColor}`;
    } else if (s.backgroundType === "gradient") {
      bgEl.style.background = `${s.backgroundGradient}, ${s.backgroundColor}`;
    } else {
      bgEl.style.background = s.backgroundColor;
    }
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  async function maybeLoadBingBackground() {
    const s = state.settings;
    if (s.backgroundType !== "bing") return;
    const cached = state.bingCache;
    if (cached && cached.url && cached.date === todayKey()) { applyBackground(); return; }
    try {
      toast(tx("bingLoading"));
      const resp = await ext.runtime.sendMessage({ type: "bingDaily", mkt: s.bingMkt || "ru-RU" });
      if (!resp || resp.error || !resp.url) throw new Error(resp && resp.error || "no url");
      await Storage.update((d) => {
        d.bingCache = { date: todayKey(), url: resp.url, copyright: resp.copyright || "" };
      });
      state = await Storage.get();
      applyBackground();
    } catch (err) {
      console.warn("Bing fetch failed:", err);
      toast(tx("bingFailed"), true);
    }
  }

  function renderGrid() {
    selectedCellKey = null;
    selAnchorKey = null;
    selRange = [];
    pointerState = null;
    moveDrag = null;
    gridEl.innerHTML = "";
    const sh = activeSheet();
    if (!sh) return;

    const cols = clampCols(state.settings.defaultColumns);
    const rows = computeFillRows(sh);
    const showCol = !!state.settings.showColLetters;
    const showRow = !!state.settings.showRowNumbers;

    gridEl.classList.toggle("has-col-letters", showCol);
    gridEl.classList.toggle("has-row-nums",    showRow);
    gridEl.classList.toggle("show-grid",       !!state.settings.showGrid);

    if (showCol) {
      const headerRow = document.createElement("div");
      headerRow.className = "grid-row header";
      // Уголок рисуем только при включённых номерах строк: он заполняет ячейку
      // над колонкой номеров. Если добавить его всегда, при выключенных номерах
      // буквы сдвигаются на колонку вправо, а последняя буква переносится
      // на вторую строку — визуально «буквы начинаются не с A».
      if (showRow) {
        const corner = document.createElement("div");
        corner.className = "corner";
        headerRow.appendChild(corner);
      }
      for (let c = 0; c < cols; c++) {
        const letter = document.createElement("div");
        letter.className = "col-letter";
        letter.textContent = colLetter(c);
        headerRow.appendChild(letter);
      }
      gridEl.appendChild(headerRow);
    }

    for (let r = 0; r < rows; r++) {
      const rowEl = document.createElement("div");
      const isLast = (r === rows - 1);
      rowEl.className = "grid-row" + (isLast ? " fill" : "");
      if (showRow) {
        const rnum = document.createElement("div");
        rnum.className = "row-num";
        rnum.textContent = String(r + 1);
        rowEl.appendChild(rnum);
      }
      for (let c = 0; c < cols; c++) {
        const key = r + "," + c;
        const bm = sh.cells[key];
        rowEl.appendChild(createCellEl(key, bm));
      }
      gridEl.appendChild(rowEl);
    }
  }

  function clampGridRows() {
    // Минимальное число строк грида — настраивается в options.
    const v = Number(state.settings.gridRows);
    return isFinite(v) ? Math.max(2, Math.min(30, Math.round(v))) : 6;
  }

  function computeFillRows(sheet) {
    // Грид растягивается на всю доступную высоту (flex: 1 1 0 у каждой строки),
    // поэтому показываем ровно столько строк, сколько нужно контенту
    // (минимум — настройка "Строк по умолчанию", чтобы сетка не схлопывалась).
    // Без резерва +4 снизу — он заставлял грид «прыгать», когда закладку
    // добавляли в последнюю видимую строку.
    let maxRow = -1;
    for (const k of Object.keys(sheet.cells || {})) {
      const r = parseInt(k.split(",")[0], 10);
      if (!isNaN(r) && r > maxRow) maxRow = r;
    }
    return Math.max(maxRow + 1, clampGridRows());
  }

  function createCellEl(key, bm) {
    const cell = document.createElement("div");
    cell.className = "cell " + (bm ? "filled" : "empty");
    cell.dataset.key = key;
    if (bm) {
      cell.dataset.id = bm.id;
      cell.title = bm.title + "\n" + bm.url;
      const fav = document.createElement("span");
      fav.className = "favicon";
      if (state.settings.showFavicon) {
        const img = document.createElement("img");
        img.alt = "";
        img.draggable = false;
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        const src = faviconUrl(bm.url);
        if (src) {
          img.src = src;
          img.onerror = () => { fav.replaceChildren(letterBadge(bm.title)); };
          fav.appendChild(img);
        } else {
          fav.appendChild(letterBadge(bm.title));
        }
      } else {
        fav.appendChild(letterBadge(bm.title));
      }
      const title = document.createElement("span");
      title.className = "title-text";
      title.textContent = bm.title;
      cell.append(fav, title);
    }
    return cell;
  }

  function clearSheetDragStyles() {
    if (!sheetTabsEl) return;
    sheetTabsEl.querySelectorAll(".sheet-tab").forEach(el => {
      el.style.opacity = "";
      el.classList.remove("sheet-drop-target");
    });
    hideSheetDropLine();
  }

  const _justAddedIds = new Set();
  function renderSheetBar() {
    sheetTabsEl.innerHTML = "";
    sheetDropLine = document.createElement("div");
    sheetDropLine.className = "sheet-drop-line";
    sheetDropLine.hidden = true;
    sheetTabsEl.appendChild(sheetDropLine);
    for (const sh of state.sheets) {
      const tab = document.createElement("div");
      tab.className = "sheet-tab" + (sh.id === state.activeSheetId ? " active" : "");
      tab.dataset.id = sh.id;
      if (_justAddedIds.has(sh.id)) {
        tab.classList.add("newly-added");
        tab.addEventListener("animationend", () => tab.classList.remove("newly-added"), { once: true });
      }
      const iconEl = document.createElement("span");
      iconEl.className = "sheet-icon";
      iconEl.textContent = sh.icon || "";
      iconEl.title = tx("sheetIcon");
      iconEl.addEventListener("dblclick", (e) => {
        if (tab.querySelector("input.sheet-name-input")) return;
        e.stopPropagation();
        beginRenameIcon(tab, sh);
      });
      const nameEl = document.createElement("span");
      nameEl.className = "name";
      nameEl.textContent = sh.name;
      tab.append(iconEl, nameEl);

      tab.addEventListener("click", (e) => {
        if (tab.querySelector("input.sheet-name-input")) return;
        if (suppressSheetClick) { suppressSheetClick = false; return; }
        if (sh.id !== state.activeSheetId) switchSheet(sh.id);
      });
      tab.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        beginRenameSheet(tab, sh);
      });
      tab.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        sheetCtxTargetId = sh.id;
        refreshSheetCtx();
        positionMenu(sheetCtx, e.clientX, e.clientY);
        sheetCtx.hidden = false;
      });

      sheetTabsEl.appendChild(tab);
    }
    refreshSheetCtx();
    updateSheetScrollArrows();
  }

  function refreshSheetCtx() {
    // No per-sheet columns any more — column count is global (settings.defaultColumns).
  }

  function updateSheetScrollArrows() {
    if (!sheetTabsEl || !sheetScrollLeft || !sheetScrollRight) return;
    const max = sheetTabsEl.scrollWidth - sheetTabsEl.clientWidth;
    sheetScrollLeft.disabled  = sheetTabsEl.scrollLeft <= 1;
    sheetScrollRight.disabled = sheetTabsEl.scrollLeft >= max - 1;
  }

  // ---------- перетаскивание вкладок листов (pointer-события) ----------
  function onSheetBarPointerDown(e) {
    if (e.button !== 0) return;
    const tab = e.target.closest && e.target.closest(".sheet-tab");
    if (!tab) return;
    if (tab.querySelector("input.sheet-name-input") || tab.querySelector("input.sheet-icon-input")) return;
    sheetDragId = null;
    sheetDragPtr = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      tab,
      moved: false,
      targetId: null,
      before: true
    };
  }

  function onSheetBarPointerMove(e) {
    const d = sheetDragPtr;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
      d.moved = true;
      sheetDragId = d.tab.dataset.id;
      d.tab.classList.add("sheet-dragging");
      d.tab.style.opacity = "0.4";
    }
    // Ищем вкладку, к которой ближе всего указатель (по середине).
    const tabs = [...sheetTabsEl.querySelectorAll(".sheet-tab")].filter(t => t !== d.tab);
    let targetId = null;
    let before = true;
    for (const t of tabs) {
      const r = t.getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) { targetId = t.dataset.id; before = true; break; }
      targetId = t.dataset.id;
      before = false;
    }
    d.targetId = targetId;
    d.before = before;
    // Позиция линии-индикатора в координатах контента (с учётом scrollLeft).
    const rect = sheetTabsEl.getBoundingClientRect();
    let left;
    if (targetId == null) {
      left = sheetTabsEl.scrollWidth;
    } else {
      const target = sheetTabsEl.querySelector('.sheet-tab[data-id="' + cssAttr(targetId) + '"]');
      const tr = target.getBoundingClientRect();
      left = before ? tr.left - rect.left : tr.right - rect.left;
    }
    left += sheetTabsEl.scrollLeft;
    sheetDropLine.style.left = left + "px";
    sheetDropLine.hidden = false;
  }

  function onSheetBarPointerUp(e) {
    const d = sheetDragPtr;
    if (!d || e.pointerId !== d.pointerId) return;
    sheetDragPtr = null;
    hideSheetDropLine();
    d.tab.classList.remove("sheet-dragging");
    d.tab.style.opacity = "";
    if (!d.moved) return;
    const fromId = d.tab.dataset.id;
    sheetDragId = null;
    if (!d.targetId || d.targetId === fromId) return;
    suppressSheetClick = true;
    setTimeout(() => { suppressSheetClick = false; }, 50);
    persistSheetOrder(fromId, d.targetId, d.before);
  }

  function onSheetBarPointerCancel() {
    const d = sheetDragPtr;
    if (!d) return;
    sheetDragPtr = null;
    sheetDragId = null;
    hideSheetDropLine();
    d.tab.classList.remove("sheet-dragging");
    d.tab.style.opacity = "";
  }

  function hideSheetDropLine() {
    if (sheetDropLine) sheetDropLine.hidden = true;
  }

  // Перемещает лист на новую позицию и сохраняет порядок.
  async function persistSheetOrder(fromId, targetId, before) {
    await Storage.update((d) => {
      const fromIdx = d.sheets.findIndex(s => s.id === fromId);
      if (fromIdx < 0) return;
      const [moved] = d.sheets.splice(fromIdx, 1);
      let toIdx;
      if (targetId == null) {
        toIdx = d.sheets.length;
      } else {
        const ti = d.sheets.findIndex(s => s.id === targetId);
        if (ti < 0) { d.sheets.splice(fromIdx, 0, moved); return; }
        toIdx = before ? ti : ti + 1;
      }
      d.sheets.splice(toIdx, 0, moved);
    });
    state = await Storage.get();
    renderSheetBar();
    renderGrid();
    updateSheetScrollArrows();
  }

  async function switchSheet(id) {
    await Storage.update((d) => { d.activeSheetId = id; });
    state = await Storage.get();
    renderSheetBar();
    renderGrid();
    if (sheetTabsEl) {
      const tabEl = sheetTabsEl.querySelector('.sheet-tab[data-id="' + id + '"]');
      if (tabEl && tabEl.scrollIntoView) tabEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    updateSheetScrollArrows();
  }

  async function addSheetPrompt() {
    if (!sheetModal || !sheetForm) return;
    sheetForm.reset();
    sheetForm.elements.name.value = tx("newSheetDefault");
    sheetModal.hidden = false;
    // restart modal animation
    const card = sheetModal.querySelector(".modal-card");
    if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
    // Defer focus to next tick so the modal can paint first.
    setTimeout(() => {
      try { sheetForm.elements.name.focus({ preventScroll: true }); } catch (_) {}
      try { sheetForm.elements.name.select(); } catch (_) {}
    }, 0);
  }

  function closeSheetModal() {
    if (sheetModal) sheetModal.hidden = true;
  }

  async function onSubmitSheet(e) {
    e.preventDefault();
    if (!sheetForm) return;
    const nameEl = sheetForm.elements.name;
    if (!nameEl) return;
    const name = (nameEl.value || "").trim();
    if (!name) return;
    if (state.sheets.some(s => s.name === name)) { toast(tx("sheetExists"), true); return; }
    const icon = randomSheetIcon();
    const cols = clampCols(state.settings.defaultColumns || 8);
    const newSheet = { id: cryptoId(), name: name, icon: icon, columns: cols, cells: {} };
    await Storage.update((d) => {
      d.sheets.push(newSheet);
      d.activeSheetId = newSheet.id;
    });
    state = await Storage.get();
    // remember the new sheet id so its tab plays entrance animation only this once
    _justAddedIds.add(newSheet.id);
    setTimeout(() => _justAddedIds.delete(newSheet.id), 800);
    renderSheetBar(); renderGrid();
    if (sheetTabsEl) sheetTabsEl.scrollLeft = sheetTabsEl.scrollWidth;
    closeSheetModal();
    toast(tx("sheetAdded"));
  }

  // ---------- confirm modal ----------
  function confirmDialog(message) {
    return new Promise((resolve) => {
      if (!confirmModal || !confirmText || !confirmOkBtn || !confirmCancelBtn) { resolve(true); return; }
      confirmText.textContent = message;
      confirmModal.hidden = false;
      // restart modal animation
      const card = confirmModal.querySelector(".modal-card");
      if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }

      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        confirmModal.hidden = true;
        cleanup();
        resolve(val);
      };
      const onOk = () => finish(true);
      const onCancel = () => finish(false);
      const onKey = (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        onCancel();
      };
      const onOverlay = (e) => {
        if (e.target === confirmModal) onCancel();
      };
      function cleanup() {
        confirmOkBtn.removeEventListener("click", onOk);
        confirmCancelBtn.removeEventListener("click", onCancel);
        document.removeEventListener("keydown", onKey);
        confirmModal.removeEventListener("mousedown", onOverlay);
      }
      confirmOkBtn.addEventListener("click", onOk);
      confirmCancelBtn.addEventListener("click", onCancel);
      document.addEventListener("keydown", onKey);
      confirmModal.addEventListener("mousedown", onOverlay);
      // Фокус на безопасную кнопку (Отмена), чтобы Enter не сработал случайно.
      setTimeout(() => {
        try { confirmCancelBtn.focus({ preventScroll: true }); } catch (_) {}
      }, 0);
    });
  }

  async function deleteSheet(sh) {
    if (state.sheets.length <= 1) { toast(tx("needOneSheet"), true); return; }
    const count = Object.keys(sh.cells || {}).length;
    if (count > 0 && !(await confirmDialog(tx("confirmDeleteSheet")(count)))) return;
    await Storage.update((d) => {
      d.sheets = d.sheets.filter(s => s.id !== sh.id);
      if (d.activeSheetId === sh.id) d.activeSheetId = d.sheets[0].id;
    });
    state = await Storage.get();
    renderSheetBar(); renderGrid();
    toast(tx("removed"));
  }

  function beginRenameIcon(tabEl, sheet) {
    if (tabEl.querySelector("input.sheet-icon-input")) return;
    const iconEl = tabEl.querySelector(".sheet-icon");
    if (!iconEl) return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "sheet-icon-input";
    input.value = sheet.icon || "";
    input.maxLength = 4;
    iconEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const finish = async (commit) => {
      if (done) return;
      done = true;
      const newIcon = (input.value || "").trim() || (sheet.icon || "");
      // restore span first
      const restored = document.createElement("span");
      restored.className = "sheet-icon";
      restored.textContent = sheet.icon || "";
      restored.title = tx("sheetIcon");
      restored.addEventListener("dblclick", (e) => {
        if (tabEl.querySelector("input.sheet-name-input")) return;
        e.stopPropagation();
        beginRenameIcon(tabEl, sheet);
      });
      input.replaceWith(restored);
      if (!commit || newIcon === (sheet.icon || "")) return;
      await Storage.update((d) => {
        const s = d.sheets.find(x => x.id === sheet.id);
        if (s) s.icon = newIcon;
      });
      state = await Storage.get();
      renderSheetBar();
      toast(tx("renamed"));
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", () => finish(true));
  }

  function beginRenameSheet(tabEl, sheet) {
    if (tabEl.querySelector("input.sheet-name-input")) return;
    const nameEl = tabEl.querySelector(".name");
    if (!nameEl) return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "sheet-name-input";
    input.value = sheet.name;
    input.maxLength = 40;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const finish = async (commit) => {
      if (done) return;
      done = true;
      const newName = (input.value || "").trim() || sheet.name;
      input.replaceWith(nameEl);
      if (!commit || newName === sheet.name) { nameEl.textContent = sheet.name; return; }
      if (state.sheets.some(s => s.id !== sheet.id && s.name === newName)) {
        toast(tx("sheetExists"), true);
        nameEl.textContent = sheet.name;
        return;
      }
      await Storage.update((d) => {
        const s = d.sheets.find(x => x.id === sheet.id);
        if (s) s.name = newName;
      });
      state = await Storage.get();
      renderSheetBar();
      toast(tx("renamed"));
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter")      { e.preventDefault(); finish(true); }
      else if (e.key === "Escape"){ e.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", () => finish(true));
  }

  function bindEvents() {
    document.getElementById("optsBtn").addEventListener("click", () => {
      if (ext.runtime.openOptionsPage) ext.runtime.openOptionsPage();
      else window.open("options.html", "_blank");
    });
    document.getElementById("cancelBtn").addEventListener("click", closeModal);
    tabForm.addEventListener("submit", onSubmitBookmark);
    quickGo.addEventListener("submit", onQuickGo);
    quickInput.addEventListener("input", () => {
      clearTimeout(_suggestTimer);
      _suggestTimer = setTimeout(fetchSuggest, 180);
    });
    quickInput.addEventListener("focus", () => {
      clearTimeout(_suggestTimer);
      _suggestTimer = setTimeout(fetchSuggest, 180);
    });
    quickInput.addEventListener("blur", () => {
      clearTimeout(_suggestTimer);
      setTimeout(() => {
        if (document.activeElement !== quickInput) hideSuggest();
      }, 120);
    });
    document.addEventListener("mousedown", (e) => {
      if (quickSuggestEl && !quickSuggestEl.hidden && !quickSuggestEl.contains(e.target)) {
        hideSuggest();
      }
    });

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

    // Close modal on click outside the card
    modalEl.addEventListener("mousedown", (e) => {
      if (e.target === modalEl) closeModal();
    });

    addSheetBtn.addEventListener("click", addSheetPrompt);
    if (sheetForm) sheetForm.addEventListener("submit", onSubmitSheet);
    const sheetCancelBtn = document.getElementById("sheetCancelBtn");
    if (sheetCancelBtn) sheetCancelBtn.addEventListener("click", closeSheetModal);
    // Close sheet modal on click outside the card
    if (sheetModal) {
      sheetModal.addEventListener("mousedown", (e) => {
        if (e.target === sheetModal) closeSheetModal();
      });
    }

    if (sheetScrollLeft) {
      sheetScrollLeft.addEventListener("click", () => {
        if (sheetTabsEl) sheetTabsEl.scrollBy({ left: -240, behavior: "smooth" });
      });
    }
    if (sheetScrollRight) {
      sheetScrollRight.addEventListener("click", () => {
        if (sheetTabsEl) sheetTabsEl.scrollBy({ left:  240, behavior: "smooth" });
      });
    }

    if (sheetTabsEl) {
      sheetTabsEl.addEventListener("scroll", updateSheetScrollArrows, { passive: true });
      window.addEventListener("resize", () => {
        updateSheetScrollArrows();
        applySheetBarHeight();
      });
    }
    // Горизонтальный скролл листов по колесу мыши над sheet-bar.
    if (sheetBar && sheetTabsEl) {
      sheetBar.addEventListener("wheel", (e) => {
        // Не перехватываем, когда пользователь крутит колесо над инпутом (переименование листа).
        if (e.target && e.target.closest && e.target.closest("input")) return;
        // Не перехватываем горизонтальный жест трекпада.
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        e.preventDefault();
        sheetTabsEl.scrollBy({ left: e.deltaY, behavior: "auto" });
      }, { passive: false });
    }

    // Перетаскивание вкладок листов (как у ячеек — pointer-события).
    if (sheetTabsEl) {
      sheetTabsEl.addEventListener("pointerdown", onSheetBarPointerDown);
      document.addEventListener("pointermove", onSheetBarPointerMove);
      document.addEventListener("pointerup", onSheetBarPointerUp);
      document.addEventListener("pointercancel", onSheetBarPointerCancel);
    }

    // Клик по ячейке: открытие закладки обрабатывается в onGridPointerUp.
    gridEl.addEventListener("click", onCellClick);
    gridEl.addEventListener("auxclick", onCellAuxClick);
    gridEl.addEventListener("contextmenu", onCellContextMenu);
    // Excel-подобное выделение диапазона и перенос выделенного блока.
    gridEl.addEventListener("pointerdown", onGridPointerDown);
    document.addEventListener("pointermove", onGridPointerMove);
    document.addEventListener("pointerup", onGridPointerUp);
    document.addEventListener("pointercancel", onCellPointerCancel);

    ctxMenu.addEventListener("click", onCtxAction);
    ctxEmpty.addEventListener("click", onCtxEmptyAction);
    sheetCtx.addEventListener("click", onSheetCtxAction);

    gridEl.addEventListener("contextmenu", (e) => {
      if (!e.target.closest(".cell")) e.preventDefault();
    });

    document.addEventListener("mousedown", (e) => {
      if (!modalEl.hidden || (sheetModal && !sheetModal.hidden) || (confirmModal && !confirmModal.hidden)) return; // don't interfere with open modals
      if (!ctxMenu.hidden && !ctxMenu.contains(e.target)) hideCtx();
      if (!ctxEmpty.hidden && !ctxEmpty.contains(e.target)) hideCtxEmpty();
      if (!sheetCtx.hidden && !sheetCtx.contains(e.target)) hideSheetCtx();
      if (!e.target.closest(".cell") && !e.target.closest(".ctx-menu") && !e.target.closest(".modal")) {
        selectCell(null);
      }
    });
    document.addEventListener("scroll", () => {
      hideCtx(); hideCtxEmpty(); hideSheetCtx();
    }, true);

    document.addEventListener("keydown", (e) => {
      if (!modalEl.hidden) { if (e.key === "Escape") closeModal(); return; }
      if (sheetModal && !sheetModal.hidden) { if (e.key === "Escape") closeSheetModal(); return; }
      if (confirmModal && !confirmModal.hidden) return; // закрывается внутри confirmDialog

      const suggestOpen = quickSuggestEl && !quickSuggestEl.hidden;

      if (e.key === "Escape") {
        hideCtx(); hideCtxEmpty(); hideSheetCtx();
        if (suggestOpen) {
          hideSuggest();
        } else if (document.activeElement === quickInput) {
          quickInput.blur();
        }
        return;
      }

      if (document.activeElement === quickInput) {
        if (suggestOpen && _suggestItems.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          e.preventDefault();
          _suggestIndex = (e.key === "ArrowDown")
            ? (_suggestIndex + 1) % _suggestItems.length
            : (_suggestIndex - 1 + _suggestItems.length) % _suggestItems.length;
          markSuggestActive();
          return;
        }
        if (suggestOpen && _suggestItems.length && e.key === "Enter" && _suggestIndex >= 0) {
          e.preventDefault();
          onQuickGo(null, _suggestItems[_suggestIndex]);
          return;
        }
        return;
      }

      if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
        e.preventDefault(); quickInput.focus(); quickInput.select();
      }
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderGrid, 80);
    });
  }

  function cssAttr(v) { return String(v).replace(/"/g, '\\"'); }

  function clearCellSelection() {
    gridEl.querySelectorAll(".cell.selected").forEach(el => el.classList.remove("selected", "active"));
  }

  function cellElByKey(key) {
    return gridEl.querySelector('.cell[data-key="' + cssAttr(key) + '"]');
  }

  function applySelection(anchorKey, keys) {
    selAnchorKey = anchorKey;
    selRange = keys;
    clearCellSelection();
    keys.forEach(k => {
      const el = cellElByKey(k);
      if (el) el.classList.add("selected");
    });
    const a = cellElByKey(anchorKey);
    if (a) a.classList.add("active");
  }

  function selectCell(key) {
    selectedCellKey = key;
    if (key) applySelection(key, [key]);
    else { selAnchorKey = null; selRange = []; clearCellSelection(); }
  }

  function selectRange(anchorKey, focusKey) {
    selectedCellKey = anchorKey;
    applySelection(anchorKey, rangeKeys(anchorKey, focusKey));
  }

  function onCellClick(e) {
    if (suppressClick) { suppressClick = false; return; }
    // Открытие закладки обрабатывается в onGridPointerUp (клик без перетаскивания).
    // Здесь только гасим случайные клики, оставшиеся после pointer-сессии.
    e.preventDefault();
    e.stopPropagation();
  }

  function onCellAuxClick(e) {
    // СКМ по заполненной ячейке: открыть в новой вкладке всегда (независимо от openInNewTab).
    if (e.button !== 1) return;
    const cell = e.target.closest(".cell");
    if (!cell) return;
    e.preventDefault();
    e.stopPropagation();
    // Подавляем последующий обычный click, чтобы не открыть ссылку повторно.
    // (СКМ не порождает click, поэтому гасим флаг отложенно.)
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
    const bm = cell.classList.contains("filled") ? currentBookmarkAt(cell.dataset.key) : null;
    if (!bm) return;
    const target = normalizeUrl(bm.url);
    window.open(target, "_blank", "noopener");
  }

  function currentBookmarkAt(key) {
    const sh = activeSheet();
    return sh && sh.cells ? sh.cells[key] : null;
  }

  function onCellContextMenu(e) {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    e.preventDefault();
    e.stopPropagation();
    hideCtx(); hideCtxEmpty();
    const key = cell.dataset.key;
    if (!key) return;
    selectCell(key);
    const bm = cell.classList.contains("filled") ? currentBookmarkAt(key) : null;

    if (bm) {
      ctxBookmarkId = bm.id;
      ctxCellKey = key;
      positionMenu(ctxMenu, e.clientX, e.clientY);
      ctxMenu.hidden = false;
    } else {
      ctxBookmarkId = null;
      ctxCellKey = key;
      positionMenu(ctxEmpty, e.clientX, e.clientY);
      ctxEmpty.hidden = false;
    }
  }

  function positionMenu(menu, x, y) {
    menu.style.left = "0px"; menu.style.top = "0px";
    menu.hidden = false;
    const r = menu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth  - r.width  - 4);
    const top  = Math.min(y, window.innerHeight - r.height - 4);
    menu.style.left = Math.max(0, left) + "px";
    menu.style.top  = Math.max(0, top)  + "px";
  }
  function hideCtx()       { ctxMenu.hidden = true;    ctxBookmarkId = null; ctxCellKey = null; }
  function hideCtxEmpty()  { ctxEmpty.hidden = true;   ctxCellKey = null; }
  function hideSheetCtx()  { sheetCtx.hidden = true;   sheetCtxTargetId = null; }

  async function onCtxAction(e) {
    const li = e.target.closest('li[data-act]');
    if (!li || !ctxMenu.contains(li)) return;
    const act = li.dataset.act;
    const id = ctxBookmarkId;
    const key = ctxCellKey;
    hideCtx();
    if (!id || !act || !key) return;
    const sh = activeSheet();
    if (!sh) return;
    const bm = sh.cells[key];
    if (!bm || bm.id !== id) return;

    switch (act) {
      case "open":
        window.location.href = normalizeUrl(bm.url);
        break;
      case "open-new":
        window.open(normalizeUrl(bm.url), "_blank", "noopener");
        break;
      case "edit":
        openEditModal(bm, key);
        break;
      case "duplicate": {
        const newKey = nextEmptyAfter(sh, key, clampCols(state.settings.defaultColumns));
        const dupTitle = bm.title + " (" + tx("duplicate").toLowerCase() + ")";
        await Storage.update((d) => {
          const cur = d.sheets.find(s => s.id === d.activeSheetId);
          if (cur && newKey) cur.cells[newKey] = { id: cryptoId(), title: dupTitle, url: bm.url };
        });
        state = await Storage.get(); renderGrid();
        toast(tx("duplicated"));
        break;
      }
      case "delete":
        await Storage.update((d) => {
          const cur = d.sheets.find(s => s.id === d.activeSheetId);
          if (cur) delete cur.cells[key];
        });
        state = await Storage.get(); renderGrid();
        toast(tx("deleted"));
        break;
    }
  }

  function onCtxEmptyAction(e) {
    const li = e.target.closest('li[data-act]');
    if (!li || !ctxEmpty.contains(li)) return;
    const act = li.dataset.act;
    const key = ctxCellKey;
    hideCtxEmpty();
    if (act === "add" && key) openAddModal(key);
  }

  async function onSheetCtxAction(e) {
    const li = e.target.closest('li[data-act]');
    if (!li || !sheetCtx.contains(li)) return;
    const act = li.dataset.act;
    const id = sheetCtxTargetId;
    hideSheetCtx();
    if (!id || !act) return;
    const sh = state.sheets.find(s => s.id === id);
    if (!sh) return;

    if (act === "rename") {
      const tabEl = sheetTabsEl.querySelector('.sheet-tab[data-id="' + id + '"]');
      if (tabEl) beginRenameSheet(tabEl, sh);
    } else if (act === "delete") {
      deleteSheet(sh);
    } else if (act === "icon") {
      const tabEl = sheetTabsEl.querySelector('.sheet-tab[data-id="' + id + '"]');
      if (tabEl) beginRenameIcon(tabEl, sh);
    }
  }
  const SHEET_ICON_PALETTE = ["📋","🏠","💼","📰","📚","🎵","🎬","🛒","💡","⚙️","🚀","📷","🎮","✉️","📊","🔥","⭐","❤️","🌐","🧠","📁","📅","📞","🛠","💬","🧩"];
  function randomSheetIcon() {
    return SHEET_ICON_PALETTE[Math.floor(Math.random() * SHEET_ICON_PALETTE.length)];
  }


  async function onAddBookmarkTop() {
    const sh = activeSheet();
    if (!sh) return;
    const key = findFirstEmptyCell(sh, computeFillRows(sh), clampCols(state.settings.defaultColumns)) || "0,0";
    openAddModal(key);
  }

  // ---------- Excel-подобное выделение и перенос блока ----------
  function selectionFilledCells() {
    const sh = activeSheet();
    const out = [];
    if (!sh || !sh.cells) return out;
    selRange.forEach(k => { if (sh.cells[k]) out.push({ from: k, bm: sh.cells[k] }); });
    return out;
  }

  function cellAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest(".cell") : null;
  }

  function clearMoveTargets() {
    gridEl.querySelectorAll(".cell.drop-target").forEach(el => el.classList.remove("drop-target"));
  }

  function clearDraggingCells() {
    gridEl.querySelectorAll(".cell.dragging").forEach(el => el.classList.remove("dragging"));
  }

  function onGridPointerDown(e) {
    if (e.button !== 0) return; // только ЛКМ
    const cell = e.target.closest(".cell");
    if (!cell) return;
    const key = cell.dataset.key;
    if (!key) return;
    const sh = activeSheet();
    const hasBookmark = !!(sh && sh.cells && sh.cells[key]);
    const inSelection = selRange.indexOf(key) !== -1;
    // Как везде: захват заполненной ячейки — перемещение (одной или блока),
    // захват пустой ячейки — выделение диапазона.
    const mode = hasBookmark ? "move" : "select";
    // Новый захват вне текущего выделения сужает выбор до этой ячейки,
    // иначе при переносе уедет старый блок, а не захваченная ячейка.
    if (mode === "select" || (mode === "move" && !inSelection)) selectCell(key);
    pointerState = {
      mode,
      anchorKey: key,
      startX: e.clientX,
      startY: e.clientY,
      lastKey: key,
      moved: false
    };
  }

  function onGridPointerMove(e) {
    if (!pointerState) return;
    const dx = e.clientX - pointerState.startX;
    const dy = e.clientY - pointerState.startY;
    if (!pointerState.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      pointerState.moved = true;
      if (pointerState.mode === "move") {
        moveDrag = { cells: selectionFilledCells(), anchorKey: pointerState.anchorKey };
        gridEl.querySelectorAll(".cell.selected").forEach(el => el.classList.add("dragging"));
      }
    }
    if (!pointerState.moved) return;
    e.preventDefault(); // запрещаем выделение текста/нативный drag во время перетаскивания
    const cell = cellAtPoint(e.clientX, e.clientY);
    const key = cell ? cell.dataset.key : null;
    if (!key || key === pointerState.lastKey) return;
    pointerState.lastKey = key;
    if (pointerState.mode === "select") {
      selectRange(pointerState.anchorKey, key);
    } else {
      clearMoveTargets();
      if (key !== pointerState.anchorKey) {
        const t = cellElByKey(key);
        if (t) t.classList.add("drop-target");
      }
    }
  }

  async function onGridPointerUp(e) {
    if (!pointerState || e.button !== 0) return;
    const st = pointerState;
    pointerState = null;
    const cell = cellAtPoint(e.clientX, e.clientY);
    const targetKey = cell ? cell.dataset.key : st.lastKey;

    if (st.mode === "move" && st.moved && moveDrag) {
      const md = moveDrag;
      moveDrag = null;
      clearMoveTargets();
      clearDraggingCells();
      if (targetKey && targetKey !== md.anchorKey) {
        await moveSelectionBlock(md, targetKey);
      } else {
        renderGrid();
      }
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 50);
      return;
    }

    // Обычный клик без перетаскивания: выделить и открыть закладку, если есть.
    clearMoveTargets();
    clearDraggingCells();
    if (!st.moved) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 50);
      if (st.mode === "select") {
        selectCell(st.anchorKey);
        openBookmarkAt(st.anchorKey);
      } else if (st.mode === "move") {
        openBookmarkAt(st.anchorKey);
      }
    }
  }

  function onCellPointerCancel() {
    pointerState = null;
    moveDrag = null;
    clearMoveTargets();
    clearDraggingCells();
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
  }

  function openBookmarkAt(key) {
    const bm = currentBookmarkAt(key);
    if (!bm) return;
    const target = normalizeUrl(bm.url);
    if (state.settings.openInNewTab) window.open(target, "_blank", "noopener");
    else window.location.href = target;
  }

  // Переносит выделенный блок так, чтобы захваченная ячейка оказалась под курсором.
  async function moveSelectionBlock(md, targetKey) {
    const sh = activeSheet();
    if (!sh || md.cells.length === 0) return;
    const [ar, ac] = keyParts(md.anchorKey);
    const [tr, tc] = keyParts(targetKey);
    const dr = tr - ar;
    const dc = tc - ac;
    if (dr === 0 && dc === 0) { renderGrid(); return; }

    const sourceKeys = new Set(md.cells.map(c => c.from));
    let blocked = false;
    await Storage.update((d) => {
      const cur = d.sheets.find(s => s.id === d.activeSheetId);
      if (!cur) return;
      // Проверяем целевые ячейки: нельзя класть на чужие занятые (вне блока).
      for (const c of md.cells) {
        const [r, col] = keyParts(c.from);
        const nk = (r + dr) + "," + (col + dc);
        if (sourceKeys.has(nk)) continue; // внутри блока — переедет вместе с блоком
        if (cur.cells[nk]) { blocked = true; return; }
      }
      if (blocked) return;
      for (const c of md.cells) delete cur.cells[c.from];
      for (const c of md.cells) {
        const [r, col] = keyParts(c.from);
        cur.cells[(r + dr) + "," + (col + dc)] = c.bm;
      }
    });

    if (blocked) {
      toast(tx("cellOccupied"), true);
      return;
    }
    state = await Storage.get();
    renderGrid();
    toast(tx("moved"));
  }

  function openAddModal(key) {
    editingBookmark = null;
    editingTargetKey = key || null;
    modalTitle.textContent = tx("modalAdd");
    tabForm.elements.title.value = "";
    tabForm.elements.url.value   = "";
    modalEl.hidden = false;
    // restart modal animation
    const card = modalEl.querySelector(".modal-card");
    if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
    // Defer focus to next tick so the modal can paint first.
    setTimeout(() => {
      try { tabForm.elements.title.focus({ preventScroll: true }); } catch (_) {}
      try { tabForm.elements.title.select(); } catch (_) {}
    }, 0);
  }
  function openEditModal(bm, key) {
    editingBookmark = { id: bm.id, key };
    editingTargetKey = key;
    modalTitle.textContent = tx("modalEdit");
    tabForm.elements.title.value = bm.title || "";
    tabForm.elements.url.value   = bm.url   || "";
    modalEl.hidden = false;
    const card = modalEl.querySelector(".modal-card");
    if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
    setTimeout(() => {
      try { tabForm.elements.title.focus({ preventScroll: true }); } catch (_) {}
      try { tabForm.elements.title.select(); } catch (_) {}
    }, 0);
  }
  function closeModal() {
    modalEl.hidden = true;
    editingBookmark = null;
    editingTargetKey = null;
  }

  async function onSubmitBookmark(e) {
    e.preventDefault();
    if (!tabForm) return;
    const titleEl = tabForm.elements.title;
    const urlEl   = tabForm.elements.url;
    if (!titleEl || !urlEl) return;
    const title = (titleEl.value || "").trim();
    const url   = (urlEl.value   || "").trim();
    if (!title || !url) return;

    await Storage.update((d) => {
      const cur = d.sheets.find(s => s.id === d.activeSheetId);
      if (!cur) return;
      if (editingBookmark) {
        const x = cur.cells[editingBookmark.key];
        if (x && x.id === editingBookmark.id) {
          x.title = title;
          x.url   = url;
        }
      } else {
        const k = editingTargetKey || findFirstEmptyCell(cur, computeFillRows(cur), clampCols(state.settings.defaultColumns)) || "0,0";
        cur.cells[k] = { id: cryptoId(), title, url };
      }
    });
    state = await Storage.get();
    renderGrid();
    closeModal();
    toast(editingBookmark ? tx("saved") : tx("added"));
  }

  function hideSuggest() {
    _suggestGen++;
    _suggestIndex = -1;
    _suggestItems = [];
    if (!quickSuggestEl || quickSuggestEl.hidden) return;
    quickSuggestEl.classList.add("closing");
    clearTimeout(_suggestHideTimer);
    _suggestHideTimer = setTimeout(() => {
      quickSuggestEl.classList.remove("closing");
      quickSuggestEl.hidden = true;
    }, 150);
  }

  function markSuggestActive() {
    if (!quickSuggestEl) return;
    const nodes = quickSuggestEl.children;
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle("active", i === _suggestIndex);
    }
    const active = nodes[_suggestIndex];
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
  }

  function renderSuggest(items) {
    if (!quickSuggestEl) return;
    _suggestItems = (items || []).slice(0, 10);
    _suggestIndex = -1;
    if (!_suggestItems.length) {
      quickSuggestEl.hidden = true;
      return;
    }
    quickSuggestEl.textContent = "";
    _suggestItems.forEach((item) => {
      const div = document.createElement("div");
      div.className = "quick-suggest-item";
      const iconEl = document.createElement("span");
iconEl.className = "suggest-icon";
iconEl.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
const textEl = document.createElement("span");
textEl.className = "suggest-text";
textEl.textContent = item;
div.append(iconEl, textEl);
      div.addEventListener("mousedown", (e) => {
        e.preventDefault(); // сохранить фокус на инпуте
        onQuickGo(null, item);
      });
      quickSuggestEl.appendChild(div);
    });
    clearTimeout(_suggestHideTimer);
    quickSuggestEl.classList.remove("closing");
    quickSuggestEl.hidden = false;
  }

  async function fetchSuggest() {
    const s = state && state.settings;
    if (!s || s.quickGoSuggest === false || !ext.runtime.sendMessage) {
      hideSuggest();
      return;
    }
    const v = quickInput.value.trim();
    if (v.length < 2) {
      hideSuggest();
      return;
    }
    const myGen = ++_suggestGen;
    try {
      const resp = await withTimeout(
        ext.runtime.sendMessage({ type: "suggest", engine: s.searchEngine || "google", q: v }),
        5000
      );
      if (myGen !== _suggestGen) return;
      if (!resp || resp.error || !resp.ok) {
        hideSuggest();
        return;
      }
      if (quickInput.value.trim() !== v) return; // ввод изменился — результат устарел
      renderSuggest(resp.items || []);
    } catch (_) {
      if (myGen === _suggestGen) hideSuggest();
    }
  }

  function onQuickGo(e, forcedValue) {
    if (e) e.preventDefault();
    hideSuggest();
    const v = (forcedValue != null ? String(forcedValue) : quickInput.value).trim();
    if (!v) return;
    let target;
    if (/^https?:\/\//i.test(v) || (/\.[a-z]{2,}/i.test(v) && !v.includes(" "))) {
      target = normalizeUrl(v);
    } else {
      const engine = state.settings.searchEngine || "google";
      if (engine === "yandex") {
        target = "https://yandex.ru/search/?text=" + encodeURIComponent(v);
      } else if (engine === "bing") {
        target = "https://www.bing.com/search?q=" + encodeURIComponent(v);
      } else {
        target = "https://www.google.com/search?q=" + encodeURIComponent(v);
      }
    }
    window.location.href = target;
  }

  let toastTimer;
  function toast(msg, isErr) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.remove("fade");
    toastEl.style.borderColor = isErr ? "rgba(255,90,90,0.5)" : "";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.add("fade");
      setTimeout(() => { toastEl.hidden = true; }, 220);
    }, 1800);
  }

  init().catch(err => {
    console.error("Tabula init failed:", err);
    const pre = document.createElement("pre");
    pre.style.cssText = "padding:20px;color:#f88";
    pre.textContent = "Tabula failed to initialize.\n\n" + (err && err.message || err);
    document.body.textContent = "";
    document.body.appendChild(pre);
  });
})();
