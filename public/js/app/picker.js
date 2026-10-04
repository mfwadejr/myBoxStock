// APP / picker — "Browse available stock": choose devices from what is in stock, without knowing any identifier.
// C.pickStock({ exclude: [ids], model }) resolves with the chosen item ids, or null if dismissed.
(() => {
  const { esc, sheet } = UI, A = AccountApp, C = A.commerce;

  C.availableStock = (exclude = []) => A.store.all('item').filter(e => (e.data.status === 'available' || e.data.status === 'returned') && !exclude.includes(e.id));
  C.modelCounts = (entries) => { const m = new Map(); for (const e of entries) { const k = e.data.model || ''; m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => a[0].localeCompare(b[0])); };
  const modelName = (m) => m || 'No model';
  const condOf = (d) => { const f = C.fields().find(x => x.core && x.key === 'cond'); return f ? String(C.getVal(d, f) || '') : ''; };
  const idsOf = (d) => C.lookupFields().map(f => C.getVal(d, f)).filter(Boolean).join(' · ');
  const hay = (d) => [d.make, d.model, d.notes, ...C.fields().map(f => C.showVal(f, C.getVal(d, f)))].join(' ').toLowerCase();

  C.pickStock = ({ exclude = [], model = '' } = {}) => {
    const pool = C.availableStock(exclude).sort((a, b) => modelName(a.data.model).localeCompare(modelName(b.data.model)) || idsOf(a.data).localeCompare(idsOf(b.data)));
    const st = { q: '', model, picked: new Set() }, counts = C.modelCounts(pool), F = A.fmt;
    const html = `<h2>Available stock</h2><p class="muted" id="cnt"></p>
      <input type="search" id="q" placeholder="Search make, model, UID, serial, MAC…" autocomplete="off">
      <div class="filters mt-md" id="fl"></div><div class="stock-list mt-md" id="sl"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="ok" disabled>Add to sale</button></div>`;
    return sheet(html, { wide: true, onMount: (el, close) => {
      const q = (s) => el.querySelector(s);
      const visible = () => pool.filter(e => (!st.model || (e.data.model || '') === st.model) && (!st.q || hay(e.data).includes(st.q)));
      const draw = () => {
        const rows = visible();
        q('#cnt').textContent = `${rows.length} of ${pool.length} available device${pool.length === 1 ? '' : 's'}`;
        q('#fl').innerHTML = `<button type="button" class="filter ${st.model ? '' : 'on'}" data-m="">All · ${pool.length}</button>` + counts.map(([m, n]) => `<button type="button" class="filter ${st.model === m && st.model !== '' ? 'on' : ''}" data-m="${esc(m)}">${esc(modelName(m))} · ${n}</button>`).join('');
        q('#sl').innerHTML = rows.length ? rows.map(e => { const d = e.data, cond = condOf(d);
          return `<label class="stock-row"><input type="checkbox" data-id="${esc(e.id)}" ${st.picked.has(e.id) ? 'checked' : ''}><div class="stock-main"><div class="strong">${esc(C.deviceName(d) || 'No model')}</div><div class="mono muted">${esc(idsOf(d) || '—')}</div></div><div class="stock-tags">${cond ? `<span class="chip gray">${esc(cond)}</span>` : ''}${C.testChip(d)}</div><div class="stock-price strong">${esc(F.money(d.price || 0))}</div></label>`; }).join('')
          : `<div class="empty">${pool.length ? 'Nothing matches. Clear the search or choose All.' : 'No devices are available right now.'}</div>`;
        const n = st.picked.size, ok = q('#ok'); ok.disabled = !n; ok.textContent = n ? `Add ${n} to sale` : 'Add to sale';
        q('#fl').querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { st.model = b.dataset.m; draw(); }));
        q('#sl').querySelectorAll('input[data-id]').forEach(i => i.addEventListener('change', () => { i.checked ? st.picked.add(i.dataset.id) : st.picked.delete(i.dataset.id); const n2 = st.picked.size; ok.disabled = !n2; ok.textContent = n2 ? `Add ${n2} to sale` : 'Add to sale'; }));
      };
      q('#q').addEventListener('input', (e) => { st.q = e.target.value.trim().toLowerCase(); draw(); });
      q('#ok').addEventListener('click', () => close([...st.picked]));
      draw();
    } });
  };
})();
