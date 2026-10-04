// APP / views / sell — quick sale: scan or type a UID, set prices, choose a customer, finish. One screen, works on a phone.
(() => {
  const { esc, toast, swap } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store;
  const st = { cart: [], mode: 'walk', cust: null, newc: { name: '', phone: '', email: '' }, payment: 'cash', notes: '', msg: '', warranty: '', orderPct: 0 };
  const reset = () => Object.assign(st, { cart: [], mode: 'walk', cust: null, newc: { name: '', phone: '', email: '' }, payment: 'cash', notes: '', msg: '', warranty: '', orderPct: 0 });
  const totals = () => C.saleTotals(st.cart, st.orderPct), total = () => totals().total;

  function lookup(code) {
    const c = C.cleanScan(code).toLowerCase(); if (!c) return null;
    const look = C.lookupFields(); return S.all('item').find(e => look.some(f => String(C.getVal(e.data, f)).toLowerCase() === c)) || null;
  }
  function add(code) {
    const e = lookup(code);
    if (!e) return `Nothing in your inventory matches "${code.trim()}".`;
    return addEntry(e);
  }
  function addEntry(e) {
    if (e.data.status === 'sold') return `${C.itemLabel(e.data)} was already sold${e.data.soldAt ? ' on ' + F.day(e.data.soldAt) : ''}.`;
    if (e.data.status !== 'available' && e.data.status !== 'returned') return `${C.itemLabel(e.data)} is marked ${C.STATUS[e.data.status]?.[1].toLowerCase() || e.data.status}, not available.`;
    if (st.cart.some(l => l.id === e.id)) return `${C.itemLabel(e.data)} is already in this sale.`;
    st.cart.push({ id: e.id, price: e.data.price || 0, pct: 0 }); return '';
  }

  async function finish(main) {
    if (!st.cart.length) return toast('Add at least one device.', true);
    let customer = null, puts = [];
    if (st.mode === 'existing') { if (!st.cust) return toast('Choose a customer, or switch to Walk-in.', true); customer = S.get('customer', st.cust); }
    if (st.mode === 'new') {
      if (!st.newc.name.trim()) return toast('Enter the new customer’s name.', true);
      if (!A.can('customers.write')) return toast('Your user type cannot add customers.', true);
      const id = Vault.newId(); customer = { id, data: { name: st.newc.name.trim(), phone: st.newc.phone.trim(), email: st.newc.email.trim(), notes: '', createdAt: Date.now() } }; puts.push({ type: 'customer', id, data: customer.data });
    }
    if (C.overCap(st.cart, st.orderPct)) return toast(`Discounts on this sale add up to more than the ${C.discountCap()}% you are allowed to give. Ask an Administrator, or reduce them.`, true);
    const untested = st.cart.map(l => S.get('item', l.id).data).filter(d => C.testState(d).missingRequired.length);
    if (untested.length && !await UI.confirmBox({ title: 'Required checks not done', body: `${untested.map(d => esc(C.itemLabel(d))).join(', ')} ${untested.length === 1 ? 'has' : 'have'} required test steps that are not ticked. Sell anyway? The sale record will show what was and was not done.`, confirmLabel: 'Sell anyway' })) return;
    const now = Date.now(), saleId = Vault.newId(), items = st.cart.map(l => { const it = S.get('item', l.id).data; return { id: l.id, uid: it.uid, serial: it.serial, mac: it.mac, make: it.make, model: it.model, fields: C.fieldSnapshot(it), inspection: C.inspectionSnapshot(it), listPrice: l.price, pct: C.pct(l.pct), price: C.lineNet(l.price, l.pct), cost: it.cost || 0 }; });
    const sale = { no: C.newReceiptNo(), ts: now, customerId: customer?.id || null, customerName: customer?.data.name || '', customerEmail: customer?.data.email || '', items, subtotal: totals().sub, orderPct: C.pct(st.orderPct), orderOff: totals().off, total: total(), cost: items.reduce((t, i) => t + i.cost, 0), payment: st.payment, warranty: C.warrantySnapshot(st.warranty || C.warrantyDefault(), now), notes: st.notes.trim() };
    puts.push({ type: 'sale', id: saleId, data: sale });
    for (const l of st.cart) { const cur = S.get('item', l.id); puts.push({ type: 'item', id: l.id, data: { ...cur.data, status: 'sold', soldAt: now, saleId, price: cur.data.price || l.price } }); }
    try { await S.commit({ puts }); } catch (e) { return toast(e.status === 409 ? 'One of these devices was just changed by someone else. Check the cart and try again.' : e.message, true); }
    const entry = S.get('sale', saleId); reset(); await C.showReceipt(entry, { canVoid: false }); render(main);
  }

  function render(main) {
    if (!A.can('sales.write')) return swap(main, '<div class="page-head"><h1>Quick sale</h1></div><div class="card"><div class="empty">Your user type cannot record sales.</div></div>');
    const picked = st.cust && S.get('customer', st.cust);
    swap(main, `<div class="page-head"><h1>Quick sale</h1><p>Scan or type a device identifier, set the price, and finish.</p></div>
      <div class="sell"><div><div class="card"><input type="text" id="scan" class="scan" placeholder="Scan or type a ${esc(C.lookupFields().map(f => f.label).join(', ') || 'device identifier')} and press Enter" autocomplete="off" autocapitalize="none"><div class="stock-tools mt-md"><button type="button" class="btn secondary small" id="browse">Browse available stock</button><button type="button" class="btn secondary small" id="bulk">Add by quantity</button>${C.modelCounts(C.availableStock(st.cart.map(l => l.id))).map(([m, n]) => `<button type="button" class="filter" data-model="${esc(m)}">${esc(m || 'No model')} · ${n}</button>`).join('')}</div><div class="hint mt-sm ${st.msg ? 'danger-text' : ''}" id="msg">${esc(st.msg)}</div></div>
        <div class="card"><h3>This sale</h3><div id="cart">${st.cart.length ? st.cart.map(l => { const it = S.get('item', l.id).data; return `<div class="cart-line"><div><div class="strong">${esc(C.deviceName(it) || 'Device')}</div><div class="mono muted">${esc(C.lookupFields().map(f => C.getVal(it, f)).filter(Boolean).join(' · '))}</div><div class="mt-xs">${C.testChip(it)}${C.testState(it).missingRequired.length ? ' <span class="chip red">Required checks missing</span>' : ''}</div></div><input type="number" class="price" min="0" step="0.01" data-line="${esc(l.id)}" value="${esc(F.dollars(l.price) || '0.00')}" aria-label="Price"><input type="number" class="pct" min="0" max="100" step="0.1" data-pct="${esc(l.id)}" value="${l.pct ? esc(l.pct) : ''}" placeholder="% off" aria-label="Percent off this device"><button type="button" class="icon-btn" data-rm="${esc(l.id)}" aria-label="Remove" title="Remove">✕</button></div>`; }).join('') : '<div class="empty">Nothing added yet.</div>'}</div></div></div>
        <div><div class="card"><h3>Customer</h3><div class="seg wide mt-sm" role="tablist"><button type="button" data-mode="walk" class="${st.mode === 'walk' ? 'on' : ''}">Walk-in</button><button type="button" data-mode="existing" class="${st.mode === 'existing' ? 'on' : ''}">Existing</button><button type="button" data-mode="new" class="${st.mode === 'new' ? 'on' : ''}">New</button></div>
          ${st.mode === 'existing' ? (picked ? `<div class="picked mt-md"><span>${esc(picked.data.name)}${picked.data.phone ? ' · ' + esc(picked.data.phone) : ''}</span><button class="btn secondary small" id="chg">Change</button></div>` : '<div class="mt-md"><input type="search" id="cs" placeholder="Search name, phone or email" autocomplete="off"><ul class="pick-list" id="cl" hidden></ul></div>') : ''}
          ${st.mode === 'new' ? `<div class="mt-md"><div class="field"><label>Name</label><input type="text" id="nn" value="${esc(st.newc.name)}"></div><div class="grid g2"><div class="field"><label>Phone</label><input type="text" id="np" value="${esc(st.newc.phone)}"></div><div class="field"><label>Email</label><input type="email" id="ne" value="${esc(st.newc.email)}"></div></div></div>` : ''}</div>
          <div class="card"><div class="field"><label>Warranty</label>${UI.select.html({ id: 'war', options: C.warrantyPeriods().filter(p => !p.archived).map(p => [p.key, p.label]), value: st.warranty || C.warrantyDefault() })}</div><div class="field"><label>Paid by</label>${UI.select.html({ id: 'pay', options: C.PAYMENTS, value: st.payment })}</div><div class="field"><label>Note (optional)</label><input type="text" id="nt" value="${esc(st.notes)}"></div>
            <div class="field mt-md"><label>% off the whole order${A.can('users.manage') ? '' : ` (you can give up to ${esc(C.discountCap())}%)`}</label><input type="number" id="op" min="0" max="100" step="0.1" value="${st.orderPct ? esc(st.orderPct) : ''}" placeholder="0"></div>
            <div class="sum-line" id="subrow" ${totals().list === totals().total ? 'hidden' : ''}><span>Subtotal before discounts</span><span id="sub">${esc(F.money(totals().list))}</span></div><div class="sum-line" id="saverow" ${totals().saved > 0 ? '' : 'hidden'}><span>You save</span><span id="save">${esc(F.money(totals().saved))}</span></div>
            <div class="total-line"><span>Total</span><span id="tot">${esc(F.money(total()))}</span></div><button class="btn block" id="done" ${st.cart.length ? '' : 'disabled'}>Complete sale</button></div></div></div>`);
    const q = (s) => main.querySelector(s), again = () => render(main);
    const sum = () => { const t = totals(); q('#tot').textContent = F.money(t.total); q('#sub').textContent = F.money(t.list); q('#save').textContent = F.money(t.saved); q('#subrow').hidden = t.saved <= 0; q('#saverow').hidden = t.saved <= 0; };
    const scan = q('#scan'); scan.focus();
    scan.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; e.preventDefault(); const v = scan.value; if (!C.cleanScan(v)) { scan.value = ''; return; } st.msg = add(v); again(); });
    const browse = async (model) => { const ids = await C.pickStock({ exclude: st.cart.map(l => l.id), model }); if (!ids?.length) return; const bad = ids.map(id => addEntry(S.get('item', id))).filter(Boolean); st.msg = bad.join(' '); again(); };
    q('#bulk').addEventListener('click', async () => { const ids = await C.pickQuantity({ exclude: st.cart.map(l => l.id) }); if (!ids?.length) return; st.msg = ids.map(id => addEntry(S.get('item', id))).filter(Boolean).join(' '); again(); });
    q('#browse').addEventListener('click', () => browse(''));
    main.querySelectorAll('[data-model]').forEach(b => b.addEventListener('click', () => browse(b.dataset.model)));
    main.querySelectorAll('[data-line]').forEach(i => i.addEventListener('input', () => { const l = st.cart.find(x => x.id === i.dataset.line); l.price = F.cents(i.value); sum(); }));
    main.querySelectorAll('[data-pct]').forEach(i => i.addEventListener('input', () => { const l = st.cart.find(x => x.id === i.dataset.pct); l.pct = C.pct(i.value); sum(); }));
    q('#op')?.addEventListener('input', (e) => { st.orderPct = C.pct(e.target.value); sum(); });
    main.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { st.cart = st.cart.filter(l => l.id !== b.dataset.rm); st.msg = ''; again(); }));
    main.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { st.mode = b.dataset.mode; again(); }));
    q('#chg')?.addEventListener('click', () => { st.cust = null; again(); });
    const cs = q('#cs'); cs?.addEventListener('input', () => {
      const t = cs.value.trim().toLowerCase(), list = q('#cl'), hits = t ? S.all('customer').filter(e => [e.data.name, e.data.phone, e.data.email].some(v => String(v || '').toLowerCase().includes(t))).slice(0, 6) : [];
      list.hidden = !hits.length; list.innerHTML = hits.map(e => `<li tabindex="0" data-c="${esc(e.id)}">${esc(e.data.name)}<span class="muted"> ${esc(e.data.phone || e.data.email || '')}</span></li>`).join('');
      list.querySelectorAll('li').forEach(li => li.addEventListener('click', () => { st.cust = li.dataset.c; again(); }));
    });
    for (const [id, k] of [['#nn', 'name'], ['#np', 'phone'], ['#ne', 'email']]) q(id)?.addEventListener('input', (e) => { st.newc[k] = e.target.value; });
    q('#war').addEventListener('change', (e) => { st.warranty = UI.select.value(e.target); });
    q('#pay').addEventListener('change', (e) => { st.payment = UI.select.value(e.target); });
    q('#nt').addEventListener('input', (e) => { st.notes = e.target.value; });
    q('#done').addEventListener('click', (e) => UI.busy(e.currentTarget, () => finish(main)));
  }
  A.views.sell = async (main) => render(main);
})();
