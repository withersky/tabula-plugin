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
 * Внешний вид: типы фона, загрузка изображения, пресеты градиентов,
 * живой превью фона/шрифта и copyright Bing. Слушатели собирает
 * bindAppearanceEvents(), вызываемый из main.wireEvents().
 */

import { getState, setState, tx } from "./state.js";
import { fillForm, persistSettings } from "./form.js";
import { flash, flashSaved, cssEscape } from "./utils.js";
import { updateFontSelectCustomVisibility } from "./i18n.js";

const bgTypeSelect = document.getElementById("bgTypeSelect");
const uploadInput  = document.getElementById("uploadInput");
const pickUploadBtn = document.getElementById("pickUploadBtn");
const clearUploadBtn = document.getElementById("clearUploadBtn");
const uploadPreview  = document.getElementById("uploadPreview");
const uploadPreviewImg = document.getElementById("uploadPreviewImg");
const uploadInfo    = document.getElementById("uploadInfo");
const dropZone      = document.getElementById("dropZone");
const bingCopyright = document.getElementById("bingCopyright");
const macosInfo     = document.getElementById("macosInfo");
const macosRefreshBtn = document.getElementById("macosRefreshBtn");
const bgPreview     = document.getElementById("bgPreview");
const fontPreview   = document.getElementById("fontPreview");
const fontFamilySelect = document.getElementById("fontFamilyKeySelect");
const fontFamilyCustomWrap = document.getElementById("fontFamilyCustomWrap");

const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));


// ---------- background type visibility ----------
export function updateBgTypeVisibility() {
  const t = bgTypeSelect.value;
  $$(".bg-only").forEach(el => {
    el.hidden = !el.classList.contains("bg-" + t);
  });
}

// ---------- upload ----------
export function onUpload(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) { flash(tx("invalidImport"), true); return; }
  if (file.size > 2 * 1024 * 1024) { flash(tx("imageTooLarge"), true); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = String(reader.result || "");
    await Storage.update((d) => {
      d.settings.backgroundType = "imageUpload";
      d.settings.backgroundImage = dataUrl;
    });
    setState(await Storage.get());
    fillForm();
    updateBgTypeVisibility();
    updateUploadPreview();
    updateBgPreview();
    flashSaved();
  };
  reader.onerror = () => flash(tx("importFailed") + reader.error, true);
  reader.readAsDataURL(file);
}

export async function onClearUpload() {
  await Storage.update((d) => {
    d.settings.backgroundImage = "";
    if (d.settings.backgroundType === "imageUpload") d.settings.backgroundType = "color";
  });
  setState(await Storage.get());
  fillForm();
  updateBgTypeVisibility();
  updateUploadPreview();
  updateBgPreview();
  flashSaved();
}

export function updateUploadPreview() {
  const s = getState().settings;
  if (s.backgroundType === "imageUpload" && s.backgroundImage) {
    uploadPreview.hidden = false;
    uploadPreviewImg.src = s.backgroundImage;
    const kb = Math.round((s.backgroundImage.length * 3) / 4 / 1024);
    uploadInfo.textContent = "~" + kb + " KB";
  } else {
    uploadPreview.hidden = true;
    uploadPreviewImg.src = "";
  }
}

export function updateBingCopyright() {
  const c = getState().bingCache;
  if (c && c.copyright) bingCopyright.textContent = c.copyright;
  else bingCopyright.textContent = "";
}

// ---------- macOS-обои: инфо и ручное обновление коллекции ----------
export function updateMacosInfo() {
  if (!macosInfo) return;
  const c = getState().macosCache;
  if (c && Array.isArray(c.list) && c.list.length) {
    const count = tx("macosCount")({ n: c.list.length });
    const title = c.url ? " · " + globalThis.macosWallpaperTitle(c.url) : "";
    macosInfo.textContent = count + title;
  } else {
    macosInfo.textContent = "";
  }
}

// Перевыкачивает коллекцию обоев, выбирает случайный и сразу применяет.
export async function onRefreshMacos() {
  try {
    const resp = await ext.runtime.sendMessage({ type: "macosWallpapers", refresh: true });
    if (!resp || resp.error || !Array.isArray(resp.list) || !resp.list.length) {
      throw new Error(resp && resp.error || "no list");
    }
    const list = resp.list;
    const date = globalThis.todayKey();
    const url  = globalThis.pickForDate(list, date);
    // Сразу строим превью, чтобы новая вкладка открывалась мгновенно,
    // как Bing, а не перекачивала оригинал 4K при каждом открытии.
    const preview = await makeMacosPreview(url).catch(() => null);
    await Storage.update((d) => { d.macosCache = { date, url, list, preview }; });
    setState(await Storage.get());
    updateMacosInfo();
    updateBgPreview();
    flashSaved();
  } catch (err) {
    flash(tx("macosFailed"), true);
  }
}

// ---------- macOS-обои: превью 1600px для мгновенной загрузки ----------
// Дубликат макос-хелпера из newtab/js/background.js (страницы не делят
// модули): при выборе обоев дня строим JPEG data URL (<=1600px) и храним
// в macosCache.preview — фон применяется мгновенно, без повторной загрузки
// оригинала 4K.
const MACOS_PREVIEW_MAX = 1600;

function macosPreviewSrc(src) {
  const scale = Math.min(1, MACOS_PREVIEW_MAX / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(src, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.75);
}

async function makeMacosPreview(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("macos preview http " + res.status);
  const blob = await res.blob();
  let src;
  if (typeof createImageBitmap === "function") {
    src = await createImageBitmap(blob);
  } else {
    const objUrl = URL.createObjectURL(blob);
    src = new Image();
    await new Promise((resolve, reject) => {
      src.onload = resolve;
      src.onerror = () => reject(new Error("macos preview decode failed"));
      src.src = objUrl;
    });
    URL.revokeObjectURL(objUrl);
  }
  try {
    return macosPreviewSrc(src);
  } finally {
    if (src && typeof src.close === "function") src.close();
  }
}

// ---------- previews ----------
export function updateAllPreviews() {
  updateBgPreview();
  updateFontPreview();
}

export function updateBgPreview() {
  if (!bgPreview) return;
  const s = getState().settings;
  const t = s.backgroundType || "color";
  if (t === "bing") {
    const cached = getState().bingCache;
    if (cached && cached.url) {
      bgPreview.style.background = `url("${cssEscape(cached.url)}") center / cover no-repeat, ${s.backgroundColor}`;
    } else {
      bgPreview.style.background = s.backgroundColor;
    }
  } else if (t === "macos") {
    const cached = getState().macosCache;
    if (cached && cached.url) {
      bgPreview.style.background = `url("${cssEscape(cached.preview || cached.url)}") center / cover no-repeat, ${s.backgroundColor}`;
    } else {
      bgPreview.style.background = s.backgroundColor;
    }
  } else if ((t === "imageUrl" || t === "imageUpload") && s.backgroundImage) {
    bgPreview.style.background = `url("${cssEscape(s.backgroundImage)}") center / cover no-repeat, ${s.backgroundColor}`;
  } else if (t === "gradient") {
    bgPreview.style.background = `${s.backgroundGradient}, ${s.backgroundColor}`;
  } else {
    bgPreview.style.background = s.backgroundColor;
  }
}

export function updateFontPreview() {
  if (!fontPreview) return;
  const s = getState().settings;
  fontPreview.style.fontFamily = resolveFont(s.fontFamilyKey, s.fontFamily);
  fontPreview.style.fontSize = Math.min(40, s.fontSize * 2.4) + "px";
  fontPreview.style.color = s.textColor;
}

// ---------- presets ----------
function wirePresets() {
  $$(".chip[data-bg]").forEach(chip => {
    chip.addEventListener("click", async () => {
      const bgType = chip.dataset.bg;
      const val = chip.dataset.val || "";
      bgTypeSelect.value = bgType;
      const el = document.querySelector('[name="backgroundGradient"]');
      if (el) el.value = val;
      await persistSettings();
      updateBgTypeVisibility();
      updateBgPreview();
      flashSaved();
    });
  });
}

// ---------- dropzone ----------
function wireDropzone() {
  if (!dropZone) return;
  dropZone.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    uploadInput.click();
  });
  pickUploadBtn.addEventListener("click", () => uploadInput.click());
  ["dragenter", "dragover"].forEach(ev => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add("drag");
    });
  });
  ["dragleave", "drop"].forEach(ev => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === "dragleave" && dropZone.contains(e.relatedTarget)) return;
      dropZone.classList.remove("drag");
    });
  });
  dropZone.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) onUpload(f);
  });
}

/** Слушает фоновые контролы: тип фона, загрузку, пресеты, селект шрифта. */
export function bindAppearanceEvents() {
  bgTypeSelect.addEventListener("change", async () => {
    updateBgTypeVisibility();
    await persistSettings();
    updateBgPreview();
    flashSaved();
  });
  uploadInput.addEventListener("change", () => {
    const f = uploadInput.files && uploadInput.files[0];
    onUpload(f);
    uploadInput.value = "";
  });
  clearUploadBtn.addEventListener("click", onClearUpload);
  if (macosRefreshBtn) macosRefreshBtn.addEventListener("click", onRefreshMacos);
  wireDropzone();
  wirePresets();
  if (fontFamilySelect) {
    fontFamilySelect.addEventListener("change", () => {
      updateFontSelectCustomVisibility(fontFamilySelect, fontFamilyCustomWrap);
    });
  }
}
