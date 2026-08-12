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
 * Палитра поиска: поиск закладок по всем листам (как Ctrl+F / krunner).
 * Открывается по Ctrl+F (Cmd+F на macOS), ищет по названию и URL, результат
 * открывает с переходом на нужный лист и подсветкой ячейки.
 */

import { getState } from "./state.js";
import { tx } from "./i18n.js";
import { selectCell, openBookmarkAt } from "./grid.js";
import { switchSheet } from "./sheets.js";
import { cachedSrc } from "./favicons.js";

const searcherEl      = document.getElementById("searcher");
const searcherInput   = document.getElementById("searcherInput");
const searcherResults = document.getElementById("searcherResults");

let results = [];
let index = -1;

export function isSearcherOpen() {
  return searcherEl && !searcherEl.hidden;
}

export function openSearcher() {
  if (!searcherEl) return;
  searcherEl.hidden = false;
  searcherInput.value = "";
  results = [];
  index = -1;
  renderResults();
  searcherInput.focus();
}

export function closeSearcher() {
  if (!searcherEl) return;
  searcherEl.hidden = true;
}

// Приоритет совпадения: начало строки важнее вхождения в середине.
function score(q, text) {
  const i = text.indexOf(q);
  if (i < 0) return 0;
  return i === 0 ? 100 : 50;
}

function searchAll(q) {
  const state = getState();
  const out = [];
  const nq = q.trim().toLowerCase();
  if (!nq) return out;
  const sheets = Array.isArray(state.sheets) ? state.sheets : [];
  for (const sh of sheets) {
    const cells = sh.cells || {};
    for (const key of Object.keys(cells)) {
      const bm = cells[key];
      if (!bm) continue;
      const title = String(bm.title || "").toLowerCase();
      const url   = String(bm.url   || "").toLowerCase();
      const ts = score(nq, title);
      const us = score(nq, url);
      if (!ts && !us) continue;
      out.push({
        sheetId: sh.id,
        sheetName: sh.name || "",
        key,
        bm,
        score: Math.max(ts, us),
        title: bm.title || bm.url || "",
        url:   bm.url || ""
      });
    }
  }
  out.sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)));
  return out.slice(0, 30);
}

function cellPos(key) {
  const p = keyParts(key);
  return colLetter(p[1]) + (p[0] + 1);
}

function favEl(r) {
  const fav = document.createElement("span");
  fav.className = "searcher-fav";
  const src = cachedSrc(r.bm.url);
  if (src) {
    const img = document.createElement("img");
    img.alt = "";
    img.src = src;
    fav.appendChild(img);
  } else {
    fav.textContent = letterChar(r.title) || "🔖";
  }
  return fav;
}

function renderResults() {
  if (!searcherResults) return;
  searcherResults.textContent = "";
  if (searcherInput.value.trim() === "") {
    const empty = document.createElement("div");
    empty.className = "searcher-empty";
    empty.textContent = tx("searcherEmpty");
    searcherResults.appendChild(empty);
    return;
  }
  if (results.length === 0) {
    const empty = document.createElement("div");
    empty.className = "searcher-empty";
    empty.textContent = tx("searcherNoResults");
    searcherResults.appendChild(empty);
    return;
  }
  results.forEach((r, i) => {
    const item = document.createElement("div");
    item.className = "searcher-item" + (i === index ? " active" : "");
    item.dataset.index = String(i);

    const body = document.createElement("div");
    body.className = "searcher-body";
    const title = document.createElement("div");
    title.className = "searcher-title";
    title.textContent = r.title;
    const url = document.createElement("div");
    url.className = "searcher-url";
    url.textContent = r.url;
    body.append(title, url);

    const meta = document.createElement("div");
    meta.className = "searcher-meta";
    const sheet = document.createElement("span");
    sheet.className = "searcher-sheet";
    sheet.textContent = r.sheetName || "—";
    const pos = document.createElement("span");
    pos.className = "searcher-pos";
    pos.textContent = cellPos(r.key);
    meta.append(sheet, pos);

    item.append(favEl(r), body, meta);
    item.addEventListener("mousedown", (e) => {
      e.preventDefault(); // сохранить фокус в поле ввода
      goTo(r);
    });
    searcherResults.appendChild(item);
  });
}

function markActive() {
  const nodes = searcherResults.querySelectorAll(".searcher-item");
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].classList.toggle("active", i === index);
  }
  const active = nodes[index];
  if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
}

// Переход к результату: переключить лист, подсветить ячейку и открыть закладку.
async function goTo(r) {
  if (!r) return;
  closeSearcher();
  if (r.sheetId && r.sheetId !== getState().activeSheetId) {
    await switchSheet(r.sheetId);
  }
  selectCell(r.key);
  openBookmarkAt(r.key);
}

// Быстрый ввод (автоповтор клавиш, вставка) группируем в один рендер за кадр:
// searchAll перебирает все закладки всех листов, renderResults строит DOM.
let _searcherRaf = 0;
function onInput(e) {
  const q = e.target.value;
  cancelAnimationFrame(_searcherRaf);
  _searcherRaf = requestAnimationFrame(() => {
    results = searchAll(q);
    index = -1;
    renderResults();
  });
}

function onKeyDown(e) {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (results.length === 0) return;
    e.preventDefault();
    if (e.key === "ArrowDown") {
      index = index < 0 ? 0 : (index + 1) % results.length;
    } else {
      index = index < 0 ? results.length - 1 : (index - 1 + results.length) % results.length;
    }
    markActive();
  } else if (e.key === "Enter") {
    e.preventDefault();
    const r = results[index >= 0 ? index : 0];
    goTo(r);
  } else if (e.key === "Escape") {
    e.preventDefault();
    closeSearcher();
  }
}

export function bindSearcherEvents() {
  if (!searcherEl) return;
  searcherInput.addEventListener("input", onInput);
  searcherInput.addEventListener("keydown", onKeyDown);
  searcherEl.addEventListener("mousedown", (e) => {
    if (e.target === searcherEl) closeSearcher();
  });
}
