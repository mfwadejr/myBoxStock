// SHARED / select — the site's one themed dropdown. All styling comes from the .select* classes (tokens only).
// Markup:   UI.select.html({ id, options: [[value, label], ...], value, cls })   ->  string to place in a template
// Read:     UI.select.value(buttonEl)       Listen: buttonEl.addEventListener('change', ...)   (a real, bubbling change event)
(() => {
  const esc = UI.esc;
  const label = (o, v) => (o.find(x => String(x[0]) === String(v)) || o[0] || ['', ''])[1];
  const html = ({ id = '', options, value = '', cls = '' }) => {
    const sel = options.some(o => String(o[0]) === String(value)) ? String(value) : String(options[0]?.[0] ?? '');
    return `<div class="select ${cls}"><button type="button" class="select-btn" ${id ? `id="${esc(id)}"` : ''} role="combobox" aria-haspopup="listbox" aria-expanded="false" data-value="${esc(sel)}"><span class="select-label">${esc(label(options, sel))}</span></button>`
      + `<ul class="select-list" role="listbox" hidden>${options.map(([v, l]) => `<li class="select-option" role="option" tabindex="-1" data-value="${esc(v)}" aria-selected="${String(v) === sel}">${esc(l)}</li>`).join('')}</ul></div>`;
  };
  const wrap = (el) => el.closest('.select');
  const list = (w) => w.querySelector('.select-list'), btn = (w) => w.querySelector('.select-btn');
  const opts = (w) => [...list(w).querySelectorAll('.select-option')];
  function close(w, refocus) { if (!w) return; w.classList.remove('open', 'up'); list(w).hidden = true; btn(w).setAttribute('aria-expanded', 'false'); if (refocus) btn(w).focus(); }
  function closeAll(except) { document.querySelectorAll('.select.open').forEach(w => { if (w !== except) close(w); }); }
  function open(w) {
    closeAll(w); const l = list(w); l.hidden = false; w.classList.add('open'); btn(w).setAttribute('aria-expanded', 'true');
    const below = window.innerHeight - btn(w).getBoundingClientRect().bottom; w.classList.toggle('up', below < l.offsetHeight + 16 && btn(w).getBoundingClientRect().top > below);
    (opts(w).find(o => o.getAttribute('aria-selected') === 'true') || opts(w)[0]).focus();
  }
  function choose(w, o) {
    const b = btn(w); opts(w).forEach(x => x.setAttribute('aria-selected', String(x === o)));
    const changed = b.dataset.value !== o.dataset.value; b.dataset.value = o.dataset.value; b.querySelector('.select-label').textContent = o.textContent;
    close(w, true); if (changed) b.dispatchEvent(new Event('change', { bubbles: true }));
  }
  document.addEventListener('click', (e) => {
    const w = wrap(e.target), o = e.target.closest('.select-option');
    if (o) return choose(wrap(o), o);
    if (e.target.closest('.select-btn')) { const x = wrap(e.target); return x.classList.contains('open') ? close(x) : open(x); }
    closeAll(w);
  });
  document.addEventListener('keydown', (e) => {
    const w = e.target.closest?.('.select'); if (!w) return;
    const items = opts(w), isOpen = w.classList.contains('open'), i = items.indexOf(document.activeElement);
    if (e.key === 'Escape' && isOpen) { e.preventDefault(); return close(w, true); }
    if (e.key === 'Tab') return close(w);
    if (!isOpen) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && e.target.closest('.select-btn')) { e.preventDefault(); open(w); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, i + 1)].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(0, i - 1)].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); } else if (e.key === 'End') { e.preventDefault(); items.at(-1).focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) choose(w, items[i]); }
    else if (e.key.length === 1) { const t = e.key.toLowerCase(), n = items.slice(i + 1).concat(items.slice(0, i + 1)).find(o => o.textContent.toLowerCase().startsWith(t)); if (n) n.focus(); } // type to jump
  });
  // Set the shown choice from code (no change event).
  const set = (el, v) => { const w = wrap(el), o = opts(w).find(x => x.dataset.value === String(v)); if (!o) return; opts(w).forEach(x => x.setAttribute('aria-selected', String(x === o))); el.dataset.value = o.dataset.value; el.querySelector('.select-label').textContent = o.textContent; };
  UI.select = { html, set, value: (el) => el.dataset.value };
})();
