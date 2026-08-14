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
  applyI18nStaticCommon(tx, getLang);
  document.title = tx("settingsTitle");
  populateFontSelect(fontFamilySelect);
  updateFontSelectCustomVisibility(fontFamilySelect, fontFamilyCustomWrap);
  buildSearchIndex();
}
