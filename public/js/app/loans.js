// APP / loans — lend a device out (demo, RMA replacement, loaner during a repair...) and take it back. The loans live inside the device record (item.loans),
// so they are encrypted, backed up and restored with it. Borrowers are existing customers or new people saved as prospects. Everything is worked out in the browser.
(() => {
  const { esc, toast, sheet } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store, D = C.delivery;
  const L = A.loans = {};
  const DAY = 864e5, today = () => C.dateStr(Date.now());
  const clip = (v, n = 500) => String(v ?? '').trim().slice(0, n);
  const atDate = (s) => !s || s === today() ? Date.now() : new Date(`${s}T12:00:00`).getTime();

  // ---- reading loans ----
  L.cfg = () => S.config().loans;
  L.of = (d) => Array.isArray(d?.loans) ? d.loans : [];
  L.open = (d) => L.of(d).find(l => !l.inAt) || null;
  L.days = (l) => Math.max(0, Math.floor(((l.inAt || Date.now()) - l.outAt) / DAY));
  L.overdue = (l) => !l.inAt && !!l.dueAt && l.dueAt < today();
  L.who = (l) => l.customer?.name || 'Erased customer';
  L.reasonOf = (key) => L.cfg().reasons.find(r => r.key === key);
  L.canKeep = (l) => !!L.reasonOf(l.reason)?.canKeep;
  // Every loan that is out right now, overdue first, then the longest out.
  L.outNow = () => S.all('item').filter(e => e.data.status === 'loaned' && L.open(e.data)).map(e => ({ e, l: L.open(e.data) })).sort((a, b) => Number(L.overdue(b.l)) - Number(L.overdue(a.l)) || a.l.outAt - b.l.outAt);
  L.forCustomer = (id) => S.all('item').flatMap(e => L.of(e.data).filter(l => l.customerId === id).map(l => ({ e, l }))).sort((a, b) => b.l.outAt - a.l.outAt);
  const LOANED = 'loaned';
  const chipOf = (l) => !l.inAt ? (L.overdue(l) ? '<span class="chip red">Overdue</span>' : '<span class="chip blue">On demo</span>') : l.outcome === 'kept' ? '<span class="chip gray">Kept</span>' : l.outcome === 'sold' ? '<span class="chip green">Sold</span>' : l.condition === 'damaged' ? '<span class="chip red">Back damaged</span>' : '<span class="chip green">Back</span>';

  // One loan as a row (used on the device sheet and the customer sheet).
  const rowHtml = (e, l, { device = false } = {}) => {
    const dl = l.delivery, miss = (l.missing || []).map(x => x.label).join(', ');
    return `<div class="buy-row" data-loan="${esc(l.id)}"><div class="ident nowrap">${esc(device ? C.itemLabel(e.data) : L.who(l))}</div><div class="right">${chipOf(l)}</div>
      <div class="hint">${esc(l.reasonLabel || 'Loan')} · out ${esc(F.day(l.outAt))}${l.dueAt && !l.inAt ? ` · due ${esc(F.day(C.dateMs(l.dueAt)))}` : ''}${l.inAt ? ` · back ${esc(F.day(l.inAt))}` : ` · ${L.days(l)} day${L.days(l) === 1 ? '' : 's'}`}${l.remindedAt && !l.inAt ? ` · reminded ${esc(F.day(l.remindedAt))}` : ''}</div><div class="buy-chip"></div>
      <div class="buy-detail"><span class="hint">${esc(D.LABEL[dl?.type] || 'Pickup')}${dl?.type === 'shipping' && dl.carrier ? ' · ' + esc(dl.carrier) : ''}</span>${dl?.type === 'shipping' && dl.tracking ? `<span class="ident">${esc(dl.tracking)}</span>` : ''}${l.customer?.phone ? `<span class="hint">${esc(l.customer.phone)}</span>` : ''}${l.customer?.email ? `<span class="hint">${esc(l.customer.email)}</span>` : ''}</div>
      ${miss ? `<div class="buy-detail"><span class="hint">Not returned: ${esc(miss)}</span></div>` : ''}${l.damageNote ? `<div class="buy-detail"><span class="hint">Damage: ${esc(l.damageNote)}</span></div>` : ''}${l.outNote || l.inNote ? `<div class="buy-detail"><span class="hint">${esc([l.outNote, l.inNote].filter(Boolean).join(' · '))}</span></div>` : ''}</div>`;
  };
  // The loan history shown on a device.
  L.historyHtml = (e) => { const list = L.of(e.data).slice().sort((a, b) => b.outAt - a.outAt); return list.length ? `<h3 class="mt-lg">Demo and loan history</h3><div class="buy-list">${list.map(l => rowHtml(e, l)).join('')}</div>` : ''; };
  L.customerHtml = (id) => { const list = L.forCustomer(id); return list.length ? `<h3 class="mt-lg">Demo units and loans</h3><div class="buy-list">${list.map(x => rowHtml(x.e, x.l, { device: true })).join('')}</div>` : ''; };

  // ---- buttons on the device sheet ----
  const lendable = (d) => d.status === 'available' || d.status === 'returned';
  L.buttonsHtml = (d) => d.status === LOANED && L.open(d) ? '<button class="btn secondary small" id="lback" type="button">Return from demo</button><button class="btn secondary small" id="lsell" type="button">Sell to borrower</button>' : lendable(d) ? '<button class="btn secondary small" id="lend" type="button">Lend out</button>' : '';
  L.wireItem = (el, e, close) => {
    const after = async (p) => { const r = await p; if (r) close(true); };
    el.querySelector('#lend')?.addEventListener('click', () => after(L.lend(S.get('item', e.id))));
    el.querySelector('#lback')?.addEventListener('click', () => after(L.back(S.get('item', e.id))));
    el.querySelector('#lsell')?.addEventListener('click', () => { const l = L.open(e.data); close(true); A.sellTo(e.id, l?.customerId || ''); });
  };
  L.blocked = (d) => d.status === LOANED ? 'This device is out on demo. Return it from demo first.' : '';

  // ---- Lend out ----
  L.lend = (entry) => {
    const cfg = L.cfg(), d = entry.data, reasons = cfg.reasons.filter(r => !r.archived);
    if (!reasons.length) return toast('Add a loan reason under Settings first.', true);
    const st = { mode: S.all('customer').length ? 'existing' : 'new', cust: null, sale: '', newc: { name: '', phone: '', email: '' }, dl: { ...D.blank(), type: 'pickup' } };
    const due0 = cfg.dueDays ? C.dateStr(Date.now() + cfg.dueDays * DAY) : '';
    const types = D.TYPES.filter(t => t[0] !== 'immediate');
    return sheet(`<h2>Lend out ${esc(C.itemLabel(d))}</h2><p class="sub">Record who has it, what went with it and when it is due back.</p>
      <div class="grid g2"><div class="field"><label for="lrs">Reason</label>${UI.select.html({ id: 'lrs', options: reasons.map(r => [r.key, r.label]), value: reasons[0].key })}</div><div class="field"><label for="ldue">Due back (optional)</label><input type="date" id="ldue" min="${esc(today())}" value="${esc(due0)}"></div></div>
      <h3 class="mt-md">Who is borrowing it</h3><div id="lcust"></div>
      <h3 class="mt-lg">Handover</h3><div class="field"><label for="ltype">How it gets to them</label>${UI.select.html({ id: 'ltype', options: types, value: 'pickup' })}</div><div id="ldl"></div>
      ${cfg.items.length ? `<h3 class="mt-lg">What goes with it</h3><div class="row wrap">${cfg.items.map(i => `<label class="check"><input type="checkbox" data-li="${esc(i.key)}" checked><span>${esc(i.label)}</span></label>`).join('')}</div>` : ''}
      <div class="grid g2 mt-lg"><div class="field"><label for="lout">Date out</label><input type="date" id="lout" max="${esc(today())}" value="${esc(today())}"></div></div>
      <div class="field"><label for="lnote">Note (optional)</label><textarea id="lnote" maxlength="500"></textarea></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Lend out</button></div>`, { wide: true, onMount: (el, close) => {
      const q = (s) => el.querySelector(s), picked = () => st.cust && S.get('customer', st.cust);
      const drawDl = () => { D.prefill(st.dl, st.mode === 'existing' ? picked() : null); q('#ldl').innerHTML = D.formHtml(st.dl, { canSave: st.dl.type === 'shipping' && A.can('customers.write') }); D.wireForm(el, st.dl, () => {}); };
      const drawCust = () => {
        const p = picked(), sales = p ? S.all('sale').filter(s => s.data.customerId === p.id && !s.data.voided).sort((a, b) => b.data.ts - a.data.ts) : [];
        q('#lcust').innerHTML = `<div class="seg wide mt-sm" role="tablist"><button type="button" data-mode="existing" class="${st.mode === 'existing' ? 'on' : ''}">Existing</button><button type="button" data-mode="new" class="${st.mode === 'new' ? 'on' : ''}">New</button></div>
          ${st.mode === 'existing' ? (p ? `<div class="picked mt-md"><span>${esc(p.data.name)}${p.data.phone ? ' · ' + esc(p.data.phone) : ''}</span><button type="button" class="btn secondary small" id="lchg">Change</button></div>${sales.length ? `<div class="field mt-md"><label for="lsale">Related sale (optional, for an RMA)</label>${UI.select.html({ id: 'lsale', options: [['', 'None'], ...sales.map(s => [s.id, `${s.data.no} · ${F.day(s.data.ts)}`])], value: st.sale })}</div>` : ''}` : '<div class="mt-md"><input type="search" id="lcs" aria-label="Search customers" placeholder="Search name, phone or email" autocomplete="off"><ul class="pick-list" id="lcl" role="listbox" aria-label="Matching customers" hidden></ul></div>')
          : `<div class="mt-md"><div class="field"><label for="lnn">Name</label><input type="text" id="lnn" value="${esc(st.newc.name)}" autocomplete="off"></div><div class="grid g2"><div class="field"><label for="lnp">Phone (optional)</label><input type="text" id="lnp" value="${esc(st.newc.phone)}" autocomplete="off"></div><div class="field"><label for="lne">Email (optional)</label><input type="email" id="lne" value="${esc(st.newc.email)}" autocomplete="off"></div></div><div class="hint">Saved as a prospect in Customers. Choose Shipping below to add an address.</div></div>`}`;
        el.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { st.mode = b.dataset.mode; st.dl.touched = false; st.dl.from = ''; drawCust(); drawDl(); }));
        q('#lchg')?.addEventListener('click', () => { st.cust = null; st.sale = ''; st.dl.touched = false; st.dl.from = ''; drawCust(); drawDl(); });
        q('#lsale')?.addEventListener('change', (ev) => { st.sale = UI.select.value(ev.target); });
        const cs = q('#lcs'); cs?.addEventListener('input', () => {
          const t = cs.value.trim().toLowerCase(), list = q('#lcl'), hits = t ? S.all('customer').filter(c => [c.data.name, c.data.phone, c.data.email].some(v => String(v || '').toLowerCase().includes(t))).slice(0, 6) : [];
          list.hidden = !hits.length; list.innerHTML = hits.map(c => `<li tabindex="0" role="option" data-c="${esc(c.id)}">${esc(c.data.name)}<span class="muted"> ${esc(c.data.phone || c.data.email || '')}</span></li>`).join('');
          list.querySelectorAll('li').forEach(li => li.addEventListener('click', () => { st.cust = li.dataset.c; drawCust(); drawDl(); }));
        });
        for (const [id, k] of [['#lnn', 'name'], ['#lnp', 'phone'], ['#lne', 'email']]) q(id)?.addEventListener('input', (ev) => { st.newc[k] = ev.target.value; });
      };
      q('#ltype').addEventListener('change', (ev) => { st.dl.type = UI.select.value(ev.target); drawDl(); });
      drawCust(); drawDl();
      q('#go').addEventListener('click', (ev) => UI.busy(ev.currentTarget, async () => {
        try {
          const puts = [], reason = reasons.find(r => r.key === UI.select.value(q('#lrs'))) || reasons[0];
          let cust = null, cid = null;
          if (st.mode === 'existing') { cust = picked(); if (!cust) return toast('Choose who is borrowing it, or switch to New.', true); cid = cust.id; }
          else { const name = clip(st.newc.name, 120); if (!name) return toast('Enter the borrower’s name.', true); if (!A.can('customers.write')) return toast('Your user type cannot add customers.', true); cid = Vault.newId(); cust = { id: cid, data: { name, phone: clip(st.newc.phone, 60), email: clip(st.newc.email, 120), notes: '', createdAt: Date.now(), prospect: true } }; }
          const dv = D.build(st.dl, cust.data.name); if (dv.error) return toast(dv.error, true);
          const delivery = dv.delivery || { type: 'pickup', date: '', notes: '' };
          if (delivery.type === 'shipping' && st.dl.save && !cust.data.address && A.can('customers.write')) cust.data = { ...cust.data, address: D.addr({ ...delivery.shipTo, name: '' }) };
          if (st.mode === 'new' || cust.data !== S.get('customer', cid)?.data) puts.push({ type: 'customer', id: cid, data: cust.data });
          const out = atDate(q('#lout').value), due = q('#ldue').value;
          if (out > Date.now() + 60e3) return toast('Choose today or an earlier date.', true);
          if (due && C.dateMs(due) < C.dateMs(q('#lout').value || today())) return toast('The due date cannot be before the date it goes out.', true);
          const cur = S.get('item', entry.id); if (!cur || !lendable(cur.data)) return toast('This device is no longer available to lend.', true);
          const loan = { id: Vault.newId(), reason: reason.key, reasonLabel: reason.label, customerId: cid, customer: { name: cust.data.name, phone: cust.data.phone || '', email: cust.data.email || '', address: D.addr(delivery.type === 'shipping' ? delivery.shipTo : cust.data.address) },
            outAt: out, outBy: A.me.username, dueAt: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : '', delivery, items: cfg.items.filter(i => q(`[data-li="${i.key}"]`)?.checked).map(i => ({ key: i.key, label: i.label })),
            outNote: clip(q('#lnote').value), saleId: st.mode === 'existing' ? st.sale : '', outCondition: C.inspectionSnapshot(cur.data) };
          puts.push({ type: 'item', id: entry.id, data: { ...cur.data, status: LOANED, loans: [...L.of(cur.data), loan] } });
          await S.commit({ puts }); D.note('loanout'); toast(`${C.itemLabel(cur.data)} lent to ${cust.data.name}`);
          close(true);
          if (delivery.type === 'shipping' && A.labels && await UI.confirmBox({ title: 'Print a shipping label?', body: 'Print the label for this parcel now.', confirmLabel: 'Print label' })) A.labels.open([{ id: loan.id, data: { no: 'Loan', ts: out, customerName: cust.data.name, delivery } }]);
        } catch (er) { toast(er.status === 409 ? 'This device was just changed by someone else. Check it and try again.' : er.message, true); }
      }));
    } });
  };

  // ---- Return from demo ----
  // Closes the open loan, sets the device's new status and (for a returned device in good condition) clears the test steps that are re-tested after a loan.
  L.back = async (entry) => {
    const d = entry.data, open = L.open(d); if (!open) return false;
    const cfg = L.cfg(), keep = L.canKeep(open), steps = C.steps(), off = new Set(cfg.retestOff);
    const retest = steps.filter(s => !off.has(s.key));
    const r = await sheet(`<h2>Return ${esc(C.itemLabel(d))}</h2><p class="sub">Lent to ${esc(L.who(open))} on ${esc(F.day(open.outAt))} (${L.days(open)} day${L.days(open) === 1 ? '' : 's'}).</p>
      <div class="grid g2"><div class="field"><label for="bin">Date back</label><input type="date" id="bin" max="${esc(today())}" value="${esc(today())}"></div>${keep ? `<div class="field"><label for="bout">What happened</label>${UI.select.html({ id: 'bout', options: [['returned', 'Returned'], ['kept', 'Customer keeps it']], value: 'returned' })}</div>` : ''}</div>
      <div id="bmore">${open.items?.length ? `<h3 class="mt-md">Items returned</h3><div class="row wrap">${open.items.map(i => `<label class="check"><input type="checkbox" data-bi="${esc(i.key)}" checked><span>${esc(i.label)}</span></label>`).join('')}</div><div class="hint">Untick anything that did not come back.</div>` : ''}
        <h3 class="mt-lg">Condition</h3><div class="field"><label for="bcond">How is it</label>${UI.select.html({ id: 'bcond', options: [['ok', 'Good, no damage'], ['damaged', 'Damaged or something is wrong']], value: 'ok' })}</div>
        <div class="field" id="bdmgbox" hidden><label for="bdmg">What is wrong</label><textarea id="bdmg" maxlength="500"></textarea></div>
        ${retest.length ? `<label class="check mt-md"><input type="checkbox" id="bretest" checked><span>Test it again before it goes back on sale (${esc(retest.map(s => s.label).join(', '))})</span></label>` : ''}</div>
      <div class="field mt-md"><label for="bnote">Note (optional)</label><textarea id="bnote" maxlength="500"></textarea></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save</button></div>`, { wide: true, onMount: (el, close) => {
      const q = (s) => el.querySelector(s), outcome = () => q('#bout') ? UI.select.value(q('#bout')) : 'returned';
      const sync = () => { q('#bmore').hidden = outcome() === 'kept'; q('#bdmgbox').hidden = UI.select.value(q('#bcond')) !== 'damaged'; };
      q('#bout')?.addEventListener('change', sync); q('#bcond').addEventListener('change', sync); sync();
      q('#go').addEventListener('click', (ev) => UI.busy(ev.currentTarget, async () => {
        try {
          const cur = S.get('item', entry.id), lo = cur && L.open(cur.data); if (!lo) return toast('This device is no longer on demo.', true);
          const kept = outcome() === 'kept', damaged = !kept && UI.select.value(q('#bcond')) === 'damaged', dmg = clip(q('#bdmg').value);
          if (damaged && !dmg) return toast('Say what is wrong with it.', true);
          const inAt = atDate(q('#bin').value); if (inAt > Date.now() + 60e3) return toast('Choose today or an earlier date.', true);
          if (inAt < lo.outAt - DAY) return toast('The return date cannot be before it went out.', true);
          const back = { inAt, inBy: A.me.username, outcome: kept ? 'kept' : 'returned', condition: kept ? '' : damaged ? 'damaged' : 'ok', damageNote: damaged ? dmg : '', missing: kept ? [] : (lo.items || []).filter(i => !q(`[data-bi="${i.key}"]`)?.checked).map(i => ({ key: i.key, label: i.label })), inNote: clip(q('#bnote').value) };
          const doRetest = !kept && !damaged && !!q('#bretest')?.checked;
          const next = { ...cur.data, loans: L.of(cur.data).map(l => l.id === lo.id ? { ...l, ...back } : l), status: kept ? 'archived' : damaged ? 'damaged' : 'available' };
          if (doRetest) { next.checks = Object.fromEntries(Object.entries(cur.data.checks || {}).filter(([k]) => off.has(k))); next.checkVals = Object.fromEntries(Object.entries(cur.data.checkVals || {}).filter(([k]) => off.has(k))); next.testedOn = ''; }
          await S.commit({ puts: [{ type: 'item', id: entry.id, data: next }] }); D.note('loanin'); toast(kept ? 'Recorded: the customer keeps it' : 'Device back');
          close(doRetest ? 'retest' : true);
        } catch (er) { toast(er.status === 409 ? 'This device was just changed by someone else. Check it and try again.' : er.message, true); }
      }));
    } });
    if (r === 'retest') { toast('Now tick the tests once they are done'); await A.inventoryEdit?.(S.get('item', entry.id)); }
    return !!r;
  };

  // A sale to the borrower closes the loan as "sold".
  L.soldPatch = (d, saleId, ts) => { const lo = L.open(d); return lo ? { loans: L.of(d).map(l => l.id === lo.id ? { ...l, inAt: ts, inBy: A.me.username, outcome: 'sold', condition: '', damageNote: '', missing: [], inNote: '', soldSaleId: saleId } : l) } : {}; };

  // ---- Home card ----
  L.homeHtml = () => {
    if (!A.can('inventory.read')) return ''; const list = L.outNow(); if (!list.length) return '';
    return `<div class="card mb-lg" id="loanbox"><div class="row spread wrap"><h3>On demo</h3><span class="row">${A.can('inventory.write') && A.reminders.overdueLoans().length > 1 ? '<button type="button" class="linkbtn" id="loanremindall">Send all reminders</button>' : ''}<button type="button" class="linkbtn" id="loanall">See all</button></span></div><div class="tablewrap mt-sm"><table><thead><tr><th>Device</th><th>With</th><th>Out</th><th>Due</th><th></th></tr></thead><tbody>${list.slice(0, 6).map(({ e, l }) => `<tr class="click" data-loanitem="${esc(e.id)}"><td>${esc(C.itemLabel(e.data))}</td><td>${esc(L.who(l))}</td><td>${L.days(l)} day${L.days(l) === 1 ? '' : 's'}</td><td>${l.dueAt ? esc(F.day(C.dateMs(l.dueAt))) : '—'} ${L.overdue(l) ? '<span class="chip red">Overdue</span>' : ''}</td><td class="right">${L.overdue(l) && A.can('inventory.write') ? `${l.remindedAt ? `<span class="hint">Reminded ${esc(F.day(l.remindedAt))}</span> ` : ''}<button type="button" class="linkbtn" data-remind="${esc(e.id)}">Send reminder</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
  };
  L.homeWire = (main) => {
    main.querySelectorAll('[data-remind]').forEach(b => { b.addEventListener('click', async (ev) => { ev.stopPropagation(); b.disabled = true; const e = S.get('item', b.dataset.remind); try { await A.reminders.sendLoan(e, L.open(e.data)); toast('Reminder sent'); A.route(); } catch (er) { toast(er.message, true); b.disabled = false; } }); });
    main.querySelector('#loanremindall')?.addEventListener('click', () => A.reminders.loanAll());
    main.querySelectorAll('[data-loanitem]').forEach(tr => tr.addEventListener('click', async () => { if (await A.inventoryEdit?.(S.get('item', tr.dataset.loanitem))) A.route(); }));
    main.querySelector('#loanall')?.addEventListener('click', () => { A.inventoryLoanFilter?.(); location.hash = '#/inventory'; });
  };

  // ---- CSV (Export everything, and one customer's export) ----
  L.table = (customerId) => {
    const look = C.lookupFields();
    const rows = S.all('item').flatMap(e => L.of(e.data).filter(l => !customerId || l.customerId === customerId).map(l => [C.deviceName(e.data), look.map(f => C.getVal(e.data, f)).filter(Boolean).join(' / '), l.reasonLabel || '', l.customer?.name || '', l.customer?.phone || '', l.customer?.email || '', D.addressText(l.customer?.address), l.outAt ? new Date(l.outAt).toISOString() : '', l.dueAt || '', l.inAt ? new Date(l.inAt).toISOString() : '', l.inAt ? (l.outcome || '') : 'on demo', l.condition || '', (l.missing || []).map(x => x.label).join('; '), l.damageNote || '', D.LABEL[l.delivery?.type] || '', l.delivery?.carrier || '', l.delivery?.tracking || '', (l.items || []).map(x => x.label).join('; '), l.outBy || '', l.inBy || '', [l.outNote, l.inNote].filter(Boolean).join(' | ')]));
    return { headers: ['loan_device', 'loan_identifier', 'loan_reason', 'borrower', 'borrower_phone', 'borrower_email', 'borrower_address', 'loan_out', 'loan_due', 'loan_back', 'loan_outcome', 'loan_condition', 'loan_not_returned', 'loan_damage', 'loan_handover', 'loan_carrier', 'loan_tracking', 'loan_included', 'loan_out_by', 'loan_in_by', 'loan_notes'], rows };
  };
  // Erasing a customer removes the personal details from the loans too; the device history stays.
  L.erasePuts = (customerId) => S.all('item').filter(e => L.of(e.data).some(l => l.customerId === customerId)).map(e => ({ type: 'item', id: e.id, data: { ...e.data, loans: L.of(e.data).map(l => l.customerId === customerId ? { ...l, customerId: null, customer: { name: 'Erased customer', phone: '', email: '', address: D.addr({}) }, delivery: D.erased(l.delivery), outNote: '', inNote: '', damageNote: '' } : l) } }));

  // ---- Settings card (Administrators) ----
  L.settingsHtml = (lc) => `<div class="card mt-lg"><h3>Demo units and loans</h3><div class="sub">Lend a device to a customer or prospect for a demo, an RMA replacement or a repair, and track who has it. Set what goes with it and what is checked when it comes back.</div>
    <div class="field mt-md"><label for="lnd">Usual loan length in days</label><input type="number" id="lnd" class="num" min="0" max="365" step="1" placeholder="No due date" value="${lc.dueDays ? esc(lc.dueDays) : ''}"><div class="hint">Pre-fills the due date when you lend a device out. Leave empty for no due date.</div></div>
    <div class="strong mt-lg">Loan reasons</div><div id="lnreasons">${lc.reasons.map((r, i) => `<div class="reason-row with-keep"><input type="text" data-lk="${i}" value="${esc(r.label)}" aria-label="Loan reason"><label class="check"><input type="checkbox" data-lc="${i}" ${r.canKeep ? 'checked' : ''}><span>Customer can keep it</span></label><button type="button" class="icon-btn" data-lr="${i}" aria-label="Remove ${esc(r.label)}" title="Remove">✕</button></div>`).join('')}</div>
    <div class="row mt-md"><button class="btn secondary" id="lnradd" type="button">Add a reason</button></div>
    <div class="strong mt-lg">What goes with a loaned device</div><div id="lnitems">${lc.items.map((r, i) => `<div class="reason-row"><input type="text" data-ik="${i}" value="${esc(r.label)}" aria-label="Item that goes with the device"><button type="button" class="icon-btn" data-ir="${i}" aria-label="Remove ${esc(r.label)}" title="Remove">✕</button></div>`).join('')}</div>
    <div class="row mt-md"><button class="btn secondary" id="lniadd" type="button">Add an item</button></div>
    ${C.steps().length ? `<div class="strong mt-lg">Test again when a device comes back</div><div class="hint">Ticked steps are cleared on return, so the device shows Awaiting test until they are done again.</div><div class="row wrap mt-sm">${C.steps().map(s => `<label class="check"><input type="checkbox" data-lt="${esc(s.key)}" ${lc.retestOff.includes(s.key) ? '' : 'checked'}><span>${esc(s.label)}</span></label>`).join('')}</div>` : ''}</div>`;
  L.settingsWire = (main, lc, redraw) => {
    main.querySelector('#lnd').addEventListener('input', (e) => { lc.dueDays = Math.max(0, Math.round(Number(e.target.value) || 0)); });
    main.querySelectorAll('[data-lk]').forEach(i => i.addEventListener('input', () => { lc.reasons[i.dataset.lk].label = i.value; }));
    main.querySelectorAll('[data-lc]').forEach(i => i.addEventListener('change', () => { lc.reasons[i.dataset.lc].canKeep = i.checked; }));
    main.querySelectorAll('[data-lr]').forEach(b => b.addEventListener('click', () => { lc.reasons.splice(Number(b.dataset.lr), 1); redraw(); }));
    main.querySelector('#lnradd').addEventListener('click', () => { lc.reasons.push({ key: 'l' + Vault.newId().slice(0, 7), label: '', canKeep: false }); redraw(); const l = main.querySelectorAll('[data-lk]'); l[l.length - 1]?.focus(); });
    main.querySelectorAll('[data-ik]').forEach(i => i.addEventListener('input', () => { lc.items[i.dataset.ik].label = i.value; }));
    main.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => { lc.items.splice(Number(b.dataset.ir), 1); redraw(); }));
    main.querySelector('#lniadd').addEventListener('click', () => { lc.items.push({ key: 'i' + Vault.newId().slice(0, 7), label: '' }); redraw(); const l = main.querySelectorAll('[data-ik]'); l[l.length - 1]?.focus(); });
    main.querySelectorAll('[data-lt]').forEach(i => i.addEventListener('change', () => { lc.retestOff = i.checked ? lc.retestOff.filter(k => k !== i.dataset.lt) : [...new Set([...lc.retestOff, i.dataset.lt])]; }));
  };
  L.settingsCheck = (lc) => {
    const r = lc.reasons.map(x => x.label.trim().toLowerCase()), i = lc.items.map(x => x.label.trim().toLowerCase());
    if (!r.length || r.some(x => !x)) return 'Every loan reason needs a name, and at least one is needed.';
    if (new Set(r).size !== r.length) return 'Two loan reasons have the same name.';
    if (i.some(x => !x)) return 'Every item that goes with a loan needs a name.';
    if (new Set(i).size !== i.length) return 'Two loan items have the same name.';
    return '';
  };
  L.settingsClean = (lc) => ({ reasons: lc.reasons.map(r => ({ key: r.key, label: r.label.trim(), canKeep: !!r.canKeep, ...(r.archived ? { archived: true } : {}) })), items: lc.items.map(r => ({ key: r.key, label: r.label.trim() })), retestOff: [...lc.retestOff], dueDays: Math.max(0, Math.min(365, Math.round(lc.dueDays || 0))) });
})();
