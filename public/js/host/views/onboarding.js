// HOST / views / onboarding — how far each new account got. Counts and setup steps only (identity and security facts the server already holds).
(() => {
  const { esc, fmt, swap } = UI;
  const RANGES = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['0', 'All time']];
  const tick = (ok) => `<span class="chip ${ok ? 'green' : ''}">${ok ? 'done' : 'not yet'}</span>`;
  const ENDED = { trial_expired: 'Trial ended', paid_expired: 'Paid ended' };
  // Plan column: Free gets its own chip (it is the final step, done by the Host), a lapsed trial or paid period a red chip, everything else the usual done / not yet.
  const planCell = (a) => a.planEnded ? `<span class="chip red">${ENDED[a.plan] || 'Plan ended'}</span>` : a.free ? '<span class="chip blue">free</span>' : tick(a.steps.planStarted);
  let days = '30';
  Host.views.onboarding = async (main) => {
    const d = await Host.api('GET', '/onboarding?days=' + days), top = Math.max(1, d.funnel[0].count);
    swap(main, `${Host.head('Onboarding', 'How far new accounts get through setup. Use it to see where people stop, and who to nudge.')}
      <div class="row mb-lg">${UI.select.html({ id: 'range', options: RANGES, value: days })}</div>
      <div class="card"><h3>Setup funnel</h3><div class="sub">${d.total} account${d.total === 1 ? '' : 's'} created in this period.</div>
        ${d.funnel.map(s => `<div class="mt-md"><div class="row spread"><span>${esc(s.label)}</span><b>${s.count}</b></div><div class="meter"><i data-pct="${Math.round(s.count / top * 100)}"></i></div></div>`).join('')}
        <div class="row wrap mt-md"><span class="chip blue">free</span><span>Free accounts: <b>${d.freeCount}</b></span><span class="chip red">Plan ended</span><span>Trial or paid period ended: <b>${d.endedCount}</b></span></div></div>
      <div class="card"><h3>Account by account</h3><div class="sub">Newest first. “Stopped at” is the first step not done yet, “Plan ended” when a trial or paid period has run out, and “Finished setup” when every step is done.</div>
        ${d.accounts.length ? `<div class="tablewrap feed"><table><thead><tr><th>Business</th><th>Reseller ID</th><th>Age</th><th>Email</th><th>Signed in</th><th>Recovery key</th><th>Plan</th><th>Stopped at</th></tr></thead><tbody id="acc-body"></tbody></table></div><div id="acc-more"></div>` : '<div class="empty">No accounts in this period.</div>'}</div>`);
    if (d.accounts.length) UI.chunked({ body: main.querySelector('#acc-body'), foot: main.querySelector('#acc-more'), items: d.accounts, noun: 'accounts', row: (a) => `<tr><td><b>${esc(a.business)}</b></td><td class="ident">${esc(a.code)}</td><td class="muted">${a.daysSince}d</td><td>${tick(a.steps.emailConfirmed)}</td><td>${tick(a.steps.firstSignIn)}</td><td>${tick(a.steps.recoverySaved)}</td><td>${planCell(a)}</td><td>${a.stuckAt ? esc(a.stuckAt) : '<span class="chip green">Finished setup</span>'}</td></tr>` });
    main.querySelector('#range').addEventListener('change', (e) => { days = UI.select.value(e.target); Host.route(); });
  };
})();
