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
 * Поиск по настройкам: индекс по подписям контролов, мгновенная фильтрация,
 * переход к найденному элементу с подсветкой (search-hit).
 */

import { tx } from "./state.js";
import { switchTab } from "./tabs.js";

const searchWrap    = document.getElementById("searchWrap");
const searchInput   = document.getElementById("settingsSearch");
const searchResults = document.getElementById("searchResults");

let searchIndex = [];
let searchActiveIdx = -1;

export function tabName(tabId) {
  const key = "nav" + tabId.charAt(0).toUpperCase() + tabId.slice(1);
  const label = tx(key);
  return label || tabId;
}

export function normSearch(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildSearchIndex() {
  searchIndex = [];
  document.querySelectorAll(".tab-panel").forEach(panel => {
    const tabId = panel.dataset.tab;
    const tabLabel = tabName(tabId);
    const push = (el) => {
      const label = el.textContent.replace(/\s+/g, " ").trim();
      if (label) searchIndex.push({ tabId: tabId, tabLabel: tabLabel, label: label, title: normSearch(label), el: el });
    };
    // Блоки виджетов — единым элементом поиска
    panel.querySelectorAll(".widget-block").forEach(push);
    // Обычные контролы (label) вне блоков виджетов
    panel.querySelectorAll("label").forEach(l => {
      if (l.closest(".widget-block")) return;
      push(l);
    });
    // Кнопки действий с данными
    panel.querySelectorAll(".data-actions .btn").forEach(push);
  });
}

export function hideSearchResults() {
  if (!searchResults) return;
  searchResults.hidden = true;
  searchResults.innerHTML = "";
  searchActiveIdx = -1;
}

export function renderSearchResults(query) {
  if (!searchResults) return;
  const q = normSearch(query);
  if (q.length < 2) { hideSearchResults(); return; }
  const words = q.split(" ");
  const scored = [];
  for (const item of searchIndex) {
    let score = 0;
    if (item.title === q) score = 100;
    else if (item.title.startsWith(q)) score = 80;
    else if (item.title.includes(q)) score = 60;
    else if (words.every(w => item.title.includes(w))) score = 40;
    if (!score) continue;
    scored.push({ item: item, score: score });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 8).map(x => x.item);

  searchResults.innerHTML = "";
  if (top.length === 0) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent = tx("searchEmpty");
    searchResults.appendChild(empty);
    searchResults.hidden = false;
    return;
  }
  top.forEach((m, i) => {
    const div = document.createElement("div");
    div.className = "search-result";
    div.role = "option";
    div.tabIndex = 0;
    div.dataset.idx = String(searchIndex.indexOf(m));
    const title = document.createElement("span");
    title.className = "search-result-title";
    title.textContent = m.label.length > 70 ? m.label.slice(0, 70) + "…" : m.label;
    const tab = document.createElement("span");
    tab.className = "search-result-tab";
    tab.textContent = m.tabLabel;
    div.appendChild(title);
    div.appendChild(tab);
    searchResults.appendChild(div);
  });
  searchResults.hidden = false;
}

export function activateSearchResult(m) {
  if (!m) return;
  hideSearchResults();
  if (searchInput) searchInput.value = "";
  switchTab(m.tabId, { scroll: false });
  requestAnimationFrame(() => {
    try { m.el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) { m.el.scrollIntoView(); }
  });
  m.el.classList.remove("search-hit");
  void m.el.offsetWidth;
  m.el.classList.add("search-hit");
  const ctrl = m.el.querySelector("input, select, button");
  if (ctrl && typeof ctrl.focus === "function") {
    try { ctrl.focus({ preventScroll: true }); } catch (_) { ctrl.focus(); }
  }
}

export function wireSearch() {
  if (!searchInput || !searchResults) return;
  let t;
  searchInput.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => { renderSearchResults(searchInput.value); }, 120);
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const items = Array.from(searchResults.querySelectorAll(".search-result"));
      if (items.length === 0) return;
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      searchActiveIdx = (searchActiveIdx + delta + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle("active", i === searchActiveIdx));
      try { items[searchActiveIdx].scrollIntoView({ block: "nearest" }); } catch (_) {}
    } else if (e.key === "Enter") {
      const items = Array.from(searchResults.querySelectorAll(".search-result"));
      const active = searchActiveIdx >= 0 && searchActiveIdx < items.length
        ? items[searchActiveIdx] : items[0];
      if (active) { e.preventDefault(); active.click(); }
    } else if (e.key === "Escape") {
      hideSearchResults();
      searchInput.value = "";
    }
  });
  searchResults.addEventListener("click", (e) => {
    const item = e.target.closest(".search-result");
    if (!item) return;
    const m = searchIndex[Number(item.dataset.idx)];
    if (m) activateSearchResult(m);
  });
  document.addEventListener("mousedown", (e) => {
    if (searchWrap && !searchWrap.contains(e.target)) hideSearchResults();
  });
}
