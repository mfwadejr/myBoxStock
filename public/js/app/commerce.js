// APP / commerce — pieces shared by the inventory, customer, sales and quick-sale pages: status chips, CSV, receipts, voiding a sale.
(() => {
  const { esc, toast, sheet } = UI, F = () => AccountApp.fmt;
  const C = AccountApp.commerce = {};

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

  // ---- sales helpers ----
  C.newReceiptNo = () => `S-${F().ymd(Date.now())}-${Vault.newId().replace(/[-_]/g, '').slice(0, 4).toUpperCase()}`;
  C.salesOf = (customerId) => AccountApp.store.all('sale').filter(s => !s.data.voided && s.data.customerId === customerId);
  C.itemLabel = (it) => [it.model, it.uid || it.serial || it.mac].filter(Boolean).join(' · ') || 'Device';

  C.receiptText = (sale) => {
    const d = sale.data, me = AccountApp.me, lines = [`${me.businessName}`, `Receipt ${d.no}`, F().when(d.ts), d.customerName ? `Customer: ${d.customerName}` : 'Walk-in customer', ''];
    for (const it of d.items) lines.push(`${C.itemLabel(it)}  ${F().money(it.price)}`);
    lines.push('', `Total: ${F().money(d.total)}`, `Paid by: ${C.paymentLabel(d.payment)}`); if (d.notes) lines.push('', d.notes); lines.push('', 'Thank you!'); return lines.join('\n');
  };
  const receiptHtml = (sale) => { const d = sale.data;
    return `<div class="receipt"><h2>${esc(AccountApp.me.businessName)}</h2><div class="sub center">Receipt ${esc(d.no)} · ${esc(F().when(d.ts))}</div>${d.voided ? '<p class="banner red center mt-md">This sale was voided.</p>' : ''}
      <p class="center mt-md">${d.customerName ? `Customer: <b>${esc(d.customerName)}</b>` : 'Walk-in customer'}</p>
      <table><tbody>${d.items.map(it => `<tr><td>${esc(C.itemLabel(it))}</td><td class="right nowrap">${esc(F().money(it.price))}</td></tr>`).join('')}</tbody></table>
      <div class="line-total"><span>Total</span><span>${esc(F().money(d.total))}</span></div><p class="sub center mt-md">Paid by ${esc(C.paymentLabel(d.payment))}</p>${d.notes ? `<p class="center mt-md">${esc(d.notes)}</p>` : ''}<p class="sub center mt-lg">Thank you!</p></div>`; };

  // Receipt sheet: print, email (opens the person's own mail app — nothing goes through our server), void.
  C.showReceipt = async (sale, { canVoid = true } = {}) => {
    const d = sale.data, can = canVoid && AccountApp.can('sales.write') && !d.voided;
    return sheet(`${receiptHtml(sale)}<div class="actions split"><div class="row">${can ? '<button class="btn danger small" id="void">Void sale</button>' : ''}</div><div class="row"><button class="btn secondary small" id="mail">Email</button><button class="btn secondary small" id="print">Print</button><button class="btn" data-cancel>Done</button></div></div>`, { onMount: (el, close) => {
      el.querySelector('#print').addEventListener('click', () => { document.documentElement.classList.add('printing'); window.addEventListener('afterprint', () => document.documentElement.classList.remove('printing'), { once: true }); window.print(); });
      el.querySelector('#mail').addEventListener('click', () => { location.href = `mailto:${encodeURIComponent(d.customerEmail || '')}?subject=${encodeURIComponent(`Receipt ${d.no} from ${AccountApp.me.businessName}`)}&body=${encodeURIComponent(C.receiptText(sale))}`; });
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
})();
