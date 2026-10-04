// APP / commerce — pieces shared by the inventory, customer, sales and quick-sale pages: status chips, CSV, receipts, voiding a sale.
(() => {
  const { esc, toast, sheet } = UI, F = () => AccountApp.fmt;
  const C = AccountApp.commerce = {};

  // ---- the account's tracked fields and test checklist (set up under Settings) ----
  C.fields = () => AccountApp.store.config().fields.filter(f => f.enabled);
  C.testsOn = () => AccountApp.store.config().tests.enabled;
  C.steps = () => C.testsOn() ? AccountApp.store.config().steps : []; // switched off in Settings = no steps anywhere; nothing is deleted
  // Dates typed in forms are plain YYYY-MM-DD; shown and compared at midday so time zones never shift the day.
  C.dateMs = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? new Date(`${s}T12:00:00`).getTime() : 0;
  C.dateStr = (t) => { const d = new Date(t || Date.now()); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  C.receivedMs = (d) => C.dateMs(d.receivedOn) || d.addedAt || 0;
  C.testedMs = (d) => C.dateMs(d.testedOn) || Object.values(d.checks || {})[0]?.at || 0;
  // Extra items under a step. Values live in d.checkVals = { stepKey: { itemKey: text | { from, to } } } and are kept even when the step is unticked.
  C.detailText = (it, v) => it.type === 'fromto' ? (v?.from || v?.to ? `${v.from || '?'} → ${v.to || '?'}` : '') : String(v || '');
  C.detailRows = (st, d) => (st.details || []).map(it => ({ label: it.label, value: C.detailText(it, d.checkVals?.[st.key]?.[it.key]) })).filter(x => x.value);
  C.getVal = (d, f) => (f.core ? d[f.key] : d.custom?.[f.key]) ?? '';
  C.setVal = (d, f, v) => { if (f.core) d[f.key] = v; else d.custom = { ...(d.custom || {}), [f.key]: v }; };
  C.showVal = (f, v) => f.type === 'bool' ? (v === true || v === 'yes' ? 'Yes' : v === false || v === 'no' ? 'No' : '') : String(v ?? '');
  // A scanner can send its label ("UID", "SN", "MAC"...) and line breaks before the value. Keep only the value.
  C.scanLabel = /^(?:uid|s\/n|sn|serial(?:\s*(?:no\.?|number|#))?|mac(?:\s*address)?|imei|id)\s*[:#=-]?$/i; // a line that is only a label
  C.cleanScan = (v) => { const t = String(v ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim(); if (C.scanLabel.test(t)) return '';
    return t.replace(/^(?:uid|s\/n|sn|serial(?:\s*(?:no|number|#))?|mac(?:\s*address)?|imei|id)\s*[:#=-]?\s+(?=\S)/i, '').replace(/^(?:sn|mac|imei)[:#=]\s*(?=\S)/i, '').replace(/^uid[:#=]?\s*(?=\S{6,})/i, '').trim(); };
  C.lookupFields = () => C.fields().filter(f => f.lookup);
  // Form control for one field, and reading it back.
  C.fieldInput = (f, v) => {
    const id = `f_${f.key}`;
    if (f.type === 'choice') return UI.select.html({ id, options: [['', '—'], ...(f.options || []).map(o => [o, o])], value: v || (f.core && f.key === 'cond' ? f.options?.[0] : '') });
    if (f.type === 'bool') return UI.select.html({ id, options: [['', '—'], ['yes', 'Yes'], ['no', 'No']], value: v === true ? 'yes' : v === false ? 'no' : '' });
    return `<input type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}" id="${id}" value="${esc(v ?? '')}" autocomplete="off"${f.lookup || f.unique ? ' data-scan' : ''}${f.type === 'number' ? ' step="any"' : ''}>`;
  };
  C.readInput = (el, f) => {
    const n = el.querySelector(`#f_${f.key}`); if (!n) return '';
    if (f.type === 'choice') return UI.select.value(n);
    if (f.type === 'bool') { const v = UI.select.value(n); return v === 'yes' ? true : v === 'no' ? false : ''; }
    return f.lookup || f.unique ? C.cleanScan(n.value) : n.value.trim();
  };
  // Test record: which checklist steps are done for a device. Stored as checks = { stepKey: { by, at } }.
  C.testState = (d) => { const steps = C.steps(), done = steps.filter(s => d.checks?.[s.key]); return { done: done.length, total: steps.length, missingRequired: steps.filter(s => s.required && !d.checks?.[s.key]) }; };
  C.testChip = (d) => { const t = C.testState(d); if (!t.total) return ''; return t.done === t.total ? '<span class="chip green">Tested</span>' : t.done ? `<span class="chip amber">Tested ${t.done}/${t.total}</span>` : '<span class="chip gray">Not tested</span>'; };
  // What gets copied into the sale so the record stays as it was, even if the setup changes later.
  C.inspectionSnapshot = (d) => !C.steps().length ? null : ({ steps: C.steps().map(s => { const c = d.checks?.[s.key]; return { label: s.label, done: !!c, by: c?.by || '', at: c?.at || 0, details: c ? C.detailRows(s, d) : [] }; }), testedOn: C.testedMs(d), by: Object.values(d.checks || {})[0]?.by || '', notes: d.testNotes || '' });
  C.fieldSnapshot = (d) => C.fields().filter(f => f.onSale).map(f => ({ label: f.label, value: C.showVal(f, C.getVal(d, f)) })).filter(x => x.value !== '');

  C.STATUS = { available: ['green', 'Available'], reserved: ['blue', 'Reserved'], sold: ['gray', 'Sold'], returned: ['amber', 'Returned'], damaged: ['red', 'Damaged'], archived: ['gray', 'Archived'] };
  C.statusChip = (s) => { const [c, l] = C.STATUS[s] || ['gray', s]; return `<span class="chip ${c}">${esc(l)}</span>`; };
  C.PAYMENTS = [['cash', 'Cash'], ['card', 'Card'], ['transfer', 'Bank transfer'], ['other', 'Other']];
  C.paymentLabel = (v) => (C.PAYMENTS.find(p => p[0] === v) || [, v || '—'])[1];
  C.download = (name, text, type = 'text/csv') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };

  // ---- CSV (done in the browser; the server never sees the file) ----
  const cell = (v) => { v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }; // leading =,+,-,@ is neutralised for spreadsheet programs
  C.toCsv = (headers, rows) => [headers.map(cell).join(','), ...rows.map(r => r.map(cell).join(','))].join('\r\n');
  C.parseCsv = (text) => {
    const rows = []; let row = [], v = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { v += '"'; i++; } else q = false; } else v += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(v); v = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(v); v = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
      else v += ch;
    }
    row.push(v); if (row.some(x => x !== '')) rows.push(row); return rows;
  };

  // ---- warranty: periods live in the encrypted config; each sale keeps its own snapshot ----
  const UNITS = [['days', 'Days'], ['months', 'Months'], ['years', 'Years']];
  C.WARRANTY_UNITS = UNITS;
  C.periodLabel = (p) => `${p.amount} ${p.amount === 1 ? p.unit.replace(/s$/, '') : p.unit}`;
  C.warrantyPeriods = () => AccountApp.store.config().warranty.periods;
  C.warrantyDefault = () => { const w = AccountApp.store.config().warranty; return w.periods.some(p => p.key === w.default && !p.archived) ? w.default : (w.periods.find(p => !p.archived)?.key || ''); };
  C.warrantyEnd = (start, p) => { if (!p || !p.amount) return null; const d = new Date(start); if (p.unit === 'years') d.setFullYear(d.getFullYear() + p.amount); else if (p.unit === 'months') d.setMonth(d.getMonth() + p.amount); else d.setDate(d.getDate() + p.amount); return d.getTime(); };
  C.warrantySnapshot = (key, start) => { const p = C.warrantyPeriods().find(x => x.key === key); return p ? { key: p.key, label: p.label, start, end: C.warrantyEnd(start, p) } : { key: 'none', label: 'No warranty', start, end: null }; };
  C.warrantyState = (w, now = Date.now()) => {
    if (!w || !w.end) return { kind: 'none', cls: 'gray', text: 'No warranty' };
    const day = 86400000, left = Math.ceil((w.end - now) / day);
    if (left > 0) return { kind: 'active', cls: 'green', text: `In warranty · ${left} day${left === 1 ? '' : 's'} remaining` };
    const ago = Math.floor((now - w.end) / day);
    return { kind: 'expired', cls: 'red', text: ago < 1 ? 'Expired today' : `Expired · ${ago} day${ago === 1 ? '' : 's'} ago` };
  };
  C.warrantyChip = (sale) => { const s = C.warrantyState(sale.warranty); return sale.voided ? '<span class="chip gray">Void</span>' : `<span class="chip ${s.cls}">${esc(s.text)}</span>`; };
  C.warrantyLine = (sale) => sale.warranty?.end ? `Warranty: ${sale.warranty.label} · ends ${F().day(sale.warranty.end)} · ${C.warrantyState(sale.warranty).text}` : 'Warranty: none';

  // ---- discounts: a % off any line and/or the whole order; Administrators may be capped for Standard users in Settings ----
  C.pct = (v) => Math.min(100, Math.max(0, Math.round((Number(v) || 0) * 10) / 10));
  C.lineNet = (price, pct) => Math.round(price * (100 - C.pct(pct)) / 100);
  C.saleTotals = (lines, orderPct) => { const list = lines.reduce((t, l) => t + l.price, 0), sub = lines.reduce((t, l) => t + C.lineNet(l.price, l.pct), 0), off = Math.round(sub * C.pct(orderPct) / 100); return { list, sub, off, total: sub - off, saved: list - (sub - off) }; };
  C.discountCap = () => AccountApp.can('users.manage') ? 100 : AccountApp.store.config().discount.maxStandardPct;
  C.overCap = (lines, orderPct) => { const t = C.saleTotals(lines, orderPct); return t.list > 0 && (t.saved / t.list) * 100 > C.discountCap() + 0.05; };

  // ---- sales helpers ----
  C.newReceiptNo = () => `S-${F().ymd(Date.now())}-${Vault.newId().replace(/[-_]/g, '').slice(0, 4).toUpperCase()}`;
  C.salesOf = (customerId) => AccountApp.store.all('sale').filter(s => !s.data.voided && s.data.customerId === customerId);
  C.deviceName = (d) => [d.make, d.model].filter(Boolean).join(' ');
  C.itemLabel = (it) => [C.deviceName(it), it.uid || it.serial || it.mac || it.fields?.[0]?.value || Object.values(it.custom || {}).find(Boolean)].filter(Boolean).join(' · ') || 'Device';

  // Older sales stored a date per step; newer ones store one "tested on" date for the whole record.
  const stepLine = (st, rec) => `${st.done ? '✓' : '—'} ${st.label}${st.done && st.at && !rec.testedOn ? ` (${F().day(st.at)}${st.by ? ', ' + st.by : ''})` : ''}${(st.details || []).length ? ': ' + st.details.map(x => `${x.label} ${x.value}`).join('; ') : ''}`;
  const recHead = (rec) => `Test record${rec.testedOn ? ` — tested ${F().day(rec.testedOn)}${rec.by ? ', ' + rec.by : ''}` : ''}`;
  C.receiptText = (sale, withTests = false) => {
    const d = sale.data, me = AccountApp.me, lines = [`${me.businessName}`, `Receipt ${d.no}`, F().when(d.ts), d.customerName ? `Customer: ${d.customerName}` : 'Walk-in customer', ''];
    for (const it of d.items) {
      lines.push(`${C.itemLabel(it)}  ${F().money(it.price)}${it.pct ? ` (${it.pct}% off ${F().money(it.listPrice)})` : ''}`); for (const x of it.fields || []) lines.push(`   ${x.label}: ${x.value}`);
      if (withTests && it.inspection) { lines.push(`   ${recHead(it.inspection)}:`); for (const st of it.inspection.steps) lines.push(`    ${stepLine(st, it.inspection)}`); if (it.inspection.notes) lines.push(`    Notes: ${it.inspection.notes}`); }
    }
    if (d.orderPct) lines.push('', `Subtotal: ${F().money(d.subtotal)}`, `Order discount ${d.orderPct}%: -${F().money(d.orderOff)}`);
    lines.push('', `Total: ${F().money(d.total)}`, `Paid by: ${C.paymentLabel(d.payment)}`, C.warrantyLine(d)); if (d.notes) lines.push('', d.notes); lines.push('', 'Thank you!'); return lines.join('\n');
  };
  C.hasTests = (sale) => sale.data.items.some(it => it.inspection?.steps?.length);
  const testHtml = (it) => it.inspection?.steps?.length ? `<div class="test-record"><div class="strong text-sm">${esc(recHead(it.inspection))}</div>${it.inspection.steps.map(st => `<div class="text-sm ${st.done ? '' : 'faint'}">${esc(stepLine(st, it.inspection))}</div>`).join('')}${it.inspection.notes ? `<div class="text-sm mt-xs">${esc(it.inspection.notes)}</div>` : ''}</div>` : '';
  const receiptHtml = (sale, withTests) => { const d = sale.data;
    return `<div class="receipt"><img class="receipt-logo" src="/assets/logo-512.png" alt="" width="512" height="512"><h2>${esc(AccountApp.me.businessName)}</h2><div class="sub center">Receipt ${esc(d.no)} · ${esc(F().when(d.ts))}</div>${d.voided ? '<p class="banner red center mt-md">This sale was voided.</p>' : ''}
      <p class="center mt-md">${d.customerName ? `Customer: <b>${esc(d.customerName)}</b>` : 'Walk-in customer'}</p>
      <table><tbody>${d.items.map(it => `<tr><td><div>${esc(C.itemLabel(it))}</div>${it.pct ? `<div class="sub text-sm">${esc(it.pct)}% off</div>` : ''}${(it.fields || []).length ? `<div class="sub text-sm">${it.fields.map(x => `${esc(x.label)}: ${esc(x.value)}`).join(' · ')}</div>` : ''}${withTests ? testHtml(it) : ''}</td><td class="right nowrap">${it.pct ? `<div class="sub text-sm strike">${esc(F().money(it.listPrice))}</div>` : ''}<div>${esc(F().money(it.price))}</div></td></tr>`).join('')}</tbody></table>
      ${d.orderPct ? `<div class="line-sub"><span>Subtotal</span><span>${esc(F().money(d.subtotal))}</span></div><div class="line-sub"><span>Order discount ${esc(d.orderPct)}%</span><span>−${esc(F().money(d.orderOff))}</span></div>` : ''}<div class="line-total"><span>Total</span><span>${esc(F().money(d.total))}</span></div><p class="sub center mt-md">Paid by ${esc(C.paymentLabel(d.payment))}</p><p class="center mt-sm">${esc(C.warrantyLine(d))}</p>${d.notes ? `<p class="center mt-md">${esc(d.notes)}</p>` : ''}<p class="sub center mt-lg">Thank you!</p></div>`; };

  // Receipt sheet: print, email (sent by the server and not kept, or opened in the person's own mail app), void.
  C.showReceipt = async (sale, { canVoid = true } = {}) => {
    const d = sale.data, can = canVoid && AccountApp.can('sales.write') && !d.voided;
    let withTests = false;
    return sheet(`<div id="rc">${receiptHtml(sale, false)}</div>${C.hasTests(sale) ? '<label class="check mt-md no-print"><input type="checkbox" id="wt"><span>Include the test record (shows what was checked before it was sold)</span></label>' : ''}<div class="actions split"><div class="row">${can ? '<button class="btn danger small" id="void">Void sale</button>' : ''}${can && AccountApp.can('users.manage') ? '<button class="btn secondary small" id="wchg">Change warranty</button>' : ''}</div><div class="row"><button class="btn secondary small" id="mail">Email</button><button class="btn secondary small" id="print">Print</button><button class="btn" data-cancel>Done</button></div></div>`, { onMount: (el, close) => {
      el.querySelector('#wt')?.addEventListener('change', (e) => { withTests = e.target.checked; el.querySelector('#rc').innerHTML = receiptHtml(sale, withTests); });
      el.querySelector('#print').addEventListener('click', () => { document.documentElement.classList.add('printing'); window.addEventListener('afterprint', () => document.documentElement.classList.remove('printing'), { once: true }); window.print(); });
      el.querySelector('#mail').addEventListener('click', async () => {
        const subject = `Receipt ${d.no} from ${AccountApp.me.businessName}`, text = () => C.receiptText(sale, withTests);
        await sheet(`<h2>Email receipt</h2><p class="sub">The receipt is sent from here and is not kept on our server. Replies go to ${esc(AccountApp.me.email || 'your own address')}.</p><div class="field mt-md"><label>Send to</label><input type="email" id="rto" value="${esc(d.customerEmail || '')}" autocomplete="off"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn secondary" id="rapp">Open in my mail app</button><button class="btn" id="rgo">Send</button></div>`, { onMount: (m, done) => {
          const to = () => m.querySelector('#rto').value.trim();
          m.querySelector('#rapp').addEventListener('click', () => { location.href = `mailto:${encodeURIComponent(to())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text())}`; done(false); });
          m.querySelector('#rgo').addEventListener('click', async () => { try { await AccountApp.api('POST', '/receipt-email', { to: to(), receiptNo: d.no, text: text() }); toast('Receipt sent'); done(true); } catch (e) { toast(e.message, true); } });
        } });
      });
      el.querySelector('#wchg')?.addEventListener('click', async () => {
        const opts = C.warrantyPeriods().filter(p => !p.archived || p.key === d.warranty?.key).map(p => [p.key, p.label]);
        const key = await sheet(`<h2>Change warranty</h2><p class="sub">The end date is worked out again from the sale date.</p><div class="field mt-md"><label>Warranty</label>${UI.select.html({ id: 'wk', options: opts, value: d.warranty?.key || 'none' })}</div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save</button></div>`, { onMount: (m, done) => m.querySelector('#go').addEventListener('click', () => done(UI.select.value(m.querySelector('#wk')))) });
        if (!key) return;
        try { await AccountApp.store.commit({ puts: [{ type: 'sale', id: sale.id, data: { ...d, warranty: C.warrantySnapshot(key, d.ts) } }] }); toast('Warranty updated'); close('warranty'); } catch (e) { toast(e.message, true); }
      });
      el.querySelector('#void')?.addEventListener('click', async () => {
        if (!await UI.confirmBox({ title: 'Void this sale?', body: 'The devices go back to available and the sale stays in your history marked as voided.', confirmLabel: 'Void sale', danger: true })) return;
        try { await C.voidSale(sale); toast('Sale voided'); close('voided'); } catch (e) { toast(e.message, true); }
      });
    } });
  };
  C.voidSale = async (sale) => {
    const puts = [{ type: 'sale', id: sale.id, data: { ...sale.data, voided: true, voidedAt: Date.now() } }];
    for (const it of sale.data.items) { const cur = AccountApp.store.get('item', it.id); if (cur && cur.data.saleId === sale.id) { const { soldAt, saleId, ...rest } = cur.data; puts.push({ type: 'item', id: cur.id, data: { ...rest, status: 'available' } }); } }
    await AccountApp.store.commit({ puts });
  };
  // Clean scanned text as soon as the box is left, so what you see is what is saved.
  document.addEventListener('change', (e) => { const n = e.target; if (n?.matches?.('input[data-scan]')) n.value = C.cleanScan(n.value); });
})();
