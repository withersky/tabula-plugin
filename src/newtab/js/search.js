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
 * Быстрый поиск (quick-go): строка поиска в топбаре, иконка движка
 * и выпадающие подсказки из suggest-API выбранного поисковика.
 */

import { getState } from "./state.js";
import { tx } from "./i18n.js";

const quickGo = document.getElementById("quickGo");
const quickInput = document.getElementById("quickGoInput");
const quickSuggestEl = document.getElementById("quickSuggest");

let _suggestTimer = null;
let _suggestGen = 0;
let _suggestItems = [];
let _suggestIndex = -1;
let _suggestHideTimer = null;

export function renderQuickGoIcon() {
  const el = document.getElementById("quickGoIcon");
  if (!el) return;
  const state = getState();
  const se = state && state.settings && state.settings.searchEngine;
  const maps = { google: "icons/se-google.svg", yandex: "icons/se-yandex.svg", bing: "icons/se-bing.svg" };
  const src = maps[se] || maps.google;
  if (el.dataset.src === src) return;
  el.dataset.src = src;
  el.innerHTML = "";
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  el.appendChild(img);
}

export function hideSuggest() {
  _suggestGen++;
  _suggestIndex = -1;
  _suggestItems = [];
  if (!quickSuggestEl || quickSuggestEl.hidden) return;
  quickSuggestEl.classList.add("closing");
  clearTimeout(_suggestHideTimer);
  _suggestHideTimer = setTimeout(() => {
    quickSuggestEl.classList.remove("closing");
    quickSuggestEl.hidden = true;
  }, 150);
}

export function markSuggestActive() {
  if (!quickSuggestEl) return;
  const nodes = quickSuggestEl.children;
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].classList.toggle("active", i === _suggestIndex);
  }
  const active = nodes[_suggestIndex];
  if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
}

function renderSuggest(items) {
  if (!quickSuggestEl) return;
  _suggestItems = (items || []).slice(0, 10);
  _suggestIndex = -1;
  if (!_suggestItems.length) {
    quickSuggestEl.hidden = true;
    return;
  }
  quickSuggestEl.textContent = "";
  _suggestItems.forEach((item) => {
    const div = document.createElement("div");
    div.className = "quick-suggest-item";
    const iconEl = document.createElement("span");
    iconEl.className = "suggest-icon";
    iconEl.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    const textEl = document.createElement("span");
    textEl.className = "suggest-text";
    textEl.textContent = item;
    div.append(iconEl, textEl);
    div.addEventListener("mousedown", (e) => {
      e.preventDefault(); // сохранить фокус на инпуте
      onQuickGo(null, item);
    });
    quickSuggestEl.appendChild(div);
  });
  clearTimeout(_suggestHideTimer);
  quickSuggestEl.classList.remove("closing");
  quickSuggestEl.hidden = false;
}

async function fetchSuggest() {
  const state = getState();
  const s = state && state.settings;
  if (!s || s.quickGoSuggest === false || !ext.runtime.sendMessage) {
    hideSuggest();
    return;
  }
  const v = quickInput.value.trim();
  if (v.length < 2) {
    hideSuggest();
    return;
  }
  const myGen = ++_suggestGen;
  try {
    const resp = await withTimeout(
      ext.runtime.sendMessage({ type: "suggest", engine: s.searchEngine || "google", q: v }),
      5000
    );
    if (myGen !== _suggestGen) return;
    if (!resp || resp.error || !resp.ok) {
      hideSuggest();
      return;
    }
    if (quickInput.value.trim() !== v) return; // ввод изменился — результат устарел
    renderSuggest(resp.items || []);
  } catch (_) {
    if (myGen === _suggestGen) hideSuggest();
  }
}

export function onQuickGo(e, forcedValue) {
  if (e) e.preventDefault();
  hideSuggest();
  const state = getState();
  const v = (forcedValue != null ? String(forcedValue) : quickInput.value).trim();
  if (!v) return;
  let target;
  if (/^https?:\/\//i.test(v) || (/\.[a-z]{2,}/i.test(v) && !v.includes(" "))) {
    target = normalizeUrl(v);
  } else {
    const engine = state.settings.searchEngine || "google";
    if (engine === "yandex") {
      target = "https://yandex.ru/search/?text=" + encodeURIComponent(v);
    } else if (engine === "bing") {
      target = "https://www.bing.com/search?q=" + encodeURIComponent(v);
    } else {
      target = "https://www.google.com/search?q=" + encodeURIComponent(v);
    }
  }
  window.location.href = target;
}

/** Состояние подсказок для общего keydown-обработчика (main.js). */
export function suggestState() {
  return { items: _suggestItems, index: _suggestIndex };
}

/** Слушает строку поиска: submit, ввод, фокус, blur, клик мимо. */
export function bindSearchEvents() {
  quickGo.addEventListener("submit", onQuickGo);
  quickInput.addEventListener("input", () => {
    clearTimeout(_suggestTimer);
    _suggestTimer = setTimeout(fetchSuggest, 180);
  });
  quickInput.addEventListener("focus", () => {
    clearTimeout(_suggestTimer);
    _suggestTimer = setTimeout(fetchSuggest, 180);
  });
  quickInput.addEventListener("blur", () => {
    clearTimeout(_suggestTimer);
    setTimeout(() => {
      if (document.activeElement !== quickInput) hideSuggest();
    }, 120);
  });
  document.addEventListener("mousedown", (e) => {
    if (quickSuggestEl && !quickSuggestEl.hidden && !quickSuggestEl.contains(e.target)) {
      hideSuggest();
    }
  });
}

export { quickInput };
