/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Вкладка «О расширении»: версия из манифеста.
 */

const aboutVersionEl = document.getElementById("aboutVersion");

export function populateAbout() {
  if (aboutVersionEl) {
    const v = (typeof ext !== "undefined" && ext.runtime && ext.runtime.getManifest) ? ext.runtime.getManifest().version : "";
    aboutVersionEl.textContent = v || "—";
  }
}
