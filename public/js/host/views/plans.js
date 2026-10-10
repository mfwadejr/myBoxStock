// HOST / views / plans — the plan list: name, price, limits. Written down ahead of taking payments; limits are not enforced yet.
(() => {
  const { esc, toast, swap, busy } = UI;

  Host.views.plans = async (main) => {
    const d = await Host.api('GET', '/business/plans');
    let plans = d.plans.map(p => ({ ...p, price: p.priceCents ? (p.priceCents / 100).toFixed(2) : '' }));
    const draw = () => {
      swap(main, `${Host.head('Plans', 'Name your plans and write down their prices and limits, ready for when payments are connected.')}
        <div class="banner blue mb-lg">Prices and limits are recorded here only. Nothing is charged and no limit is enforced yet. The free trial is ${d.trialDays} days (change it under Settings).</div>
        ${plans.map((p, i) => `<div class="card"><div class="row spread"><h3>${esc(p.name || 'New plan')}</h3><button class="btn danger small" data-rm="${i}">Remove</button></div>
          <div class="grid g3"><div class="field"><label for="pn${i}">Name</label><input type="text" id="pn${i}" data-k="name" data-i="${i}" value="${esc(p.name)}" maxlength="60"></div>
            <div class="field"><label for="pp${i}">Price</label><input type="text" id="pp${i}" data-k="price" data-i="${i}" value="${esc(p.price)}" inputmode="decimal" placeholder="29.00"></div>
            <div class="field"><label for="iv${i}">Billed every</label>${UI.select.html({ id: 'iv' + i, value: p.interval || 'month', options: [['month', 'Month'], ['year', 'Year']] })}</div>
            <div class="field"><label for="pu${i}">Users included</label><input type="number" id="pu${i}" data-k="maxUsers" data-i="${i}" value="${esc(p.maxUsers ?? '')}" min="1" placeholder="No limit"></div>
            <div class="field"><label for="pd${i}">Devices included</label><input type="number" id="pd${i}" data-k="maxDevices" data-i="${i}" value="${esc(p.maxDevices ?? '')}" min="1" placeholder="No limit"></div>
            <div class="field"><label for="pt${i}">Note</label><input type="text" id="pt${i}" data-k="note" data-i="${i}" value="${esc(p.note || '')}" maxlength="200"></div></div></div>`).join('') || '<div class="card"><div class="empty">No plans yet.</div></div>'}
        <div class="row mt-lg"><button class="btn secondary" id="add">Add a plan</button><button class="btn" id="save">Save plans</button></div>`);
      main.querySelectorAll('[data-k]').forEach(el => el.addEventListener('input', () => { plans[+el.dataset.i][el.dataset.k] = el.value; }));
      plans.forEach((p, i) => main.querySelector('#iv' + i).addEventListener('change', (e) => { p.interval = UI.select.value(e.target); }));
      main.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { plans.splice(+b.dataset.rm, 1); draw(); }));
      main.querySelector('#add').addEventListener('click', () => { plans.push({ name: '', price: '', interval: 'month', maxUsers: '', maxDevices: '', note: '' }); draw(); });
      main.querySelector('#save').addEventListener('click', (e) => busy(e.currentTarget, async () => {
        try { const r = await Host.api('PUT', '/business/plans', { plans }); plans = r.plans.map(p => ({ ...p, price: p.priceCents ? (p.priceCents / 100).toFixed(2) : '' })); toast('Plans saved'); draw(); } catch (er) { toast(er.message, true); }
      }));
    };
    draw();
  };
})();
