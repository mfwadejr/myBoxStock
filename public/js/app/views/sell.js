// APP / views / sell — quick sale: scan or type a UID, set prices, choose a customer, finish. One screen, works on a phone.
(() => {
  const { esc, toast, swap } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store;
  const st = { cart: [], mode: 'walk', cust: null, newc: { name: '', phone: '', email: '' }, payment: 'cash', notes: '', msg: '' };
  const reset = () => Object.assign(st, { cart: [], mode: 'walk', cust: null, newc: { name: '', phone: '', email: '' }, payment: 'cash', notes: '', msg: '' });
  const total = () => st.cart.reduce((t, l) => t + l.price, 0);

  function lookup(code) {
    const c = code.trim().toLowerCase(); if (!c) return null;
    const look = C.lookupFields(); return S.all('item').find(e => look.some(f => String(C.getVal(e.data, f)).toLowerCase() === c)) || null;
  }
  function add(code) {
    const e = lookup(code);
    if (!e) return `Nothing in your inventory matches "${code.trim()}".`;
    if (e.data.status === 'sold') return `${C.itemLabel(e.data)} was already sold${e.data.soldAt ? ' on ' + F.day(e.data.soldAt) : ''}.`;
    if (e.data.status !== 'available' && e.data.status !== 'returned') return `${C.itemLabel(e.data)} is marked ${C.STATUS[e.data.status]?.[1].toLowerCase() || e.data.status}, not available.`;
    if (st.cart.some(l => l.id === e.id)) return `${C.itemLabel(e.data)} is already in this sale.`;
    st.cart.push({ id: e.id, price: e.data.price || 0 }); return '';
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
    const untested = st.cart.map(l => S.get('item', l.id).data).filter(d => C.testState(d).missingRequired.length);
    if (untested.length && !await UI.confirmBox({ title: 'Required checks not done', body: `${untested.map(d => esc(C.itemLabel(d))).join(', ')} ${untested.length === 1 ? 'has' : 'have'} required test steps that are not ticked. Sell anyway? The sale record will show what was and was not done.`, confirmLabel: 'Sell anyway' })) return;
    const now = Date.now(), saleId = Vault.newId(), items = st.cart.map(l => { const it = S.get('item', l.id).data; return { id: l.id, uid: it.uid, serial: it.serial, mac: it.mac, model: it.model, fields: C.fieldSnapshot(it), inspection: C.inspectionSnapshot(it), price: l.price, cost: it.cost || 0 }; });
    const sale = { no: C.newReceiptNo(), ts: now, customerId: customer?.id || null, customerName: customer?.data.name || '', customerEmail: customer?.data.email || '', items, total: total(), cost: items.reduce((t, i) => t + i.cost, 0), payment: st.payment, notes: st.notes.trim() };
    puts.push({ type: 'sale', id: saleId, data: sale });
    for (const l of st.cart) { const cur = S.get('item', l.id); puts.push({ type: 'item', id: l.id, data: { ...cur.data, status: 'sold', soldAt: now, saleId, price: cur.data.price || l.price } }); }
    try { await S.commit({ puts }); } catch (e) { return toast(e.status === 409 ? 'One of these devices was just changed by someone else. Check the cart and try again.' : e.message, true); }
    const entry = S.get('sale', saleId); reset(); await C.showReceipt(entry, { canVoid: false }); render(main);
  }

  function render(main) {
    if (!A.can('sales.write')) return swap(main, '<div class="page-head"><h1>Quick sale</h1></div><div class="card"><div class="empty">Your user type cannot record sales.</div></div>');
    const picked = st.cust && S.get('customer', st.cust);
    swap(main, `<div class="page-head"><h1>Quick sale</h1><p>Scan or type a device identifier, set the price, and finish.</p></div>
      <div class="sell"><div><div class="card"><input type="text" id="scan" class="scan" placeholder="Scan or type a ${esc(C.lookupFields().map(f => f.label).join(', ') || 'device identifier')} and press Enter" autocomplete="off" autocapitalize="none"><div class="hint mt-sm ${st.msg ? 'danger-text' : ''}" id="msg">${esc(st.msg)}</div></div>
        <div class="card"><h3>This sale</h3><div id="cart">${st.cart.length ? st.cart.map(l => { const it = S.get('item', l.id).data; return `<div class="cart-line"><div><div class="strong">${esc(it.model || 'Device')}</div><div class="mono muted">${esc(C.lookupFields().map(f => C.getVal(it, f)).filter(Boolean).join(' · '))}</div><div class="mt-xs">${C.testChip(it)}${C.testState(it).missingRequired.length ? ' <span class="chip red">Required checks missing</span>' : ''}</div></div><input type="number" class="price" min="0" step="0.01" data-line="${esc(l.id)}" value="${esc(F.dollars(l.price) || '0.00')}" aria-label="Price"><button class="btn secondary small" data-rm="${esc(l.id)}" aria-label="Remove">✕</button></div>`; }).join('') : '<div class="empty">Nothing added yet.</div>'}</div></div></div>
        <div><div class="card"><h3>Customer</h3><div class="seg wide mt-sm" role="tablist"><button type="button" data-mode="walk" class="${st.mode === 'walk' ? 'on' : ''}">Walk-in</button><button type="button" data-mode="existing" class="${st.mode === 'existing' ? 'on' : ''}">Existing</button><button type="button" data-mode="new" class="${st.mode === 'new' ? 'on' : ''}">New</button></div>
          ${st.mode === 'existing' ? (picked ? `<div class="picked mt-md"><span>${esc(picked.data.name)}${picked.data.phone ? ' · ' + esc(picked.data.phone) : ''}</span><button class="btn secondary small" id="chg">Change</button></div>` : '<div class="mt-md"><input type="search" id="cs" placeholder="Search name, phone or email" autocomplete="off"><ul class="pick-list" id="cl" hidden></ul></div>') : ''}
          ${st.mode === 'new' ? `<div class="mt-md"><div class="field"><label>Name</label><input type="text" id="nn" value="${esc(st.newc.name)}"></div><div class="grid g2"><div class="field"><label>Phone</label><input type="text" id="np" value="${esc(st.newc.phone)}"></div><div class="field"><label>Email</label><input type="email" id="ne" value="${esc(st.newc.email)}"></div></div></div>` : ''}</div>
          <div class="card"><div class="field"><label>Paid by</label>${UI.select.html({ id: 'pay', options: C.PAYMENTS, value: st.payment })}</div><div class="field"><label>Note (optional)</label><input type="text" id="nt" value="${esc(st.notes)}"></div>
            <div class="total-line"><span>Total</span><span id="tot">${esc(F.money(total()))}</span></div><button class="btn block" id="done" ${st.cart.length ? '' : 'disabled'}>Complete sale</button></div></div></div>`);
    const q = (s) => main.querySelector(s), again = () => render(main);
    const scan = q('#scan'); scan.focus();
    scan.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; e.preventDefault(); const v = scan.value; if (!v.trim()) return; st.msg = add(v); again(); });
    main.querySelectorAll('[data-line]').forEach(i => i.addEventListener('input', () => { const l = st.cart.find(x => x.id === i.dataset.line); l.price = F.cents(i.value); q('#tot').textContent = F.money(total()); }));
    main.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { st.cart = st.cart.filter(l => l.id !== b.dataset.rm); st.msg = ''; again(); }));
    main.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { st.mode = b.dataset.mode; again(); }));
    q('#chg')?.addEventListener('click', () => { st.cust = null; again(); });
    const cs = q('#cs'); cs?.addEventListener('input', () => {
      const t = cs.value.trim().toLowerCase(), list = q('#cl'), hits = t ? S.all('customer').filter(e => [e.data.name, e.data.phone, e.data.email].some(v => String(v || '').toLowerCase().includes(t))).slice(0, 6) : [];
      list.hidden = !hits.length; list.innerHTML = hits.map(e => `<li tabindex="0" data-c="${esc(e.id)}">${esc(e.data.name)}<span class="muted"> ${esc(e.data.phone || e.data.email || '')}</span></li>`).join('');
      list.querySelectorAll('li').forEach(li => li.addEventListener('click', () => { st.cust = li.dataset.c; again(); }));
    });
    for (const [id, k] of [['#nn', 'name'], ['#np', 'phone'], ['#ne', 'email']]) q(id)?.addEventListener('input', (e) => { st.newc[k] = e.target.value; });
    q('#pay').addEventListener('change', (e) => { st.payment = UI.select.value(e.target); });
    q('#nt').addEventListener('input', (e) => { st.notes = e.target.value; });
    q('#done').addEventListener('click', (e) => UI.busy(e.currentTarget, () => finish(main)));
  }
  A.views.sell = async (main) => render(main);
})();
