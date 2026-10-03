// APP / views / inventory — devices: search, filters, add/edit, archive, CSV import/export, stock levels. All data is decrypted in the browser.
(() => {
  const { esc, toast, sheet, swap } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store;
  const COND = [['New', 'New'], ['Refurbished', 'Refurbished'], ['Used', 'Used']];
  const STATUSES = ['available', 'reserved', 'sold', 'returned', 'damaged', 'archived'].map(s => [s, C.STATUS[s][1]]);
  const FILTERS = [['active', 'Available'], ['all', 'All (not archived)'], ...STATUSES.filter(s => s[0] !== 'available')];
  const view = { q: '', status: 'active', model: '' };
  const LIMIT = 200;

  const matches = (it, q) => !q || [it.uid, it.serial, it.mac, it.model, it.supplier, it.notes].some(v => String(v || '').toLowerCase().includes(q));
  const modelsOf = () => [...new Set(S.all('item').map(e => (e.data.model || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const reorderOf = (name) => S.all('model').find(m => m.data.name === name);
  const lowModels = () => modelsOf().map(name => { const r = reorderOf(name)?.data.reorder || 0, n = S.all('item').filter(e => e.data.model === name && e.data.status === 'available').length; return { name, n, r }; }).filter(m => m.r > 0 && m.n <= m.r);

  function duplicate(data, selfId) {
    for (const e of S.all('item')) { if (e.id === selfId || e.data.status === 'archived') continue;
      for (const k of ['uid', 'serial', 'mac']) if (data[k] && e.data[k] && e.data[k].toLowerCase() === data[k].toLowerCase()) return `Another device already has that ${k === 'uid' ? 'UID' : k === 'mac' ? 'MAC address' : 'serial number'}.`; }
    return null;
  }
  const fields = (d = {}) => `<div class="grid g2 mt-md"><div class="field"><label>UID</label><input type="text" id="uid" value="${esc(d.uid || '')}" autocomplete="off"></div><div class="field"><label>Serial number</label><input type="text" id="serial" value="${esc(d.serial || '')}" autocomplete="off"></div>
    <div class="field"><label>MAC address</label><input type="text" id="mac" value="${esc(d.mac || '')}" autocomplete="off"></div><div class="field"><label>Model</label><input type="text" id="model" value="${esc(d.model || '')}" autocomplete="off"></div>
    <div class="field"><label>Condition</label>${UI.select.html({ id: 'cond', options: COND, value: d.cond || 'New' })}</div><div class="field"><label>Status</label>${UI.select.html({ id: 'status', options: STATUSES, value: d.status || 'available' })}</div>
    <div class="field"><label>Cost</label><input type="number" id="cost" min="0" step="0.01" value="${esc(F.dollars(d.cost))}"></div><div class="field"><label>Selling price</label><input type="number" id="price" min="0" step="0.01" value="${esc(F.dollars(d.price))}"></div></div>
    <div class="field"><label>Supplier</label><input type="text" id="supplier" value="${esc(d.supplier || '')}" autocomplete="off"></div><div class="field"><label>Notes</label><textarea id="notes">${esc(d.notes || '')}</textarea></div>`;
  const read = (el, old = {}) => { const v = (id) => el.querySelector('#' + id).value.trim();
    return { ...old, uid: v('uid'), serial: v('serial'), mac: v('mac'), model: v('model'), cond: UI.select.value(el.querySelector('#cond')), status: UI.select.value(el.querySelector('#status')), cost: F.cents(v('cost')), price: F.cents(v('price')), supplier: v('supplier'), notes: v('notes'), addedAt: old.addedAt || Date.now() }; };
  const check = (d, selfId) => (!d.uid && !d.serial && !d.mac) ? 'Enter a UID, serial number or MAC address.' : duplicate(d, selfId);

  function addSheet(again) {
    return sheet(`<h2>Add device</h2>${fields()}<div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn secondary" id="more">Save and add another</button><button class="btn" id="go">Save</button></div>`, { onMount: (el, close) => {
      const save = async (more) => { try { const d = read(el); const bad = check(d); if (bad) return toast(bad, true); await S.commit({ puts: [{ type: 'item', data: d }] }); toast('Device added'); close(more ? 'more' : true); } catch (e) { toast(e.message, true); } };
      el.querySelector('#go').addEventListener('click', () => save(false)); el.querySelector('#more').addEventListener('click', () => save(true));
    } }).then(r => r === 'more' ? addSheet() : r);
  }
  function editSheet(e) {
    const d = e.data, sold = d.status === 'sold', can = A.can('inventory.write');
    return sheet(`<h2>${esc(C.itemLabel(d))}</h2>${sold ? `<p class="sub">Sold ${esc(F.when(d.soldAt))}${S.get('sale', d.saleId) ? ` · receipt ${esc(S.get('sale', d.saleId).data.no)}` : ''}</p>` : ''}${fields(d)}
      <div class="actions split"><div class="row">${can ? `<button class="btn danger small" id="del">Delete</button><button class="btn secondary small" id="arch">${d.status === 'archived' ? 'Restore' : 'Archive'}</button>` : ''}</div><div class="row"><button class="btn secondary" data-cancel>${can ? 'Cancel' : 'Close'}</button>${can ? '<button class="btn" id="go">Save</button>' : ''}</div></div>`, { onMount: (el, close) => {
      if (!can) { el.querySelectorAll('input,textarea').forEach(i => { i.disabled = true; }); return; }
      const run = async (fn) => { try { await fn(); close(true); } catch (er) { toast(er.message, true); } };
      el.querySelector('#go').addEventListener('click', () => run(async () => { const n = read(el, d); const bad = check(n, e.id); if (bad) throw new Error(bad); await S.commit({ puts: [{ type: 'item', id: e.id, data: n }] }); toast('Saved'); }));
      el.querySelector('#arch').addEventListener('click', () => run(async () => { await S.commit({ puts: [{ type: 'item', id: e.id, data: { ...d, status: d.status === 'archived' ? 'available' : 'archived' } }] }); }));
      el.querySelector('#del').addEventListener('click', async () => { if (!await UI.confirmBox({ title: 'Delete this device?', body: 'It is removed for good. Past sales that included it keep their receipts.', confirmLabel: 'Delete', danger: true })) return; run(async () => { await S.commit({ deletes: [{ type: 'item', id: e.id }] }); toast('Deleted'); }); });
    } });
  }

  const HEAD = ['uid', 'serial', 'mac', 'model', 'condition', 'cost', 'price', 'status', 'supplier', 'notes'];
  function exportCsv() {
    const rows = S.all('item').map(e => { const d = e.data; return [d.uid, d.serial, d.mac, d.model, d.cond, F.dollars(d.cost), F.dollars(d.price), d.status, d.supplier, d.notes]; });
    C.download(`inventory-${F.ymd(Date.now())}.csv`, C.toCsv(HEAD, rows)); toast(`Exported ${rows.length} devices`);
  }
  async function importCsv(file) {
    const rows = C.parseCsv((await file.text()).replace(/^﻿/, '')); if (rows.length < 2) return toast('That file has no rows to import.', true);
    const head = rows[0].map(h => h.trim().toLowerCase()), col = (n) => head.indexOf(n);
    if (!['uid', 'serial', 'mac'].some(n => col(n) >= 0)) return toast('The first row must have column names such as uid, serial, mac, model, cost, price.', true);
    const have = new Set(S.all('item').flatMap(e => [e.data.uid, e.data.serial, e.data.mac].filter(Boolean).map(x => x.toLowerCase()))), good = [], skipped = [];
    const seenNow = new Set();
    for (const r of rows.slice(1)) {
      const g = (n) => (col(n) >= 0 ? (r[col(n)] || '').trim() : ''), d = { uid: g('uid'), serial: g('serial'), mac: g('mac'), model: g('model'), cond: COND.some(c => c[0].toLowerCase() === g('condition').toLowerCase()) ? COND.find(c => c[0].toLowerCase() === g('condition').toLowerCase())[0] : 'New', cost: F.cents(g('cost')), price: F.cents(g('price')), status: STATUSES.some(s => s[0] === g('status').toLowerCase()) ? g('status').toLowerCase() : 'available', supplier: g('supplier'), notes: g('notes'), addedAt: Date.now() };
      const keys = [d.uid, d.serial, d.mac].filter(Boolean).map(x => x.toLowerCase());
      if (!keys.length || keys.some(k => have.has(k) || seenNow.has(k))) { skipped.push(r); continue; }
      keys.forEach(k => seenNow.add(k)); good.push(d);
    }
    const ok = await sheet(`<h2>Import devices</h2><p class="sub">${good.length} device${good.length === 1 ? '' : 's'} will be added.${skipped.length ? ` ${skipped.length} row${skipped.length === 1 ? '' : 's'} will be skipped because they have no identifier or one that already exists.` : ''}</p><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go" ${good.length ? '' : 'disabled'}>Import ${good.length}</button></div>`, { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => {
      try { for (let i = 0; i < good.length; i += 200) await S.commit({ puts: good.slice(i, i + 200).map(data => ({ type: 'item', data })) }); close(true); } catch (e) { toast(e.message, true); } }) });
    if (ok) { toast(`Imported ${good.length} devices`); A.route(); }
  }

  A.views.inventory = async (main) => {
    if (!A.can('inventory.read')) return swap(main, '<div class="page-head"><h1>Inventory</h1></div><div class="card"><div class="empty">Your user type does not include inventory.</div></div>');
    const can = A.can('inventory.write'), items = S.all('item'), models = modelsOf(), low = lowModels();
    const shown = items.filter(e => (view.status === 'active' ? e.data.status === 'available' : view.status === 'all' ? e.data.status !== 'archived' : e.data.status === view.status) && (!view.model || e.data.model === view.model) && matches(e.data, view.q.toLowerCase())).sort((a, b) => (b.data.addedAt || 0) - (a.data.addedAt || 0));
    swap(main, `<div class="page-head row spread wrap"><div><h1>Inventory</h1><p>${items.filter(e => e.data.status === 'available').length} available · ${items.length} total. Only your team can read this.</p></div>
      ${can ? '<div class="row"><button class="btn secondary" id="imp">Import CSV</button><button class="btn secondary" id="exp">Export CSV</button><button class="btn" id="add">Add device</button></div><input type="file" id="file" accept=".csv,text/csv">' : '<div class="row"><button class="btn secondary" id="exp">Export CSV</button></div>'}</div>
      ${low.length ? `<div class="banner mb-lg">${low.map(m => `${esc(m.name)}: ${m.n} left (reorder at ${m.r})`).join(' · ')}</div>` : ''}
      <div class="toolbar"><input type="search" class="search" id="q" placeholder="Search UID, serial, MAC, model, notes" value="${esc(view.q)}" autocomplete="off">${UI.select.html({ id: 'st', options: FILTERS, value: view.status })}${UI.select.html({ id: 'md', options: [['', 'All models'], ...models.map(m => [m, m])], value: view.model })}</div>
      <div class="card"><div class="tablewrap">${shown.length ? `<table><thead><tr><th>UID</th><th>Serial</th><th>MAC</th><th>Model</th><th>Condition</th><th class="right">Cost</th><th class="right">Price</th><th>Status</th></tr></thead><tbody>${shown.slice(0, LIMIT).map(e => { const d = e.data; return `<tr class="click" data-id="${esc(e.id)}"><td class="mono">${esc(d.uid || '—')}</td><td class="mono">${esc(d.serial || '—')}</td><td class="mono">${esc(d.mac || '—')}</td><td>${esc(d.model || '—')}</td><td>${esc(d.cond || '')}</td><td class="right">${esc(F.money(d.cost))}</td><td class="right">${esc(F.money(d.price))}</td><td>${C.statusChip(d.status)}</td></tr>`; }).join('')}</tbody></table>${shown.length > LIMIT ? `<p class="hint center my-md">Showing the first ${LIMIT} of ${shown.length}. Narrow the search to see the rest.</p>` : ''}` : `<div class="empty">${items.length ? 'No devices match.' : 'No devices yet.'}</div>`}</div></div>
      ${models.length ? `<div class="card mt-lg"><h3>Stock levels</h3><div class="sub">Get a warning on this page when a model's available count drops to its reorder level (0 turns it off).</div><div class="tablewrap mt-sm"><table><thead><tr><th>Model</th><th class="right">Available</th><th>Reorder at</th><th></th></tr></thead><tbody>${models.map(m => { const n = items.filter(e => e.data.model === m && e.data.status === 'available').length, r = reorderOf(m)?.data.reorder || 0; return `<tr><td>${esc(m)}</td><td class="right">${n}</td><td><input type="number" min="0" step="1" class="w-xs" data-model="${esc(m)}" value="${r}" ${can ? '' : 'disabled'}></td><td>${r > 0 && n <= r ? '<span class="chip red">Low</span>' : ''}</td></tr>`; }).join('')}</tbody></table></div></div>` : ''}`);
    const again = () => A.views.inventory(main);
    main.querySelector('#q').addEventListener('input', (e) => { view.q = e.target.value; clearTimeout(again.t); again.t = setTimeout(async () => { const pos = e.target.selectionStart; await again(); const q = main.querySelector('#q'); q.focus(); q.setSelectionRange(pos, pos); }, 180); });
    main.querySelector('#st').addEventListener('change', (e) => { view.status = UI.select.value(e.target); again(); });
    main.querySelector('#md').addEventListener('change', (e) => { view.model = UI.select.value(e.target); again(); });
    main.querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', async () => { if (await editSheet(S.get('item', tr.dataset.id))) again(); }));
    main.querySelector('#add')?.addEventListener('click', async () => { if (await addSheet()) again(); });
    main.querySelector('#exp')?.addEventListener('click', exportCsv);
    main.querySelector('#imp')?.addEventListener('click', () => main.querySelector('#file').click());
    main.querySelector('#file')?.addEventListener('change', async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await importCsv(f); });
    main.querySelectorAll('[data-model]').forEach(i => i.addEventListener('change', async () => {
      const name = i.dataset.model, cur = reorderOf(name), n = Math.max(0, Math.floor(Number(i.value) || 0));
      try { await S.commit({ puts: [{ type: 'model', id: cur?.id, data: { name, reorder: n } }] }); toast('Saved'); again(); } catch (e) { toast(e.message, true); }
    }));
  };
})();
