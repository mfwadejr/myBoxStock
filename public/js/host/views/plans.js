// HOST / views / plans — the Limits list (what is counted, and what happens at the cap) and the plan list (name, price, and each plan's own number for every limit).
// Limits are enforced by the server when a reseller adds devices, sales, customers, models or people. Prices are written down only; nothing is charged.
(() => {
  const { esc, toast, swap, busy } = UI;
  const COUNTS = [['admins', 'Administrators'], ['users', 'Team members (including administrators)'], ['item', 'Device records'], ['sale', 'Sales records'], ['customer', 'Customer records'], ['model', 'Models']];
  const PERIODS = [['all', 'All time'], ['d365', 'Rolling 12 months'], ['d30', 'Rolling 30 days']];
  const ACTIONS = [['warn', 'Warn only'], ['block', 'Block adding new']];

  Host.views.plans = async (main) => {
    const d = await Host.api('GET', '/business/plans');
    const load = (x) => { limits = x.limits.map(l => ({ ...l })); plans = x.plans.map(p => ({ ...p, price: p.priceCents ? (p.priceCents / 100).toFixed(2) : '', limits: { ...(p.limits || {}) } })); defaultPlanId = x.defaultPlanId || ''; };
    let limits, plans, defaultPlanId; load(d);
    const draw = () => {
      swap(main, `${Host.head('Plans', 'Decide what each plan includes and what is counted. The server enforces the limits; prices are written down for when payments are connected.')}
        <div class="banner blue mb-lg">Limits are enforced. A limit set to “Block adding new” stops a reseller from adding past the cap; “Warn only” shows them a notice and lets them carry on. Prices are recorded here only and nothing is charged. The free trial is ${d.trialDays} days (change it under Settings).</div>
        <div class="card"><div class="row spread wrap"><div><h3>Limits</h3><div class="sub mb-0">What can be counted for a reseller. Devices count every device record, sold or not, so a device keeps counting after it is sold. Loans and “in stock only” cannot be counted, because the server cannot read them. Each plan below sets its own number for each limit.</div></div><button class="btn secondary" id="addlim">Add a limit</button></div>
          ${limits.map((l, i) => `<div class="limit-row"><div class="grid g3">
            <div class="field"><label for="ln${i}">Name</label><input type="text" id="ln${i}" data-lk="name" data-li="${i}" value="${esc(l.name)}" maxlength="60"></div>
            <div class="field"><label for="lc${i}">Counts</label>${UI.select.html({ id: 'lc' + i, value: l.counts, options: COUNTS })}</div>
            <div class="field"><label for="lp${i}">Counting period</label>${UI.select.html({ id: 'lp' + i, value: l.period, options: PERIODS })}</div>
            <div class="field"><label for="lw${i}">Warn at (percent)</label><input type="number" id="lw${i}" data-lk="warnPct" data-li="${i}" value="${esc(l.warnPct)}" min="1" max="100"></div>
            <div class="field"><label for="la${i}">At the cap</label>${UI.select.html({ id: 'la' + i, value: l.action, options: ACTIONS })}</div>
            <div class="field"><label>Order</label><div class="row wrap"><button type="button" class="btn secondary small" data-lup="${i}" ${i ? '' : 'disabled'}>Move up</button><button type="button" class="btn secondary small" data-ldn="${i}" ${i < limits.length - 1 ? '' : 'disabled'}>Move down</button><button type="button" class="btn danger small" data-lrm="${i}">Remove</button></div></div>
          </div></div>`).join('') || '<div class="empty">No limits. Add one to start counting.</div>'}</div>
        ${plans.map((p, i) => `<div class="card"><div class="row spread"><h3>${esc(p.name || 'New plan')}</h3><button class="btn danger small" data-rm="${i}">Remove</button></div>
          <div class="grid g3"><div class="field"><label for="pn${i}">Name</label><input type="text" id="pn${i}" data-k="name" data-i="${i}" value="${esc(p.name)}" maxlength="60"></div>
            <div class="field"><label for="pp${i}">Price</label><input type="text" id="pp${i}" data-k="price" data-i="${i}" value="${esc(p.price)}" inputmode="decimal" placeholder="29.00"></div>
            <div class="field"><label for="iv${i}">Billed every</label>${UI.select.html({ id: 'iv' + i, value: p.interval || 'month', options: [['month', 'Month'], ['year', 'Year']] })}</div>
            <div class="field"><label for="pt${i}">Note</label><input type="text" id="pt${i}" data-k="note" data-i="${i}" value="${esc(p.note || '')}" maxlength="200"></div></div>
          ${limits.length ? `<h4 class="mt-md">Included in ${esc(p.name || 'this plan')}</h4><div class="grid g3">${limits.map((l, j) => `<div class="field"><label for="pl${i}-${j}">${esc(l.name)}</label><input type="number" id="pl${i}-${j}" data-pl="${esc(l.id)}" data-i="${i}" value="${esc(p.limits[l.id] ?? '')}" min="0" placeholder="No limit"></div>`).join('')}</div>` : ''}</div>`).join('') || '<div class="card"><div class="empty">No plans yet.</div></div>'}
        <div class="card"><div class="field mb-0"><label for="dp">New accounts start on</label>${UI.select.html({ id: 'dp', value: defaultPlanId, options: [['', 'No plan (no limits)'], ...plans.filter(p => p.id).map(p => [p.id, p.name])] })}<div class="hint">Applies to people who sign up from now on. To move an account that already exists, open it under Accounts and choose Plan and limits. Plans just added need saving first to appear here.</div></div></div>
        <div class="row mt-lg"><button class="btn secondary" id="add">Add a plan</button><button class="btn" id="save">Save plans and limits</button></div>`);
      main.querySelectorAll('[data-k]').forEach(el => el.addEventListener('input', () => { plans[+el.dataset.i][el.dataset.k] = el.value; }));
      main.querySelectorAll('[data-lk]').forEach(el => el.addEventListener('input', () => { limits[+el.dataset.li][el.dataset.lk] = el.value; }));
      main.querySelectorAll('[data-pl]').forEach(el => el.addEventListener('input', () => { plans[+el.dataset.i].limits[el.dataset.pl] = el.value; }));
      limits.forEach((l, i) => {
        main.querySelector('#lc' + i).addEventListener('change', (e) => { l.counts = UI.select.value(e.target); });
        main.querySelector('#lp' + i).addEventListener('change', (e) => { l.period = UI.select.value(e.target); });
        main.querySelector('#la' + i).addEventListener('change', (e) => { l.action = UI.select.value(e.target); });
      });
      plans.forEach((p, i) => main.querySelector('#iv' + i).addEventListener('change', (e) => { p.interval = UI.select.value(e.target); }));
      main.querySelector('#dp').addEventListener('change', (e) => { defaultPlanId = UI.select.value(e.target); });
      const move = (i, to) => { const [x] = limits.splice(i, 1); limits.splice(to, 0, x); draw(); };
      main.querySelectorAll('[data-lup]').forEach(b => b.addEventListener('click', () => move(+b.dataset.lup, +b.dataset.lup - 1)));
      main.querySelectorAll('[data-ldn]').forEach(b => b.addEventListener('click', () => move(+b.dataset.ldn, +b.dataset.ldn + 1)));
      main.querySelectorAll('[data-lrm]').forEach(b => b.addEventListener('click', () => { limits.splice(+b.dataset.lrm, 1); draw(); }));
      main.querySelector('#addlim').addEventListener('click', () => { limits.push({ id: 'lim-' + Math.random().toString(36).slice(2, 10), name: '', counts: 'item', period: 'all', warnPct: 80, action: 'warn' }); draw(); });
      main.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { plans.splice(+b.dataset.rm, 1); draw(); }));
      main.querySelector('#add').addEventListener('click', () => { plans.push({ name: '', price: '', interval: 'month', note: '', limits: {} }); draw(); });
      main.querySelector('#save').addEventListener('click', (e) => busy(e.currentTarget, async () => {
        try {
          const r = await Host.api('PUT', '/business/plans', { plans, limits, defaultPlanId }); load(r); toast('Plans and limits saved'); draw();
        } catch (er) { toast(er.message, true); }
      }));
    };
    draw();
  };
})();
