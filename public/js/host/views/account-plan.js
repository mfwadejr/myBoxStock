// HOST / views / account-plan — on an account's sheet: which plan it is on, how much of each limit it uses, the Host's own numbers, and how it is billed.
// Counts only. Provider ids are kept for a payment system that is not connected yet; nothing is sent anywhere.
(() => {
  const { esc, fmt, toast, sheet, busy } = UI;
  const STATUS = { current: ['green', 'Current'], due: ['amber', 'Due soon'], overdue: ['red', 'Overdue'] };
  const PERIOD = { all: '', d365: ' · last 12 months', d30: ' · last 30 days' };
  const P = Host.accountPlan = {};

  P.statusChip = (s) => STATUS[s] ? `<span class="chip ${STATUS[s][0]}">${STATUS[s][1]}</span>` : '';

  // The block shown on the account sheet, under Plan.
  P.html = (d) => {
    const i = d.planInfo, plan = i.plans.find(p => p.id === i.planRef);
    return `<h3 class="mt-sm">Plan limits and billing</h3>
      <div class="setting"><div><div class="setting-title">${plan ? esc(plan.name) : 'No plan chosen'} ${P.statusChip(i.subscription)}</div><div class="setting-desc">${plan ? '' : 'Without a plan there are no limits. '}${i.cycle ? `Billed every ${i.cycle}. ` : ''}${i.providerCustomer || i.providerSubscription ? 'Payment system details saved.' : ''}</div></div><button class="btn secondary small" id="lim">Plan, limits and billing</button></div>
      ${i.usage.filter(u => u.limit != null).map(u => `<div class="plan-use"><div class="row spread"><span>${esc(u.name)}<span class="hint">${esc(PERIOD[u.period])}${u.source === 'override' ? ' · own number' : ''}</span></span><span><b>${u.used} of ${u.limit}</b> ${u.state === 'full' ? '<span class="chip red">At the cap</span>' : u.state === 'warn' ? '<span class="chip amber">Nearly full</span>' : ''}</span></div><div class="meter"><i class="${u.state === 'full' ? 'bad' : u.state === 'warn' ? 'warn' : ''}" data-pct="${Math.min(100, u.pct)}"></i></div></div>`).join('') || (i.usage.length ? '<div class="setting-desc">No numbers are set for this account, so nothing is limited.</div>' : '')}`;
  };

  P.sheet = async (d, a, back) => {
    const i = d.planInfo;
    await sheet(`<h2>Plan, limits and billing</h2><p class="muted">${esc(a.business_name)} · <span class="ident">${esc(a.account_code)}</span></p>
      <div class="field mt-md"><label for="pr">Plan</label>${UI.select.html({ id: 'pr', value: i.planRef, options: [['', 'No plan (no limits)'], ...i.plans.map(p => [p.id, p.name])] })}</div>
      ${i.limitDefs.length ? `<h4 class="mt-md">This account's own numbers</h4><div class="hint">Leave a box empty to use the plan's number. Type a number to give this account its own, and 0 to allow none.</div><div class="grid g3 mt-sm">${i.limitDefs.map((l, j) => `<div class="field"><label for="ov${j}">${esc(l.name)}</label><input type="number" id="ov${j}" data-ov="${esc(l.id)}" min="0" value="${esc(i.overrides[l.id] ?? '')}" placeholder="Plan's number"></div>`).join('')}</div>` : ''}
      <h4 class="mt-md">Billing</h4>
      <div class="field"><label for="cy">Billed every</label>${UI.select.html({ id: 'cy', value: i.cycle, options: [['', 'Not set'], ['month', 'Month'], ['year', 'Year']] })}<div class="hint">For your own tracking. Mark a payment as received with Record a receipt; the paid-through date moves on by one billing period.</div></div>
      <div class="grid g2"><div class="field"><label for="pc">Payment system customer ID (optional)</label><input type="text" id="pc" maxlength="120" value="${esc(i.providerCustomer)}" autocomplete="off"></div>
        <div class="field"><label for="ps">Payment system subscription ID (optional)</label><input type="text" id="ps" maxlength="120" value="${esc(i.providerSubscription)}" autocomplete="off"></div></div>
      <div class="field"><label for="rs">Reason (saved in the log)</label><input type="text" id="rs" maxlength="200" placeholder="e.g. Moved to Pro at their request"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save</button></div>`, { onMount: (el, close) => {
        el.querySelector('#go').addEventListener('click', (e) => busy(e.currentTarget, async () => {
          const overrides = {}; el.querySelectorAll('[data-ov]').forEach(x => { overrides[x.dataset.ov] = x.value; });
          try { await Host.api('POST', `/accounts/${a.id}/limits`, { planRef: UI.select.value(el.querySelector('#pr')), overrides, cycle: UI.select.value(el.querySelector('#cy')), providerCustomer: el.querySelector('#pc').value, providerSubscription: el.querySelector('#ps').value, reason: el.querySelector('#rs').value }); toast('Saved'); close(); } catch (er) { toast(er.message, true); }
        }));
      } });
    back();
  };
})();
