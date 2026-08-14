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
 * Интернационализация страницы новой вкладки: tx() поверх глобальной t()
 * из lib/storage.js + применение статических data-i18n атрибутов.
 */

import { getState, getLang } from "./state.js";

export function tx(key) { return t(key, getLang()); }

/** Заполняет статические тексты ([data-i18n] и т.п.) и заголовок страницы. */
export function applyI18nStatic() {
  applyI18nStaticCommon(tx, getLang);
  applyPageTitle();
}

export function applyPageTitle() {
  const state = getState();
  const custom = state && state.settings && state.settings.pageTitle;
  document.title = (custom && String(custom).trim()) || tx("newTabTitle");
}
