/*
 * Tabula — spreadsheet-style new tab page browser extension.
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
