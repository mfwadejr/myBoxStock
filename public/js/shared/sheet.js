// SHARED / sheet — modal sheets and confirm dialogs.
(() => {
  const { esc } = UI;

  // Resolves with the value passed to close(), or null if dismissed (Esc, click outside, Cancel).
  // Keyboard and screen reader behaviour: the sheet is a named dialog (named by its first heading), focus moves into it and stays inside (Tab wraps),
  // Escape closes only the top sheet (and never a dropdown that is open inside it), and focus goes back to the control that opened it.
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), textarea:not([disabled]), .select-btn:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const shown = (e) => e.offsetWidth > 0 || e.offsetHeight > 0 || e.getClientRects().length > 0;
  let seq = 0;
  UI.sheet = (html, { onMount, wide = false } = {}) => new Promise((resolve) => {
    const opener = document.activeElement, scrim = document.createElement('div'); scrim.className = 'scrim';
    scrim.innerHTML = `<div class="sheet${wide ? ' wide' : ''}" role="dialog" aria-modal="true" tabindex="-1"><div class="sheet-body">${html}</div></div>`;
    const dlg = scrim.firstElementChild, head = dlg.querySelector('h1, h2, h3');
    if (head) { head.id = head.id || `sheet-title-${++seq}`; dlg.setAttribute('aria-labelledby', head.id); } else dlg.setAttribute('aria-label', 'Dialog');
    let done = false;
    const onKey = (e) => {
      if (done) return;
      const top = [...document.querySelectorAll('.scrim:not(.closing)')].pop(); if (top !== scrim) return;   // only the sheet on top reacts
      if (e.key === 'Escape') { if (e.defaultPrevented || dlg.querySelector('.select.open')) return; e.preventDefault(); close(null); }
      else if (e.key === 'Tab') {
        const list = [...dlg.querySelectorAll(FOCUSABLE)].filter(shown); if (!list.length) { e.preventDefault(); dlg.focus(); return; }
        const first = list[0], last = list[list.length - 1], at = document.activeElement;
        if (!dlg.contains(at)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && (at === first || at === dlg)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
      }
    };
    const close = (v = null) => {
      if (done) return; done = true; scrim.classList.add('closing'); setTimeout(() => scrim.remove(), 200); document.removeEventListener('keydown', onKey);
      if (opener && opener !== document.body && document.contains(opener) && typeof opener.focus === 'function' && (!document.activeElement || document.activeElement === document.body || scrim.contains(document.activeElement))) opener.focus();
      resolve(v);
    };
    document.addEventListener('keydown', onKey);
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(null); });
    document.body.append(scrim);
    scrim.querySelector('[data-cancel]')?.addEventListener('click', () => close(null));
    onMount?.(scrim.querySelector('.sheet-body'), close);
    if (!dlg.contains(document.activeElement) || document.activeElement === dlg) {
      const first = [...dlg.querySelectorAll('input:not([type=hidden]):not([type=file]), textarea')].find(shown) || [...dlg.querySelectorAll(FOCUSABLE)].find(shown);
      (first || dlg).focus();
    }
  });

  UI.confirmBox = ({ title, body, confirmLabel = 'Confirm', danger = false, typeToConfirm = null }) => UI.sheet(
    `<h2>${esc(title)}</h2><p class="muted">${body}</p>
     ${typeToConfirm ? `<div class="field mt-md"><label for="tc">Type <b>${esc(typeToConfirm)}</b> to confirm</label><input type="text" id="tc" autocomplete="off"></div>` : ''}
     <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn ${danger ? 'danger' : ''}" id="ok">${esc(confirmLabel)}</button></div>`,
    { onMount: (el, close) => {
      const ok = el.querySelector('#ok'), tc = el.querySelector('#tc');
      if (tc) { ok.disabled = true; tc.addEventListener('input', () => { ok.disabled = tc.value !== typeToConfirm; }); }
      ok.addEventListener('click', () => close(tc ? tc.value : true));
    } });

  UI.busy = async (btn, fn) => { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); try { return await fn(); } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); } };
})();
