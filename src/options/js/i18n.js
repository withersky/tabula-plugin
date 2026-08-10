/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Интернационализация страницы настроек: применение статических data-i18n
 * атрибутов, заголовок страницы и селект шрифтов (с учётом локали).
 */

import { tx, getLang } from "./state.js";
import { buildSearchIndex } from "./search.js";

const fontFamilySelect = document.getElementById("fontFamilyKeySelect");
const fontFamilyCustomWrap = document.getElementById("fontFamilyCustomWrap");

export function populateFontSelect(sel) {
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = "";
  FONT_FAMILIES.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.key;
    opt.textContent = tx(f.i18n);
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

export function updateFontSelectCustomVisibility(sel, wrap) {
  if (!sel || !wrap) return;
  wrap.hidden = sel.value !== "custom";
}

/** Заполняет статические тексты, заголовок, шрифты и индекс поиска. */
export function applyI18nStatic() {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = tx(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = tx(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = tx(el.dataset.i18nTitle); });
  document.documentElement.lang = getLang();
  document.title = tx("settingsTitle");
  populateFontSelect(fontFamilySelect);
  updateFontSelectCustomVisibility(fontFamilySelect, fontFamilyCustomWrap);
  buildSearchIndex();
}
