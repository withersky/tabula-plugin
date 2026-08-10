/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Entry-модуль страницы новой вкладки: инициализация, применение настроек,
 * общие слушатели (модалки, клавиатура, resize), режим предпросмотра
 * (newtab.html?preview=1 в iframe настроек).
 *
 * Глобалы lib/browser.js (ext), lib/core.js (t, withTimeout, normalizeUrl,
 * faviconUrl, ...) и lib/storage.js (Storage, clampCols, colLetter, cryptoId, ...)
 * остаются классическими скриптами — подключаются до этого модуля.
 */

import { getState, setState, getLang, setLang } from "./state.js";
import { tx, applyI18nStatic, applyPageTitle } from "./i18n.js";
import { startClock, clockWidget } from "./clock.js";
import { startWeather, renderWeather, bindWeatherEvents, toggleWeatherPopup } from "./weather.js";
import { weatherWidget } from "./weather.js";
import { renderQuickGoIcon, hideSuggest, markSuggestActive, onQuickGo, suggestState, bindSearchEvents } from "./search.js";
import { quickInput } from "./search.js";
import { applyBackground, applySelectionColor, maybeLoadBingBackground } from "./background.js";
import { renderGrid, closeModal, hideCtx, hideCtxEmpty, hideSheetCtx, onSubmitBookmark, bindGridEvents } from "./grid.js";
import { renderSheetBar, refreshSheetCtx, closeSheetModal, bindSheetEvents } from "./sheets.js";

// Режим предпросмотра: newtab.html?preview=1 открывается в iframe настроек.
// Применяет настройки из options по postMessage и ничего не пишет в storage.
const PREVIEW_MODE = new URLSearchParams(location.search).get("preview") === "1";

// Общие DOM-ссылки для слушателей (модули владеют своими ссылками отдельно).
const modalEl     = document.getElementById("modal");
const tabForm     = document.getElementById("tabForm");
const sheetModal  = document.getElementById("sheetModal");
const confirmModal= document.getElementById("confirmModal");
const gridEl      = document.getElementById("grid");
const quickGo     = document.getElementById("quickGo");
const quickSuggestEl = document.getElementById("quickSuggest");

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
    const langChanged = (next.settings && next.settings.language) !== getLang();
    const prevSettings = prev.settings || {};
    const nextSettings = Object.assign({}, prevSettings, next.settings || {});
    setState({
      sheets:        Array.isArray(next.sheets) ? next.sheets : prev.sheets,
      activeSheetId: next.activeSheetId || prev.activeSheetId,
      settings:      nextSettings,
      bingCache:     next.bingCache !== undefined ? next.bingCache : prev.bingCache,
      weatherCache:  next.weatherCache !== undefined ? next.weatherCache : prev.weatherCache
    });
    setLang(nextSettings.language || "ru");
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

  document.addEventListener("keydown", (e) => {
    if (!modalEl.hidden) { if (e.key === "Escape") closeModal(); return; }
    if (sheetModal && !sheetModal.hidden) { if (e.key === "Escape") closeSheetModal(); return; }
    if (confirmModal && !confirmModal.hidden) return; // закрывается внутри confirmDialog

    const suggestOpen = quickSuggestEl && !quickSuggestEl.hidden;
    const sst = suggestState();

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
      if (suggestOpen && sst.items.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        const next = (e.key === "ArrowDown")
          ? (sst.index + 1) % sst.items.length
          : (sst.index - 1 + sst.items.length) % sst.items.length;
        sst.index = next;
        markSuggestActive();
        return;
      }
      if (suggestOpen && sst.items.length && e.key === "Enter" && sst.index >= 0) {
        e.preventDefault();
        onQuickGo(null, sst.items[sst.index]);
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

  // События модулей.
  bindSearchEvents();
  bindWeatherEvents();
  bindGridEvents();
  bindSheetEvents();

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
