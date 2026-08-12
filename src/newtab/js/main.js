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
 * Entry-модуль страницы новой вкладки: инициализация, применение настроек,
 * общие слушатели (модалки, клавиатура, resize), режим предпросмотра
 * (newtab.html?preview=1 в iframe настроек).
 *
 * Глобалы lib/browser.js (ext), lib/core.js (t, withTimeout, normalizeUrl,
 * faviconUrl, ...) и lib/storage.js (Storage, clampCols, colLetter, cryptoId, ...)
 * остаются классическими скриптами — подключаются до этого модуля.
 */

import { getState, setState, getLang, setLang, activeSheet } from "./state.js";
import { tx, applyI18nStatic, applyPageTitle } from "./i18n.js";
import { startClock, bindClockEvents, clockWidget } from "./clock.js";
import { startWeather, renderWeather, bindWeatherEvents, bindWeatherCityMenu, toggleWeatherPopup } from "./weather.js";
import { weatherWidget } from "./weather.js";
import { renderQuickGoIcon, bindSearchEvents } from "./search.js";
import { applyBackground, applySelectionColor, maybeLoadBingBackground } from "./background.js";
import { renderGrid, closeModal, onSubmitBookmark, bindGridEvents } from "./grid.js";
import { renderSheetBar, updateSheetBarActive, refreshSheetCtx, bindSheetEvents, switchSheetBySwipe } from "./sheets.js";
import { initFavicons, prefetchFavicons } from "./favicons.js";
import { bindSearcherEvents } from "./searcher.js";
import { bindShortcutEvents } from "./shortcuts.js";
import { bindHotkeyEvents } from "./hotkeys.js";

// Режим предпросмотра: newtab.html?preview=1 открывается в iframe настроек.
// Применяет настройки из options по postMessage и ничего не пишет в storage.
const PREVIEW_MODE = new URLSearchParams(location.search).get("preview") === "1";

// Общие DOM-ссылки для слушателей (модули владеют своими ссылками отдельно).
// Ссылки модалок и подсказок живут в модулях, которые ими владеют
// (grid.js/sheets.js/hotkeys.js), чтобы не дублировать выборки.
const modalEl = document.getElementById("modal");
const tabForm = document.getElementById("tabForm");
const quickGo = document.getElementById("quickGo");

// ---------- фавиконки ----------

function collectVisibleUrls() {
  const sheet = activeSheet();
  if (!sheet || !sheet.cells) return [];
  const urls = [];
  for (const key of Object.keys(sheet.cells)) {
    const bm = sheet.cells[key];
    if (bm && typeof bm.url === "string" && bm.url) urls.push(bm.url);
  }
  return urls;
}

// ---------- применение настроек ----------

function applySettings() {
  const state = getState();
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
  // При cellSelectedMode "autoColor" акцент подбирается из текущего фона.
  applySelectionColor();
  // Общий масштаб виджетов и нижнего бара (50%..150%), задаётся ползунком uiScale.
  const usc = Number(s.uiScale);
  const uscV = (isFinite(usc) && usc > 0) ? Math.min(1.5, Math.max(0.5, usc / 100)) : 1;
  root.setProperty("--ui-scale", String(uscV));
  applyBackground();
  renderQuickGoIcon();
  requestAnimationFrame(applyTopbarHeight);
}

function applyLayoutFlags() {
  const state = getState();
  const s = state.settings;
  document.body.classList.toggle("no-quick-go", !s.showQuickGo);
  document.body.classList.toggle("no-sheet-bar", !s.showSheetTabs);
  // Сенсорные жесты: долгое нажатие/перетаскивание (touch-action отдаётся сетке).
  document.body.classList.toggle("touch-gestures", s.touchGestures !== false);
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
  const state = getState();
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
  const state = getState();
  const s = state && state.settings;
  if (!s || s.showSheetTabs === false) {
    document.documentElement.style.setProperty("--sheet-bar-height", "0px");
    return;
  }
  const h = bar.getBoundingClientRect().height;
  document.documentElement.style.setProperty("--sheet-bar-height", Math.ceil(h) + "px");
}

// ---------- инициализация ----------

async function init() {
  setState(await Storage.get());
  // Кэш фавиконок читается до первого рендера, чтобы ячейки сразу получили
  // data URL из storage (офлайн) вместо letter-бейджей.
  await initFavicons();
  if (PREVIEW_MODE) {
    // Превью ничего не пишет в chrome.storage: все «сохранения» (погода, фон,
    // активный лист) мутируют state в памяти и исчезают при закрытии настроек.
    Storage.update = async (mutator) => { mutator(getState()); };
  }
  setLang(getState().settings.language || "ru");
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

  // Фоновая догрузка фавиконок новых хостов — только вне предпросмотра
  // (в iframe настроек не дёргаем сеть при каждом движении ползунков).
  if (!PREVIEW_MODE && getState() && getState().settings.showFavicon) {
    prefetchFavicons(collectVisibleUrls());
  }

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
    const prev = getState();
    // Точечные диффы: какие именно части данных изменились. Логика вынесена
    // в чистую функцию diffTabulaData (src/lib/core.js) — она покрыта
    // юнит-тестами, и JSON.stringify-сравнения не дублируются здесь.
    const d = diffTabulaData(prev, next, getLang());
    const sheetsChanged   = d.sheetsChanged;
    const activeChanged   = d.activeChanged;
    const settingsChanged = d.settingsChanged;
    const weatherChanged  = d.weatherChanged;
    const bingChanged     = d.bingChanged;
    const langChanged     = d.langChanged;
    const prevSettings    = d.prevSettings;
    const nextSettings    = d.nextSettings;

    setState({
      sheets:        Array.isArray(next.sheets) ? next.sheets : prev.sheets,
      activeSheetId: next.activeSheetId || prev.activeSheetId,
      settings:      d.nextSettings,
      bingCache:     next.bingCache !== undefined ? next.bingCache : prev.bingCache,
      weatherCaches: next.weatherCaches !== undefined ? next.weatherCaches : prev.weatherCaches
    });
    setLang(d.nextSettings.language || "ru");

    if (settingsChanged) {
      applySettings();
      applyLayoutFlags();
      if (langChanged) applyI18nStatic();
      else applyPageTitle();
    }

    // Сетка и вкладки листов обновляются только при реальных изменениях,
    // а не на каждый апдейт погоды/фона.
    if (sheetsChanged || activeChanged || settingsChanged) {
      renderGrid();
      if (sheetsChanged) {
        // Состав вкладок изменился — пересоздаём бар целиком.
        renderSheetBar();
      } else if (activeChanged) {
        // Сменился только активный лист — передвигаем класс active без
        // пересоздания DOM, иначе вкладки мигают анимацией входа.
        updateSheetBarActive();
      }
      if (sheetsChanged || activeChanged) refreshSheetCtx();
      // После изменения настроек/листов догружаем фавиконки активного листа.
      if (getState() && getState().settings.showFavicon) {
        prefetchFavicons(collectVisibleUrls());
      }
    }

    // Часы: перезапуск только при изменении настроек.
    if (settingsChanged) startClock();

    // Погода: рестарт только при изменении значимых полей настроек,
    // иначе каждый апдейт weatherCaches зацикливает себя.
    const weatherSettingsChanged = settingsChanged && (
      nextSettings.showWeather         !== prevSettings.showWeather         ||
      nextSettings.weatherActiveCityId !== prevSettings.weatherActiveCityId ||
      nextSettings.weatherRefreshMin   !== prevSettings.weatherRefreshMin   ||
      JSON.stringify(nextSettings.weatherCities) !== JSON.stringify(prevSettings.weatherCities)
    );
    if (weatherSettingsChanged) {
      startWeather();
    } else if (weatherChanged) {
      renderWeather();
    }

    // Фон Bing обновился — перекрашиваем фон, сетку не трогаем.
    if (bingChanged) applyBackground();
  });
}

// ---------- preview mode (newtab.html?preview=1 inside options iframe) ----------
function onPreviewMessage(e) {
  const d = e.data;
  if (!d || d.type !== "tabula-preview-settings") return;
  const incoming = d.settings;
  if (!incoming || typeof incoming !== "object") return;
  const prev = getState().settings || {};
  const merged = Object.assign({}, prev, incoming);
  const langChanged = (merged.language || "ru") !== getLang();
  const state = getState();
  state.settings = merged;
  setLang(merged.language || "ru");
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
      // В превью нет bindWeatherEvents — вешаем локальный обработчик попапа.
      toggleWeatherPopup();
    });
  }
  // В превью нет bindWeatherEvents — привязываем меню городов отдельно,
  // чтобы клик по городу в шапке попапа раскрывал список (а не закрывал попап).
  bindWeatherCityMenu();
}

// ---------- общие слушатели ----------

function bindEvents() {
  document.getElementById("optsBtn").addEventListener("click", () => {
    if (ext.runtime.openOptionsPage) ext.runtime.openOptionsPage();
    else window.open("options.html", "_blank");
  });
  document.getElementById("cancelBtn").addEventListener("click", closeModal);
  tabForm.addEventListener("submit", onSubmitBookmark);

  // Close modal on click outside the card
  modalEl.addEventListener("mousedown", (e) => {
    if (e.target === modalEl) closeModal();
  });

  // Горячие клавиши вынесены в отдельный модуль: см. hotkeys.js.
  bindHotkeyEvents();

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderGrid, 80);
  });

  // События модулей.
  bindSearchEvents();
  bindWeatherEvents();
  bindClockEvents();
  bindGridEvents();
  bindSheetEvents();
  bindSearcherEvents();
  bindShortcutEvents();

  // Свайп по сетке влево/вправо → переключение листов (см. grid.js).
  window.addEventListener("tabula:sheet-swipe", (e) => {
    const dir = e.detail && e.detail.dir;
    if (dir) switchSheetBySwipe(dir);
  });

  // applySheetBarHeight после ресайза лист-бара (вкладки переносятся на новую строку).
  window.addEventListener("tabula:sheetbar-resize", applySheetBarHeight);
}

init().catch(err => {
  console.error("Tabula init failed:", err);
  const pre = document.createElement("pre");
  pre.style.cssText = "padding:20px;color:#f88";
  pre.textContent = "Tabula failed to initialize.\n\n" + (err && err.message || err);
  document.body.textContent = "";
  document.body.appendChild(pre);
});
