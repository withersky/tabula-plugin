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
