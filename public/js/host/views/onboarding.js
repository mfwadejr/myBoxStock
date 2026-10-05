// HOST / views / onboarding — how far each new account got. Counts and setup steps only (identity and security facts the server already holds).
(() => {
  const { esc, fmt, swap } = UI;
  const RANGES = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['0', 'All time']];
  const tick = (ok) => `<span class="chip ${ok ? 'green' : ''}">${ok ? 'done' : 'not yet'}</span>`;
  let days = '30';
  Host.views.onboarding = async (main) => {
    const d = await Host.api('GET', '/onboarding?days=' + days), top = Math.max(1, d.funnel[0].count);
    swap(main, `${Host.head('Onboarding', 'How far new accounts get through setup. Use it to see where people stop, and who to nudge.')}
      <div class="row mb-lg">${UI.select.html({ id: 'range', options: RANGES, value: days })}</div>
      <div class="card"><h3>Setup funnel</h3><div class="sub">${d.total} account${d.total === 1 ? '' : 's'} created in this period.</div>
        ${d.funnel.map(s => `<div class="mt-md"><div class="row spread"><span>${esc(s.label)}</span><b>${s.count}</b></div><div class="meter"><i data-pct="${Math.round(s.count / top * 100)}"></i></div></div>`).join('')}</div>
      <div class="card"><h3>Account by account</h3><div class="sub">Newest first. “Stopped at” is the first step not done yet.</div>
        ${d.accounts.length ? `<div class="tablewrap"><table><thead><tr><th>Business</th><th>Reseller ID</th><th>Age</th><th>Email</th><th>Signed in</th><th>Recovery key</th><th>Plan</th><th>Stopped at</th></tr></thead><tbody>${d.accounts.map(a => `<tr><td><b>${esc(a.business)}</b></td><td class="mono">${esc(a.code)}</td><td class="muted">${a.daysSince}d</td><td>${tick(a.steps.emailConfirmed)}</td><td>${tick(a.steps.firstSignIn)}</td><td>${tick(a.steps.recoverySaved)}</td><td>${tick(a.steps.planStarted)}</td><td>${a.stuckAt ? esc(a.stuckAt) : '<span class="chip green">finished</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No accounts in this period.</div>'}</div>`);
    main.querySelector('#range').addEventListener('change', (e) => { days = UI.select.value(e.target); Host.route(); });
  };
})();
