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
 */

(() => {
  "use strict";

  const RANGE_KEYS = ["defaultColumns", "uiOpacity", "fontSize", "clockSize", "weatherSize", "weatherRefreshMin", "weatherForecastDays", "cellSelectedColor", "gridRows"];
  const TEXT_KEYS = ["fontFamily",
                     "backgroundColor", "backgroundGradient", "backgroundImage"];
  const NUMBER_KEYS = ["weatherLat", "weatherLon"];
  const SELECT_KEYS = ["backgroundType", "bingMkt"];
  const CHECK_KEYS  = ["showFavicon", "openInNewTab", "showRowNumbers",
                       "showColLetters", "showSheetTabs", "showQuickGo", "showGrid",
                       "showClock", "showWeather"];

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const resetBtn    = $("#resetBtn");
  const exportBtn   = $("#exportBtn");
  const importBtn   = $("#importBtn");
  const importFile  = $("#importFile");
  const weatherGeoBtn = $("#weatherGeoBtn");
  const geoModal       = $("#geoModal");
  const geoForm        = $("#geoForm");
  const geoCityInput   = $("#geoCityInput");
  const geoCancelBtn   = $("#geoCancelBtn");
  const geoStatus      = $("#geoStatus");
  const geoResults     = $("#geoResults");
  const geoSearchBtn   = $("#geoSearchBtn");
  const confirmModal     = $("#confirmModal");
  const confirmText      = $("#confirmText");
  const confirmOkBtn     = $("#confirmOkBtn");
  const confirmCancelBtn = $("#confirmCancelBtn");
  const importBookmarksBtn  = $("#importBookmarksBtn");
  const bookmarksModal      = $("#bookmarksModal");
  const bookmarksFolderSelect = $("#bookmarksFolderSelect");
  const bookmarksFolderInfo = $("#bookmarksFolderInfo");
  const bookmarksCancelBtn  = $("#bookmarksCancelBtn");
  const bookmarksImportBtn  = $("#bookmarksImportBtn");
  let   _geoInFlight = false;
  let   _geoLastQuery = "";
  let   _bookmarkTreeRoot = null;
  let   _bookmarkFolders = [];
  const statusEl    = $("#status");
  const bgTypeSelect = $("#bgTypeSelect");
  const uploadInput  = $("#uploadInput");
  const pickUploadBtn = $("#pickUploadBtn");
  const clearUploadBtn = $("#clearUploadBtn");
  const uploadPreview  = $("#uploadPreview");
  const uploadPreviewImg = $("#uploadPreviewImg");
  const uploadInfo    = $("#uploadInfo");
  const dropZone      = $("#dropZone");
  const bingCopyright = $("#bingCopyright");
  const autoSaveHint  = $("#autoSaveHint");
  const bgPreview     = $("#bgPreview");
  const fontPreview   = $("#fontPreview");
  const fontFamilySelect = $("#fontFamilyKeySelect");
  const fontFamilyCustomWrap = $("#fontFamilyCustomWrap");
  const aboutVersionEl  = $("#aboutVersion");
  const aboutRepoLink   = $("#aboutRepoLink");
  const searchWrap      = $("#searchWrap");
  const searchInput     = $("#settingsSearch");
  const searchResults   = $("#searchResults");

  let state = null;
  let lang  = "ru";
  let saveTimer;
  let dirtyFlashTimer;
  let searchIndex = [];
  let searchTimer;
  let searchActiveIdx = -1;
  const TAB_IDS = ["appearance", "grid", "typography", "widgets", "language", "data", "about"];

  function tx(key) { return t(key, lang); }

  function applyI18nStatic() {
    $$("[data-i18n]").forEach(el => { el.textContent = tx(el.dataset.i18n); });
    $$("[data-i18n-placeholder]").forEach(el => {
      el.placeholder = tx(el.dataset.i18nPlaceholder);
    });
    $$("[data-i18n-title]").forEach(el => { el.title = tx(el.dataset.i18nTitle); });
    document.documentElement.lang = lang;
    document.title = tx("settingsTitle");
    populateFontSelect(fontFamilySelect);
    updateFontSelectCustomVisibility(fontFamilySelect, fontFamilyCustomWrap);
    buildSearchIndex();
  }

  // ---------- font selects ----------
  function populateFontSelect(sel) {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = "";
    FONT_FAMILIES.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.key;
      opt.textContent = tx(f.i18n);
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  }

  function updateFontSelectCustomVisibility(sel, wrap) {
    if (!sel || !wrap) return;
    wrap.hidden = sel.value !== "custom";
  }

  // ---------- about block ----------
  function populateAbout() {
    if (aboutVersionEl) {
      const v = (typeof ext !== "undefined" && ext.runtime && ext.runtime.getManifest) ? ext.runtime.getManifest().version : "";
      aboutVersionEl.textContent = v || "—";
    }
  }

  // ---------- init ----------
  async function init() {
    state = await Storage.get();
    lang = state.settings.language || "ru";
    
    applyI18nStatic();
    fillForm();
    wireEvents();
    wirePresets();
    wireTabs();
    wireSearch();
    updateBgTypeVisibility();
    updateUploadPreview();
    updateBingCopyright();
    
    updateAllPreviews();
    populateAbout();

    Storage.onChanged((next) => {
      if (!next) return;
      const langChanged = (next.settings && next.settings.language) !== lang;
      state = {
        sheets:        Array.isArray(next.sheets) ? next.sheets : state.sheets,
        activeSheetId: next.activeSheetId || state.activeSheetId,
        settings:      Object.assign({}, state.settings, next.settings || {}),
        bingCache:     next.bingCache !== undefined ? next.bingCache : state.bingCache
      };
      lang = state.settings.language || "ru";
      if (langChanged) applyI18nStatic();
      fillForm();
      updateBgTypeVisibility();
      updateUploadPreview();
      updateBingCopyright();
      updateAllPreviews();
    });
  }

  // ---------- form fill / collect ----------
  function fillForm() {
    const s = state.settings;
    for (const key of Object.keys(s)) {
      const els = $$('[name="' + key + '"]');
      if (els.length === 0) continue;
      const first = els[0];
      if (first.type === "checkbox") {
        first.checked = !!s[key];
      } else if (first.type === "radio") {
        els.forEach(el => { el.checked = (el.value === s[key]); });
      } else {
        first.value = s[key] != null ? s[key] : "";
      }
    }
    refreshRangeOutputs();
    syncWidgetCollapsed();
  }

  // ---------- widget collapsed state ----------
  // Сворачивает блок виджета в строку, если тоггл выключен.
  function syncWidgetCollapsed() {
    const map = [
      ["showClock",   "#widget-clock"],
      ["showQuickGo", "#widget-search"],
      ["showWeather", "#widget-weather"]
    ];
    for (const [key, sel] of map) {
      const block = $(sel);
      if (!block) continue;
      const input = $('input[name="' + key + '"]');
      const on = !!(input && input.checked);
      block.classList.toggle("is-collapsed", !on);
    }
  }

  function collectSettings() {
    const settings = Object.assign({}, state.settings);
    for (const key of Object.keys(settings)) {
      const els = $$('[name="' + key + '"]');
      if (els.length === 0) continue;
      const first = els[0];
      let v;
      if (first.type === "checkbox") {
        v = first.checked;
      } else if (first.type === "radio") {
        const checked = els.find(el => el.checked);
        if (checked) v = checked.value;
        else continue;
      }
      else if (first.type === "range" || first.type === "number") v = Number(first.value);
      else v = first.value;
      settings[key] = v;
    }
    return settings;
  }

  function refreshRangeOutputs() {
    for (const k of RANGE_KEYS) {
      const el = document.querySelector('[name="' + k + '"]');
      const out = document.querySelector('[data-out="' + k + '"]');
      if (el && out) out.textContent = el.value;
    }
  }

  // ---------- background type visibility ----------
  function updateBgTypeVisibility() {
    const t = bgTypeSelect.value;
    $$(".bg-only").forEach(el => {
      el.hidden = !el.classList.contains("bg-" + t);
    });
  }

  // ---------- upload ----------
  function onUpload(file) {
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
      state = await Storage.get();
      fillForm();
      updateBgTypeVisibility();
      updateUploadPreview();
      updateBgPreview();
      flashSaved();
    };
    reader.onerror = () => flash(tx("importFailed") + reader.error, true);
    reader.readAsDataURL(file);
  }

  async function onClearUpload() {
    await Storage.update((d) => {
      d.settings.backgroundImage = "";
      if (d.settings.backgroundType === "imageUpload") d.settings.backgroundType = "color";
    });
    state = await Storage.get();
    fillForm();
    updateBgTypeVisibility();
    updateUploadPreview();
    updateBgPreview();
    flashSaved();
  }

  function updateUploadPreview() {
    const s = state.settings;
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

  function updateBingCopyright() {
    const c = state.bingCache;
    if (c && c.copyright) bingCopyright.textContent = c.copyright;
    else bingCopyright.textContent = "";
  }

  // ---------- previews ----------
  function updateAllPreviews() {
    updateBgPreview();
    updateFontPreview();
  }

  function updateBgPreview() {
    if (!bgPreview) return;
    const s = state.settings;
    const t = s.backgroundType || "color";
    if (t === "bing") {
      const cached = state.bingCache;
      if (cached && cached.url) {
        bgPreview.style.background = `url("${cssEscape(cached.url)}") center / cover no-repeat, ${s.backgroundColor}`;
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

  function updateFontPreview() {
    if (!fontPreview) return;
    const s = state.settings;
    fontPreview.style.fontFamily = resolveFont(s.fontFamilyKey, s.fontFamily);
    fontPreview.style.fontSize = Math.min(40, s.fontSize * 2.4) + "px";
    fontPreview.style.color = s.textColor;
  }

  function cssEscape(v) { return String(v).replace(/"/g, '\\"'); }

  // ---------- save / reset ----------
  async function persistSettings() {
    const settings = collectSettings();
    await Storage.update((d) => { d.settings = settings; });
    state.settings = settings;
    refreshRangeOutputs();
    updateAllPreviews();
  }

  function flashSaved() {
    if (!autoSaveHint) return;
    autoSaveHint.classList.add("flash");
    clearTimeout(dirtyFlashTimer);
    dirtyFlashTimer = setTimeout(() => autoSaveHint.classList.remove("flash"), 900);
  }

  async function onReset() {
    if (!(await confirmDialog(tx("confirmReset")))) return;
    state = await Storage.reset();
    lang = state.settings.language || "ru";
    applyI18nStatic();
    fillForm();
    updateBgTypeVisibility();
    updateUploadPreview();
    updateBingCopyright();
    updateAllPreviews();
    flash(tx("resetDone"));
  }

  // ---------- export / import ----------
  function onExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tabula-" + new Date().toISOString().slice(0,10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    flash(tx("exported"));
  }

  function onImportClick() { importFile.click(); }

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

  // ---------- tabs ----------
  function switchTab(tabId, opts) {
    const scroll = !opts || opts.scroll !== false;
    const id = TAB_IDS.indexOf(tabId) >= 0 ? tabId : "appearance";
    $$(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === id));
    $$(".tab-panel").forEach(p => { p.hidden = p.dataset.tab !== id; });
    try { history.replaceState(null, "", "#tab=" + id); } catch (_) {}
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function wireTabs() {
    $$(".tab").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    const m = (location.hash || "").match(/^#tab=([\w-]+)/);
    const initial = m && TAB_IDS.indexOf(m[1]) >= 0 ? m[1] : "appearance";
    $$(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === initial));
    $$(".tab-panel").forEach(p => { p.hidden = p.dataset.tab !== initial; });
  }

  // ---------- settings search ----------
  function tabName(tabId) {
    const key = "nav" + tabId.charAt(0).toUpperCase() + tabId.slice(1);
    const label = tx(key);
    return label || tabId;
  }

  function normSearch(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function buildSearchIndex() {
    searchIndex = [];
    $$(".tab-panel").forEach(panel => {
      const tabId = panel.dataset.tab;
      const tabLabel = tabName(tabId);
      const push = (el) => {
        const label = el.textContent.replace(/\s+/g, " ").trim();
        if (label) searchIndex.push({ tabId: tabId, tabLabel: tabLabel, label: label, title: normSearch(label), el: el });
      };
      // Блоки виджетов — единым элементом поиска
      $$(".widget-block", panel).forEach(push);
      // Обычные контролы (label) вне блоков виджетов
      $$("label", panel).forEach(l => {
        if (l.closest(".widget-block")) return;
        push(l);
      });
      // Кнопки действий с данными
      $$(".data-actions .btn", panel).forEach(push);
    });
  }

  function hideSearchResults() {
    if (!searchResults) return;
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    searchActiveIdx = -1;
  }

  function renderSearchResults(query) {
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

  function activateSearchResult(m) {
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

  function wireSearch() {
    if (!searchInput || !searchResults) return;
    let t;
    searchInput.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => { renderSearchResults(searchInput.value); }, 120);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = $$(".search-result", searchResults);
        if (items.length === 0) return;
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        searchActiveIdx = (searchActiveIdx + delta + items.length) % items.length;
        items.forEach((it, i) => it.classList.toggle("active", i === searchActiveIdx));
        try { items[searchActiveIdx].scrollIntoView({ block: "nearest" }); } catch (_) {}
      } else if (e.key === "Enter") {
        const items = $$(".search-result", searchResults);
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

  // ---------- wiring ----------
  function wireEvents() {
    if (resetBtn)   resetBtn.addEventListener("click", onReset);
    if (exportBtn)  exportBtn.addEventListener("click", onExport);
    if (importBtn)  importBtn.addEventListener("click", onImportClick);

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
        state = await Storage.get();
        lang = state.settings.language || "ru";
        applyI18nStatic();
        fillForm();
        updateBgTypeVisibility();
        updateUploadPreview();
        updateBingCopyright();
        updateAllPreviews();
        flash(tx("imported"));
      } catch (err) {
        flash(tx("importFailed") + (err && err.message || err), true);
      } finally {
        importFile.value = "";
      }
    });

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
    wireDropzone();

    let t;
    const allControls = $$("input, select").filter(el =>
      el !== uploadInput && el !== importFile && el !== searchInput);
    allControls.forEach((el) => {
      const handler = () => {
        clearTimeout(t);
        t = setTimeout(async () => {
          await persistSettings();
          flashSaved();
        }, 220);
      };
      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    });

    RANGE_KEYS.forEach(k => {
      const el = document.querySelector('[name="' + k + '"]');
      if (!el) return;
      el.addEventListener("input", () => {
        const out = document.querySelector('[data-out="' + k + '"]');
        if (out) out.textContent = el.value;
      });
    });

    // Мгновенно сворачивать/разворачивать блок виджета по клику на тоггл
    ["showClock", "showQuickGo", "showWeather"].forEach(k => {
      const el = document.querySelector('input[name="' + k + '"]');
      if (!el) return;
      el.addEventListener("change", syncWidgetCollapsed);
    });

    if (weatherGeoBtn) {
      weatherGeoBtn.addEventListener("click", () => openGeoModal());
    }
    if (geoCancelBtn) {
      geoCancelBtn.addEventListener("click", closeGeoModal);
    }
    if (geoModal) {
      geoModal.addEventListener("click", (e) => {
        if (e.target === geoModal) closeGeoModal();
      });
    }
    if (geoForm) {
      geoForm.addEventListener("submit", (e) => {
        e.preventDefault();
        runGeoSearch();
      });
    }
    if (importBookmarksBtn) {
      importBookmarksBtn.addEventListener("click", openBookmarksModal);
    }
    if (bookmarksCancelBtn) {
      bookmarksCancelBtn.addEventListener("click", closeBookmarksModal);
    }
    if (bookmarksImportBtn) {
      bookmarksImportBtn.addEventListener("click", onBookmarksImport);
    }
    if (bookmarksFolderSelect) {
      bookmarksFolderSelect.addEventListener("change", onBookmarksFolderChange);
    }
    if (bookmarksModal) {
      bookmarksModal.addEventListener("click", (e) => {
        if (e.target === bookmarksModal) closeBookmarksModal();
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && geoModal && !geoModal.hidden) closeGeoModal();
      if (e.key === "Escape" && bookmarksModal && !bookmarksModal.hidden) closeBookmarksModal();
    });

    if (fontFamilySelect) {
      fontFamilySelect.addEventListener("change", () => {
        updateFontSelectCustomVisibility(fontFamilySelect, fontFamilyCustomWrap);
      });
    }
  }

  // ---------- confirm modal ----------
  function confirmDialog(message) {
    return new Promise((resolve) => {
      if (!confirmModal || !confirmText || !confirmOkBtn || !confirmCancelBtn) { resolve(true); return; }
      confirmText.textContent = message;
      confirmModal.hidden = false;

      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        confirmModal.hidden = true;
        cleanup();
        resolve(val);
      };
      const onOk = () => finish(true);
      const onCancel = () => finish(false);
      const onKey = (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        onCancel();
      };
      const onOverlay = (e) => {
        if (e.target === confirmModal) onCancel();
      };
      function cleanup() {
        confirmOkBtn.removeEventListener("click", onOk);
        confirmCancelBtn.removeEventListener("click", onCancel);
        document.removeEventListener("keydown", onKey);
        confirmModal.removeEventListener("mousedown", onOverlay);
      }
      confirmOkBtn.addEventListener("click", onOk);
      confirmCancelBtn.addEventListener("click", onCancel);
      document.addEventListener("keydown", onKey);
      confirmModal.addEventListener("mousedown", onOverlay);
      // Фокус на безопасную кнопку (Отмена), чтобы Enter не сработал случайно.
      setTimeout(() => {
        try { confirmCancelBtn.focus({ preventScroll: true }); } catch (_) {}
      }, 0);
    });
  }

  // ---------- geo modal ----------
  function openGeoModal() {
    if (!geoModal) return;
    const cityEl = document.querySelector('input[name="weatherCity"]');
    const preset = (cityEl && cityEl.value || "").trim();
    if (geoCityInput) geoCityInput.value = preset;
    if (geoResults) { geoResults.innerHTML = ""; geoResults.hidden = true; }
    if (geoStatus) { geoStatus.hidden = true; geoStatus.textContent = ""; }
    geoModal.hidden = false;
    setTimeout(() => geoCityInput && geoCityInput.focus(), 0);
  }

  function closeGeoModal() {
    if (!geoModal) return;
    geoModal.hidden = true;
    if (geoResults) { geoResults.innerHTML = ""; geoResults.hidden = true; }
    if (geoStatus) { geoStatus.hidden = true; geoStatus.textContent = ""; }
    if (geoSearchBtn) geoSearchBtn.disabled = false;
    _geoInFlight = false;
  }

  function setGeoStatus(text, isError) {
    if (!geoStatus) return;
    if (!text) { geoStatus.hidden = true; geoStatus.textContent = ""; return; }
    geoStatus.hidden = false;
    geoStatus.textContent = text;
    geoStatus.style.color = isError ? "rgba(255,150,150,0.95)" : "";
  }

  async function runGeoSearch() {
    if (_geoInFlight || !geoCityInput) return;
    const city = geoCityInput.value.trim();
    if (!city) { setGeoStatus(tx("hintWeatherCity"), true); return; }
    _geoInFlight = true;
    if (geoSearchBtn) geoSearchBtn.disabled = true;
    setGeoStatus(tx("geoSearching"), false);
    if (geoResults) { geoResults.innerHTML = ""; geoResults.hidden = true; }
    _geoLastQuery = city;
    try {
      const resp = await ext.runtime.sendMessage({ type: "weatherGeocode", city: city, lang: lang });
      if (geoCityInput.value.trim() !== _geoLastQuery) return; // устаревший ответ
      if (!resp || resp.error || !resp.ok) throw new Error(resp && resp.error || "no response");
      const list = Array.isArray(resp.results) ? resp.results : [];
      if (list.length === 0) { setGeoStatus(tx("geoNotFound"), true); return; }
      setGeoStatus("", false);
      renderGeoResults(list);
    } catch (e) {
      setGeoStatus(tx("geoError"), true);
    } finally {
      _geoInFlight = false;
      if (geoSearchBtn) geoSearchBtn.disabled = false;
    }
  }

  function renderGeoResults(list) {
    if (!geoResults) return;
    geoResults.innerHTML = "";
    list.forEach((r) => {
      const li = document.createElement("li");
      li.className = "geo-result";
      li.tabIndex = 0;
      const title = document.createElement("div");
      title.className = "geo-result-title";
      const parts = [r.name];
      if (r.admin1) parts.push(r.admin1);
      if (r.country) parts.push(r.country);
      title.textContent = parts.join(", ");
      const coords = document.createElement("div");
      coords.className = "geo-result-coords";
      coords.textContent = "lat " + Number(r.lat).toFixed(4) + ", lon " + Number(r.lon).toFixed(4);
      const hint = document.createElement("div");
      hint.className = "geo-result-hint";
      hint.textContent = tx("geoPickHint");
      li.appendChild(title);
      li.appendChild(coords);
      li.appendChild(hint);
      li.addEventListener("click", () => pickGeoResult(r));
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickGeoResult(r); }
      });
      geoResults.appendChild(li);
    });
    geoResults.hidden = false;
  }

  async function pickGeoResult(r) {
    try {
      await Storage.update((d) => {
        d.settings.weatherLat = r.lat;
        d.settings.weatherLon = r.lon;
        d.settings.weatherCity = r.name || _geoLastQuery;
        d.weatherCache = null;
      });
      state = await Storage.get();
      fillForm();
      flashSaved();
    } catch (e) {
      flash(tx("weatherLoadFailed"), true);
      return;
    }
    closeGeoModal();
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

  async function openBookmarksModal() {
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

  function onBookmarksFolderChange() {
    if (!bookmarksFolderSelect || !bookmarksFolderInfo || !bookmarksImportBtn) return;
    const id = bookmarksFolderSelect.value;
    const folder = _bookmarkFolders.find((f) => String(f.id) === String(id));
    if (!folder || folder.count === 0) {
      bookmarksFolderInfo.textContent = tx("bookmarksFolderEmpty");
      bookmarksFolderInfo.hidden = false;
      bookmarksImportBtn.disabled = true;
      return;
    }
    bookmarksFolderInfo.textContent = tx("bookmarksFolderInfo")(folder.count);
    bookmarksFolderInfo.hidden = false;
    bookmarksImportBtn.disabled = false;
  }

  async function onBookmarksImport() {
    if (!bookmarksFolderSelect || !_bookmarkTreeRoot) return;
    const id = bookmarksFolderSelect.value;
    const folder = _bookmarkFolders.find((f) => String(f.id) === String(id));
    if (!folder || folder.count === 0) return;
    const node = findBookmarkNode(_bookmarkTreeRoot, id);
    if (!node) { flash(tx("bookmarksUnavailable"), true); return; }
    const urls = collectBookmarkUrls(node, []);
    if (urls.length === 0) { flash(tx("bookmarksFolderEmpty"), true); return; }
    if (!(await confirmDialog(tx("bookmarksConfirm")(folder.name, urls.length)))) return;
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
      flash(tx("bookmarksImported")(urls.length));
      closeBookmarksModal();
    } catch (e) {
      flash(tx("importFailed"), true);
    }
  }

  function closeBookmarksModal() {
    if (!bookmarksModal) return;
    bookmarksModal.hidden = true;
  }

  // ---------- helpers ----------
  let flashTimer;
  function flash(msg, isErr) {
    statusEl.textContent = msg;
    statusEl.style.borderColor = isErr ? "rgba(255,90,90,0.5)" : "";
    statusEl.hidden = false;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { statusEl.hidden = true; }, 1800);
  }

  init().catch(err => {
    const pre = document.createElement("pre");
    pre.style.cssText = "padding:20px;color:#f88";
    pre.textContent = "Options failed to initialize.\n\n" + (err && err.message || err);
    document.body.textContent = "";
    document.body.appendChild(pre);
  });
})();
