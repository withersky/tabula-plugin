/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Форма настроек: заполнение контролов из state, сбор значений, синхронизация
 * виджет-блоков, режим AutoColor, вывод значений range-ползунков и сохранение
 * (persistSettings). Никаких слушателей — их вешает main.wireEvents().
 */

import { getState } from "./state.js";
import { sendPreview } from "./preview.js";

export const RANGE_KEYS = ["defaultColumns", "uiOpacity", "uiScale", "fontSize", "clockSize", "weatherSize", "weatherRefreshMin", "weatherForecastDays", "cellSelectedColor", "gridRows"];

const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

export function fillForm() {
  const s = getState().settings;
  for (const key of Object.keys(s)) {
    const els = $$('[name="' + key + '"]');
    if (els.length === 0) continue;
    const first = els[0];
    if (first.type === "checkbox") {
      first.checked = !!s[key];
    } else if (first.type === "radio") {
      els.forEach(el => { el.checked = (el.value === s[key]); });
    } else {
      first.value = s[key] != null ? s[key] : "";
    }
  }
  syncCellSelectedMode();
  refreshRangeOutputs();
  syncWidgetCollapsed();
  sendPreview(collectSettings());
}

/** Собирает текущие значения формы в объект настроек. */
export function collectSettings() {
  const settings = Object.assign({}, getState().settings);
  for (const key of Object.keys(settings)) {
    const els = $$('[name="' + key + '"]');
    if (els.length === 0) continue;
    const first = els[0];
    let v;
    if (first.type === "checkbox") {
      v = first.checked;
    } else if (first.type === "radio") {
      const checked = els.find(el => el.checked);
      if (checked) v = checked.value;
      else continue;
    }
    else if (first.type === "range" || first.type === "number") v = Number(first.value);
    else v = first.value;
    settings[key] = v;
  }
  return settings;
}

/** Сохраняет настройки в storage и обновляет превью/ползунки. */
export async function persistSettings() {
  const settings = collectSettings();
  await Storage.update((d) => { d.settings = settings; });
  getState().settings = settings;
  refreshRangeOutputs();
}

// ---------- widget collapsed state ----------
// Сворачивает блок виджета в строку, если тоггл выключен.
export function syncWidgetCollapsed() {
  const map = [
    ["showClock",   "#widget-clock"],
    ["showQuickGo", "#widget-search"],
    ["showWeather", "#widget-weather"]
  ];
  for (const [key, sel] of map) {
    const block = $(sel);
    if (!block) continue;
    const input = $('input[name="' + key + '"]');
    const on = !!(input && input.checked);
    block.classList.toggle("is-collapsed", !on);
  }
}

// Прячет и отключает ручной выбор цвета, если выбран режим AutoColor
// (цвет выделения подбирается автоматически под текущий фон).
export function syncCellSelectedMode() {
  const modeEl = document.querySelector('[name="cellSelectedMode"]:checked');
  const colorEl = document.querySelector('[name="cellSelectedColor"]');
  const hintEl = document.getElementById("cellSelectedAutoColorHint");
  const autoColor = !!(modeEl && modeEl.value === "autoColor");
  if (colorEl) colorEl.disabled = autoColor;
  if (hintEl) hintEl.hidden = !autoColor;
}

export function refreshRangeOutputs() {
  for (const k of RANGE_KEYS) {
    const el = document.querySelector('[name="' + k + '"]');
    const out = document.querySelector('[data-out="' + k + '"]');
    if (el && out) out.textContent = el.value;
  }
}
