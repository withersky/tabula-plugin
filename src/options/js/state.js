/*
 * Tabula — spreadsheet-style new tab page browser extension.
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
