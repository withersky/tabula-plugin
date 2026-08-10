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
 * Общий разделяемый стейт страницы настроек.
 * Модули ES читают/пишут его через геттеры/сеттеры, чтобы оставаться
 * синхронизированными (state переприсваивается после каждого Storage.get()).
 *
 * Глобалы lib/core.js и lib/storage.js (Storage, t, FONT_FAMILIES, clampCols,
 * makeBlankSheet, cryptoId и т.д.) остаются классическими скриптами — модули
 * обращаются к ним напрямую.
 */

let _state = null;
let _lang  = "ru";

export function getState() { return _state; }
export function setState(s) { _state = s; }

export function getLang() { return _lang; }
export function setLang(l) { _lang = l; }

/** Перевод строки из словаря I18N (глобал t из lib/storage.js). */
export function tx(key) { return t(key, _lang); }
