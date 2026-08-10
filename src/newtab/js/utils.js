/*
 * Tabula — spreadsheet-style new tab page browser extension.
 *
 * Общие утилиты страницы новой вкладки: toast, CSS-эскейпинг,
 * confirm-модалка (общий DOM #confirmModal).
 */

const confirmModal    = document.getElementById("confirmModal");
const confirmText     = document.getElementById("confirmText");
const confirmOkBtn    = document.getElementById("confirmOkBtn");
const confirmCancelBtn= document.getElementById("confirmCancelBtn");
const toastEl         = document.getElementById("toast");

export function cssEscape(v) { return String(v).replace(/"/g, '\\"'); }

export function cssAttr(v) { return String(v).replace(/"/g, '\\"'); }

export function pad2(n) { n = String(n); return n.length < 2 ? "0" + n : n; }

let toastTimer;
export function toast(msg, isErr) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  toastEl.classList.remove("fade");
  toastEl.style.borderColor = isErr ? "rgba(255,90,90,0.5)" : "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.add("fade");
    setTimeout(() => { toastEl.hidden = true; }, 220);
  }, 1800);
}

// ---------- confirm modal ----------
export function confirmDialog(message) {
  return new Promise((resolve) => {
    if (!confirmModal || !confirmText || !confirmOkBtn || !confirmCancelBtn) { resolve(true); return; }
    confirmText.textContent = message;
    confirmModal.hidden = false;
    // restart modal animation
    const card = confirmModal.querySelector(".modal-card");
    if (card) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }

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
