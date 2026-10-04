// APP / views / inventory — devices: search, filters, add/edit, archive, CSV import/export, stock levels. All data is decrypted in the browser.
(() => {
  const { esc, toast, sheet, swap } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store;
  const STATUSES = ['available', 'reserved', 'sold', 'returned', 'damaged', 'archived'].map(s => [s, C.STATUS[s][1]]);
  const FILTERS = [['active', 'Available'], ['all', 'All (not archived)'], ...STATUSES.filter(s => s[0] !== 'available')];
  const view = { q: '', status: 'active', model: '' };
  const LIMIT = 200;

  const valuesOf = (d) => [d.make, d.model, d.notes, ...C.fields().map(f => C.showVal(f, C.getVal(d, f)))];
  const matches = (d, q) => !q || valuesOf(d).some(v => String(v || '').toLowerCase().includes(q));
  const modelsOf = () => [...new Set(S.all('item').map(e => (e.data.model || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const reorderOf = (name) => S.all('model').find(m => m.data.name === name);
  const lowModels = () => modelsOf().map(name => { const r = reorderOf(name)?.data.reorder || 0, n = S.all('item').filter(e => e.data.model === name && e.data.status === 'available').length; return { name, n, r }; }).filter(m => m.r > 0 && m.n <= m.r);

  // Fields marked "must be unique" cannot repeat across devices.
  function duplicate(data, selfId) {
    for (const f of C.fields().filter(x => x.unique)) { const v = String(C.getVal(data, f)).toLowerCase(); if (!v) continue;
      for (const e of S.all('item')) if (e.id !== selfId && e.data.status !== 'archived' && String(C.getVal(e.data, f)).toLowerCase() === v) return `Another device already has that ${f.label}.`; }
    return null;
  }
  // One extra item under a step: text, From → To (two boxes) or a choice from a list.
  const dId = (st, it, part = '') => `dv_${st.key}_${it.key}${part}`;
  const detailInput = (st, it, v) => {
    if (it.type === 'fromto') return `<div class="field"><label>${esc(it.label)}</label><div class="grid g2"><input type="text" id="${dId(st, it, '_from')}" value="${esc(v?.from || '')}" placeholder="From" aria-label="${esc(it.label)} from" autocomplete="off"><input type="text" id="${dId(st, it, '_to')}" value="${esc(v?.to || '')}" placeholder="To" aria-label="${esc(it.label)} to" autocomplete="off"></div></div>`;
    if (it.type === 'choice') return `<div class="field"><label>${esc(it.label)}</label>${UI.select.html({ id: dId(st, it), options: [['', '—'], ...(it.options || []).map(o => [o, o])], value: v || '' })}</div>`;
    return `<div class="field"><label>${esc(it.label)}</label><input type="text" id="${dId(st, it)}" value="${esc(v || '')}" autocomplete="off"></div>`;
  };
  const readDetail = (el, st, it) => {
    const g = (id) => el.querySelector('#' + id)?.value.trim() || '';
    if (it.type === 'fromto') return { from: g(dId(st, it, '_from')), to: g(dId(st, it, '_to')) };
    if (it.type === 'choice') return UI.select.value(el.querySelector('#' + dId(st, it))) || '';
    return g(dId(st, it));
  };
  const testBlock = (d = {}) => { const steps = C.steps(); if (!steps.length) return '';
    return `<div class="tests"><div class="row spread"><h3>Test record</h3><button type="button" class="btn secondary small" id="allt">Mark all done</button></div>
      <div class="field"><label>Tested on</label><input type="date" id="tdate" class="maxw-md" value="${esc(C.dateStr(C.testedMs(d) || Date.now()))}"><div class="hint">Defaults to today. Change it if you tested at a different time.</div></div>${steps.map(st => { const c = d.checks?.[st.key];
      return `<label class="check"><input type="checkbox" data-step="${esc(st.key)}" ${c ? 'checked' : ''}><span>${esc(st.label)}${st.required ? ' <span class="faint">(required before sale)</span>' : ''}</span></label>${(st.details || []).length ? `<div class="test-items" data-items="${esc(st.key)}" ${c ? '' : 'hidden'}>${st.details.map(it => detailInput(st, it, d.checkVals?.[st.key]?.[it.key])).join('')}</div>` : ''}`; }).join('')}<div class="field mt-md mb-0"><label>Test notes</label><textarea id="tnotes">${esc(d.testNotes || '')}</textarea></div></div>`; };
  const fields = (d = {}) => `<div class="grid g2 mt-md">${C.catalog.makeField(d)}${C.catalog.modelField(d)}${C.fields().map(f => `<div class="field"><label>${esc(f.label)}</label>${C.fieldInput(f, C.getVal(d, f))}</div>`).join('')}
    <div class="field"><label>Status</label>${UI.select.html({ id: 'status', options: STATUSES, value: d.status || 'available' })}</div><div class="field"><label>Cost</label><input type="number" id="cost" min="0" step="0.01" value="${esc(F.dollars(d.cost))}"></div><div class="field"><label>Selling price</label><input type="number" id="price" min="0" step="0.01" value="${esc(F.dollars(d.price))}"></div></div>
    <div class="field"><label>Date received</label><input type="date" id="recv" class="maxw-md" value="${esc(C.dateStr(C.receivedMs(d) || Date.now()))}"></div>
    <div class="field"><label>Notes</label><textarea id="notes">${esc(d.notes || '')}</textarea></div>${testBlock(d)}`;
  const read = (el, old = {}) => {
    const v = (id) => el.querySelector('#' + id).value.trim(), d = { ...old, ...C.catalog.read(el), status: UI.select.value(el.querySelector('#status')), cost: F.cents(v('cost')), price: F.cents(v('price')), notes: v('notes'), addedAt: old.addedAt || Date.now(), receivedOn: v('recv') || C.dateStr(old.addedAt || Date.now()) };
    for (const f of C.fields()) C.setVal(d, f, C.readInput(el, f));
    if (el.querySelector('[data-step]')) {
      const checks = {}, vals = { ...(old.checkVals || {}) };
      el.querySelectorAll('[data-step]').forEach(c => { if (c.checked) checks[c.dataset.step] = old.checks?.[c.dataset.step] || { by: A.me.username, at: Date.now() }; });
      for (const st of C.steps()) if ((st.details || []).length && el.querySelector(`[data-items="${st.key}"]`)) vals[st.key] = Object.fromEntries(st.details.map(it => [it.key, readDetail(el, st, it)]));
      d.checks = checks; d.checkVals = vals; d.testedOn = Object.keys(checks).length ? (v('tdate') || C.dateStr(Date.now())) : (old.testedOn || ''); d.testNotes = el.querySelector('#tnotes').value.trim();
    }
    return d;
  };
  const check = (d, selfId) => { const look = C.lookupFields(); if (look.length && !look.some(f => C.getVal(d, f))) return `Enter at least one of: ${look.map(f => f.label).join(', ')}.`; return duplicate(d, selfId); };
  const wireTests = (el) => {
    const sync = (c) => { const box = el.querySelector(`[data-items="${c.dataset.step}"]`); if (box) box.hidden = !c.checked; };
    el.querySelectorAll('[data-step]').forEach(c => c.addEventListener('change', () => sync(c)));
    el.querySelector('#allt')?.addEventListener('click', () => el.querySelectorAll('[data-step]').forEach(c => { c.checked = true; sync(c); })); // the date in "Tested on" is used as it stands
  };

  function addSheet(again) {
    return sheet(`<h2>Add device</h2>${fields()}<div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn secondary" id="more">Save and add another</button><button class="btn" id="go">Save</button></div>`, { wide: true, onMount: (el, close) => {
      wireTests(el); C.catalog.wire(el);
      const save = async (more) => { try { const d = read(el); const bad = check(d); if (bad) return toast(bad, true); await S.commit({ puts: [{ type: 'item', data: d }] }); toast('Device added'); close(more ? 'more' : true); } catch (e) { toast(e.message, true); } };
      el.querySelector('#go').addEventListener('click', () => save(false)); el.querySelector('#more').addEventListener('click', () => save(true));
    } }).then(r => r === 'more' ? addSheet() : r);
  }
  function editSheet(e) {
    const d = e.data, sold = d.status === 'sold', can = A.can('inventory.write');
    return sheet(`<h2>${esc(C.itemLabel(d))}</h2>${sold ? `<p class="sub">Sold ${esc(F.when(d.soldAt))}${S.get('sale', d.saleId) ? ` · receipt ${esc(S.get('sale', d.saleId).data.no)}` : ''}</p>` : ''}${fields(d)}
      <div class="actions split"><div class="row">${can ? `<button class="btn danger small" id="del">Delete</button><button class="btn secondary small" id="arch">${d.status === 'archived' ? 'Restore' : 'Archive'}</button>` : ''}</div><div class="row"><button class="btn secondary" data-cancel>${can ? 'Cancel' : 'Close'}</button>${can ? '<button class="btn" id="go">Save</button>' : ''}</div></div>`, { wide: true, onMount: (el, close) => {
      if (!can) { el.querySelectorAll('input,textarea,button.select-btn').forEach(i => { i.disabled = true; }); el.querySelector('#allt')?.remove(); return; }
      wireTests(el); C.catalog.wire(el);
      const run = async (fn) => { try { await fn(); close(true); } catch (er) { toast(er.message, true); } };
      el.querySelector('#go').addEventListener('click', () => run(async () => { const n = read(el, d); const bad = check(n, e.id); if (bad) throw new Error(bad); await S.commit({ puts: [{ type: 'item', id: e.id, data: n }] }); toast('Saved'); }));
      el.querySelector('#arch').addEventListener('click', () => run(async () => { await S.commit({ puts: [{ type: 'item', id: e.id, data: { ...d, status: d.status === 'archived' ? 'available' : 'archived' } }] }); }));
      el.querySelector('#del').addEventListener('click', async () => { if (!await UI.confirmBox({ title: 'Delete this device?', body: 'It is removed for good. Past sales that included it keep their receipts.', confirmLabel: 'Delete', danger: true })) return; run(async () => { await S.commit({ deletes: [{ type: 'item', id: e.id }] }); toast('Deleted'); }); });
    } });
  }

  const csvFields = () => [...C.fields().map(f => ({ key: f.key, label: f.label, f })), { key: 'make', label: 'Make' }, { key: 'model', label: 'Model' }, { key: 'cost', label: 'Cost' }, { key: 'price', label: 'Price' }, { key: 'status', label: 'Status' }, { key: 'receivedOn', label: 'Date received' }, { key: 'notes', label: 'Notes' }];
  // CSV columns for the extra items under test steps: From → To items get two columns.
  const itemCols = () => C.steps().flatMap(st => (st.details || []).flatMap(it => it.type === 'fromto' ? [{ st, it, part: 'from', label: `${it.label} from` }, { st, it, part: 'to', label: `${it.label} to` }] : [{ st, it, label: it.label }]));
  function exportCsv() {
    const cols = csvFields(), steps = C.steps();
    const rows = S.all('item').map(e => { const d = e.data; return [...cols.map(c => c.f ? C.showVal(c.f, C.getVal(d, c.f)) : c.key === 'cost' || c.key === 'price' ? F.dollars(d[c.key]) : c.key === 'receivedOn' ? C.dateStr(C.receivedMs(d)) : d[c.key]), ...(steps.length ? [...steps.map(st => d.checks?.[st.key] ? 'yes' : ''), ...itemCols().map(x => { const v = d.checkVals?.[x.st.key]?.[x.it.key]; return x.part ? (v?.[x.part] || '') : C.detailText(x.it, v); }), d.checks && Object.keys(d.checks).length ? C.dateStr(C.testedMs(d)) : '', d.testNotes || ''] : [])]; });
    C.download(`inventory-${F.ymd(Date.now())}.csv`, C.toCsv([...cols.map(c => c.label), ...(steps.length ? [...steps.map(st => st.label), ...itemCols().map(x => x.label), 'Tested on', 'Test notes'] : [])], rows)); toast(`Exported ${rows.length} devices`);
  }
  async function importCsv(file) {
    const rows = C.parseCsv((await file.text()).replace(/^\uFEFF/, '')); if (rows.length < 2) return toast('That file has no rows to import.', true);
    const head = rows[0].map(h => h.trim().toLowerCase()), cols = csvFields(), colOf = (c) => { const names = [c.key, c.label.toLowerCase()]; if (c.key === 'cond') names.push('condition'); return head.findIndex(h => names.includes(h)); };
    const look = C.lookupFields(); if (!look.some(f => colOf({ key: f.key, label: f.label }) >= 0)) return toast(`The first row must have column names, including at least one of: ${look.map(f => f.label).join(', ')}.`, true);
    const have = new Map(); for (const f of C.fields().filter(x => x.unique)) have.set(f.key, new Set(S.all('item').map(e => String(C.getVal(e.data, f)).toLowerCase()).filter(Boolean)));
    const good = [], skipped = [], norm = C.catalog.normalizer();
    for (const r of rows.slice(1)) {
      const d = { status: 'available', cost: 0, price: 0, addedAt: Date.now(), receivedOn: C.dateStr(Date.now()) };
      for (const c of cols) { const i = colOf(c); if (i < 0) continue; const raw = (r[i] || '').trim(); if (c.f) { let v = raw; if (c.f.type === 'choice') v = (c.f.options || []).find(o => o.toLowerCase() === raw.toLowerCase()) || ''; if (c.f.type === 'bool') v = /^(y|yes|true|1)$/i.test(raw) ? true : /^(n|no|false|0)$/i.test(raw) ? false : ''; C.setVal(d, c.f, v); } else if (c.key === 'cost' || c.key === 'price') d[c.key] = F.cents(raw); else if (c.key === 'receivedOn') d.receivedOn = C.dateMs(raw) ? raw : C.dateStr(Date.now()); else if (c.key === 'status') d.status = STATUSES.some(s => s[0] === raw.toLowerCase()) ? raw.toLowerCase() : 'available'; else d[c.key] = raw; }
      Object.assign(d, norm(d.make, d.model));
      if (!d.cond && C.fields().some(f => f.key === 'cond')) d.cond = C.fields().find(f => f.key === 'cond').options?.[0] || '';
      const steps = C.steps(); steps.forEach(st => { const i = head.indexOf(st.label.toLowerCase()); if (i >= 0 && /^(y|yes|true|1|x)$/i.test((r[i] || '').trim())) (d.checks ||= {})[st.key] = { by: A.me.username, at: Date.now() }; });
      if (steps.length) {
        for (const x of itemCols()) { const i = head.indexOf(x.label.toLowerCase()), raw = i >= 0 ? (r[i] || '').trim() : ''; if (!raw) continue; const box = ((d.checkVals ||= {})[x.st.key] ||= {}); if (x.part) (box[x.it.key] ||= { from: '', to: '' })[x.part] = raw; else box[x.it.key] = x.it.type === 'choice' ? ((x.it.options || []).find(o => o.toLowerCase() === raw.toLowerCase()) || '') : raw; }
        const ki = head.indexOf('tested on'); if (d.checks) d.testedOn = ki >= 0 && C.dateMs((r[ki] || '').trim()) ? r[ki].trim() : C.dateStr(Date.now());
        const ti = head.indexOf('test notes'); if (ti >= 0 && r[ti]) d.testNotes = r[ti].trim();
      }
      const keys = C.fields().filter(f => f.unique).map(f => [f.key, String(C.getVal(d, f)).toLowerCase()]).filter(k => k[1]);
      if (!look.some(f => C.getVal(d, f)) || keys.some(([k, v]) => have.get(k).has(v))) { skipped.push(r); continue; }
      keys.forEach(([k, v]) => have.get(k).add(v)); good.push(d);
    }
    const ok = await sheet(`<h2>Import devices</h2><p class="sub">${good.length} device${good.length === 1 ? '' : 's'} will be added.${skipped.length ? ` ${skipped.length} row${skipped.length === 1 ? '' : 's'} will be skipped because they have no identifier or one that already exists.` : ''}</p><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go" ${good.length ? '' : 'disabled'}>Import ${good.length}</button></div>`, { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => {
      try { for (let i = 0; i < good.length; i += 200) await S.commit({ puts: good.slice(i, i + 200).map(data => ({ type: 'item', data })) }); close(true); } catch (e) { toast(e.message, true); } }) });
    if (ok) { toast(`Imported ${good.length} devices`); A.route(); }
  }

  A.views.inventory = async (main) => {
    if (!A.can('inventory.read')) return swap(main, '<div class="page-head"><h1>Inventory</h1></div><div class="card"><div class="empty">Your user type does not include inventory.</div></div>');
    const can = A.can('inventory.write'), items = S.all('item'), models = modelsOf(), low = lowModels(), look = C.lookupFields().slice(0, 3);
    const shown = items.filter(e => (view.status === 'active' ? e.data.status === 'available' : view.status === 'all' ? e.data.status !== 'archived' : e.data.status === view.status) && (!view.model || e.data.model === view.model) && matches(e.data, view.q.toLowerCase())).sort((a, b) => C.receivedMs(b.data) - C.receivedMs(a.data));
    swap(main, `<div class="page-head row spread wrap"><div><h1>Inventory</h1><p>${items.filter(e => e.data.status === 'available').length} available · ${items.length} total. Only your team can read this.</p></div>
      ${can ? '<div class="row"><button class="btn secondary" id="imp">Import CSV</button><button class="btn secondary" id="exp">Export CSV</button><button class="btn" id="add">Add device</button></div><input type="file" id="file" accept=".csv,text/csv">' : '<div class="row"><button class="btn secondary" id="exp">Export CSV</button></div>'}</div>
      ${low.length ? `<div class="banner mb-lg">${low.map(m => `${esc(m.name)}: ${m.n} left (reorder at ${m.r})`).join(' · ')}</div>` : ''}
      <div class="toolbar"><input type="search" class="search" id="q" placeholder="Search ${esc(look.map(f => f.label).join(', ') || 'devices')}, make, model, notes" value="${esc(view.q)}" autocomplete="off">${UI.select.html({ id: 'st', options: FILTERS, value: view.status })}${UI.select.html({ id: 'md', options: [['', 'All models'], ...models.map(m => [m, m])], value: view.model })}</div>
      <div class="card"><div class="tablewrap">${shown.length ? `<table><thead><tr>${look.map(f => `<th>${esc(f.label)}</th>`).join('')}<th>Device</th><th class="right">Cost</th><th class="right">Price</th>${C.testsOn() ? '<th>Tests</th>' : ''}<th>Status</th></tr></thead><tbody>${shown.slice(0, LIMIT).map(e => { const d = e.data; return `<tr class="click" data-id="${esc(e.id)}">${look.map(f => `<td class="mono">${esc(C.showVal(f, C.getVal(d, f)) || '—')}</td>`).join('')}<td>${esc(C.deviceName(d) || '—')}</td><td class="right">${esc(F.money(d.cost))}</td><td class="right">${esc(F.money(d.price))}</td>${C.testsOn() ? `<td>${C.testChip(d)}</td>` : ''}<td>${C.statusChip(d.status)}</td></tr>`; }).join('')}</tbody></table>${shown.length > LIMIT ? `<p class="hint center my-md">Showing the first ${LIMIT} of ${shown.length}. Narrow the search to see the rest.</p>` : ''}` : `<div class="empty">${items.length ? 'No devices match.' : 'No devices yet.'}</div>`}</div></div>
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
