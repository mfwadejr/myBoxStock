// APP / views / sales — every sale, with totals for the period you choose. Receipts open from here.
(() => {
  const { esc, swap } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store;
  const f = { q: '', from: '', to: '', war: '' };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const PERIODS = [['today', 'Today'], ['7', '7 days'], ['30', '30 days'], ['month', 'This month'], ['all', 'All time']];
  const range = (k) => { const now = new Date(), to = iso(now); if (k === 'today') return { from: to, to }; if (k === 'month') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to }; if (k === 'all') return { from: '', to: '' }; const d = new Date(now); d.setDate(d.getDate() - (Number(k) - 1)); return { from: iso(d), to }; };
  const activePeriod = () => (PERIODS.find(([k]) => { const r = range(k); return r.from === f.from && r.to === f.to; }) || [''])[0];
  const WAR = { active: 'In warranty', expired: 'Expired', none: 'No warranty' };
  const day = (s, end) => s ? new Date(`${s}T${end ? '23:59:59.999' : '00:00:00'}`).getTime() : null;

  // One row per sale; shared by "Export CSV" here and "Export everything" in Security.
  A.salesTable = (entries) => ({ headers: ['receipt', 'date', 'customer', 'devices', 'payment', 'warranty', 'warranty_ends', 'total', 'cost', 'profit', 'voided'],
    rows: entries.map(e => [e.data.no, new Date(e.data.ts).toISOString(), e.data.customerName || '', e.data.items.map(C.itemLabel).join('; '), C.paymentOf(e.data), e.data.warranty?.label || 'No warranty', e.data.warranty?.end ? F.ymd(e.data.warranty.end) : '', F.dollars(e.data.total), F.dollars(e.data.cost || 0), F.dollars(e.data.total - (e.data.cost || 0)), e.data.voided ? 'yes' : '']) });
  A.views.sales = async (main) => {
    if (!A.can('sales.read')) return swap(main, '<div class="page-head"><h1>Sales</h1></div><div class="card"><div class="empty">Your user type does not include sales.</div></div>');
    const from = day(f.from), to = day(f.to, true), q = f.q.toLowerCase();
    const rows = S.all('sale').filter(e => (!from || e.data.ts >= from) && (!to || e.data.ts <= to) && (!q || [e.data.no, e.data.customerName, C.paymentOf(e.data), e.data.warranty?.label, ...e.data.items.flatMap(i => [i.uid, i.serial, i.mac, i.make, i.model, ...(i.fields || []).map(x => x.value)])].some(v => String(v || '').toLowerCase().includes(q)))).filter(e => !f.war || (!e.data.voided && C.warrantyState(e.data.warranty).kind === f.war)).sort((a, b) => b.data.ts - a.data.ts);
    const live = rows.filter(e => !e.data.voided), revenue = live.reduce((t, e) => t + e.data.total, 0), profit = live.reduce((t, e) => t + e.data.total - (e.data.cost || 0), 0);
    swap(main, `<div class="page-head row spread wrap"><div><h1>Sales</h1><p>Receipts and totals. Only your team can read this.</p></div><div class="row"><button class="btn secondary" id="exp">Export CSV</button>${A.can('sales.write') ? '<a class="btn" href="#/sell">Quick sale</a>' : ''}</div></div>
      <div class="toolbar"><input type="search" class="search" id="q" placeholder="Search sales" value="${esc(f.q)}" autocomplete="off"><input type="date" id="from" value="${esc(f.from)}" aria-label="From"><input type="date" id="to" value="${esc(f.to)}" aria-label="To">${UI.select.html({ id: 'war', options: [['', 'All warranties'], ['active', 'In warranty'], ['expired', 'Expired'], ['none', 'No warranty']], value: f.war })}</div>
      <div class="filters mb-lg">${PERIODS.map(([k, l]) => `<button type="button" class="filter ${activePeriod() === k ? 'on' : ''}" data-period="${k}">${l}</button>`).join('')}${f.q || f.from || f.to || f.war ? '<button type="button" class="linkbtn" id="clr">Clear filters</button>' : ''}</div>
      <p class="hint mb-md">Showing ${f.from || f.to ? `${esc(f.from || 'the start')} to ${esc(f.to || 'today')}` : 'all time'}${f.war ? ` · ${esc(WAR[f.war])}` : ''}${f.q ? ` · matching “${esc(f.q)}”` : ''} · ${rows.length} sale${rows.length === 1 ? '' : 's'}</p>
      <div class="stat-grid"><div class="card stat"><div class="stat-label">Sales</div><div class="stat-value">${live.length}</div></div><div class="card stat"><div class="stat-label">Revenue</div><div class="stat-value">${esc(F.money(revenue))}</div></div><div class="card stat"><div class="stat-label">Profit</div><div class="stat-value">${esc(F.money(profit))}</div></div><div class="card stat"><div class="stat-label">Devices sold</div><div class="stat-value">${live.reduce((t, e) => t + e.data.items.length, 0)}</div></div></div>
      <div class="card"><div class="tablewrap">${rows.length ? `<table><thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th class="right">Items</th><th>Warranty</th><th>Paid by</th><th class="right">Total</th></tr></thead><tbody>${rows.slice(0, 300).map(e => `<tr class="click" data-id="${esc(e.id)}"><td>${esc(F.when(e.data.ts))}</td><td class="mono">${esc(e.data.no)}${e.data.voided ? ' <span class="chip red">Void</span>' : ''}</td><td>${esc(e.data.customerName || 'Walk-in')}</td><td class="right">${e.data.items.length}</td><td>${C.warrantyChip(e.data)}</td><td>${esc(C.paymentOf(e.data))}</td><td class="right">${esc(F.money(e.data.total))}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No sales in this view.</div>'}</div></div>`);
    const again = () => A.views.sales(main);
    main.querySelector('#q').addEventListener('input', (e) => { f.q = e.target.value; clearTimeout(again.t); again.t = setTimeout(async () => { const pos = e.target.selectionStart; await again(); const i = main.querySelector('#q'); i.focus(); i.setSelectionRange(pos, pos); }, 180); });
    main.querySelector('#from').addEventListener('change', (e) => { f.from = e.target.value; again(); });
    main.querySelectorAll('[data-period]').forEach(b => b.addEventListener('click', () => { Object.assign(f, range(b.dataset.period)); again(); }));
    main.querySelector('#clr')?.addEventListener('click', () => { Object.assign(f, { q: '', from: '', to: '', war: '' }); again(); });
    main.querySelector('#war').addEventListener('change', (e) => { f.war = UI.select.value(e.target); again(); });
    main.querySelector('#to').addEventListener('change', (e) => { f.to = e.target.value; again(); });
    main.querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', async () => { if (await C.showReceipt(S.get('sale', tr.dataset.id))) again(); }));
    main.querySelector('#exp').addEventListener('click', () => { const t = A.salesTable(rows); C.download(`sales-${F.ymd(Date.now())}.csv`, C.toCsv(t.headers, t.rows)); });
  };
})();
