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
 * Общий разделяемый стейт страницы новой вкладки.
 * Модули ES читают/пишут его через геттеры/сеттеры, чтобы оставаться
 * синхронизированными (state переприсваивается после каждого Storage.get()).
 *
 * Глобалы lib/core.js и lib/storage.js (Storage, t, clampCols и т.д.)
 * остаются классическими скриптами — модули обращаются к ним напрямую.
 */

const _app = {
  state: null,
  lang: "ru"
};

export function getState() { return _app.state; }
export function setState(s) { _app.state = s; }

export function getLang() { return _app.lang; }
export function setLang(l) { _app.lang = l; }

/** Активный лист: по id из state, иначе первый. */
export function activeSheet() {
  const state = _app.state;
  if (!state || !Array.isArray(state.sheets) || state.sheets.length === 0) return null;
  return state.sheets.find(s => s.id === state.activeSheetId) || state.sheets[0];
}
