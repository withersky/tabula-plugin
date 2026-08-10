/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Интернационализация страницы новой вкладки: tx() поверх глобальной t()
 * из lib/storage.js + применение статических data-i18n атрибутов.
 */

import { getState, getLang } from "./state.js";

export function tx(key) { return t(key, getLang()); }

/** Заполняет статические тексты ([data-i18n] и т.п.) и заголовок страницы. */
export function applyI18nStatic() {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = tx(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = tx(el.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = tx(el.dataset.i18nTitle); });
  document.documentElement.lang = getLang();
  applyPageTitle();
}

export function applyPageTitle() {
  const state = getState();
  const custom = state && state.settings && state.settings.pageTitle;
  document.title = (custom && String(custom).trim()) || tx("newTabTitle");
}
