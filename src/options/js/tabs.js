/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Навигация по вкладкам настроек: переключение панелей, синхронизация
 * с location.hash (#tab=...) и скролл наверх.
 */

export const TAB_IDS = ["appearance", "widgets", "language", "data", "about"];

export function switchTab(tabId, opts) {
  const scroll = !opts || opts.scroll !== false;
  const id = TAB_IDS.indexOf(tabId) >= 0 ? tabId : "appearance";
  document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === id));
  document.querySelectorAll(".tab-panel").forEach(p => { p.hidden = p.dataset.tab !== id; });
  try { history.replaceState(null, "", "#tab=" + id); } catch (_) {}
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

export function wireTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  const m = (location.hash || "").match(/^#tab=([\w-]+)/);
  const initial = m && TAB_IDS.indexOf(m[1]) >= 0 ? m[1] : "appearance";
  document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === initial));
  document.querySelectorAll(".tab-panel").forEach(p => { p.hidden = p.dataset.tab !== initial; });
}
