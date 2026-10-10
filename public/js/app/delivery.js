// APP / delivery — how a sale reaches the customer: Immediate, Shipping, Pickup or Meet. The form for Quick sale, the receipt lines, the "To ship / Shipped" status,
// the customer's saved address and the CSV columns. Everything lives inside the encrypted sale and customer records; nothing here talks to the server except a log note.
(() => {
  const { esc, toast, sheet } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store;
  const D = C.delivery = {};
  D.TYPES = [['immediate', 'Immediate'], ['shipping', 'Shipping'], ['pickup', 'Pickup'], ['meet', 'Meet']];
  D.LABEL = Object.fromEntries(D.TYPES);
  const clip = (v, n = 200) => String(v ?? '').trim().slice(0, n);
  const ADDR = ['name', 'street', 'unit', 'city', 'state', 'zip', 'country'];

  // ---- settings (Settings > Delivery and labels) ----
  D.cfg = () => ({ country: false, receiptNote: false, receiptDeliveryNote: false, ...(S.config().delivery || {}) });

  // ---- addresses ----
  D.addr = (a = {}) => Object.fromEntries(ADDR.map(k => [k, clip(a?.[k])]));
  D.hasAddr = (a) => ADDR.some(k => k !== 'name' && clip(a?.[k]));
  D.cityLine = (a) => [clip(a?.city), [clip(a?.state), clip(a?.zip)].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  D.lines = (a) => [clip(a?.street), clip(a?.unit), D.cityLine(a), clip(a?.country)].filter(Boolean);
  const addrText = (a) => [clip(a?.name), ...D.lines(a)].filter(Boolean).join(', ');
  D.addressText = addrText;

  // ---- what a sale carries ----
  D.of = (d) => d?.delivery || null;
  D.typeOf = (d) => d?.delivery?.type || 'immediate';        // old sales have no delivery and read as Immediate
  D.fee = (dl) => Math.max(0, Math.round(Number(dl?.fee) || 0));
  D.feeOf = (d) => D.typeOf(d) === 'shipping' ? D.fee(d.delivery) : 0;
  D.costOf = (d) => D.typeOf(d) === 'shipping' ? Math.max(0, Math.round(Number(d.delivery.cost) || 0)) : 0;
  D.due = (d) => (d?.total || 0) + D.feeOf(d);                // what the customer paid: items plus the shipping fee
  D.status = (d) => D.typeOf(d) === 'shipping' ? (d.delivery.status === 'shipped' ? 'shipped' : 'toship') : '';
  D.isToShip = (e) => !e.data.voided && D.status(e.data) === 'toship';
  D.matches = (d, key) => !key || (key === 'toship' ? !d.voided && D.status(d) === 'toship' : key === 'shipped' ? !d.voided && D.status(d) === 'shipped' : D.typeOf(d) === key);
  D.FILTER = [['', 'All deliveries'], ['toship', 'To ship'], ['shipped', 'Shipped'], ['shipping', 'Shipping'], ['pickup', 'Pickup'], ['meet', 'Meet'], ['immediate', 'Immediate']];
  D.tag = (d) => {
    const t = D.typeOf(d); if (t === 'immediate') return '';
    const s = D.status(d);
    return `<span class="chip blue">${esc(D.LABEL[t])}</span>${s ? ` <span class="chip ${s === 'shipped' ? 'green' : 'amber'}">${s === 'shipped' ? 'Shipped' : 'To ship'}</span>` : ''}`;
  };
  // Erasing a customer also removes the person's address and notes from their sales.
  D.erased = (dl) => dl ? { ...dl, shipTo: D.addr({}), note: '', notes: '', carrier: '', tracking: '' } : dl;
  D.note = (event) => { A.api('POST', '/delivery/note', { event }).catch(() => {}); };   // log only: the kind of event, never an address

  // ---- Quick sale form ----
  D.blank = () => ({ type: 'immediate', shipTo: D.addr({}), fee: '', cost: '', carrier: '', tracking: '', note: '', date: '', notes: '', save: true, touched: false, from: '' });
  // A saved address fills Ship to once, until the person types in it. The name falls back to the customer's name when the box is left empty.
  D.prefill = (dl, cust) => {
    if (dl.type !== 'shipping' || dl.touched) return;
    const id = cust?.id || '';
    if (dl.from === id && D.hasAddr(dl.shipTo)) return;
    dl.from = id; const saved = D.addr(cust?.data.address); dl.shipTo = { ...saved, name: saved.name || cust?.data.name || '' };
  };
  const inp = (id, label, v, extra = '') => `<div class="field"><label for="${id}">${esc(label)}</label><input type="text" id="${id}" value="${esc(v)}" autocomplete="off" ${extra}></div>`;
  D.addressFields = (a, p, { name = true, country = D.cfg().country } = {}) => `${name ? inp(p + 'n', 'Name', a.name) : ''}${inp(p + 's', 'Street', a.street)}${inp(p + 'u', 'Apartment or suite', a.unit)}<div class="grid g2">${inp(p + 'c', 'City', a.city)}${inp(p + 'st', 'State', a.state)}</div><div class="grid g2">${inp(p + 'z', 'ZIP', a.zip)}${country ? inp(p + 'co', 'Country', a.country) : ''}</div>`;
  D.readAddress = (root, p) => { const v = (s) => root.querySelector('#' + p + s)?.value ?? ''; return D.addr({ name: v('n'), street: v('s'), unit: v('u'), city: v('c'), state: v('st'), zip: v('z'), country: v('co') }); };
  D.formHtml = (dl, { canSave = false } = {}) => {
    if (dl.type === 'immediate') return '';
    if (dl.type === 'shipping') return `<div class="delivery-box" id="dbox"><h3>Ship to</h3>${D.addressFields(dl.shipTo, 'sh')}
      <div class="grid g2"><div class="field"><label for="dfee">Shipping fee charged to the customer</label><input type="number" id="dfee" min="0" step="0.01" value="${esc(dl.fee)}" placeholder="0.00"></div><div class="field"><label for="dcost">Your shipping cost (optional)</label><input type="number" id="dcost" min="0" step="0.01" value="${esc(dl.cost)}" placeholder="0.00"></div></div>
      <div class="hint mb-md">Your own shipping cost is for your profit figures only. It never appears on a receipt or a label.</div>
      <div class="grid g2">${inp('dcar', 'Carrier (optional)', dl.carrier)}${inp('dtr', 'Tracking number (optional)', dl.tracking)}</div>
      ${inp('dnote', 'Delivery note (optional)', dl.note, 'maxlength="200" placeholder="Fragile, leave at the door"')}
      ${canSave ? `<div class="setting"><div><div class="setting-title">Save this address to the customer</div><div class="setting-desc">Next time it fills in for you.</div></div><label class="switch"><input type="checkbox" id="dsave" aria-label="Save this address to the customer" ${dl.save ? 'checked' : ''}><i></i></label></div>` : ''}</div>`;
    return `<div class="delivery-box" id="dbox"><div class="field"><label for="dwhen">Date (optional)</label><input type="date" id="dwhen" value="${esc(dl.date)}"></div><div class="field"><label for="dnotes">${dl.type === 'meet' ? 'Notes (where, when, who)' : 'Pickup note (optional)'}</label><textarea id="dnotes" maxlength="500">${esc(dl.notes)}</textarea></div></div>`;
  };
  D.wireForm = (root, dl, onFee) => {
    const q = (s) => root.querySelector(s), on = (s, ev, fn) => q(s)?.addEventListener(ev, fn);
    const addr = () => { dl.shipTo = D.readAddress(root, 'sh'); dl.touched = true; };
    for (const s of ['n', 's', 'u', 'c', 'st', 'z', 'co']) on('#sh' + s, 'input', addr);
    on('#dfee', 'input', (e) => { dl.fee = e.target.value; onFee(); }); on('#dcost', 'input', (e) => { dl.cost = e.target.value; });
    on('#dcar', 'input', (e) => { dl.carrier = e.target.value; }); on('#dtr', 'input', (e) => { dl.tracking = e.target.value; }); on('#dnote', 'input', (e) => { dl.note = e.target.value; });
    on('#dwhen', 'change', (e) => { dl.date = e.target.value; }); on('#dnotes', 'input', (e) => { dl.notes = e.target.value; }); on('#dsave', 'change', (e) => { dl.save = e.target.checked; });
  };
  D.sumRow = (dl) => `<div class="sum-line" id="shiprow" ${dl.type === 'shipping' && D.fee({ fee: F.cents(dl.fee) }) > 0 ? '' : 'hidden'}><span>Shipping</span><span id="ship">${esc(F.money(F.cents(dl.fee)))}</span></div>`;
  D.sumUpdate = (root, dl, itemsTotal) => {
    const fee = dl.type === 'shipping' ? F.cents(dl.fee) : 0, row = root.querySelector('#shiprow');
    if (row) { row.hidden = fee <= 0; root.querySelector('#ship').textContent = F.money(fee); }
    root.querySelector('#tot').textContent = F.money(itemsTotal + fee);
  };
  D.dueNow = (dl, itemsTotal) => itemsTotal + (dl.type === 'shipping' ? F.cents(dl.fee) : 0);
  // Turns the form into what is stored on the sale, or says what is missing.
  D.build = (dl, customerName) => {
    if (dl.type === 'immediate') return { delivery: null };
    if (dl.type === 'shipping') {
      const shipTo = D.addr({ ...dl.shipTo, name: clip(dl.shipTo.name) || customerName });
      if (!shipTo.name) return { error: 'Enter who the parcel is for.' };
      if (!shipTo.street || !shipTo.city) return { error: 'Enter the street and city to ship to.' };
      const fee = F.cents(dl.fee), cost = F.cents(dl.cost);
      return { delivery: { type: 'shipping', shipTo, fee, cost, carrier: clip(dl.carrier, 80), tracking: clip(dl.tracking, 120), note: clip(dl.note), status: 'toship', shippedAt: 0, labelRef: '' } };
    }
    return { delivery: { type: dl.type, date: /^\d{4}-\d{2}-\d{2}$/.test(dl.date) ? dl.date : '', notes: clip(dl.notes, 500) } };
  };

  // ---- receipt (what the customer sees: the shipping fee, never the reseller's own cost) ----
  D.receiptHtml = (d) => {
    const dl = d.delivery; if (!dl) return '';
    const cfg = D.cfg();
    if (dl.type === 'shipping') return `<div class="receipt-delivery"><div class="strong">Ship to</div><div>${[clip(dl.shipTo?.name), ...D.lines(dl.shipTo)].filter(Boolean).map(esc).join('<br>')}</div>${cfg.receiptDeliveryNote && dl.note ? `<div class="sub text-sm mt-xs">${esc(dl.note)}</div>` : ''}</div>`;
    return `<div class="receipt-delivery"><div class="strong">${esc(D.LABEL[dl.type])}${dl.date ? ' · ' + esc(F.day(C.dateMs(dl.date))) : ''}</div>${cfg.receiptNote && dl.notes ? `<div class="sub text-sm mt-xs">${esc(dl.notes)}</div>` : ''}</div>`;
  };
  D.receiptFeeHtml = (d) => D.typeOf(d) === 'shipping' ? `<div class="line-sub"><span>Shipping</span><span>${esc(F.money(D.fee(d.delivery)))}</span></div>` : '';
  D.receiptText = (d) => {
    const dl = d.delivery; if (!dl) return [];
    const cfg = D.cfg();
    if (dl.type === 'shipping') return [`Ship to: ${addrText(dl.shipTo)}`, ...(cfg.receiptDeliveryNote && dl.note ? [`Delivery note: ${dl.note}`] : [])];
    return [`${D.LABEL[dl.type]}${dl.date ? ' on ' + F.day(C.dateMs(dl.date)) : ''}`, ...(cfg.receiptNote && dl.notes ? [dl.notes] : [])];
  };
  D.receiptFeeText = (d) => D.typeOf(d) === 'shipping' ? [`Shipping: ${F.money(D.fee(d.delivery))}`] : [];

  // ---- sale detail (staff only, never printed): status, tracking, internal cost, actions ----
  D.detailHtml = (sale, canWrite) => {
    const d = sale.data, t = D.typeOf(d); if (t === 'immediate') return '';
    const dl = d.delivery, s = D.status(d);
    if (t !== 'shipping') return `<div class="delivery-detail no-print"><div class="row spread"><h3>Delivery</h3>${D.tag(d)}</div>${dl.date ? `<div class="hint">${esc(F.day(C.dateMs(dl.date)))}</div>` : ''}${dl.notes ? `<p>${esc(dl.notes)}</p>` : ''}</div>`;
    return `<div class="delivery-detail no-print"><div class="row spread"><h3>Delivery</h3>${D.tag(d)}</div>
      <div class="delivery-facts"><span class="muted">Ship to</span><span>${[clip(dl.shipTo?.name), ...D.lines(dl.shipTo)].map(esc).join('<br>')}</span>
        <span class="muted">Carrier</span><span>${esc(dl.carrier || '—')}</span>
        <span class="muted">Tracking</span><span>${dl.tracking ? `<span class="ident">${esc(dl.tracking)}</span> <button type="button" class="linkbtn" id="dcopy">Copy</button>` : '—'}</span>
        ${s === 'shipped' ? `<span class="muted">Shipped</span><span>${esc(F.day(dl.shippedAt))}</span>` : ''}
        ${dl.note ? `<span class="muted">Delivery note</span><span>${esc(dl.note)}</span>` : ''}
        <span class="muted">Shipping charged</span><span>${esc(F.money(D.fee(dl)))}</span>
        <span class="muted">Your shipping cost</span><span>${esc(F.money(D.costOf(d)))} <span class="hint">internal</span></span></div>
      <div class="row wrap mt-md">${canWrite && !d.voided && s === 'toship' ? '<button type="button" class="btn small" id="dship">Mark shipped</button>' : ''}${canWrite && !d.voided ? '<button type="button" class="btn secondary small" id="dtrack">Edit tracking</button>' : ''}<button type="button" class="btn secondary small" id="dlabel">Print label</button></div></div>`;
  };
  D.wireDetail = (root, sale, close) => {
    const q = (s) => root.querySelector(s);
    q('#dcopy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(sale.data.delivery.tracking); toast('Tracking number copied'); } catch { toast('Copy it by selecting the number.', true); } });
    q('#dship')?.addEventListener('click', async () => { if (await D.shipSheet(sale, true)) close('shipped'); });
    q('#dtrack')?.addEventListener('click', async () => { if (await D.shipSheet(sale, false)) close('tracking'); });
    q('#dlabel')?.addEventListener('click', () => A.labels?.open([sale]));
  };
  // Mark shipped (date, carrier, tracking) or just edit carrier and tracking.
  D.shipSheet = async (sale, mark) => {
    const dl = sale.data.delivery;
    const ok = await sheet(`<h2>${mark ? 'Mark shipped' : 'Carrier and tracking'}</h2><p class="sub">${mark ? 'Carrier and tracking are optional and can be added later.' : 'A label prints fine without tracking. Add it later and print again.'}</p>
      ${mark ? `<div class="field mt-md"><label for="sdate">Date shipped</label><input type="date" id="sdate" value="${esc(C.dateStr(Date.now()))}" max="${esc(C.dateStr(Date.now()))}"></div>` : ''}
      <div class="field${mark ? '' : ' mt-md'}"><label for="scar">Carrier</label><input type="text" id="scar" value="${esc(dl.carrier || '')}" autocomplete="off"></div><div class="field"><label for="str">Tracking number</label><input type="text" id="str" value="${esc(dl.tracking || '')}" autocomplete="off"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save</button></div>`, { onMount: (el, close) => {
      el.querySelector('#go').addEventListener('click', async () => {
        const next = { ...dl, carrier: clip(el.querySelector('#scar').value, 80), tracking: clip(el.querySelector('#str').value, 120) };
        if (mark) { const day = el.querySelector('#sdate').value || C.dateStr(Date.now()); if (C.dateMs(day) > Date.now() + 864e5) return toast('Choose today or an earlier date.', true); next.status = 'shipped'; next.shippedAt = C.dateMs(day); }
        try { await S.commit({ puts: [{ type: 'sale', id: sale.id, data: { ...sale.data, delivery: next } }] }); D.note(mark ? 'shipped' : 'tracking'); toast(mark ? 'Marked shipped' : 'Saved'); close(true); } catch (e) { toast(e.message, true); }
      });
    } });
    return !!ok;
  };

  // ---- customer page: a saved address ----
  D.customerAddressHtml = (a = {}) => `<h3 class="mt-lg">Address</h3><p class="sub">Used to fill in Ship to on a sale. Optional.</p>${D.addressFields(a, 'ca', { name: false })}${D.hasAddr(a) ? '<div class="row"><button type="button" class="btn secondary small" id="caclear">Clear address</button></div>' : ''}`;
  D.readCustomerAddress = (root) => { const a = D.readAddress(root, 'ca'); return D.hasAddr(a) ? a : null; };
  D.wireCustomerAddress = (root) => root.querySelector('#caclear')?.addEventListener('click', () => { for (const s of ['s', 'u', 'c', 'st', 'z', 'co']) { const i = root.querySelector('#ca' + s); if (i) i.value = ''; } root.querySelector('#caclear').hidden = true; });

  // Sales page: shipping figures kept apart from revenue and profit (the reseller's own cost is internal, so it is shown here and never on a receipt).
  D.summaryHtml = (live) => {
    const ship = live.filter(e => D.typeOf(e.data) === 'shipping'); if (!ship.length) return '';
    const fee = ship.reduce((t, e) => t + D.fee(e.data.delivery), 0), cost = ship.reduce((t, e) => t + D.costOf(e.data), 0);
    return `<p class="hint mb-md">Shipping on ${ship.length} sale${ship.length === 1 ? '' : 's'}: ${esc(F.money(fee))} charged, ${esc(F.money(cost))} your cost. Revenue and Profit above already include shipping (Profit after shipping), after any refunds.</p>`;
  };

  // ---- CSV (added to the Sales export by delivery-ui.js) ----
  D.csvHeaders = ['delivery', 'delivery_status', 'ship_to', 'shipping_fee', 'shipping_cost', 'carrier', 'tracking', 'shipped_on', 'delivery_note', 'delivery_date', 'delivery_notes'];
  D.csvRow = (d) => { const dl = d.delivery, t = D.typeOf(d); return [D.LABEL[t], D.status(d) === 'shipped' ? 'Shipped' : D.status(d) === 'toship' ? 'To ship' : '', t === 'shipping' ? addrText(dl.shipTo) : '', t === 'shipping' ? F.dollars(D.fee(dl)) : '', t === 'shipping' ? F.dollars(D.costOf(d)) : '', dl?.carrier || '', dl?.tracking || '', dl?.shippedAt ? F.ymd(dl.shippedAt) : '', dl?.note || '', dl?.date || '', dl?.notes || '']; };
  D.addrHeaders = ['street', 'apartment_or_suite', 'city', 'state', 'zip', 'country'];
  D.addrRow = (a) => [a?.street || '', a?.unit || '', a?.city || '', a?.state || '', a?.zip || '', a?.country || ''];
})();
