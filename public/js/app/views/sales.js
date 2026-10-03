// APP / views / sales — every sale, with totals for the period you choose. Receipts open from here.
(() => {
  const { esc, swap } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store;
  const f = { q: '', from: '', to: '' };
  const day = (s, end) => s ? new Date(`${s}T${end ? '23:59:59.999' : '00:00:00'}`).getTime() : null;

  A.views.sales = async (main) => {
    if (!A.can('sales.read')) return swap(main, '<div class="page-head"><h1>Sales</h1></div><div class="card"><div class="empty">Your user type does not include sales.</div></div>');
    const from = day(f.from), to = day(f.to, true), q = f.q.toLowerCase();
    const rows = S.all('sale').filter(e => (!from || e.data.ts >= from) && (!to || e.data.ts <= to) && (!q || [e.data.no, e.data.customerName, ...e.data.items.flatMap(i => [i.uid, i.serial, i.model])].some(v => String(v || '').toLowerCase().includes(q)))).sort((a, b) => b.data.ts - a.data.ts);
    const live = rows.filter(e => !e.data.voided), revenue = live.reduce((t, e) => t + e.data.total, 0), profit = live.reduce((t, e) => t + e.data.total - (e.data.cost || 0), 0);
    swap(main, `<div class="page-head row spread wrap"><div><h1>Sales</h1><p>Receipts and totals. Only your team can read this.</p></div><div class="row"><button class="btn secondary" id="exp">Export CSV</button>${A.can('sales.write') ? '<a class="btn" href="#/sell">Quick sale</a>' : ''}</div></div>
      <div class="toolbar"><input type="search" class="search" id="q" placeholder="Search receipt number, customer, device" value="${esc(f.q)}" autocomplete="off"><input type="date" id="from" value="${esc(f.from)}" aria-label="From"><input type="date" id="to" value="${esc(f.to)}" aria-label="To"></div>
      <div class="stat-grid"><div class="card stat"><div class="stat-label">Sales</div><div class="stat-value">${live.length}</div></div><div class="card stat"><div class="stat-label">Revenue</div><div class="stat-value">${esc(F.money(revenue))}</div></div><div class="card stat"><div class="stat-label">Profit</div><div class="stat-value">${esc(F.money(profit))}</div></div><div class="card stat"><div class="stat-label">Devices sold</div><div class="stat-value">${live.reduce((t, e) => t + e.data.items.length, 0)}</div></div></div>
      <div class="card"><div class="tablewrap">${rows.length ? `<table><thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th class="right">Items</th><th>Paid by</th><th class="right">Total</th></tr></thead><tbody>${rows.slice(0, 300).map(e => `<tr class="click" data-id="${esc(e.id)}"><td>${esc(F.when(e.data.ts))}</td><td class="mono">${esc(e.data.no)}${e.data.voided ? ' <span class="chip red">Void</span>' : ''}</td><td>${esc(e.data.customerName || 'Walk-in')}</td><td class="right">${e.data.items.length}</td><td>${esc(C.paymentLabel(e.data.payment))}</td><td class="right">${esc(F.money(e.data.total))}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No sales in this view.</div>'}</div></div>`);
    const again = () => A.views.sales(main);
    main.querySelector('#q').addEventListener('input', (e) => { f.q = e.target.value; clearTimeout(again.t); again.t = setTimeout(async () => { const pos = e.target.selectionStart; await again(); const i = main.querySelector('#q'); i.focus(); i.setSelectionRange(pos, pos); }, 180); });
    main.querySelector('#from').addEventListener('change', (e) => { f.from = e.target.value; again(); });
    main.querySelector('#to').addEventListener('change', (e) => { f.to = e.target.value; again(); });
    main.querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', async () => { if (await C.showReceipt(S.get('sale', tr.dataset.id))) again(); }));
    main.querySelector('#exp').addEventListener('click', () => C.download(`sales-${F.ymd(Date.now())}.csv`, C.toCsv(['receipt', 'date', 'customer', 'devices', 'payment', 'total', 'cost', 'profit', 'voided'], rows.map(e => [e.data.no, new Date(e.data.ts).toISOString(), e.data.customerName || '', e.data.items.map(C.itemLabel).join('; '), C.paymentLabel(e.data.payment), F.dollars(e.data.total), F.dollars(e.data.cost || 0), F.dollars(e.data.total - (e.data.cost || 0)), e.data.voided ? 'yes' : '']))));
  };
})();
