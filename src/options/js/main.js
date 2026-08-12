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
 * Entry-модуль страницы настроек: инициализация, общие слушатели формы
 * (автосохранение + живой превью) и подписка на изменения storage.
 *
 * Глобалы lib/browser.js (ext) и lib/storage.js (Storage, t, resolveFont,
 * FONT_FAMILIES, makeBlankSheet, clampCols, cryptoId, ...) остаются
 * классическими скриптами — подключаются до этого модуля.
 */

import { getState, setState, setLang, getLang } from "./state.js";
import { applyI18nStatic } from "./i18n.js";
import { wireTabs } from "./tabs.js";
import { wireSearch } from "./search.js";
import {
  fillForm, collectSettings, syncCellSelectedMode, syncWidgetCollapsed,
  refreshRangeOutputs, persistSettings, RANGE_KEYS
} from "./form.js";
import { sendPreview } from "./preview.js";
import {
  updateBgTypeVisibility, updateUploadPreview, updateBingCopyright,
  updateAllPreviews, bindAppearanceEvents
} from "./appearance.js";
import { bindWidgetEvents, renderCityLists } from "./widgets.js";
import { bindDataEvents } from "./data.js";
import { populateAbout } from "./about.js";
import { flashSaved, $$ } from "./utils.js";

async function init() {
  setState(await Storage.get());
  setLang(getState().settings.language || "ru");

  applyI18nStatic();
  fillForm();
  renderCityLists();
  wireEvents();
  wireTabs();
  wireSearch();
  updateBgTypeVisibility();
  updateUploadPreview();
  updateBingCopyright();
  updateAllPreviews();
  populateAbout();

  Storage.onChanged((next) => {
    if (!next) return;
    const prev = getState();
    const langChanged = (next.settings && next.settings.language) !== getLang();
    setState({
      sheets:        Array.isArray(next.sheets) ? next.sheets : prev.sheets,
      activeSheetId: next.activeSheetId || prev.activeSheetId,
      settings:      Object.assign({}, prev.settings, next.settings || {}),
      bingCache:     next.bingCache !== undefined ? next.bingCache : prev.bingCache,
      weatherCaches: next.weatherCaches !== undefined ? next.weatherCaches : prev.weatherCaches
    });
    setLang(getState().settings.language || "ru");
    if (langChanged) applyI18nStatic();
    fillForm();
    renderCityLists();
    updateBgTypeVisibility();
    updateUploadPreview();
    updateBingCopyright();
    updateAllPreviews();
  });
}

// ---------- общие слушатели формы ----------
function wireEvents() {
  bindAppearanceEvents();
  bindWidgetEvents();
  bindDataEvents();

  const uploadInput = document.getElementById("uploadInput");
  const importFile  = document.getElementById("importFile");
  const searchInput = document.getElementById("settingsSearch");
  const previewFrame = document.getElementById("previewFrame");

  // Автосохранение с дебаунсом + мгновенная отправка в iframe-превью.
  // Контролы модалок (гео-поиск, выбор папки закладок) не относятся к настройкам
  // оформления — ввод в них не должен обновлять превью и сохранять настройки.
  let t;
  const allControls = $$("input, select").filter(el =>
    el !== uploadInput && el !== importFile && el !== searchInput &&
    !(el.closest && el.closest(".modal")));
  allControls.forEach((el) => {
    const handler = () => {
      sendPreview(collectSettings());
      clearTimeout(t);
      t = setTimeout(async () => {
        await persistSettings();
        updateAllPreviews();
        flashSaved();
      }, 220);
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });

  // AutoColor: ручной color-пикер не нужен — прячем его и показываем подсказку.
  document.querySelectorAll('[name="cellSelectedMode"]').forEach((el) => {
    el.addEventListener("change", syncCellSelectedMode);
  });

  RANGE_KEYS.forEach(k => {
    const el = document.querySelector('[name="' + k + '"]');
    if (!el) return;
    el.addEventListener("input", () => {
      const out = document.querySelector('[data-out="' + k + '"]');
      if (out) out.textContent = el.value;
    });
  });

  // Превью: синхронизируемся с iframe после его загрузки (и после каждой
  // перезагрузки, например при изменении языка страница пересоздаётся).
  if (previewFrame) {
    previewFrame.addEventListener("load", () => sendPreview(collectSettings()));
  }

  // Мгновенно сворачивать/разворачивать блок виджета по клику на тоггл.
  ["showClock", "showQuickGo", "showWeather"].forEach(k => {
    const el = document.querySelector('input[name="' + k + '"]');
    if (!el) return;
    el.addEventListener("change", syncWidgetCollapsed);
  });
}

init().catch(err => {
  const pre = document.createElement("pre");
  pre.style.cssText = "padding:20px;color:#f88";
  pre.textContent = "Options failed to initialize.\n\n" + (err && err.message || err);
  document.body.textContent = "";
  document.body.appendChild(pre);
});
