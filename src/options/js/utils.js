/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Общие утилиты страницы настроек: DOM-хелперы, CSS-эскейпинг,
 * всплывающий статус и «flash» индикатора автосохранения.
 */

const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

export { $, $$ };

export function cssEscape(v) { return String(v).replace(/"/g, '\\"'); }

const statusEl = $("#status");
const autoSaveHint = $("#autoSaveHint");

let flashTimer;
export function flash(msg, isErr) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.borderColor = isErr ? "rgba(255,90,90,0.5)" : "";
  statusEl.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { statusEl.hidden = true; }, 1800);
}

let dirtyFlashTimer;
export function flashSaved() {
  if (!autoSaveHint) return;
  autoSaveHint.classList.add("flash");
  clearTimeout(dirtyFlashTimer);
  dirtyFlashTimer = setTimeout(() => autoSaveHint.classList.remove("flash"), 900);
}
