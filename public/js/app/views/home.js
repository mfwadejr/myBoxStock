// APP / views / home — the day-to-day picture: stock, this month's sales, low stock, recent sales. Worked out in the browser.
(() => {
  const { esc, swap } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store;

  A.views.home = async (main) => {
    const me = A.me, items = S.all('item'), sales = S.all('sale').filter(e => !e.data.voided), now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const month = sales.filter(e => e.data.ts >= start), rev = month.reduce((t, e) => t + e.data.total, 0), profit = month.reduce((t, e) => t + e.data.total - (e.data.cost || 0), 0);
    const avail = items.filter(e => C.isAvail(e.data)), value = avail.reduce((t, e) => t + (e.data.cost || 0), 0);
    const low = [...new Set(items.map(e => e.data.model).filter(Boolean))].map(name => ({ name, n: avail.filter(e => e.data.model === name).length, r: S.all('model').find(m => m.data.name === name)?.data.reorder || 0 })).filter(m => m.r > 0 && m.n <= m.r);
    const recent = [...sales].sort((a, b) => b.data.ts - a.data.ts).slice(0, 6);
    swap(main, `<div class="page-head row spread wrap"><div><h1>Home</h1><p>${esc(me.businessName)} · ${esc(now.toLocaleDateString([], { month: 'long', year: 'numeric' }))}</p></div>${A.can('sales.write') ? '<a class="btn" href="#/sell">Quick sale</a>' : ''}</div>
      ${S.unreadable ? `<div class="banner red mb-lg">${S.unreadable} record${S.unreadable === 1 ? '' : 's'} could not be opened with your key. Sign out and back in; if it continues, contact support.</div>` : ''}
      <div class="stat-grid"><div class="card stat"><div class="stat-label">Available devices</div><div class="stat-value">${avail.length}</div><div class="stat-note">${esc(F.money(value))} at cost</div></div><div class="card stat"><div class="stat-label">Devices sold this month</div><div class="stat-value">${month.reduce((t, e) => t + e.data.items.length, 0)}</div><div class="stat-note">in ${month.length} sale${month.length === 1 ? '' : 's'}</div></div><div class="card stat"><div class="stat-label">Revenue this month</div><div class="stat-value">${esc(F.money(rev))}</div></div><div class="card stat"><div class="stat-label">Profit this month</div><div class="stat-value">${esc(F.money(profit))}</div></div></div>
      ${low.length ? `<div class="banner mb-lg"><b>Low stock:</b> ${low.map(m => `${esc(m.name)} (${m.n} left, reorder at ${m.r})`).join(' · ')}</div>` : ''}
      <div class="card"><h3>Recent sales</h3><div class="tablewrap mt-sm">${recent.length ? `<table><thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th class="right">Total</th></tr></thead><tbody>${recent.map(e => `<tr class="click" data-id="${esc(e.id)}"><td>${esc(F.when(e.data.ts))}</td><td class="ident">${esc(e.data.no)}</td><td>${esc(e.data.customerName || 'Walk-in')}</td><td class="right">${esc(F.money(e.data.total))}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">No sales yet.${A.can('inventory.write') && !items.length ? ' Start by adding devices under Inventory.' : ''}</div>`}</div></div>`);
    main.querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', async () => { if (await C.showReceipt(S.get('sale', tr.dataset.id))) A.route(); }));
    A.firstRunCard(main);
    A.backupReminder(main);
  };
})();
