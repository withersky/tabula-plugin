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
 * Вкладка «Данные»: сброс, экспорт/импорт конфига и импорт из закладок
 * браузера (папка → новый лист). Слушатели собирает bindDataEvents(),
 * вызываемый из main.wireEvents().
 */

import { getState, setState, setLang, tx } from "./state.js";
import { confirmDialog } from "./confirm.js";
import { fillForm } from "./form.js";
import { applyI18nStatic } from "./i18n.js";
import {
  updateBgTypeVisibility, updateUploadPreview, updateBingCopyright, updateAllPreviews
} from "./appearance.js";
import { flash } from "./utils.js";

const resetBtn    = document.getElementById("resetBtn");
const exportBtn   = document.getElementById("exportBtn");
const importBtn   = document.getElementById("importBtn");
const importFile  = document.getElementById("importFile");
const importBookmarksBtn  = document.getElementById("importBookmarksBtn");
const bookmarksModal      = document.getElementById("bookmarksModal");
const bookmarksFolderSelect = document.getElementById("bookmarksFolderSelect");
const bookmarksFolderInfo = document.getElementById("bookmarksFolderInfo");
const bookmarksCancelBtn  = document.getElementById("bookmarksCancelBtn");
const bookmarksImportBtn  = document.getElementById("bookmarksImportBtn");
const clearFaviconCacheBtn = document.getElementById("clearFaviconCacheBtn");

let _bookmarkTreeRoot = null;
let _bookmarkFolders = [];

// Перезаполняет форму и превью после смены данных (reset / import / ...).
function reloadViews() {
  applyI18nStatic();
  fillForm();
  updateBgTypeVisibility();
  updateUploadPreview();
  updateBingCopyright();
  updateAllPreviews();
}

export async function onReset() {
  if (!(await confirmDialog(tx("confirmReset")))) return;
  setState(await Storage.reset());
  setLang(getState().settings.language || "ru");
  reloadViews();
  flash(tx("resetDone"));
}

/** Сбрасывает кэш фавиконок (ключ tabula_favicons в storage). */
export async function onClearFaviconCache() {
  try {
    await ext.storage.local.remove("tabula_favicons");
    flash(tx("faviconCacheCleared"));
  } catch (_) {
    flash(tx("importFailed") + "favicons", true);
  }
}

// ---------- export / import ----------
export function onExport() {
  const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tabula-" + new Date().toISOString().slice(0,10) + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  flash(tx("exported"));
}

export function onImportClick() { importFile.click(); }

export function bindImportFile() {
  importFile.addEventListener("change", async () => {
    const f = importFile.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.sheets) || !parsed.settings) {
        throw new Error(tx("invalidImport"));
      }
      if (!(await confirmDialog(tx("confirmImport")))) return;
      await Storage.set(parsed);
      setState(await Storage.get());
      setLang(getState().settings.language || "ru");
      reloadViews();
      flash(tx("imported"));
    } catch (err) {
      flash(tx("importFailed") + (err && err.message || err), true);
    } finally {
      importFile.value = "";
    }
  });
}

// ---------- bookmarks import ----------
function collectBookmarkFolders(node, parentPath, out) {
  if (!node || !Array.isArray(node.children)) return out;
  node.children.forEach((child) => {
    if (!child || !Array.isArray(child.children)) return; // не папка, а закладка
    const name = (child.title || "").trim() || tx("bookmarksSheetDefault");
    const path = parentPath ? parentPath + " / " + name : name;
    let count = 0;
    (function walk(n) {
      if (n.url) { count++; return; }
      if (n.children) n.children.forEach(walk);
    })(child);
    out.push({ id: child.id, name: name, path: path, count: count });
    collectBookmarkFolders(child, path, out);
  });
  return out;
}

function collectBookmarkUrls(node, out) {
  if (!node) return out;
  if (node.url) {
    out.push({ title: (node.title || "").trim() || node.url, url: node.url });
    return out;
  }
  if (node.children) node.children.forEach((child) => collectBookmarkUrls(child, out));
  return out;
}

function findBookmarkNode(node, id) {
  if (!node) return null;
  if (String(node.id) === String(id)) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findBookmarkNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

export async function openBookmarksModal() {
  if (!bookmarksModal) return;
  bookmarksModal.hidden = false;
  if (bookmarksImportBtn) bookmarksImportBtn.disabled = true;
  if (bookmarksFolderInfo) { bookmarksFolderInfo.hidden = true; bookmarksFolderInfo.textContent = ""; }
  if (_bookmarkTreeRoot) { renderBookmarkFolders(); return; }
  try {
    const tree = await ext.bookmarks.getTree();
    _bookmarkTreeRoot = (tree && tree[0]) || null;
    _bookmarkFolders = collectBookmarkFolders(_bookmarkTreeRoot, "", []);
    renderBookmarkFolders();
  } catch (e) {
    flash(tx("bookmarksUnavailable"), true);
    closeBookmarksModal();
  }
}

function renderBookmarkFolders() {
  if (!bookmarksFolderSelect) return;
  bookmarksFolderSelect.innerHTML = "";
  if (_bookmarkFolders.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = tx("bookmarksFolderEmpty");
    bookmarksFolderSelect.appendChild(opt);
    if (bookmarksImportBtn) bookmarksImportBtn.disabled = true;
    return;
  }
  _bookmarkFolders.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = String(f.id);
    opt.textContent = f.path + " (" + f.count + ")";
    bookmarksFolderSelect.appendChild(opt);
  });
  bookmarksFolderSelect.selectedIndex = 0;
  onBookmarksFolderChange();
}

export function onBookmarksFolderChange() {
  if (!bookmarksFolderSelect || !bookmarksFolderInfo || !bookmarksImportBtn) return;
  const id = bookmarksFolderSelect.value;
  const folder = _bookmarkFolders.find((f) => String(f.id) === String(id));
  if (!folder || folder.count === 0) {
    bookmarksFolderInfo.textContent = tx("bookmarksFolderEmpty");
    bookmarksFolderInfo.hidden = false;
    bookmarksImportBtn.disabled = true;
    return;
  }
  bookmarksFolderInfo.textContent = tx("bookmarksFolderInfo")({ n: folder.count });
  bookmarksFolderInfo.hidden = false;
  bookmarksImportBtn.disabled = false;
}

export async function onBookmarksImport() {
  if (!bookmarksFolderSelect || !_bookmarkTreeRoot) return;
  const id = bookmarksFolderSelect.value;
  const folder = _bookmarkFolders.find((f) => String(f.id) === String(id));
  if (!folder || folder.count === 0) return;
  const node = findBookmarkNode(_bookmarkTreeRoot, id);
  if (!node) { flash(tx("bookmarksUnavailable"), true); return; }
  const urls = collectBookmarkUrls(node, []);
  if (urls.length === 0) { flash(tx("bookmarksFolderEmpty"), true); return; }
  if (!(await confirmDialog(tx("bookmarksConfirm")({ name: folder.name, n: urls.length })))) return;
  try {
    await Storage.update((d) => {
      const cols = clampCols(Number(d.settings.defaultColumns) || 8);
      const sheet = makeBlankSheet(folder.name, cols, "⭐");
      urls.forEach((bm, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        sheet.cells[r + "," + c] = { id: cryptoId(), title: bm.title, url: bm.url };
      });
      d.sheets.push(sheet);
    });
    flash(tx("bookmarksImported")({ n: urls.length }));
    closeBookmarksModal();
  } catch (e) {
    flash(tx("importFailed"), true);
  }
}

export function closeBookmarksModal() {
  if (!bookmarksModal) return;
  bookmarksModal.hidden = true;
}

/** Слушает кнопки данных и модалку импорта закладок. */
export function bindDataEvents() {
  if (resetBtn)   resetBtn.addEventListener("click", onReset);
  if (exportBtn)  exportBtn.addEventListener("click", onExport);
  if (importBtn)  importBtn.addEventListener("click", onImportClick);
  bindImportFile();
  if (clearFaviconCacheBtn) clearFaviconCacheBtn.addEventListener("click", onClearFaviconCache);

  if (importBookmarksBtn) importBookmarksBtn.addEventListener("click", openBookmarksModal);
  if (bookmarksCancelBtn) bookmarksCancelBtn.addEventListener("click", closeBookmarksModal);
  if (bookmarksImportBtn) bookmarksImportBtn.addEventListener("click", onBookmarksImport);
  if (bookmarksFolderSelect) bookmarksFolderSelect.addEventListener("change", onBookmarksFolderChange);
  if (bookmarksModal) {
    bookmarksModal.addEventListener("click", (e) => {
      if (e.target === bookmarksModal) closeBookmarksModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && bookmarksModal && !bookmarksModal.hidden) closeBookmarksModal();
  });
}
