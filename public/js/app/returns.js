// APP / returns — returns and refunds on sales: net-of-refund figures, the Return or refund sheet, the credit note (refund receipt), the Settings card and the history list.
// A return is stored inside its sale (sale.returns[]), so it is encrypted, backed up, restored and exported with the sale. Nothing here talks to the server except a log note.
(() => {
  const { esc, toast, sheet } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store;
  const R = A.returns = {};
  const RESTOCK = [['available', 'Back to Available'], ['returned', 'Returned'], ['damaged', 'Damaged (out of stock)']];
  const RESTOCK_LABEL = Object.fromEntries(RESTOCK);
  const sum = (list, fn) => list.reduce((t, x) => t + (Number(fn(x)) || 0), 0);
  const q = (el, s) => el.querySelector(s);

  // ---- the data: what has been returned, and the sale's figures once refunds are taken off ----
  R.of = (d) => Array.isArray(d.returns) ? d.returns : [];
  R.hasReturns = (d) => R.of(d).length > 0;
  R.doneIds = (d) => new Set(R.of(d).flatMap(r => (r.lines || []).map(l => l.id)));
  R.state = (d) => { const done = R.doneIds(d); return !done.size ? '' : (d.items || []).every(it => done.has(it.id)) ? 'full' : 'part'; };
  R.chip = (d) => { const s = R.state(d), ask = d.returnAsk ? ' <span class="chip blue">Return requested</span>' : ''; return (s === 'full' ? '<span class="chip gray">Returned</span>' : s === 'part' ? '<span class="chip amber">Partly returned</span>' : '') + (s === 'full' ? '' : ask); };
  // Money back to the customer is "refunds"; a device restocked as Available or Returned comes off the cost of the sale; a Damaged one stays a cost. Return shipping paid by the reseller is a cost.
  R.net = (d) => {
    const rs = R.of(d), costOf = new Map((d.items || []).map(it => [it.id, it.cost || 0]));
    const refunds = sum(rs, r => r.net), costBack = sum(rs, r => sum((r.lines || []).filter(l => l.restock !== 'damaged'), l => costOf.get(l.id))), shipLoss = sum(rs, r => r.retShipPaidBy === 'reseller' ? r.retShipCost : 0);
    // Revenue is what the customer paid (items plus the shipping fee, C.delivery.due) less money given back; profit also takes off the reseller's own shipping cost (internal) and return postage.
    const shipFee = C.delivery.feeOf(d), shipCost = C.delivery.costOf(d);
    const revenue = C.delivery.due(d) - refunds, cost = (d.cost || 0) - costBack;
    return { refunds, fees: sum(rs, r => r.fee), revenue, cost, profit: revenue - cost - shipCost - shipLoss, devices: (d.items || []).length - R.doneIds(d).size, shipLoss, shipFee, shipCost };
  };
  // Totals for a list of sale records (voided ones are left out by the caller).
  R.sums = (entries) => entries.reduce((t, e) => { const n = R.net(e.data); return { sales: t.sales + 1, refunds: t.refunds + n.refunds, revenue: t.revenue + n.revenue, profit: t.profit + n.profit, devices: t.devices + n.devices }; }, { sales: 0, refunds: 0, revenue: 0, profit: 0, devices: 0 });
  // A shipped sale: sale.delivery.type is "shipping" (see delivery.js); the fee charged to the customer is sale.delivery.fee.
  R.isShipped = (d) => C.delivery.typeOf(d) === 'shipping';
  R.itemTag = (d, it) => R.doneIds(d).has(it.id) ? '<div class="sub text-sm">Returned · warranty ended</div>' : '';
  R.receiptBanner = (d) => { const s = R.state(d); return s ? `<p class="banner center mt-md">${s === 'full' ? 'This sale was returned and refunded.' : 'Part of this sale was returned and refunded.'}</p>` : ''; };
  // The warranty of a fully returned sale is over.
  const chip0 = C.warrantyChip, lines0 = C.warrantyLines;
  C.warrantyChip = (sale) => R.state(sale) === 'full' && !sale.voided ? '<span class="chip gray">Returned</span>' : chip0(sale);
  C.warrantyLines = (sale) => R.state(sale) === 'full' ? ['Warranty: ended (returned)'] : lines0(sale);

  // ---- who may process a return, and the settings behind it ----
  R.settings = () => S.config().returns;
  R.canProcess = () => A.can('sales.write') && (A.can('users.manage') || R.settings().standardCan);
  R.overLimit = (net) => { const lim = R.settings().limit; return !A.can('users.manage') && lim > 0 && net > lim; };
  R.defaultFee = (gross) => { const f = R.settings().fee; return f.mode === 'pct' ? Math.round(gross * Math.min(100, f.value) / 100) : f.mode === 'flat' ? Math.min(gross, Math.round(f.value)) : 0; };
  const RN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand = (n) => { let out = ''; while (out.length < n) for (const b of crypto.getRandomValues(new Uint8Array(n * 2))) if (b < 252 && out.length < n) out += RN[b % 36]; return out; };
  R.newNo = () => { const taken = new Set(S.all('sale').flatMap(e => R.of(e.data).map(r => r.no))); let no; do no = `R-${F.ymd(Date.now())}-${rand(5)}`; while (taken.has(no)); return no; };
  const note = (body) => A.api('POST', '/account/return-note', body).catch(() => {});

  // ---- the credit note: what the customer gets. It never shows costs, profit or internal notes. ----
  R.noteText = (sale, ret) => {
    const d = sale.data, lines = [A.me.businessName, `Credit note ${ret.no}`, F.when(ret.ts), `For receipt ${d.no}`]; if (d.customerName) lines.push(`Customer: ${d.customerName}`); lines.push('');
    for (const l of ret.lines) lines.push(`${l.label}  -${F.money(l.refund)}`);
    if (ret.shipRefund) lines.push(`Shipping refunded  -${F.money(ret.shipRefund)}`);
    if (ret.fee) lines.push(`Restocking fee  ${F.money(ret.fee)}`);
    lines.push('', `Total refunded: ${F.money(ret.net)}`, `Refunded by: ${ret.methodLabel || '—'}`); if (ret.reasonLabel) lines.push(`Reason: ${ret.reasonLabel}`); lines.push('', 'Thank you!'); return lines.join('\n');
  };
  R.noteHtml = (sale, ret) => { const d = sale.data;
    return `<div class="receipt"><img class="receipt-logo" src="/assets/logo-512.png" alt="" width="512" height="512"><h2>${esc(A.me.businessName)}</h2><div class="sub center">Credit note ${esc(ret.no)} · ${esc(F.when(ret.ts))}</div><div class="sub center">For receipt ${esc(d.no)}</div>
      <p class="center mt-md">${d.customerName ? `Customer: <b>${esc(d.customerName)}</b>` : 'Walk-in customer'}</p>
      <table><tbody>${ret.lines.map(l => `<tr><td>${esc(l.label)}</td><td class="right nowrap">−${esc(F.money(l.refund))}</td></tr>`).join('')}</tbody></table>
      ${ret.shipRefund ? `<div class="line-sub"><span>Shipping refunded</span><span>−${esc(F.money(ret.shipRefund))}</span></div>` : ''}${ret.fee ? `<div class="line-sub"><span>Restocking fee</span><span>${esc(F.money(ret.fee))}</span></div>` : ''}
      <div class="line-total"><span>Total refunded</span><span>${esc(F.money(ret.net))}</span></div><p class="sub center mt-md">Refunded by ${esc(ret.methodLabel || '—')}</p>${ret.reasonLabel ? `<p class="center mt-sm">Reason: ${esc(ret.reasonLabel)}</p>` : ''}<p class="sub center mt-lg">Thank you!</p></div>`; };
  R.creditNote = (sale, ret) => sheet(`<div id="cn">${R.noteHtml(sale, ret)}</div><div class="actions"><button class="btn secondary small" id="cnmail">Email</button><button class="btn secondary small" id="cnprint">Print</button><button class="btn" data-cancel>Done</button></div>`, { onMount: (el) => {
    q(el, '#cnprint').addEventListener('click', () => { document.documentElement.classList.add('printing'); window.addEventListener('afterprint', () => document.documentElement.classList.remove('printing'), { once: true }); window.print(); });
    q(el, '#cnmail').addEventListener('click', () => sheet(`<h2>Email the credit note</h2><p class="sub">${C.ownMail() ? `Sent from your own mail server (${esc(C.ownMail().fromAddress)}).` : `Sent from the site, and replies go to ${esc(A.me.email || 'your own address')}.`} The credit note is not kept on our server.</p><div class="field mt-md"><label for="rto">Send to</label><input type="email" id="rto" value="${esc(sale.data.customerEmail || '')}" autocomplete="off"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn secondary" id="rapp">Open in my mail app</button><button class="btn" id="rgo">Send</button></div>`, { onMount: (m, done) => {
      const to = () => q(m, '#rto').value.trim(), subject = `Credit note ${ret.no} from ${A.me.businessName}`;
      q(m, '#rapp').addEventListener('click', () => { location.href = `mailto:${encodeURIComponent(to())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(R.noteText(sale, ret))}`; done(false); });
      q(m, '#rgo').addEventListener('click', async () => { try { await A.api('POST', '/receipt-email', { kind: 'receipt', to: to(), receiptNo: ret.no, customer: sale.data.customerName, text: R.noteText(sale, ret), ...C.mailCustom('receipt'), ...(C.ownMail() ? { smtp: C.ownMail() } : {}) }); toast('Email sent'); done(true); } catch (e) { toast(e.message, true); } });
    } }));
  } });

  // ---- the receipt sheet's extra buttons and notes (called from commerce.js) ----
  R.sheetNote = (sale) => { const a = sale.data.returnAsk; return a && R.state(sale.data) !== 'full' ? `<p class="banner blue mt-md no-print">Return requested by ${esc(a.by)} on ${esc(F.day(a.ts))}${a.note ? ': ' + esc(a.note) : ''}. ${A.can('users.manage') ? 'Use Return or refund to process it.' : 'An Administrator will process it.'}</p>` : ''; };
  R.actions = (sale, canAct) => {
    const d = sale.data, left = d.items.some(it => !R.doneIds(d).has(it.id));
    return `${canAct && !d.voided && left && R.canProcess() ? '<button class="btn secondary small" id="ret">Return or refund</button>' : ''}${R.of(d).map(r => `<button class="btn secondary small" data-cn="${esc(r.id)}">Credit note ${esc(r.no)}</button>`).join('')}`;
  };
  R.wire = (el, sale, close) => {
    q(el, '#ret')?.addEventListener('click', async () => { const ok = await R.open(S.get('sale', sale.id) || sale); if (ok) close('returned'); });
    el.querySelectorAll('[data-cn]').forEach(b => b.addEventListener('click', () => { const cur = S.get('sale', sale.id) || sale, ret = R.of(cur.data).find(r => r.id === b.dataset.cn); if (ret) R.creditNote(cur, ret); }));
  };

  // ---- the Return or refund sheet ----
  R.open = (sale) => {
    const d = sale.data, cfg = R.settings(), admin = A.can('users.manage'), done = R.doneIds(d), left = d.items.filter(it => !done.has(it.id)), shipped = R.isShipped(d), fee0 = C.delivery.feeOf(d);
    const reasons = cfg.reasons.filter(r => !r.archived && r.label.trim()), methods = C.paymentOptions();
    if (!left.length) { toast('Every device on this sale has already been returned.', true); return Promise.resolve(false); }
    if (d.voided) { toast('A voided sale cannot be returned.', true); return Promise.resolve(false); }
    return sheet(`<h2>Return or refund</h2><p class="sub">Receipt ${esc(d.no)}${d.customerName ? ` · ${esc(d.customerName)}` : ''}. Money is handled outside the app; this records what was given back and puts the devices where you choose.</p>
      <h3 class="mt-lg">Devices that came back</h3><div class="buy-list" id="rl">${left.map(it => `<div class="ret-line" data-line="${esc(it.id)}"><input type="checkbox" data-pick="${esc(it.id)}" aria-label="Returned: ${esc(C.itemLabel(it))}"><div class="stock-main"><div class="strong">${esc(C.itemLabel(it))}</div><div class="hint">Sold for ${esc(F.money(it.price))}</div></div><input type="number" class="price" min="0" step="0.01" data-amt="${esc(it.id)}" value="${esc(F.dollars(it.price) || '0.00')}" aria-label="Refund for ${esc(C.itemLabel(it))}" disabled><div class="ret-where" data-where="${esc(it.id)}" hidden><label for="rs_${esc(it.id)}" class="hint">What happens to it</label>${UI.select.html({ id: 'rs_' + it.id, options: RESTOCK, value: 'available' })}</div></div>`).join('')}</div>
      <div class="field mt-lg"><label for="rreason">Reason</label>${UI.select.html({ id: 'rreason', options: reasons.length ? reasons.map(r => [r.key, r.label]) : [['', 'No reason']], value: reasons[0]?.key || '' })}</div>
      <div class="field"><label for="rnote">Note (optional)</label><input type="text" id="rnote" autocomplete="off"></div>
      <div class="field"><label for="rfee">Restocking fee${cfg.fee.mode === 'pct' ? ` (default ${esc(cfg.fee.value)}%)` : cfg.fee.mode === 'flat' ? ` (default ${esc(F.money(cfg.fee.value))})` : ''}</label><input type="number" id="rfee" class="num" min="0" step="0.01" value="" placeholder="0.00"><div class="hint">Kept by you, so it is taken off the refund. Leave empty for none.</div></div>
      ${shipped ? `<div class="field"><label for="rship">Shipping fee refunded${fee0 ? ` (customer paid ${esc(F.money(fee0))})` : ''}</label><input type="number" id="rship" class="num" min="0" step="0.01" value="" placeholder="0.00"><div class="hint">Leave empty to keep the shipping fee.</div></div>` : ''}
      <div class="field"><label for="rmeth">Refund given by</label>${UI.select.html({ id: 'rmeth', options: methods, value: d.payment || C.paymentDefault() })}</div>
      ${shipped ? `<h3 class="mt-lg">Return shipping</h3><div class="field"><label for="rtrk">Return tracking number (optional)</label><input type="text" id="rtrk" autocomplete="off"></div><div class="field"><label for="rscost">Return shipping cost (optional)</label><input type="number" id="rscost" class="num" min="0" step="0.01" value="" placeholder="0.00"></div><div class="field"><label for="rspay">Who paid for return shipping</label>${UI.select.html({ id: 'rspay', options: [['', 'Not recorded'], ['reseller', 'I paid'], ['customer', 'The customer paid']], value: '' })}</div>` : ''}
      <div class="total-line"><span>Refund total</span><span id="rtot">${esc(F.money(0))}</span></div><p class="banner red" id="rlim" hidden></p>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="rgo" disabled>Process return</button></div>`, { onMount: (el, close) => {
      let feeEdited = false;
      const picked = () => left.filter(it => q(el, `[data-pick="${it.id}"]`).checked);
      const gross = () => sum(picked(), it => F.cents(q(el, `[data-amt="${it.id}"]`).value));
      const parts = () => { const g = gross(), fee = Math.min(g, F.cents(q(el, '#rfee').value)), ship = shipped ? F.cents(q(el, '#rship').value) : 0; return { g, fee, ship, net: Math.max(0, g + ship - fee) }; };
      const refresh = () => {
        const p = parts(), n = picked().length; q(el, '#rtot').textContent = F.money(p.net);
        const over = R.overLimit(p.net), lim = q(el, '#rlim'); lim.hidden = !over; if (over) lim.textContent = `Refunds above ${F.money(cfg.limit)} need an Administrator. You can ask an Administrator to process this return.`;
        const go = q(el, '#rgo'); go.disabled = !n; go.textContent = over ? 'Ask an Administrator' : 'Process return';
      };
      el.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('change', () => {
        const id = b.dataset.pick; q(el, `[data-amt="${id}"]`).disabled = !b.checked; q(el, `[data-where="${id}"]`).hidden = !b.checked;
        if (!feeEdited) { const f = R.defaultFee(gross()); q(el, '#rfee').value = f ? F.dollars(f) : ''; }
        if (shipped && fee0 && picked().length === left.length) q(el, '#rship').value = F.dollars(fee0); else if (shipped && !feeEdited && picked().length !== left.length) q(el, '#rship').value = '';
        refresh();
      }));
      el.querySelectorAll('[data-amt]').forEach(i => i.addEventListener('input', () => { if (!feeEdited) { const f = R.defaultFee(gross()); q(el, '#rfee').value = f ? F.dollars(f) : ''; } refresh(); }));
      q(el, '#rfee').addEventListener('input', () => { feeEdited = true; refresh(); });
      q(el, '#rship')?.addEventListener('input', refresh);
      q(el, '#rgo').addEventListener('click', (e) => UI.busy(e.currentTarget, async () => {
        const p = parts(), pk = picked(), reasonKey = UI.select.value(q(el, '#rreason')), reason = reasons.find(r => r.key === reasonKey), mkey = UI.select.value(q(el, '#rmeth'));
        for (const it of pk) { const a = F.cents(q(el, `[data-amt="${it.id}"]`).value); if (a > it.price) return toast(`The refund for ${C.itemLabel(it)} is more than it sold for (${F.money(it.price)}).`, true); }
        if (R.overLimit(p.net)) {
          const text = q(el, '#rnote').value.trim();
          try { await S.commit({ puts: [{ type: 'sale', id: sale.id, data: { ...d, returnAsk: { by: A.me.login || A.me.username, ts: Date.now(), note: text } } }] }); } catch (er) { return toast(er.message, true); }
          note({ event: 'requested', devices: pk.length, cents: p.net }); toast('An Administrator can now process this return.'); return close(false);
        }
        const ret = { id: Vault.newId(), no: R.newNo(), ts: Date.now(), by: A.me.login || A.me.username, role: A.me.role || '', reasonKey, reasonLabel: reason?.label || '', note: q(el, '#rnote').value.trim(),
          lines: pk.map(it => ({ id: it.id, label: C.itemLabel(it), price: it.price, refund: F.cents(q(el, `[data-amt="${it.id}"]`).value), restock: UI.select.value(q(el, `#rs_${it.id}`)) })),
          fee: p.fee, shipRefund: p.ship, net: p.net, method: mkey, methodLabel: C.paymentLabel(mkey),
          ...(shipped ? { retTracking: q(el, '#rtrk').value.trim(), retShipCost: F.cents(q(el, '#rscost').value), retShipPaidBy: UI.select.value(q(el, '#rspay')) } : {}) };
        const { returnAsk, ...rest } = d, puts = [{ type: 'sale', id: sale.id, data: { ...rest, returns: [...R.of(d), ret] } }];
        for (const l of ret.lines) { const cur = S.get('item', l.id); if (cur && cur.data.saleId === sale.id) { const { soldAt, saleId, ...item } = cur.data; puts.push({ type: 'item', id: cur.id, data: { ...item, status: l.restock } }); } }
        try { await S.commit({ puts }); } catch (er) { return toast(er.status === 409 ? 'This sale was just changed by someone else. Close it and try again.' : er.message, true); }
        note({ event: 'processed', devices: pk.length, cents: ret.net, full: pk.length === left.length && !done.size });
        toast('Return recorded'); close(true); R.creditNote(S.get('sale', sale.id), ret);
      }));
      refresh();
    } });
  };

  // ---- the Activity page: every return, newest first (Administrators) ----
  R.history = (host) => {
    const rows = S.all('sale').flatMap(e => R.of(e.data).map(r => ({ sale: e, r }))).sort((a, b) => b.r.ts - a.r.ts);
    const box = document.createElement('div'); box.id = 'rethist';
    box.innerHTML = `<div class="card mt-lg"><h3>Returns and refunds</h3><div class="sub">Every return processed on your account, with who processed it.</div><div class="tablewrap mt-sm">${rows.length ? `<table><thead><tr><th>When</th><th>Credit note</th><th>Receipt</th><th>Devices</th><th class="right">Refunded</th><th>Processed by</th></tr></thead><tbody>${rows.map(({ sale, r }) => `<tr class="click" data-sale="${esc(sale.id)}" data-ret="${esc(r.id)}"><td>${esc(F.when(r.ts))}</td><td class="ident">${esc(r.no)}</td><td class="ident">${esc(sale.data.no)}</td><td>${r.lines.length}</td><td class="right">${esc(F.money(r.net))}</td><td>${esc(r.by)}${r.role ? ` <span class="muted">(${esc(r.role)})</span>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No returns yet.</div>'}</div></div>`;
    host.querySelector('#rethist')?.remove(); host.appendChild(box);
    box.querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', () => { const s = S.get('sale', tr.dataset.sale), r = s && R.of(s.data).find(x => x.id === tr.dataset.ret); if (r) R.creditNote(s, r); }));
  };

  // ---- CSV: one row per return (used by "Export everything") ----
  R.table = (entries) => ({ headers: ['credit_note', 'date', 'receipt', 'customer', 'devices', 'reason', 'note', 'refund_devices', 'restocking_fee', 'shipping_refunded', 'refund_total', 'refunded_by', 'processed_by', 'device_destination', 'return_tracking', 'return_shipping_cost', 'return_shipping_paid_by'],
    rows: entries.flatMap(e => R.of(e.data).map(r => [r.no, new Date(r.ts).toISOString(), e.data.no, e.data.customerName || '', r.lines.map(l => l.label).join('; '), r.reasonLabel || '', r.note || '', F.dollars(sum(r.lines, l => l.refund)), F.dollars(r.fee || 0), F.dollars(r.shipRefund || 0), F.dollars(r.net), r.methodLabel || '', r.by || '', r.lines.map(l => RESTOCK_LABEL[l.restock] || l.restock).join('; '), r.retTracking || '', F.dollars(r.retShipCost || 0), r.retShipPaidBy || ''])) });

  // ---- Settings card (placed on the Settings page; Administrators only) ----
  R.settingsHtml = (rc) => `<div class="card mt-lg"><h3>Returns and refunds</h3><div class="sub">Who can process a returned device, what reasons are offered, and the usual restocking fee. Administrators can always process returns; View users never can.</div>
    <label class="check mt-md"><input type="checkbox" id="rtstd" ${rc.standardCan ? 'checked' : ''}><span>Standard users can process returns</span></label>
    <div class="field mt-md"><label for="rtlim">Refunds above this amount need an Administrator</label><input type="number" id="rtlim" class="num" min="0" step="0.01" placeholder="No limit" value="${rc.limit ? esc(F.dollars(rc.limit)) : ''}"><div class="hint">Leave empty for no limit. Above it, a Standard user can ask an Administrator to process the return. This is checked in the app, like the discount limit.</div></div>
    <div class="field"><label for="rtfm">Default restocking fee</label><div class="row wrap">${UI.select.html({ id: 'rtfm', options: [['none', 'None'], ['pct', 'A percentage'], ['flat', 'A flat amount']], value: rc.fee.mode })}<input type="number" id="rtfv" class="num" min="0" step="0.01" aria-label="Restocking fee value" ${rc.fee.mode === 'none' ? 'hidden' : ''} value="${rc.fee.mode === 'pct' ? esc(rc.fee.value) : rc.fee.mode === 'flat' ? esc(F.dollars(rc.fee.value)) : ''}"></div><div class="hint">Pre-filled on each return. Whoever processes the return can change or remove it for that one return.</div></div>
    <div class="strong mt-lg">Return reasons</div><div id="rtreasons">${rc.reasons.map((r, i) => `<div class="reason-row"><input type="text" data-rk="${i}" value="${esc(r.label)}" aria-label="Return reason"><button type="button" class="icon-btn" data-rr="${i}" aria-label="Remove ${esc(r.label)}" title="Remove">✕</button></div>`).join('')}</div>
    <div class="row mt-md"><button class="btn secondary" id="rtadd" type="button">Add a reason</button></div></div>`;
  R.settingsWire = (main, rc, redraw) => {
    const dollarsOrPct = () => { const v = Number(main.querySelector('#rtfv').value) || 0; rc.fee.value = rc.fee.mode === 'flat' ? Math.round(v * 100) : v; };
    main.querySelector('#rtstd').addEventListener('change', (e) => { rc.standardCan = e.target.checked; });
    main.querySelector('#rtlim').addEventListener('input', (e) => { rc.limit = F.cents(e.target.value); });
    main.querySelector('#rtfm').addEventListener('change', (e) => { rc.fee.mode = UI.select.value(e.target); rc.fee.value = 0; redraw(); });
    main.querySelector('#rtfv').addEventListener('input', dollarsOrPct);
    main.querySelectorAll('[data-rk]').forEach(i => i.addEventListener('input', () => { rc.reasons[i.dataset.rk].label = i.value; }));
    main.querySelectorAll('[data-rr]').forEach(b => b.addEventListener('click', () => { rc.reasons.splice(Number(b.dataset.rr), 1); redraw(); }));
    main.querySelector('#rtadd').addEventListener('click', () => { rc.reasons.push({ key: 'r' + Vault.newId().slice(0, 7), label: '' }); redraw(); const l = main.querySelectorAll('[data-rk]'); l[l.length - 1]?.focus(); });
  };
  R.settingsCheck = (rc) => {
    const names = rc.reasons.map(r => r.label.trim().toLowerCase());
    if (!names.length || names.some(x => !x)) return 'Every return reason needs a name, and at least one is needed.';
    if (new Set(names).size !== names.length) return 'Two return reasons have the same name.';
    if (rc.fee.mode === 'pct' && !(rc.fee.value >= 0 && rc.fee.value <= 100)) return 'Enter a restocking fee from 0 to 100 percent.';
    return '';
  };
  R.settingsClean = (rc) => ({ reasons: rc.reasons.map(r => ({ key: r.key, label: r.label.trim(), ...(r.archived ? { archived: true } : {}) })), standardCan: !!rc.standardCan, limit: Math.max(0, Math.round(rc.limit || 0)), fee: rc.fee.mode === 'none' ? { mode: 'none', value: 0 } : { mode: rc.fee.mode, value: Math.max(0, rc.fee.value || 0) } });
})();
