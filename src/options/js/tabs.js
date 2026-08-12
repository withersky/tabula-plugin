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
 * Навигация по вкладкам настроек: переключение панелей, синхронизация
 * с location.hash (#tab=...) и скролл наверх.
 */

export const TAB_IDS = ["appearance", "widgets", "language", "data", "about"];

// Живое превью имеет смысл только там, где меняется оформление страницы.
const PREVIEW_TABS = ["appearance", "widgets"];

function syncPreviewPane(id) {
  document.querySelectorAll(".preview-pane").forEach(p => {
    p.hidden = !PREVIEW_TABS.includes(id);
  });
}

export function switchTab(tabId, opts) {
  const scroll = !opts || opts.scroll !== false;
  const id = TAB_IDS.indexOf(tabId) >= 0 ? tabId : "appearance";
  document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === id));
  document.querySelectorAll(".tab-panel").forEach(p => { p.hidden = p.dataset.tab !== id; });
  syncPreviewPane(id);
  try { history.replaceState(null, "", "#tab=" + id); } catch (_) {}
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

export function wireTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  const m = (location.hash || "").match(/^#tab=([\w-]+)/);
  const initial = m && TAB_IDS.indexOf(m[1]) >= 0 ? m[1] : "appearance";
  document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === initial));
  document.querySelectorAll(".tab-panel").forEach(p => { p.hidden = p.dataset.tab !== initial; });
  syncPreviewPane(initial);
}
