(() => {
  "use strict";

  const RANGE_KEYS = ["defaultColumns", "cellHeight", "fontSize", "clockSize", "weatherSize", "weatherRefreshMin", "quickGoSuggestOpacity"];
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
  let   _geoInFlight = false;
  let   _geoLastQuery = "";
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
  const clockFontSelect = $("#clockFontKeySelect");
  const clockFontCustomWrap = $("#clockFontCustomWrap");
  const aboutVersionEl  = $("#aboutVersion");
  const aboutRepoLink   = $("#aboutRepoLink");

  let state = null;
  let lang  = "ru";
  let saveTimer;
  let dirtyFlashTimer;

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
    populateFontSelect(clockFontSelect);
    updateFontSelectCustomVisibility(fontFamilySelect, fontFamilyCustomWrap);
    updateFontSelectCustomVisibility(clockFontSelect, clockFontCustomWrap);
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
    wireSidebar();
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
    updateSuggestOpacityVisibility();
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

  // Показывать ползунок прозрачности подложки подсказок только при включённых подсказках.
  function updateSuggestOpacityVisibility() {
    const wrap = $("#quickGoSuggestOpacityWrap");
    if (!wrap) return;
    const cb = $('input[name="quickGoSuggest"]');
    wrap.hidden = !(cb && cb.checked);
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
    if (!confirm(tx("confirmReset"))) return;
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

  // ---------- sidebar nav ----------
  function wireSidebar() {
    const items = $$(".nav-item");
    const panels = items.map(a => document.querySelector(a.getAttribute("href")));
    function update() {
      const scrollY = window.scrollY + 120;
      let activeIdx = 0;
      panels.forEach((p, i) => {
        if (p && p.offsetTop <= scrollY) activeIdx = i;
      });
      items.forEach((a, i) => a.classList.toggle("active", i === activeIdx));
    }
    window.addEventListener("scroll", update, { passive: true });
    items.forEach(a => {
      a.addEventListener("click", () => {
        const target = document.querySelector(a.getAttribute("href"));
        if (target) {
          setTimeout(() => {
            const top = target.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top, behavior: "smooth" });
          }, 0);
        }
      });
    });
    update();
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
        if (!confirm(tx("confirmImport"))) return;
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
      el !== uploadInput && el !== importFile);
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

    const suggestOpacityCb = document.querySelector('input[name="quickGoSuggest"]');
    if (suggestOpacityCb) suggestOpacityCb.addEventListener("change", updateSuggestOpacityVisibility);

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
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && geoModal && !geoModal.hidden) closeGeoModal();
    });

    if (fontFamilySelect) {
      fontFamilySelect.addEventListener("change", () => {
        updateFontSelectCustomVisibility(fontFamilySelect, fontFamilyCustomWrap);
      });
    }
    if (clockFontSelect) {
      clockFontSelect.addEventListener("change", () => {
        updateFontSelectCustomVisibility(clockFontSelect, clockFontCustomWrap);
      });
    }
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
    document.body.innerHTML = "<pre style='padding:20px;color:#f88'>" +
      "Options failed to initialize.\n\n" + (err && err.message || err) + "</pre>";
  });
})();
