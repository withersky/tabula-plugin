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
 * Грид ячеек: рендер активного листа, Excel-подобное выделение и перенос
 * блоков, контекстные меню ячеек, модалки добавления/редактирования закладки.
 */

import { getState, setState, activeSheet } from "./state.js";
import { tx } from "./i18n.js";
import { toast, cssEscape, cssAttr, keyCode } from "./utils.js";
import { cachedSrc, onFaviconLoaded } from "./favicons.js";

const gridEl     = document.getElementById("grid");
const modalEl    = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const tabForm    = document.getElementById("tabForm");
const ctxMenu    = document.getElementById("ctxMenu");
const ctxEmpty   = document.getElementById("ctxMenuEmpty");
const sheetCtx   = document.getElementById("sheetCtx");

let editingBookmark = null;
let editingTargetKey = null;
let ctxCellKey = null;
let ctxBookmarkId = null;
let selectedCellKey = null;
let suppressClick = false;
let selAnchorKey = null;   // якорная ячейка текущего выделения
let selRange = [];         // ключи ячеек в выделении (в т.ч. диапазон)
let pointerState = null;   // активная pointer-сессия на сетке
let moveDrag = null;       // данные переноса выделенного блока
let moveGhost = null;      // плавающая копия закладки во время drag
let moveDropSheetId = null;// id листа, на вкладку которого наведён drag
let longPressTimer = null; // таймер долгого нажатия (сенсорные жесты)
let swipePtr = null;       // свайп-сессия по пустой области сетки (touch)
let cellEls = new Map();   // key → DOM-элемент ячейки активного листа (индекс)

const LONG_PRESS_MS = 800; // порог долгого нажатия (800 мс — запас, чтобы успеть начать перетаскивание)
const SWIPE_X = 70;        // порог горизонтального свайпа (переключение листа)
const SWIPE_RATIO = 1.2;   // доминирование горизонтали над вертикалью
const SWIPE_MAX_MS = 500;  // свайп — это быстрое движение, не перетаскивание

// ---------- рендер ----------

export function renderGrid() {
  selectedCellKey = null;
  selAnchorKey = null;
  selRange = [];
  pointerState = null;
  moveDrag = null;
  cellEls.clear();
  const state = getState();
  const sh = activeSheet();
  if (!sh) return;

  // Собираем сетку во фрагменте и вставляем одним вызовом — один reflow
  // вместо N appendChild (важно для больших листов).
  const frag = document.createDocumentFragment();

  const cols = clampCols(state.settings.defaultColumns);
  const rows = computeFillRows(sh);
  const showCol = !!state.settings.showColLetters;
  const showRow = !!state.settings.showRowNumbers;

  gridEl.classList.toggle("has-col-letters", showCol);
  gridEl.classList.toggle("has-row-nums",    showRow);
  gridEl.classList.toggle("show-grid",       !!state.settings.showGrid);

  if (showCol) {
    const headerRow = document.createElement("div");
    headerRow.className = "grid-row header";
    // Уголок рисуем только при включённых номерах строк: он заполняет ячейку
    // над колонкой номеров. Если добавить его всегда, при выключенных номерах
    // буквы сдвигаются на колонку вправо, а последняя буква переносится
    // на вторую строку — визуально «буквы начинаются не с A».
    if (showRow) {
      const corner = document.createElement("div");
      corner.className = "corner";
      headerRow.appendChild(corner);
    }
    for (let c = 0; c < cols; c++) {
      const letter = document.createElement("div");
      letter.className = "col-letter";
      letter.textContent = colLetter(c);
      headerRow.appendChild(letter);
    }
    frag.appendChild(headerRow);
  }

  for (let r = 0; r < rows; r++) {
    const rowEl = document.createElement("div");
    const isLast = (r === rows - 1);
    rowEl.className = "grid-row" + (isLast ? " fill" : "");
    if (showRow) {
      const rnum = document.createElement("div");
      rnum.className = "row-num";
      rnum.textContent = String(r + 1);
      rowEl.appendChild(rnum);
    }
    for (let c = 0; c < cols; c++) {
      const key = r + "," + c;
      const bm = sh.cells[key];
      const cellEl = createCellEl(key, bm);
      cellEls.set(key, cellEl);
      rowEl.appendChild(cellEl);
    }
    frag.appendChild(rowEl);
  }
  gridEl.replaceChildren(frag);
}

export function clampGridRows() {
  // Минимальное число строк грида — настраивается в options.
  const state = getState();
  const v = Number(state.settings.gridRows);
  return isFinite(v) ? Math.max(2, Math.min(30, Math.round(v))) : 6;
}

export function computeFillRows(sheet) {
  // Грид растягивается на всю доступную высоту (flex: 1 1 0 у каждой строки),
  // поэтому показываем ровно столько строк, сколько нужно контенту
  // (минимум — настройка "Строк по умолчанию", чтобы сетка не схлопывалась).
  // Без резерва +4 снизу — он заставлял грид «прыгать», когда закладку
  // добавляли в последнюю видимую строку.
  let maxRow = -1;
  for (const k of Object.keys(sheet.cells || {})) {
    const r = parseInt(k.split(",")[0], 10);
    if (!isNaN(r) && r > maxRow) maxRow = r;
  }
  return Math.max(maxRow + 1, clampGridRows());
}

function letterBadge(title) {
  const span = document.createElement("span");
  span.className = "letter";
  span.textContent = letterChar(title);
  return span;
}

function createCellEl(key, bm) {
  const cell = document.createElement("div");
  cell.className = "cell " + (bm ? "filled" : "empty");
  cell.dataset.key = key;
  if (bm) {
    cell.dataset.id = bm.id;
    cell.title = bm.title + "\n" + bm.url;
    const state = getState();
    const fav = document.createElement("span");
    fav.className = "favicon";
    if (state.settings.showFavicon) {
      const host = faviconHost(bm.url);
      if (host) cell.dataset.host = host;
      const src = cachedSrc(bm.url);
      if (src) {
        const img = document.createElement("img");
        img.alt = "";
        img.draggable = false;
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.src = src;
        img.onerror = () => { fav.replaceChildren(letterBadge(bm.title)); };
        fav.appendChild(img);
      } else {
        fav.appendChild(letterBadge(bm.title));
      }
    } else {
      fav.appendChild(letterBadge(bm.title));
    }
    const title = document.createElement("span");
    title.className = "title-text";
    title.textContent = bm.title;
    cell.append(fav, title);
  }
  return cell;
}

// ---------- фавиконки: дозагрузка ячеек из кэша ----------

function updateFaviconCells(host) {
  if (!host) return;
  for (const cell of cellEls.values()) {
    if (!cell.classList.contains("filled") || cell.dataset.host !== host) continue;
    const fav = cell.querySelector(".favicon");
    if (!fav || fav.querySelector("img")) continue;
    const sheet = activeSheet();
    const bm = sheet && sheet.cells ? sheet.cells[cell.dataset.key] : null;
    if (!bm) continue;
    const src = cachedSrc(bm.url);
    if (!src) continue;
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.src = src;
    img.onerror = () => { fav.replaceChildren(letterBadge(bm.title)); };
    fav.replaceChildren(img);
  }
}

onFaviconLoaded(host => { updateFaviconCells(host); });

// ---------- выделение ----------

function clearCellSelection() {
  for (const el of cellEls.values()) el.classList.remove("selected", "active");
}

function cellElByKey(key) {
  return cellEls.get(key) || null;
}

function applySelection(anchorKey, keys) {
  selAnchorKey = anchorKey;
  selRange = keys;
  clearCellSelection();
  keys.forEach(k => {
    const el = cellElByKey(k);
    if (el) el.classList.add("selected");
  });
  const a = cellElByKey(anchorKey);
  if (a) a.classList.add("active");
}

export function selectCell(key) {
  selectedCellKey = key;
  if (key) applySelection(key, [key]);
  else { selAnchorKey = null; selRange = []; clearCellSelection(); }
}

function selectRange(anchorKey, focusKey) {
  selectedCellKey = anchorKey;
  applySelection(anchorKey, rangeKeys(anchorKey, focusKey));
}

// ---------- клики и контекстное меню ячейки ----------

function currentBookmarkAt(key) {
  const sh = activeSheet();
  return sh && sh.cells ? sh.cells[key] : null;
}

function onCellClick(e) {
  if (suppressClick) { suppressClick = false; return; }
  // Открытие закладки обрабатывается в onGridPointerUp (клик без перетаскивания).
  // Здесь только гасим случайные клики, оставшиеся после pointer-сессии.
  e.preventDefault();
  e.stopPropagation();
}

function onCellAuxClick(e) {
  // СКМ по заполненной ячейке: открыть в новой вкладке всегда (независимо от openInNewTab).
  if (e.button !== 1) return;
  const cell = e.target.closest(".cell");
  if (!cell) return;
  e.preventDefault();
  e.stopPropagation();
  // Подавляем последующий обычный click, чтобы не открыть ссылку повторно.
  // (СКМ не порождает click, поэтому гасим флаг отложенно.)
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 50);
  const bm = cell.classList.contains("filled") ? currentBookmarkAt(cell.dataset.key) : null;
  if (!bm) return;
  const target = normalizeUrl(bm.url);
  window.open(target, "_blank", "noopener");
}

function onCellContextMenu(e) {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  e.preventDefault();
  e.stopPropagation();
  hideCtx(); hideCtxEmpty();
  const key = cell.dataset.key;
  if (!key) return;
  selectCell(key);
  const bm = cell.classList.contains("filled") ? currentBookmarkAt(key) : null;

  if (bm) {
    ctxBookmarkId = bm.id;
    ctxCellKey = key;
    positionMenu(ctxMenu, e.clientX, e.clientY);
    ctxMenu.hidden = false;
  } else {
    ctxBookmarkId = null;
    ctxCellKey = key;
    positionMenu(ctxEmpty, e.clientX, e.clientY);
    ctxEmpty.hidden = false;
  }
}

export function positionMenu(menu, x, y) {
  menu.style.left = "0px"; menu.style.top = "0px";
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth  - r.width  - 4);
  const top  = Math.min(y, window.innerHeight - r.height - 4);
  menu.style.left = Math.max(0, left) + "px";
  menu.style.top  = Math.max(0, top)  + "px";
}

export function hideCtx()       { ctxMenu.hidden = true;    ctxBookmarkId = null; ctxCellKey = null; }
export function hideCtxEmpty()  { ctxEmpty.hidden = true;   ctxCellKey = null; }
export function hideSheetCtx()  { sheetCtx.hidden = true;   /* sheetCtxTargetId живёт в sheets.js */ }

async function onCtxAction(e) {
  const li = e.target.closest('li[data-act]');
  if (!li || !ctxMenu.contains(li)) return;
  const act = li.dataset.act;
  const id = ctxBookmarkId;
  const key = ctxCellKey;
  hideCtx();
  if (!id || !act || !key) return;
  const sh = activeSheet();
  if (!sh) return;
  const bm = sh.cells[key];
  if (!bm || bm.id !== id) return;

  const state = getState();
  switch (act) {
    case "open":
      window.location.href = normalizeUrl(bm.url);
      break;
    case "open-new":
      window.open(normalizeUrl(bm.url), "_blank", "noopener");
      break;
    case "edit":
      openEditModal(bm, key);
      break;
    case "duplicate": {
      const newKey = nextEmptyAfter(sh, key, clampCols(state.settings.defaultColumns));
      const dupTitle = bm.title + " (" + tx("duplicate").toLowerCase() + ")";
      await Storage.update((d) => {
        const cur = d.sheets.find(s => s.id === d.activeSheetId);
        if (cur && newKey) cur.cells[newKey] = { id: cryptoId(), title: dupTitle, url: bm.url };
      });
      setState(await Storage.get()); renderGrid();
      toast(tx("duplicated"));
      break;
    }
    case "delete":
      await Storage.update((d) => {
        const cur = d.sheets.find(s => s.id === d.activeSheetId);
        if (cur) delete cur.cells[key];
      });
      setState(await Storage.get()); renderGrid();
      toast(tx("deleted"));
      break;
  }
}

function onCtxEmptyAction(e) {
  const li = e.target.closest('li[data-act]');
  if (!li || !ctxEmpty.contains(li)) return;
  const act = li.dataset.act;
  const key = ctxCellKey;
  hideCtxEmpty();
  if (act === "add" && key) openAddModal(key);
}

export async function onAddBookmarkTop() {
  const sh = activeSheet();
  if (!sh) return;
  const state = getState();
  const key = findFirstEmptyCell(sh, computeFillRows(sh), clampCols(state.settings.defaultColumns)) || "0,0";
  openAddModal(key);
}

// ---------- Excel-подобное выделение и перенос блока ----------

function selectionFilledCells() {
  const sh = activeSheet();
  const out = [];
  if (!sh || !sh.cells) return out;
  selRange.forEach(k => { if (sh.cells[k]) out.push({ from: k, bm: sh.cells[k] }); });
  return out;
}

function cellAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest(".cell") : null;
}

function clearMoveTargets() {
  for (const el of cellEls.values()) el.classList.remove("drop-target");
}

function clearSheetDropTargets() {
  document.querySelectorAll(".sheet-tab.sheet-drop-target").forEach(el => el.classList.remove("sheet-drop-target"));
}

function clearDraggingCells() {
  for (const el of cellEls.values()) el.classList.remove("dragging");
}

// Вкладка листа под указателем (для переноса закладки на другой лист).
function sheetTabAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest(".sheet-tab") : null;
}

// ---------- ghost: плавающая копия закладки, следующая за курсором ----------
function createDragGhost(md) {
  const ghost = document.createElement("div");
  ghost.className = "cell-drag-ghost";
  ghost.textContent = md.cells.length === 1
    ? (md.cells[0].bm.title || md.cells[0].bm.url || "")
    : (md.cells.length + " · " + (tx("moved") || ""));
  document.body.appendChild(ghost);
  return ghost;
}
function updateDragGhost(x, y) {
  if (!moveGhost) return;
  moveGhost.style.left = (x + 14) + "px";
  moveGhost.style.top  = (y + 14) + "px";
}
function removeDragGhost() {
  if (moveGhost) { moveGhost.remove(); moveGhost = null; }
}

// ---------- сенсорные жесты: долгое нажатие на ячейке ----------
// Долгое нажатие открывает то же контекстное меню, что и правый клик.
// Работает только при включённой настройке touchGestures (body.touch-gestures).
function armCellLongPress(e) {
  clearCellLongPress();
  if (getState().settings.touchGestures === false) return;
  const x = e.clientX;
  const y = e.clientY;
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    // Отменяем pointer-сессию: отпускание пальца не должно открыть закладку.
    pointerState = null;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 350);
    const cell = cellAtPoint(x, y);
    if (!cell) return;
    onCellContextMenu({
      target: cell,
      clientX: x,
      clientY: y,
      preventDefault() {},
      stopPropagation() {}
    });
  }, LONG_PRESS_MS);
}

function clearCellLongPress() {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
}

// ---------- сенсорные жесты: свайп для переключения листов ----------
// Свайп влево/вправо по сетке (по ячейке или пустой области) переключает
// листы. Срабатывает только для touch и при включённой настройке
// touchGestures. Быстрое горизонтальное движение побеждает перетаскивание.
function fireSheetSwipe(dir) {
  if (typeof CustomEvent === "undefined") return;
  window.dispatchEvent(new CustomEvent("tabula:sheet-swipe", { detail: { dir } }));
}

function isSwipeGesture(e, startX, startY, startTime) {
  if (e.pointerType !== "touch") return 0;
  if (getState().settings.touchGestures === false) return 0;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  if (Math.abs(dx) < SWIPE_X || Math.abs(dx) <= Math.abs(dy) * SWIPE_RATIO) return 0;
  if (startTime != null && (e.timeStamp - startTime) > SWIPE_MAX_MS) return 0;
  return dx < 0 ? 1 : -1;
}

function onGridSwipeDown(e) {
  if (e.pointerType !== "touch") return;
  if (e.target.closest(".cell")) return; // ячейки обрабатывает onGridPointerDown
  swipePtr = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startTime: e.timeStamp };
}

function onGridSwipeMove(e) {
  const s = swipePtr;
  if (!s || e.pointerId !== s.pointerId) return;
  const dir = isSwipeGesture(e, s.startX, s.startY, s.startTime);
  if (!dir) return;
  swipePtr = null;
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 350);
  fireSheetSwipe(dir);
}

function onGridSwipeUp(e) {
  if (!swipePtr || e.pointerId !== swipePtr.pointerId) return;
  swipePtr = null;
}

function cancelSwipeSession() {
  swipePtr = null;
}

function onGridPointerDown(e) {
  if (e.button !== 0) return; // только ЛКМ
  const cell = e.target.closest(".cell");
  if (!cell) return;
  const key = cell.dataset.key;
  if (!key) return;
  const sh = activeSheet();
  const hasBookmark = !!(sh && sh.cells && sh.cells[key]);
  const inSelection = selRange.indexOf(key) !== -1;
  // Как везде: захват заполненной ячейки — перемещение (одной или блока),
  // захват пустой ячейки — выделение диапазона.
  const mode = hasBookmark ? "move" : "select";
  // Новый захват вне текущего выделения сужает выбор до этой ячейки,
  // иначе при переносе уедет старый блок, а не захваченная ячейка.
  if (mode === "select" || (mode === "move" && !inSelection)) selectCell(key);
  pointerState = {
    mode,
    anchorKey: key,
    startX: e.clientX,
    startY: e.clientY,
    startTime: e.timeStamp,
    lastKey: key,
    moved: false
  };
  armCellLongPress(e);
}

function onGridPointerMove(e) {
  if (!pointerState) return;
  // Свайп влево/вправо → переключение листов (только touch).
  // При захвате закладки (mode "move") свайп отключён: жест всегда
  // трактуется как перетаскивание, чтобы drag не превращался в слайд.
  const swipeDir = pointerState.mode === "move"
    ? 0
    : isSwipeGesture(e, pointerState.startX, pointerState.startY, pointerState.startTime);
  if (swipeDir) {
    pointerState = null;
    moveDrag = null;
    removeDragGhost();
    clearCellLongPress();
    clearMoveTargets();
    clearSheetDropTargets();
    clearDraggingCells();
    moveDropSheetId = null;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 350);
    fireSheetSwipe(swipeDir);
    return;
  }
  const dx = e.clientX - pointerState.startX;
  const dy = e.clientY - pointerState.startY;
  if (!pointerState.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
    pointerState.moved = true;
    clearCellLongPress();
    if (pointerState.mode === "move") {
      moveDrag = { cells: selectionFilledCells(), anchorKey: pointerState.anchorKey };
      moveGhost = createDragGhost(moveDrag);
      for (const el of cellEls.values()) {
        if (el.classList.contains("selected")) el.classList.add("dragging");
      }
    }
  }
  if (!pointerState.moved) return;
  e.preventDefault(); // запрещаем выделение текста/нативный drag во время перетаскивания
  updateDragGhost(e.clientX, e.clientY);
  const cell = cellAtPoint(e.clientX, e.clientY);
  const key = cell ? cell.dataset.key : null;

  if (pointerState.mode === "select") {
    if (!key || key === pointerState.lastKey) return;
    pointerState.lastKey = key;
    selectRange(pointerState.anchorKey, key);
    return;
  }

  // Режим переноса: вкладка листа под курсором → подсвечиваем как drop-цель.
  const sheetTab = sheetTabAtPoint(e.clientX, e.clientY);
  const sheetId = sheetTab && sheetTab.dataset.id;
  const curSheetId = activeSheet() && activeSheet().id;
  if (sheetId && sheetId !== curSheetId) {
    if (moveDropSheetId !== sheetId) {
      moveDropSheetId = sheetId;
      clearMoveTargets();
      clearSheetDropTargets();
      sheetTab.classList.add("sheet-drop-target");
    }
    pointerState.lastKey = key || pointerState.lastKey;
    return;
  }
  if (moveDropSheetId) {
    moveDropSheetId = null;
    clearSheetDropTargets();
  }
  if (!key || key === pointerState.lastKey) return;
  pointerState.lastKey = key;
  clearMoveTargets();
  if (key !== pointerState.anchorKey) {
    const t = cellElByKey(key);
    if (t) {
      // Одиночную закладку можно поменять местами с занятой ячейкой.
      if (moveDrag && moveDrag.cells.length === 1 && t.classList.contains("filled")) {
        t.classList.add("drop-swap");
      } else {
        t.classList.add("drop-target");
      }
    }
  }
}

async function onGridPointerUp(e) {
  if (!pointerState || e.button !== 0) return;
  clearCellLongPress();
  const st = pointerState;
  pointerState = null;
  const cell = cellAtPoint(e.clientX, e.clientY);
  const targetKey = cell ? cell.dataset.key : st.lastKey;

  if (st.mode === "move" && st.moved && moveDrag) {
    const md = moveDrag;
    moveDrag = null;
    removeDragGhost();
    clearMoveTargets();
    clearDraggingCells();
    const dropSheetId = moveDropSheetId;
    moveDropSheetId = null;
    clearSheetDropTargets();
    if (dropSheetId) {
      // Сброс на вкладку другого листа → перенос блока на этот лист.
      await moveBlockToSheet(md, dropSheetId);
    } else if (targetKey && targetKey !== md.anchorKey) {
      // Одиночная закладка на занятую ячейку → обмен местами.
      if (md.cells.length === 1 && currentBookmarkAt(targetKey)) {
        await swapBookmarks(md.anchorKey, targetKey);
      } else {
        await moveSelectionBlock(md, targetKey);
      }
    } else {
      renderGrid();
    }
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
    return;
  }

  // Обычный клик без перетаскивания: выделить и открыть закладку, если есть.
  removeDragGhost();
  clearMoveTargets();
  clearDraggingCells();
  moveDropSheetId = null;
  clearSheetDropTargets();
  if (!st.moved) {
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
    if (st.mode === "select") {
      selectCell(st.anchorKey);
      openBookmarkAt(st.anchorKey);
    } else if (st.mode === "move") {
      openBookmarkAt(st.anchorKey);
    }
  }
}

function onCellPointerCancel() {
  clearCellLongPress();
  pointerState = null;
  moveDrag = null;
  removeDragGhost();
  moveDropSheetId = null;
  clearMoveTargets();
  clearSheetDropTargets();
  clearDraggingCells();
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 50);
}

export function openBookmarkAt(key) {
  const bm = currentBookmarkAt(key);
  if (!bm) return;
  const state = getState();
  const target = normalizeUrl(bm.url);
  if (state.settings.openInNewTab) window.open(target, "_blank", "noopener");
  else window.location.href = target;
}

// ---------- клавиатурная навигация ----------
// Excel-подобные хоткеи: стрелки двигают выделение, Enter/пробел открывают
// закладку, F2 редактирует. Работают при фокусе на странице (не в полях ввода).

/** Ключ выбранной ячейки (для хоткеев из других модулей). */
export function selectedKey() { return selectedCellKey; }

/** Открывает закладку в выбранной ячейке (Enter/пробел). */
export function openSelected() {
  if (selectedCellKey) openBookmarkAt(selectedCellKey);
}

/** Открывает редактирование закладки в выбранной ячейке (F2). */
export function editSelected() {
  if (!selectedCellKey) return;
  const bm = currentBookmarkAt(selectedCellKey);
  if (bm) openEditModal(bm, selectedCellKey);
}

/** Открывает закладку выбранной ячейки в новой вкладке (Ctrl+Enter / Shift+Enter). */
export function openSelectedInNewTab() {
  if (!selectedCellKey) return;
  const bm = currentBookmarkAt(selectedCellKey);
  if (!bm) return;
  window.open(normalizeUrl(bm.url), "_blank", "noopener");
}

/** Удаляет закладку в выбранной ячейке (Delete/Backspace). */
export async function deleteSelected() {
  if (!selectedCellKey) return;
  const sh = activeSheet();
  if (!sh || !sh.cells || !sh.cells[selectedCellKey]) return;
  const key = selectedCellKey;
  await Storage.update((d) => {
    const cur = d.sheets.find(s => s.id === d.activeSheetId);
    if (cur) delete cur.cells[key];
  });
  setState(await Storage.get()); renderGrid();
  toast(tx("deleted"));
}

/** Дублирует закладку выбранной ячейки в первую свободную (Ctrl+D). */
export async function duplicateSelected() {
  if (!selectedCellKey) return;
  const sh = activeSheet();
  if (!sh || !sh.cells || !sh.cells[selectedCellKey]) return;
  const state = getState();
  const newKey = nextEmptyAfter(sh, selectedCellKey, clampCols(state.settings.defaultColumns));
  if (!newKey) return;
  const bm = sh.cells[selectedCellKey];
  const dupTitle = bm.title + " (" + tx("duplicate").toLowerCase() + ")";
  await Storage.update((d) => {
    const cur = d.sheets.find(s => s.id === d.activeSheetId);
    if (cur) cur.cells[newKey] = { id: cryptoId(), title: dupTitle, url: bm.url };
  });
  setState(await Storage.get()); renderGrid();
  toast(tx("duplicated"));
}

/** Добавляет закладку в выбранную ячейку, а без выделения — в первую свободную (Insert). */
export function addSelected() {
  if (selectedCellKey) openAddModal(selectedCellKey);
  else onAddBookmarkTop();
}

/** Показывает контекстное меню выбранной ячейки (Shift+F10 / ContextMenu). */
export function openCellContextMenu() {
  if (!selectedCellKey) return;
  hideCtx(); hideCtxEmpty();
  const key = selectedCellKey;
  const bm = currentBookmarkAt(key);
  ctxCellKey = key;
  if (bm) {
    ctxBookmarkId = bm.id;
    positionMenu(ctxMenu, window.innerWidth / 2, window.innerHeight / 2);
    ctxMenu.hidden = false;
  } else {
    ctxBookmarkId = null;
    positionMenu(ctxEmpty, window.innerWidth / 2, window.innerHeight / 2);
    ctxEmpty.hidden = false;
  }
}

/** Ключ последней заполненной ячейки активного листа (для Ctrl+End). */
function lastFilledKey() {
  const sh = activeSheet();
  if (!sh || !sh.cells) return null;
  let best = null;
  for (const key of Object.keys(sh.cells)) {
    if (!best) { best = key; continue; }
    const a = keyParts(best);
    const b = keyParts(key);
    if (b[0] > a[0] || (b[0] === a[0] && b[1] > a[1])) best = key;
  }
  return best;
}

/** Выбирает ячейку и подкручивает к ней скролл (Ctrl+Home / Ctrl+End). */
function selectCellAndScroll(key) {
  selectCell(key);
  const el = cellElByKey(key);
  if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** Перемещает выделение на dr/dc ячеек (стрелки). */
export function moveSelection(dr, dc) {
  const sh = activeSheet();
  if (!sh) return;
  const state = getState();
  const cols = clampCols(state.settings.defaultColumns);
  let r = 0, c = 0;
  if (selectedCellKey) {
    const p = keyParts(selectedCellKey);
    r = p[0]; c = p[1];
  }
  const rows = Math.max(computeFillRows(sh), r + 1);
  const nr = Math.max(0, Math.min(rows - 1, r + dr));
  const nc = Math.max(0, Math.min(cols - 1, c + dc));
  const key = nr + "," + nc;
  selectCell(key);
  const el = cellElByKey(key);
  if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function onGridKeyDown(e) {
  // Не вмешиваемся, когда фокус на интерактивном элементе (поля ввода, кнопки,
  // ссылки, селекты) или открыты палитра поиска/модалки/меню.
  const ae = document.activeElement;
  if (ae) {
    const tag = ae.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A" || tag === "SELECT") return;
  }
  const modalOpen = !modalEl.hidden || !document.getElementById("sheetModal").hidden || !document.getElementById("confirmModal").hidden || !document.getElementById("shortcutModal").hidden;
  if (modalOpen) return;
  const searcherOpen = document.getElementById("searcher") && !document.getElementById("searcher").hidden;
  if (searcherOpen) return;
  if (!ctxMenu.hidden || !ctxEmpty.hidden || !sheetCtx.hidden) return;
  const k = e.key;
  const code = keyCode(e);

  // Ctrl+Enter / Shift+Enter — открыть в новой вкладке (независимо от настройки openInNewTab).
  if ((e.ctrlKey || e.metaKey || e.shiftKey) && k === "Enter") {
    e.preventDefault();
    openSelectedInNewTab();
    return;
  }

  // Ctrl-комбинации: Home — первая ячейка, End — последняя заполненная,
  // D — дублировать (KeyD — физическая клавиша, работает на любой раскладке).
  if (e.ctrlKey || e.metaKey) {
    switch (code) {
      case "Home":
        e.preventDefault();
        selectCellAndScroll("0,0");
        break;
      case "End": {
        e.preventDefault();
        const last = lastFilledKey();
        selectCellAndScroll(last || "0,0");
        break;
      }
      case "KeyD":
        e.preventDefault();
        duplicateSelected();
        break;
      default:
        break;
    }
    return;
  }

  switch (k) {
    case "ArrowUp": case "ArrowDown": case "ArrowLeft": case "ArrowRight":
      e.preventDefault();
      moveSelection(k === "ArrowUp" ? -1 : k === "ArrowDown" ? 1 : 0,
                    k === "ArrowLeft" ? -1 : k === "ArrowRight" ? 1 : 0);
      break;
    case "Home":
      e.preventDefault();
      moveSelection(0, -1000); // начало строки
      break;
    case "End":
      e.preventDefault();
      moveSelection(0, 1000); // конец строки
      break;
    case "Enter": case " ":
      e.preventDefault();
      openSelected();
      break;
    case "F2":
      e.preventDefault();
      editSelected();
      break;
    case "Delete": case "Backspace":
      e.preventDefault();
      deleteSelected();
      break;
    case "Insert":
      e.preventDefault();
      addSelected();
      break;
    case "F10":
      if (e.shiftKey) { e.preventDefault(); openCellContextMenu(); }
      break;
    case "ContextMenu":
      e.preventDefault();
      openCellContextMenu();
      break;
  }
}

// Переносит выделенный блок так, чтобы захваченная ячейка оказалась под курсором.
async function moveSelectionBlock(md, targetKey) {
  const sh = activeSheet();
  if (!sh || md.cells.length === 0) return;
  const [ar, ac] = keyParts(md.anchorKey);
  const [tr, tc] = keyParts(targetKey);
  const dr = tr - ar;
  const dc = tc - ac;
  if (dr === 0 && dc === 0) { renderGrid(); return; }

  const sourceKeys = new Set(md.cells.map(c => c.from));
  let blocked = false;
  await Storage.update((d) => {
    const cur = d.sheets.find(s => s.id === d.activeSheetId);
    if (!cur) return;
    // Проверяем целевые ячейки: нельзя класть на чужие занятые (вне блока).
    for (const c of md.cells) {
      const [r, col] = keyParts(c.from);
      const nk = (r + dr) + "," + (col + dc);
      if (sourceKeys.has(nk)) continue; // внутри блока — переедет вместе с блоком
      if (cur.cells[nk]) { blocked = true; return; }
    }
    if (blocked) return;
    for (const c of md.cells) delete cur.cells[c.from];
    for (const c of md.cells) {
      const [r, col] = keyParts(c.from);
      cur.cells[(r + dr) + "," + (col + dc)] = c.bm;
    }
  });

  if (blocked) {
    toast(tx("cellOccupied"), true);
    return;
  }
  setState(await Storage.get());
  renderGrid();
  toast(tx("moved"));
}

// Переносит выделенный блок закладок на другой лист (первая свободная ячейка).
async function moveBlockToSheet(md, sheetId) {
  const curSheetId = activeSheet() && activeSheet().id;
  if (!sheetId || sheetId === curSheetId || md.cells.length === 0) { renderGrid(); return; }
  const state = getState();
  const cols = clampCols(state.settings.defaultColumns);
  let blocked = false;
  let targetKeys = [];
  await Storage.update((d) => {
    const target = d.sheets.find(s => s.id === sheetId);
    const source = d.sheets.find(s => s.id === d.activeSheetId);
    if (!target || !source) return;
    // Ищем свободные ячейки на целевом листе под все закладки блока.
    let k = findFirstEmptyCell(target, computeFillRows(target), cols);
    for (let i = 0; i < md.cells.length; i++) {
      if (!k) { blocked = true; return; }
      targetKeys.push(k);
      k = nextEmptyAfter(target, k, cols);
    }
    for (const c of md.cells) {
      const bm = source.cells[c.from];
      if (bm && bm.id === c.bm.id) delete source.cells[c.from];
    }
    md.cells.forEach((c, i) => { target.cells[targetKeys[i]] = c.bm; });
  });

  if (blocked) {
    toast(tx("cellOccupied"), true);
    return;
  }
  setState(await Storage.get());
  renderGrid();
  toast(tx("moved"));
}

// Меняет местами две одиночные закладки на активном листе.
async function swapBookmarks(aKey, bKey) {
  await Storage.update((d) => {
    const cur = d.sheets.find(s => s.id === d.activeSheetId);
    if (!cur) return;
    const a = cur.cells[aKey];
    const b = cur.cells[bKey];
    if (!a || !b) return;
    cur.cells[aKey] = b;
    cur.cells[bKey] = a;
  });
  setState(await Storage.get());
  renderGrid();
  toast(tx("swapped"));
}

// ---------- модалка закладки ----------

function openAddModal(key) {
  editingBookmark = null;
  editingTargetKey = key || null;
  modalTitle.textContent = tx("modalAdd");
  tabForm.elements.title.value = "";
  tabForm.elements.url.value   = "";
  modalEl.hidden = false;
  // restart modal animation
  const card = modalEl.querySelector(".modal-card");
  if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
  // Defer focus to next tick so the modal can paint first.
  setTimeout(() => {
    try { tabForm.elements.title.focus({ preventScroll: true }); } catch (_) {}
    try { tabForm.elements.title.select(); } catch (_) {}
  }, 0);
}

function openEditModal(bm, key) {
  editingBookmark = { id: bm.id, key };
  editingTargetKey = key;
  modalTitle.textContent = tx("modalEdit");
  tabForm.elements.title.value = bm.title || "";
  tabForm.elements.url.value   = bm.url   || "";
  modalEl.hidden = false;
  const card = modalEl.querySelector(".modal-card");
  if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
  setTimeout(() => {
    try { tabForm.elements.title.focus({ preventScroll: true }); } catch (_) {}
    try { tabForm.elements.title.select(); } catch (_) {}
  }, 0);
}

export function closeModal() {
  modalEl.hidden = true;
  editingBookmark = null;
  editingTargetKey = null;
}

export async function onSubmitBookmark(e) {
  e.preventDefault();
  if (!tabForm) return;
  const titleEl = tabForm.elements.title;
  const urlEl   = tabForm.elements.url;
  if (!titleEl || !urlEl) return;
  const title = (titleEl.value || "").trim();
  const url   = (urlEl.value   || "").trim();
  if (!title || !url) return;

  await Storage.update((d) => {
    const cur = d.sheets.find(s => s.id === d.activeSheetId);
    if (!cur) return;
    if (editingBookmark) {
      const x = cur.cells[editingBookmark.key];
      if (x && x.id === editingBookmark.id) {
        x.title = title;
        x.url   = url;
      }
    } else {
      const state = getState();
      const k = editingTargetKey || findFirstEmptyCell(cur, computeFillRows(cur), clampCols(state.settings.defaultColumns)) || "0,0";
      cur.cells[k] = { id: cryptoId(), title, url };
    }
  });
  setState(await Storage.get());
  renderGrid();
  closeModal();
  toast(editingBookmark ? tx("saved") : tx("added"));
}

// ---------- события ----------

/** Слушает грид, контекстные меню ячеек и клики вне меню/модалок. */
export function bindGridEvents() {
  // Клик по ячейке: открытие закладки обрабатывается в onGridPointerUp.
  gridEl.addEventListener("click", onCellClick);
  gridEl.addEventListener("auxclick", onCellAuxClick);
  gridEl.addEventListener("contextmenu", onCellContextMenu);
  // Excel-подобное выделение диапазона и перенос выделенного блока.
  gridEl.addEventListener("pointerdown", onGridPointerDown);
  document.addEventListener("pointermove", onGridPointerMove);
  document.addEventListener("pointerup", onGridPointerUp);
  document.addEventListener("pointercancel", onCellPointerCancel);

  // Клавиатурная навигация: стрелки, Enter/пробел, F2.
  document.addEventListener("keydown", onGridKeyDown);

  // Свайп по пустой области сетки (не по ячейке) → переключение листов.
  gridEl.addEventListener("pointerdown", onGridSwipeDown);
  document.addEventListener("pointermove", onGridSwipeMove);
  document.addEventListener("pointerup", onGridSwipeUp);
  document.addEventListener("pointercancel", cancelSwipeSession);

  ctxMenu.addEventListener("click", onCtxAction);
  ctxEmpty.addEventListener("click", onCtxEmptyAction);

  gridEl.addEventListener("contextmenu", (e) => {
    if (!e.target.closest(".cell")) e.preventDefault();
  });

  document.addEventListener("mousedown", (e) => {
    const modalOpen = !document.getElementById("modal").hidden ||
      !document.getElementById("sheetModal").hidden ||
      !document.getElementById("confirmModal").hidden;
    if (modalOpen) return; // don't interfere with open modals
    if (!ctxMenu.hidden && !ctxMenu.contains(e.target)) hideCtx();
    if (!ctxEmpty.hidden && !ctxEmpty.contains(e.target)) hideCtxEmpty();
    if (!sheetCtx.hidden && !sheetCtx.contains(e.target)) hideSheetCtx();
    if (!e.target.closest(".cell") && !e.target.closest(".ctx-menu") && !e.target.closest(".modal")) {
      selectCell(null);
    }
  });
  document.addEventListener("scroll", () => {
    hideCtx(); hideCtxEmpty(); hideSheetCtx();
  }, true);
}

export { gridEl };
