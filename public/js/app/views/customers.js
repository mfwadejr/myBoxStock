// APP / views / customers — the people you sell to: search (name, phone, email, notes, address, receipt, tracking), sorting, quick filters and one-place history. Decrypted in the browser only.
(() => {
  const { esc, toast, sheet, swap } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store, D = C.delivery;
  // Kept while the app is open: search text, sort, quick filters, page and size.
  const st = { q: '', sort: 'name', dir: 'asc', chips: new Set(), page: 1, size: 25, sig: '' };
  const SORTS = [['name', 'Name', 'A to Z', 'Z to A'], ['last', 'Last purchase', 'newest first', 'oldest first'], ['spent', 'Total spent', 'high to low', 'low to high'], ['count', 'Number of purchases', 'most first', 'fewest first'], ['added', 'Recently added', 'newest first', 'oldest first']];
  const FIRST = { name: 'asc', last: 'desc', spent: 'desc', count: 'desc', added: 'desc' };   // the direction a column starts in when first clicked
  const CHIPS = [['addr', 'Has an address'], ['recent', 'Bought in the last 30 days'], ['none', 'No purchases yet']];
  const sortOptions = SORTS.flatMap(([k, l, a, b]) => [[`${k}:${FIRST[k]}`, `${l} (${a})`], [`${k}:${FIRST[k] === 'asc' ? 'desc' : 'asc'}`, `${l} (${b})`]]);
  const DAY = 864e5;

  const fields = (d = {}) => `<div class="field mt-md"><label for="name">Name</label><input type="text" id="name" value="${esc(d.name || '')}" autocomplete="off"></div><div class="field"><label for="phone">Phone</label><input type="text" id="phone" value="${esc(d.phone || '')}" autocomplete="off"></div><div class="field"><label for="email">Email</label><input type="email" id="email" value="${esc(d.email || '')}" autocomplete="off"></div><div class="field"><label for="notes">Notes</label><textarea id="notes">${esc(d.notes || '')}</textarea></div>${D.customerAddressHtml(d.address)}`;
  const read = (el, old = {}) => { const v = (id) => el.querySelector('#' + id).value.trim(); return { ...old, name: v('name'), phone: v('phone'), email: v('email'), notes: v('notes'), createdAt: old.createdAt || Date.now(), address: D.readCustomerAddress(el) || undefined }; };

  // ---- the figures: every sale of a customer (voided ones are kept for finding, not counted), totals are net of refunds and include shipping ----
  const salesBy = () => { const m = new Map(); for (const s of S.all('sale')) { const id = s.data.customerId; if (id) { if (!m.has(id)) m.set(id, []); m.get(id).push(s); } } return m; };
  const statsOf = (sales) => { const live = sales.filter(x => !x.data.voided); return { n: live.length, total: live.reduce((t, x) => t + A.returns.net(x.data).revenue, 0), last: live.reduce((m, x) => Math.max(m, x.data.ts), 0) }; };
  // Never includes the reseller's own costs: only what is also on the receipt, the shipment and the credit notes.
  const saleText = (d) => { const dl = d.delivery || {}; return [d.no, dl.tracking, dl.carrier, D.typeOf(d) === 'shipping' ? D.addressText(dl.shipTo) : '', ...A.returns.of(d).flatMap(r => [r.no, r.retTracking])].filter(Boolean).join(' '); };
  const textOf = (e, sales) => [e.data.name, e.data.phone, e.data.email, e.data.notes, D.addressText(e.data.address), ...sales.map(s => saleText(s.data))].filter(Boolean).join('\n').toLowerCase();

  const rows = () => {
    const by = salesBy(), now = Date.now(), q = st.q.trim().toLowerCase();
    const list = S.all('customer').map(e => { const sales = by.get(e.id) || []; return { e, sales, s: statsOf(sales) }; })
      .filter(r => !q || textOf(r.e, r.sales).includes(q))
      .filter(r => !st.chips.has('addr') || D.hasAddr(r.e.data.address))
      .filter(r => !st.chips.has('recent') || (r.s.last && r.s.last >= now - 30 * DAY))
      .filter(r => !st.chips.has('none') || r.s.n === 0);
    const sign = st.dir === 'asc' ? 1 : -1, byName = (a, b) => a.e.data.name.localeCompare(b.e.data.name);
    const key = { name: null, last: (r) => r.s.last, spent: (r) => r.s.total, count: (r) => r.s.n, added: (r) => r.e.data.createdAt || 0 }[st.sort];
    list.sort((a, b) => {
      if (!key) return sign * byName(a, b);
      if (st.sort === 'last' && !a.s.last !== !b.s.last) return a.s.last ? -1 : 1;   // customers who never bought stay at the end either way
      return sign * (key(a) - key(b)) || byName(a, b);
    });
    return list;
  };

  // ---- the customer page: details, address, then every sale and shipment in one place ----
  const historyHtml = (sales) => {
    if (!sales.length) return '<p class="sub">No purchases yet.</p>';
    return `<div class="buy-list">${sales.map(s => { const d = s.data, dl = d.delivery, ships = D.typeOf(d) === 'shipping', rets = A.returns.of(d), net = A.returns.net(d);
      return `<div class="buy-row click" data-sale="${esc(s.id)}"><div class="ident nowrap">${esc(d.no)}${d.voided ? ' <span class="chip red">Void</span>' : ''}</div><div class="right strong">${esc(F.money(D.due(d)))}</div>
        <div class="hint">${esc(F.day(d.ts))} · ${d.items.length} item${d.items.length === 1 ? '' : 's'}</div><div class="buy-chip">${d.voided ? '' : C.warrantyChip(d)}</div>
        <div class="buy-detail"><span class="hint">${d.items.map(it => esc(C.itemLabel(it))).join('; ')}</span></div>
        <div class="buy-detail">${D.tag(d)}${d.voided ? '' : A.returns.chip(d)}${ships && dl.tracking ? `<span class="hint">${dl.carrier ? esc(dl.carrier) + ' ' : ''}Tracking</span> <span class="ident">${esc(dl.tracking)}</span>` : ''}${ships && dl.shipTo ? `<span class="hint">${esc(D.addressText(dl.shipTo))}</span>` : ''}</div>
        ${rets.length ? `<div class="buy-detail">${rets.map(r => `<span class="hint">Refund ${esc(F.money(r.net))} · credit note ${esc(r.no)} · ${esc(F.day(r.ts))}${r.retTracking ? ` · return tracking ${esc(r.retTracking)}` : ''}</span>`).join('')}${d.voided ? '' : `<span class="hint">Net ${esc(F.money(net.revenue))}</span>`}</div>` : ''}
        <div class="buy-detail"><button type="button" class="linkbtn" data-receipt="${esc(s.id)}">Receipt</button>${ships && !d.voided ? `<button type="button" class="linkbtn" data-plabel="${esc(s.id)}">Print label</button>` : ''}</div></div>`; }).join('')}</div>`;
  };

  A.customerSheet = (e) => {
    const d = e?.data, can = A.can('customers.write'), sales = e ? S.all('sale').filter(s => s.data.customerId === e.id).sort((a, b) => b.data.ts - a.data.ts) : [], sum = statsOf(sales);
    return sheet(`<h2>${e ? esc(d.name) : 'Add customer'}</h2>${e ? `<p class="sub" id="csum"><b>${esc(F.money(sum.total))}</b> spent across ${sum.n} purchase${sum.n === 1 ? '' : 's'}${sum.last ? ` · last on ${esc(F.day(sum.last))}` : ''}${sales.some(s => A.returns.hasReturns(s.data)) ? ' (after refunds)' : ''}</p>` : ''}${fields(d)}${e ? `<h3 class="mt-lg">Purchases and shipments</h3>${historyHtml(sales)}` : ''}
      <div class="actions split"><div class="row">${e && can ? '<button class="btn danger small" id="del">Delete</button><button class="btn secondary small" id="era">Erase</button>' : ''}${e ? '<button class="btn secondary small" id="xp">Export</button>' : ''}</div><div class="row"><button class="btn secondary" data-cancel>${can ? 'Cancel' : 'Close'}</button>${can ? '<button class="btn" id="go">Save</button>' : ''}</div></div>`, { onMount: (el, close) => {
      D.wireCustomerAddress(el);
      if (!can) el.querySelectorAll('input,textarea').forEach(i => { i.disabled = true; });
      el.querySelectorAll('[data-sale]').forEach(tr => tr.addEventListener('click', () => C.showReceipt(S.get('sale', tr.dataset.sale))));
      el.querySelectorAll('[data-receipt],[data-plabel]').forEach(b => b.addEventListener('click', (ev) => { ev.stopPropagation(); const sale = S.get('sale', b.dataset.receipt || b.dataset.plabel); if (!sale) return; if (b.dataset.plabel) A.labels?.open([sale]); else C.showReceipt(sale); }));
      el.querySelector('#go')?.addEventListener('click', async () => { try { const n = read(el, d); if (!n.name) return toast('Enter a name.', true); const [id] = await S.commit({ puts: [{ type: 'customer', id: e?.id, data: n }] }); toast('Saved'); close(id); } catch (er) { toast(er.message, true); } });
      el.querySelector('#xp')?.addEventListener('click', () => A.exportCustomer(e));
      el.querySelector('#era')?.addEventListener('click', async () => { try { if (await A.eraseCustomer(e)) close(true); } catch (er) { toast(er.message, true); } });
      el.querySelector('#del')?.addEventListener('click', async () => { if (!await UI.confirmBox({ title: 'Delete this customer?', body: 'Their past sales stay in your history under their name.', confirmLabel: 'Delete', danger: true })) return; try { await S.commit({ deletes: [{ type: 'customer', id: e.id }] }); toast('Deleted'); close('deleted'); } catch (er) { toast(er.message, true); } });
    } });
  };

  // "/" or Ctrl/Cmd+K jumps to the search box on this page (not while typing, not while a sheet is open).
  document.addEventListener('keydown', (ev) => {
    if (!/^#\/customers/.test(location.hash) || document.querySelector('.scrim')) return;
    const box = document.getElementById('q'); if (!box) return;
    const typing = /^(INPUT|TEXTAREA)$/.test(ev.target.tagName) || ev.target.isContentEditable;
    if (((ev.key === '/' && !typing) || ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k')) && !ev.altKey) { ev.preventDefault(); box.focus(); box.select(); }
  });

  A.views.customers = async (main) => {
    if (!A.can('customers.read')) return swap(main, '<div class="page-head"><h1>Customers</h1></div><div class="card"><div class="empty">Your user type does not include customers.</div></div>');
    const total = S.all('customer').length, all = rows(), filtering = !!(st.q.trim() || st.chips.size);
    const sig = JSON.stringify([st.q, st.sort, st.dir, [...st.chips]]); if (sig !== st.sig) { st.sig = sig; st.page = 1; }   // a new search, sort or filter goes back to page 1
    st.page = Math.min(Math.max(1, st.page), Math.max(1, Math.ceil(all.length / st.size)));
    const arrow = (k) => st.sort === k ? (st.dir === 'asc' ? '▲' : '▼') : '', th = (k, label, cls = '') => `<th class="${cls}" aria-sort="${st.sort === k ? (st.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" class="th-sort${st.sort === k ? ' on' : ''}" data-sort="${k}">${label} <span class="sort-arrow" aria-hidden="true">${arrow(k)}</span></button></th>`;
    swap(main, `<div class="page-head row spread wrap"><div><h1>Customers</h1><p>${total} customers. Only your team can read this.</p></div>${A.can('customers.write') ? '<button class="btn" id="add">Add customer</button>' : ''}</div>
      <div class="toolbar"><div class="search-box"><input type="search" class="search" id="q" placeholder="Search name, phone, email, address, receipt, tracking" aria-label="Search customers" aria-keyshortcuts="/" value="${esc(st.q)}" autocomplete="off">${st.q ? '<button type="button" class="search-clear" id="qclear" aria-label="Clear search">✕</button>' : ''}</div>${UI.select.html({ id: 'csort', options: sortOptions, value: `${st.sort}:${st.dir}`, cls: 'sort-pick' })}</div>
      <div class="filters mb-md" role="group" aria-label="Quick filters">${CHIPS.map(([k, l]) => `<button type="button" class="filter ${st.chips.has(k) ? 'on' : ''}" data-chip="${k}" aria-pressed="${st.chips.has(k)}">${l}</button>`).join('')}${filtering ? '<button type="button" class="linkbtn" id="cclr">Clear search and filters</button>' : ''}</div>
      <p class="hint mb-md" id="ccount" role="status" aria-live="polite">${filtering ? `${all.length} result${all.length === 1 ? '' : 's'}` : `${total} customer${total === 1 ? '' : 's'}`}</p>
      <div class="card"><div class="tablewrap">${all.length ? `<table><thead><tr>${th('name', 'Name')}<th>Phone</th><th>Email</th>${th('count', 'Purchases', 'right')}${th('spent', 'Spent', 'right')}${th('last', 'Last purchase')}${th('added', 'Added')}</tr></thead><tbody>${all.slice((st.page - 1) * st.size, st.page * st.size).map(({ e, s }) => `<tr class="click" data-id="${esc(e.id)}"><td data-label="Name">${esc(e.data.name)}</td><td data-label="Phone">${esc(e.data.phone || '—')}</td><td data-label="Email">${esc(e.data.email || '—')}</td><td class="right" data-label="Purchases">${s.n}</td><td class="right" data-label="Spent">${esc(F.money(s.total))}</td><td class="muted" data-label="Last purchase">${s.last ? esc(F.day(s.last)) : '—'}</td><td class="muted" data-label="Added">${e.data.createdAt ? esc(F.day(e.data.createdAt)) : '—'}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${total ? 'No customers match.' : 'No customers yet. They are added here or during a quick sale.'}</div>`}</div><div id="pg"></div></div>`);
    const again = () => A.views.customers(main);
    UI.pager(main.querySelector('#pg'), { page: st.page, size: st.size, total: all.length, change: (n) => { st.page = n.page; st.size = n.size; again(); } });
    const input = main.querySelector('#q');
    input.addEventListener('input', (e) => { st.q = e.target.value; clearTimeout(again.t); again.t = setTimeout(async () => { const pos = e.target.selectionStart; await again(); const i = main.querySelector('#q'); i.focus(); i.setSelectionRange(pos, pos); }, 180); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.q) { e.preventDefault(); st.q = ''; again().then(() => main.querySelector('#q').focus()); } });
    main.querySelector('#qclear')?.addEventListener('click', async () => { st.q = ''; await again(); main.querySelector('#q').focus(); });
    main.querySelector('#cclr')?.addEventListener('click', () => { st.q = ''; st.chips.clear(); again(); });
    main.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.chip; if (st.chips.has(k)) st.chips.delete(k); else { st.chips.add(k); if (k === 'recent') st.chips.delete('none'); if (k === 'none') st.chips.delete('recent'); } again(); }));
    main.querySelector('#csort').addEventListener('change', (e) => { [st.sort, st.dir] = UI.select.value(e.target).split(':'); again(); });
    main.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.sort; if (st.sort === k) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.sort = k; st.dir = FIRST[k]; } again(); }));
    main.querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', async () => { if (await A.customerSheet(S.get('customer', tr.dataset.id))) again(); }));
    main.querySelector('#add')?.addEventListener('click', async () => { if (await A.customerSheet()) again(); });
  };
})();
