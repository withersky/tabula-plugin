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
 * Листы: вкладки листов в нижнем баре, перетаскивание для смены порядка,
 * переименование имени/иконки, добавление/удаление листа, контекстное меню.
 */

import { getState, setState } from "./state.js";
import { tx } from "./i18n.js";
import { toast, confirmDialog } from "./utils.js";
import { renderGrid, positionMenu, hideSheetCtx } from "./grid.js";

const sheetTabsEl    = document.getElementById("sheetTabs");
const addSheetBtn    = document.getElementById("addSheetBtn");
const sheetBar       = document.getElementById("sheetBar");
const sheetScrollLeft  = document.getElementById("sheetScrollLeft");
const sheetScrollRight = document.getElementById("sheetScrollRight");
const sheetModal     = document.getElementById("sheetModal");
const sheetForm      = document.getElementById("sheetForm");
const sheetCtx       = document.getElementById("sheetCtx");

let sheetCtxTargetId = null;
let sheetDragId = null;
let sheetDragPtr = null;        // активная pointer-сессия на вкладке листа
let suppressSheetClick = false; // подавление click после перетаскивания вкладки
let sheetDropLine = null;       // индикатор позиции вставки в лист-баре
let sheetLongPressTimer = null; // таймер долгого нажатия (сенсорные жесты)
let barScrollPtr = null;        // сессия ручного скролла лист-бара пальцем (touch)
let autoScrollTimer = null;     // автоскролл при перетаскивании вкладки к краю

const LONG_PRESS_MS = 500;      // порог долгого нажатия

const _justAddedIds = new Set();

export function refreshSheetCtx() {
  // No per-sheet columns any more — column count is global (settings.defaultColumns).
}

export function updateSheetScrollArrows() {
  if (!sheetTabsEl || !sheetScrollLeft || !sheetScrollRight) return;
  const max = sheetTabsEl.scrollWidth - sheetTabsEl.clientWidth;
  sheetScrollLeft.disabled  = sheetTabsEl.scrollLeft <= 1;
  sheetScrollRight.disabled = sheetTabsEl.scrollLeft >= max - 1;
}

// Лёгкое обновление бара: передвигает только класс active и стрелки скролла.
// Не пересоздаёт DOM — переключение листа не должно переигрывать анимацию
// вкладок (при пересоздании каждая .sheet-tab заново проигрывала бы tabIn).
export function updateSheetBarActive() {
  if (!sheetTabsEl) return;
  const activeId = getState().activeSheetId;
  sheetTabsEl.querySelectorAll(".sheet-tab").forEach(el => {
    el.classList.toggle("active", el.dataset.id === activeId);
  });
  updateSheetScrollArrows();
}

function clearSheetDragStyles() {
  if (!sheetTabsEl) return;
  sheetTabsEl.querySelectorAll(".sheet-tab").forEach(el => {
    el.style.opacity = "";
    el.classList.remove("sheet-drop-target");
  });
  hideSheetDropLine();
}

export function renderSheetBar() {
  const state = getState();
  sheetTabsEl.innerHTML = "";
  sheetDropLine = document.createElement("div");
  sheetDropLine.className = "sheet-drop-line";
  sheetDropLine.hidden = true;
  sheetTabsEl.appendChild(sheetDropLine);
  for (const sh of state.sheets) {
    const tab = document.createElement("div");
    tab.className = "sheet-tab" + (sh.id === state.activeSheetId ? " active" : "");
    tab.dataset.id = sh.id;
    if (_justAddedIds.has(sh.id)) {
      tab.classList.add("newly-added");
      tab.addEventListener("animationend", () => tab.classList.remove("newly-added"), { once: true });
    }
    const iconEl = document.createElement("span");
    iconEl.className = "sheet-icon";
    iconEl.textContent = sh.icon || "";
    iconEl.title = tx("sheetIcon");
    iconEl.addEventListener("dblclick", (e) => {
      if (tab.querySelector("input.sheet-name-input")) return;
      e.stopPropagation();
      beginRenameIcon(tab, sh);
    });
    const nameEl = document.createElement("span");
    nameEl.className = "name";
    nameEl.textContent = sh.name;
    tab.append(iconEl, nameEl);

    tab.addEventListener("click", (e) => {
      if (tab.querySelector("input.sheet-name-input")) return;
      if (suppressSheetClick) { suppressSheetClick = false; return; }
      // Берём ТЕКУЩИЙ активный лист, а не значение из замыкания renderSheetBar:
      // после switchSheet DOM вкладок не пересоздаётся, поэтому замыкание state
      // может хранить устаревший activeSheetId (в Firefox onChanged для локальных
      // правок той же страницы не перерисовывает бар), и клик по листу, который
      // был активен в момент последнего renderSheetBar, ошибочно считался «уже
      // активным» и не переключался.
      if (sh.id !== getState().activeSheetId) switchSheet(sh.id);
    });
    tab.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      beginRenameSheet(tab, sh);
    });
    tab.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      sheetCtxTargetId = sh.id;
      refreshSheetCtx();
      positionMenu(sheetCtx, e.clientX, e.clientY);
      sheetCtx.hidden = false;
    });

    sheetTabsEl.appendChild(tab);
  }
  refreshSheetCtx();
  updateSheetScrollArrows();
}

// ---------- сенсорные жесты: долгое нажатие на вкладке листа ----------
// Открывает контекстное меню листа (переименовать/удалить/иконка) как при ПКМ.
function armSheetLongPress(e) {
  clearSheetLongPress();
  if (getState().settings.touchGestures === false) return;
  const tab = e.target.closest && e.target.closest(".sheet-tab");
  const id = tab && tab.dataset.id;
  if (!id) return;
  const x = e.clientX;
  const y = e.clientY;
  sheetLongPressTimer = setTimeout(() => {
    sheetLongPressTimer = null;
    sheetDragPtr = null; // отменяем drag-сессию, чтобы не началось перетаскивание
    suppressSheetClick = true;
    setTimeout(() => { suppressSheetClick = false; }, 350);
    sheetCtxTargetId = id;
    refreshSheetCtx();
    positionMenu(sheetCtx, x, y);
    sheetCtx.hidden = false;
  }, LONG_PRESS_MS);
}

function clearSheetLongPress() {
  if (sheetLongPressTimer) { clearTimeout(sheetLongPressTimer); sheetLongPressTimer = null; }
}

// ---------- скролл лист-бара пальцем ----------
// Вкладки используют touch-action: none (нужен drag), поэтому горизонтальный
// скролл бара выполняется вручную: жест, начатый на пустой области бара, или
// быстрый флик по вкладке прокручивает лист-бар.
function beginBarScroll(e) {
  if (e.pointerType !== "touch") return;
  if (!sheetTabsEl) return;
  const max = sheetTabsEl.scrollWidth - sheetTabsEl.clientWidth;
  if (max <= 0) return; // нечего прокручивать
  barScrollPtr = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startScrollLeft: sheetTabsEl.scrollLeft,
    moved: false
  };
}
function onBarScrollMove(e) {
  const s = barScrollPtr;
  if (!s || e.pointerId !== s.pointerId) return;
  const dx = e.clientX - s.startX;
  if (!s.moved && Math.abs(dx) < 5) return;
  s.moved = true;
  const max = sheetTabsEl.scrollWidth - sheetTabsEl.clientWidth;
  sheetTabsEl.scrollLeft = Math.max(0, Math.min(max, s.startScrollLeft - dx));
  updateSheetScrollArrows();
}
function endBarScroll(e) {
  if (!barScrollPtr) return;
  if (e && e.pointerId !== undefined && e.pointerId !== barScrollPtr.pointerId) return;
  barScrollPtr = null;
}

// ---------- автоскролл бара при перетаскивании вкладки к краю ----------
function stopSheetAutoScroll() {
  if (autoScrollTimer) { clearInterval(autoScrollTimer); autoScrollTimer = null; }
}
function startSheetAutoScroll(dir) {
  if (autoScrollTimer) return;
  autoScrollTimer = setInterval(() => {
    if (!sheetTabsEl) { stopSheetAutoScroll(); return; }
    const max = sheetTabsEl.scrollWidth - sheetTabsEl.clientWidth;
    const before = sheetTabsEl.scrollLeft;
    sheetTabsEl.scrollLeft = Math.max(0, Math.min(max, before + dir * 4));
    updateSheetScrollArrows();
    if (sheetTabsEl.scrollLeft === before) stopSheetAutoScroll();
  }, 16);
}
function updateSheetAutoScroll(e) {
  if (!sheetTabsEl) return;
  const r = sheetTabsEl.getBoundingClientRect();
  const EDGE = 36;
  if (e.clientX < r.left + EDGE) startSheetAutoScroll(-1);
  else if (e.clientX > r.right - EDGE) startSheetAutoScroll(1);
  else stopSheetAutoScroll();
}

// ---------- перетаскивание вкладок листов (pointer-события) ----------
function onSheetBarPointerDown(e) {
  if (e.button !== 0) return;
  const tab = e.target.closest && e.target.closest(".sheet-tab");
  if (!tab) { beginBarScroll(e); return; }
  if (tab.querySelector("input.sheet-name-input") || tab.querySelector("input.sheet-icon-input")) return;
  sheetDragId = null;
  sheetDragPtr = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    startTime: e.timeStamp,
    tab,
    moved: false,
    targetId: null,
    before: true
  };
  armSheetLongPress(e);
}

function onSheetBarPointerMove(e) {
  if (barScrollPtr) { onBarScrollMove(e); return; }
  const d = sheetDragPtr;
  if (!d || e.pointerId !== d.pointerId) return;
  if (!d.moved) {
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
    // Быстрое горизонтальное движение пальцем без паузы — это скролл бара,
    // а не перетаскивание вкладки (как флик в мобильных браузерах).
    if (e.pointerType === "touch" && (e.timeStamp - d.startTime) <= 250 &&
        sheetTabsEl && (sheetTabsEl.scrollWidth - sheetTabsEl.clientWidth) > 0) {
      clearSheetLongPress();
      sheetDragPtr = null;
      barScrollPtr = {
        pointerId: e.pointerId,
        startX: d.startX,
        startScrollLeft: sheetTabsEl.scrollLeft,
        moved: false
      };
      onBarScrollMove(e);
      return;
    }
    d.moved = true;
    clearSheetLongPress();
    sheetDragId = d.tab.dataset.id;
    d.tab.classList.add("sheet-dragging");
    d.tab.style.opacity = "0.4";
  }
  // Ищем вкладку, к которой ближе всего указатель (по середине).
  const tabs = [...sheetTabsEl.querySelectorAll(".sheet-tab")].filter(t => t !== d.tab);
  let targetId = null;
  let before = true;
  for (const t of tabs) {
    const r = t.getBoundingClientRect();
    if (e.clientX < r.left + r.width / 2) { targetId = t.dataset.id; before = true; break; }
    targetId = t.dataset.id;
    before = false;
  }
  d.targetId = targetId;
  d.before = before;
  // Позиция линии-индикатора в координатах контента (с учётом scrollLeft).
  const rect = sheetTabsEl.getBoundingClientRect();
  let left;
  if (targetId == null) {
    left = sheetTabsEl.scrollWidth;
  } else {
    const target = sheetTabsEl.querySelector('.sheet-tab[data-id="' + String(targetId).replace(/"/g, '\\"') + '"]');
    const tr = target.getBoundingClientRect();
    left = before ? tr.left - rect.left : tr.right - rect.left;
  }
  left += sheetTabsEl.scrollLeft;
  sheetDropLine.style.left = left + "px";
  sheetDropLine.hidden = false;
  // Автоскролл бара, когда вкладку тащат к краю.
  updateSheetAutoScroll(e);
}

function onSheetBarPointerUp(e) {
  endBarScroll(e);
  stopSheetAutoScroll();
  const d = sheetDragPtr;
  if (!d || e.pointerId !== d.pointerId) return;
  clearSheetLongPress();
  sheetDragPtr = null;
  hideSheetDropLine();
  d.tab.classList.remove("sheet-dragging");
  d.tab.style.opacity = "";
  if (!d.moved) return;
  const fromId = d.tab.dataset.id;
  sheetDragId = null;
  if (!d.targetId || d.targetId === fromId) return;
  suppressSheetClick = true;
  setTimeout(() => { suppressSheetClick = false; }, 50);
  persistSheetOrder(fromId, d.targetId, d.before);
}

function onSheetBarPointerCancel() {
  endBarScroll(null);
  stopSheetAutoScroll();
  clearSheetLongPress();
  const d = sheetDragPtr;
  if (!d) return;
  sheetDragPtr = null;
  sheetDragId = null;
  hideSheetDropLine();
  d.tab.classList.remove("sheet-dragging");
  d.tab.style.opacity = "";
}

function hideSheetDropLine() {
  if (sheetDropLine) sheetDropLine.hidden = true;
}

// Перемещает лист на новую позицию и сохраняет порядок.
async function persistSheetOrder(fromId, targetId, before) {
  // Storage.update возвращает мутированные данные — не читаем storage повторно.
  const data = await Storage.update((d) => {
    const fromIdx = d.sheets.findIndex(s => s.id === fromId);
    if (fromIdx < 0) return;
    const [moved] = d.sheets.splice(fromIdx, 1);
    let toIdx;
    if (targetId == null) {
      toIdx = d.sheets.length;
    } else {
      const ti = d.sheets.findIndex(s => s.id === targetId);
      if (ti < 0) { d.sheets.splice(fromIdx, 0, moved); return; }
      toIdx = before ? ti : ti + 1;
    }
    d.sheets.splice(toIdx, 0, moved);
  });
  setState(data);
  renderSheetBar();
  renderGrid();
  updateSheetScrollArrows();
}

export async function switchSheet(id) {
  // Storage.update возвращает данные — одно чтение storage вместо двух.
  const data = await Storage.update((d) => { d.activeSheetId = id; });
  setState(data);
  updateSheetBarActive();
  renderGrid();
  if (sheetTabsEl) {
    const tabEl = sheetTabsEl.querySelector('.sheet-tab[data-id="' + id + '"]');
    if (tabEl && tabEl.scrollIntoView) tabEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }
  updateSheetScrollArrows();
}

// Переключение листа свайпом: dir = 1 (влево → следующий), -1 (вправо → предыдущий).
export function switchSheetBySwipe(dir) {
  const state = getState();
  if (!state.sheets || state.sheets.length < 2) return;
  const idx = state.sheets.findIndex(s => s.id === state.activeSheetId);
  if (idx < 0) return;
  const next = (idx + (dir || 1) + state.sheets.length) % state.sheets.length;
  if (next === idx) return;
  switchSheet(state.sheets[next].id);
}

async function addSheetPrompt() {
  if (!sheetModal || !sheetForm) return;
  sheetForm.reset();
  sheetForm.elements.name.value = tx("newSheetDefault");
  sheetModal.hidden = false;
  // restart modal animation
  const card = sheetModal.querySelector(".modal-card");
  if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
  // Defer focus to next tick so the modal can paint first.
  setTimeout(() => {
    try { sheetForm.elements.name.focus({ preventScroll: true }); } catch (_) {}
    try { sheetForm.elements.name.select(); } catch (_) {}
  }, 0);
}

export function closeSheetModal() {
  if (sheetModal) sheetModal.hidden = true;
}

async function onSubmitSheet(e) {
  e.preventDefault();
  if (!sheetForm) return;
  const nameEl = sheetForm.elements.name;
  if (!nameEl) return;
  const name = (nameEl.value || "").trim();
  if (!name) return;
  const state = getState();
  if (state.sheets.some(s => s.name === name)) { toast(tx("sheetExists"), true); return; }
  const icon = randomSheetIcon();
  const cols = clampCols(state.settings.defaultColumns || 8);
  const newSheet = { id: cryptoId(), name: name, icon: icon, columns: cols, cells: {} };
  await Storage.update((d) => {
    d.sheets.push(newSheet);
    d.activeSheetId = newSheet.id;
  });
  setState(await Storage.get());
  // remember the new sheet id so its tab plays entrance animation only this once
  _justAddedIds.add(newSheet.id);
  setTimeout(() => _justAddedIds.delete(newSheet.id), 800);
  renderSheetBar(); renderGrid();
  if (sheetTabsEl) sheetTabsEl.scrollLeft = sheetTabsEl.scrollWidth;
  closeSheetModal();
  toast(tx("sheetAdded"));
}

async function deleteSheet(sh) {
  const state = getState();
  if (state.sheets.length <= 1) { toast(tx("needOneSheet"), true); return; }
  const count = Object.keys(sh.cells || {}).length;
  if (count > 0 && !(await confirmDialog(tx("confirmDeleteSheet")({ n: count })))) return;
  await Storage.update((d) => {
    d.sheets = d.sheets.filter(s => s.id !== sh.id);
    if (d.activeSheetId === sh.id) d.activeSheetId = d.sheets[0].id;
  });
  setState(await Storage.get());
  renderSheetBar(); renderGrid();
  toast(tx("removed"));
}

function beginRenameIcon(tabEl, sheet) {
  if (tabEl.querySelector("input.sheet-icon-input")) return;
  const iconEl = tabEl.querySelector(".sheet-icon");
  if (!iconEl) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "sheet-icon-input";
  input.value = sheet.icon || "";
  input.maxLength = 4;
  iconEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const finish = async (commit) => {
    if (done) return;
    done = true;
    const newIcon = (input.value || "").trim() || (sheet.icon || "");
    // restore span first
    const restored = document.createElement("span");
    restored.className = "sheet-icon";
    restored.textContent = sheet.icon || "";
    restored.title = tx("sheetIcon");
    restored.addEventListener("dblclick", (e) => {
      if (tabEl.querySelector("input.sheet-name-input")) return;
      e.stopPropagation();
      beginRenameIcon(tabEl, sheet);
    });
    input.replaceWith(restored);
    if (!commit || newIcon === (sheet.icon || "")) return;
    await Storage.update((d) => {
      const s = d.sheets.find(x => x.id === sheet.id);
      if (s) s.icon = newIcon;
    });
    setState(await Storage.get());
    renderSheetBar();
    toast(tx("renamed"));
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  input.addEventListener("blur", () => finish(true));
}

function beginRenameSheet(tabEl, sheet) {
  if (tabEl.querySelector("input.sheet-name-input")) return;
  const nameEl = tabEl.querySelector(".name");
  if (!nameEl) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "sheet-name-input";
  input.value = sheet.name;
  input.maxLength = 40;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const finish = async (commit) => {
    if (done) return;
    done = true;
    const newName = (input.value || "").trim() || sheet.name;
    input.replaceWith(nameEl);
    if (!commit || newName === sheet.name) { nameEl.textContent = sheet.name; return; }
    const state = getState();
    if (state.sheets.some(s => s.id !== sheet.id && s.name === newName)) {
      toast(tx("sheetExists"), true);
      nameEl.textContent = sheet.name;
      return;
    }
    await Storage.update((d) => {
      const s = d.sheets.find(x => x.id === sheet.id);
      if (s) s.name = newName;
    });
    setState(await Storage.get());
    renderSheetBar();
    toast(tx("renamed"));
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter")      { e.preventDefault(); finish(true); }
    else if (e.key === "Escape"){ e.preventDefault(); finish(false); }
  });
  input.addEventListener("blur", () => finish(true));
}

async function onSheetCtxAction(e) {
  const li = e.target.closest('li[data-act]');
  if (!li || !sheetCtx.contains(li)) return;
  const act = li.dataset.act;
  const id = sheetCtxTargetId;
  hideSheetCtx();
  sheetCtxTargetId = null;
  if (!id || !act) return;
  const state = getState();
  const sh = state.sheets.find(s => s.id === id);
  if (!sh) return;

  if (act === "rename") {
    const tabEl = sheetTabsEl.querySelector('.sheet-tab[data-id="' + id + '"]');
    if (tabEl) beginRenameSheet(tabEl, sh);
  } else if (act === "delete") {
    deleteSheet(sh);
  } else if (act === "icon") {
    const tabEl = sheetTabsEl.querySelector('.sheet-tab[data-id="' + id + '"]');
    if (tabEl) beginRenameIcon(tabEl, sh);
  }
}

const SHEET_ICON_PALETTE = ["📋","🏠","💼","📰","📚","🎵","🎬","🛒","💡","⚙️","🚀","📷","🎮","✉️","📊","🔥","⭐","❤️","🌐","🧠","📁","📅","📞","🛠","💬","🧩"];
function randomSheetIcon() {
  return SHEET_ICON_PALETTE[Math.floor(Math.random() * SHEET_ICON_PALETTE.length)];
}

/** Слушает лист-бар: скролл, колёсико, перетаскивание, модалку листа, ctx-меню. */
export function bindSheetEvents() {
  addSheetBtn.addEventListener("click", addSheetPrompt);
  if (sheetForm) sheetForm.addEventListener("submit", onSubmitSheet);
  const sheetCancelBtn = document.getElementById("sheetCancelBtn");
  if (sheetCancelBtn) sheetCancelBtn.addEventListener("click", closeSheetModal);
  // Close sheet modal on click outside the card
  if (sheetModal) {
    sheetModal.addEventListener("mousedown", (e) => {
      if (e.target === sheetModal) closeSheetModal();
    });
  }

  if (sheetScrollLeft) {
    sheetScrollLeft.addEventListener("click", () => {
      if (sheetTabsEl) sheetTabsEl.scrollBy({ left: -240, behavior: "smooth" });
    });
  }
  if (sheetScrollRight) {
    sheetScrollRight.addEventListener("click", () => {
      if (sheetTabsEl) sheetTabsEl.scrollBy({ left:  240, behavior: "smooth" });
    });
  }

  if (sheetTabsEl) {
    sheetTabsEl.addEventListener("scroll", updateSheetScrollArrows, { passive: true });
    window.addEventListener("resize", () => {
      updateSheetScrollArrows();
      // Высота бара может измениться при переносе вкладок на новую строку.
      const ev = new CustomEvent("tabula:sheetbar-resize");
      window.dispatchEvent(ev);
    });
  }
  // Горизонтальный скролл листов по колесу мыши над sheet-bar.
  if (sheetBar && sheetTabsEl) {
    sheetBar.addEventListener("wheel", (e) => {
      // Не перехватываем, когда пользователь крутит колесо над инпутом (переименование листа).
      if (e.target && e.target.closest && e.target.closest("input")) return;
      // Не перехватываем горизонтальный жест трекпада.
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      sheetTabsEl.scrollBy({ left: e.deltaY, behavior: "auto" });
    }, { passive: false });
  }

  // Перетаскивание вкладок листов (как у ячеек — pointer-события).
  if (sheetTabsEl) {
    sheetTabsEl.addEventListener("pointerdown", onSheetBarPointerDown);
    document.addEventListener("pointermove", onSheetBarPointerMove);
    document.addEventListener("pointerup", onSheetBarPointerUp);
    document.addEventListener("pointercancel", onSheetBarPointerCancel);
  }

  sheetCtx.addEventListener("click", onSheetCtxAction);
}
