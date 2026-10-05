// APP / views / customers — the people you sell to, with their purchase history. Decrypted in the browser only.
(() => {
  const { esc, toast, sheet, swap } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store;
  let q = '';
  const fields = (d = {}) => `<div class="field mt-md"><label>Name</label><input type="text" id="name" value="${esc(d.name || '')}" autocomplete="off"></div><div class="field"><label>Phone</label><input type="text" id="phone" value="${esc(d.phone || '')}" autocomplete="off"></div><div class="field"><label>Email</label><input type="email" id="email" value="${esc(d.email || '')}" autocomplete="off"></div><div class="field"><label>Notes</label><textarea id="notes">${esc(d.notes || '')}</textarea></div>`;
  const read = (el, old = {}) => { const v = (id) => el.querySelector('#' + id).value.trim(); return { ...old, name: v('name'), phone: v('phone'), email: v('email'), notes: v('notes'), createdAt: old.createdAt || Date.now() }; };
  const stats = (id) => { const s = C.salesOf(id); return { n: s.length, total: s.reduce((t, x) => t + x.data.total, 0), last: s.reduce((m, x) => Math.max(m, x.data.ts), 0) }; };

  A.customerSheet = (e) => {
    const d = e?.data, can = A.can('customers.write'), sales = e ? C.salesOf(e.id).sort((a, b) => b.data.ts - a.data.ts) : [];
    return sheet(`<h2>${e ? esc(d.name) : 'Add customer'}</h2>${fields(d)}${e ? `<h3 class="mt-lg">Purchases</h3>${sales.length ? `<div class="buy-list">${sales.map(s => `<div class="buy-row click" data-sale="${esc(s.id)}"><div class="mono nowrap">${esc(s.data.no)}</div><div class="right strong">${esc(F.money(s.data.total))}</div><div class="hint">${esc(F.day(s.data.ts))} · ${s.data.items.length} item${s.data.items.length === 1 ? '' : 's'}</div><div class="buy-chip">${C.warrantyChip(s.data)}</div></div>`).join('')}</div>` : '<p class="sub">No purchases yet.</p>'}` : ''}
      <div class="actions split"><div class="row">${e && can ? '<button class="btn danger small" id="del">Delete</button><button class="btn secondary small" id="era">Erase</button>' : ''}${e ? '<button class="btn secondary small" id="xp">Export</button>' : ''}</div><div class="row"><button class="btn secondary" data-cancel>${can ? 'Cancel' : 'Close'}</button>${can ? '<button class="btn" id="go">Save</button>' : ''}</div></div>`, { onMount: (el, close) => {
      if (!can) el.querySelectorAll('input,textarea').forEach(i => { i.disabled = true; });
      el.querySelectorAll('[data-sale]').forEach(tr => tr.addEventListener('click', () => C.showReceipt(S.get('sale', tr.dataset.sale))));
      el.querySelector('#go')?.addEventListener('click', async () => { try { const n = read(el, d); if (!n.name) return toast('Enter a name.', true); const [id] = await S.commit({ puts: [{ type: 'customer', id: e?.id, data: n }] }); toast('Saved'); close(id); } catch (er) { toast(er.message, true); } });
      el.querySelector('#xp')?.addEventListener('click', () => A.exportCustomer(e));
      el.querySelector('#era')?.addEventListener('click', async () => { try { if (await A.eraseCustomer(e)) close(true); } catch (er) { toast(er.message, true); } });
      el.querySelector('#del')?.addEventListener('click', async () => { if (!await UI.confirmBox({ title: 'Delete this customer?', body: 'Their past sales stay in your history under their name.', confirmLabel: 'Delete', danger: true })) return; try { await S.commit({ deletes: [{ type: 'customer', id: e.id }] }); toast('Deleted'); close('deleted'); } catch (er) { toast(er.message, true); } });
    } });
  };

  A.views.customers = async (main) => {
    if (!A.can('customers.read')) return swap(main, '<div class="page-head"><h1>Customers</h1></div><div class="card"><div class="empty">Your user type does not include customers.</div></div>');
    const all = S.all('customer').filter(e => !q || [e.data.name, e.data.phone, e.data.email, e.data.notes].some(v => String(v || '').toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.data.name.localeCompare(b.data.name));
    swap(main, `<div class="page-head row spread wrap"><div><h1>Customers</h1><p>${S.all('customer').length} customers. Only your team can read this.</p></div>${A.can('customers.write') ? '<button class="btn" id="add">Add customer</button>' : ''}</div>
      <div class="toolbar"><input type="search" class="search" id="q" placeholder="Search name, phone, email" value="${esc(q)}" autocomplete="off"></div>
      <div class="card"><div class="tablewrap">${all.length ? `<table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th class="right">Purchases</th><th class="right">Spent</th><th>Last purchase</th></tr></thead><tbody>${all.map(e => { const s = stats(e.id); return `<tr class="click" data-id="${esc(e.id)}"><td>${esc(e.data.name)}</td><td>${esc(e.data.phone || '—')}</td><td>${esc(e.data.email || '—')}</td><td class="right">${s.n}</td><td class="right">${esc(F.money(s.total))}</td><td class="muted">${s.last ? esc(F.day(s.last)) : '—'}</td></tr>`; }).join('')}</tbody></table>` : `<div class="empty">${S.all('customer').length ? 'No customers match.' : 'No customers yet. They are added here or during a quick sale.'}</div>`}</div></div>`);
    const again = () => A.views.customers(main);
    main.querySelector('#q').addEventListener('input', (e) => { q = e.target.value; clearTimeout(again.t); again.t = setTimeout(async () => { const pos = e.target.selectionStart; await again(); const i = main.querySelector('#q'); i.focus(); i.setSelectionRange(pos, pos); }, 180); });
    main.querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', async () => { if (await A.customerSheet(S.get('customer', tr.dataset.id))) again(); }));
    main.querySelector('#add')?.addEventListener('click', async () => { if (await A.customerSheet()) again(); });
  };
})();
