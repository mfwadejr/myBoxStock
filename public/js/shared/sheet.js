// SHARED / sheet — modal sheets and confirm dialogs.
(() => {
  const { esc } = UI;

  // Resolves with the value passed to close(), or null if dismissed (Esc, click outside, Cancel).
  UI.sheet = (html, { onMount, wide = false } = {}) => new Promise((resolve) => {
    const scrim = document.createElement('div'); scrim.className = 'scrim';
    scrim.innerHTML = `<div class="sheet${wide ? ' wide' : ''}" role="dialog" aria-modal="true"><div class="sheet-body">${html}</div></div>`;
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    const close = (v = null) => { scrim.classList.add('closing'); setTimeout(() => scrim.remove(), 200); document.removeEventListener('keydown', onKey); resolve(v); };
    document.addEventListener('keydown', onKey);
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(null); });
    document.body.append(scrim);
    scrim.querySelector('[data-cancel]')?.addEventListener('click', () => close(null));
    onMount?.(scrim.querySelector('.sheet-body'), close);
    scrim.querySelector('input,select')?.focus();
  });

  UI.confirmBox = ({ title, body, confirmLabel = 'Confirm', danger = false, typeToConfirm = null }) => UI.sheet(
    `<h2>${esc(title)}</h2><p class="muted">${body}</p>
     ${typeToConfirm ? `<div class="field mt-md"><label>Type <b>${esc(typeToConfirm)}</b> to confirm</label><input type="text" id="tc" autocomplete="off"></div>` : ''}
     <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn ${danger ? 'danger' : ''}" id="ok">${esc(confirmLabel)}</button></div>`,
    { onMount: (el, close) => {
      const ok = el.querySelector('#ok'), tc = el.querySelector('#tc');
      if (tc) { ok.disabled = true; tc.addEventListener('input', () => { ok.disabled = tc.value !== typeToConfirm; }); }
      ok.addEventListener('click', () => close(tc ? tc.value : true));
    } });

  UI.busy = async (btn, fn) => { btn.disabled = true; try { return await fn(); } finally { btn.disabled = false; } };
})();
