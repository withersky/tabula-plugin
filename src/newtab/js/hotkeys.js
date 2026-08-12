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
 * Горячие клавиши страницы новой вкладки: Ctrl+F / Ctrl+K, Esc, PageUp/PageDown,
 * F1 / «?», «/». Вынесены из main.js в отдельный модуль, чтобы bindEvents()
 * оставался только про мышиные слушатели и инициализацию.
 */

import { isSearcherOpen, openSearcher } from "./searcher.js";
import { isShortcutsOpen, hideShortcuts, showShortcuts } from "./shortcuts.js";
import { closeModal, hideCtx, hideCtxEmpty, hideSheetCtx } from "./grid.js";
import { closeSheetModal, switchSheetBySwipe } from "./sheets.js";
import { quickInput, hideSuggest, markSuggestActive, onQuickGo, suggestState } from "./search.js";
import { keyCode } from "./utils.js";

const modalEl        = document.getElementById("modal");
const sheetModal     = document.getElementById("sheetModal");
const confirmModal   = document.getElementById("confirmModal");
const quickSuggestEl = document.getElementById("quickSuggest");

/** Вешает обработчик клавиатуры на document (вызывается из main.js). */
export function bindHotkeyEvents() {
  document.addEventListener("keydown", (e) => {
    // Пока открыта палитра поиска, клавиши обрабатывает она сама.
    if (isSearcherOpen()) return;
    // Пока открыта справка по горячим клавишам — обрабатываем только Esc.
    if (isShortcutsOpen()) {
      if (e.key === "Escape") { e.preventDefault(); hideShortcuts(); }
      return;
    }
    if (!modalEl.hidden) { if (e.key === "Escape") closeModal(); return; }
    if (sheetModal && !sheetModal.hidden) { if (e.key === "Escape") closeSheetModal(); return; }
    if (confirmModal && !confirmModal.hidden) return; // закрывается внутри confirmDialog

    // Раскладочно-независимый код клавиши (KeyF/KeyK/…, Slash) — хоткеи
    // работают одинаково на EN и RU-раскладках.
    const code = keyCode(e);

    // Ctrl+F / Cmd+F → палитра поиска по всем листам.
    if ((e.ctrlKey || e.metaKey) && code === "KeyF") {
      e.preventDefault();
      openSearcher();
      return;
    }

    // Ctrl+K / Ctrl+E → фокус в поисковую строку (или палитра поиска при no-quick-go).
    if ((e.ctrlKey || e.metaKey) && (code === "KeyK" || code === "KeyE")) {
      e.preventDefault();
      if (document.body.classList.contains("no-quick-go")) {
        openSearcher();
      } else {
        quickInput.focus(); quickInput.select();
      }
      return;
    }

    const suggestOpen = quickSuggestEl && !quickSuggestEl.hidden;
    const sst = suggestState();

    if (e.key === "Escape") {
      hideCtx(); hideCtxEmpty(); hideSheetCtx();
      if (suggestOpen) {
        hideSuggest();
      } else if (document.activeElement === quickInput) {
        quickInput.blur();
      }
      return;
    }

    if (document.activeElement === quickInput) {
      if (suggestOpen && sst.items.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        const next = (e.key === "ArrowDown")
          ? (sst.index + 1) % sst.items.length
          : (sst.index - 1 + sst.items.length) % sst.items.length;
        sst.index = next;
        markSuggestActive();
        return;
      }
      if (suggestOpen && sst.items.length && e.key === "Enter" && sst.index >= 0) {
        e.preventDefault();
        onQuickGo(null, sst.items[sst.index]);
        return;
      }
      return;
    }

    if (code === "Slash" && !e.shiftKey && document.activeElement.tagName !== "INPUT") {
      e.preventDefault();
      if (document.body.classList.contains("no-quick-go")) {
        openSearcher(); // поисковая строка скрыта — открываем палитру поиска
      } else {
        quickInput.focus(); quickInput.select();
      }
      return;
    }

    // PageUp/PageDown → предыдущий/следующий лист.
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      switchSheetBySwipe(e.key === "PageDown" ? 1 : -1);
      return;
    }

    // F1 / «?» → справка по горячим клавишам. «?» — это Shift+/ (en) или Shift+7 (ru).
    if (e.key === "F1" || e.key === "?" || (code === "Slash" && e.shiftKey)) {
      e.preventDefault();
      showShortcuts();
    }
  });
}
