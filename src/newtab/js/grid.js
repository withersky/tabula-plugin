/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Грид ячеек: рендер активного листа, Excel-подобное выделение и перенос
 * блоков, контекстные меню ячеек, модалки добавления/редактирования закладки.
 */

import { getState, setState, activeSheet } from "./state.js";
import { tx } from "./i18n.js";
import { toast, cssEscape, cssAttr } from "./utils.js";

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

// ---------- рендер ----------

export function renderGrid() {
  selectedCellKey = null;
  selAnchorKey = null;
  selRange = [];
  pointerState = null;
  moveDrag = null;
  gridEl.innerHTML = "";
  const state = getState();
  const sh = activeSheet();
  if (!sh) return;

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
    gridEl.appendChild(headerRow);
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
      rowEl.appendChild(createCellEl(key, bm));
    }
    gridEl.appendChild(rowEl);
  }
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
      const img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      const src = faviconUrl(bm.url);
      if (src) {
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

// ---------- выделение ----------

function clearCellSelection() {
  gridEl.querySelectorAll(".cell.selected").forEach(el => el.classList.remove("selected", "active"));
}

function cellElByKey(key) {
  return gridEl.querySelector('.cell[data-key="' + cssAttr(key) + '"]');
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
  gridEl.querySelectorAll(".cell.drop-target").forEach(el => el.classList.remove("drop-target"));
}

function clearDraggingCells() {
  gridEl.querySelectorAll(".cell.dragging").forEach(el => el.classList.remove("dragging"));
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
    lastKey: key,
    moved: false
  };
}

function onGridPointerMove(e) {
  if (!pointerState) return;
  const dx = e.clientX - pointerState.startX;
  const dy = e.clientY - pointerState.startY;
  if (!pointerState.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
    pointerState.moved = true;
    if (pointerState.mode === "move") {
      moveDrag = { cells: selectionFilledCells(), anchorKey: pointerState.anchorKey };
      gridEl.querySelectorAll(".cell.selected").forEach(el => el.classList.add("dragging"));
    }
  }
  if (!pointerState.moved) return;
  e.preventDefault(); // запрещаем выделение текста/нативный drag во время перетаскивания
  const cell = cellAtPoint(e.clientX, e.clientY);
  const key = cell ? cell.dataset.key : null;
  if (!key || key === pointerState.lastKey) return;
  pointerState.lastKey = key;
  if (pointerState.mode === "select") {
    selectRange(pointerState.anchorKey, key);
  } else {
    clearMoveTargets();
    if (key !== pointerState.anchorKey) {
      const t = cellElByKey(key);
      if (t) t.classList.add("drop-target");
    }
  }
}

async function onGridPointerUp(e) {
  if (!pointerState || e.button !== 0) return;
  const st = pointerState;
  pointerState = null;
  const cell = cellAtPoint(e.clientX, e.clientY);
  const targetKey = cell ? cell.dataset.key : st.lastKey;

  if (st.mode === "move" && st.moved && moveDrag) {
    const md = moveDrag;
    moveDrag = null;
    clearMoveTargets();
    clearDraggingCells();
    if (targetKey && targetKey !== md.anchorKey) {
      await moveSelectionBlock(md, targetKey);
    } else {
      renderGrid();
    }
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
    return;
  }

  // Обычный клик без перетаскивания: выделить и открыть закладку, если есть.
  clearMoveTargets();
  clearDraggingCells();
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
  pointerState = null;
  moveDrag = null;
  clearMoveTargets();
  clearDraggingCells();
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 50);
}

function openBookmarkAt(key) {
  const bm = currentBookmarkAt(key);
  if (!bm) return;
  const state = getState();
  const target = normalizeUrl(bm.url);
  if (state.settings.openInNewTab) window.open(target, "_blank", "noopener");
  else window.location.href = target;
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
