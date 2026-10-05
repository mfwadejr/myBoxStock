// HOST / views / pipeline — signups and trials, who has gone quiet, where trials ended up, and what is due to renew. Host-side facts only.
(() => {
  const { esc, fmt, swap } = UI;
  const kind = { paid: ['green', 'Paid'], trial: ['blue', 'Trial'] };

  Host.views.pipeline = async (main) => {
    const [p, rn] = await Promise.all([Host.api('GET', '/business/pipeline'), Host.api('GET', '/business/renewals')]);
    const trials = p.trials.length ? `<div class="tablewrap feed"><table><thead><tr><th>Business</th><th>Reseller ID</th><th>Owner</th><th>Days left</th><th>Last seen</th></tr></thead><tbody id="trials-body"></tbody></table></div><div id="trials-more"></div>` : '<div class="empty">No one is on a trial right now.</div>';
    const quiet = p.quiet.length ? `<div class="tablewrap feed"><table><tbody id="quiet-body"></tbody></table></div><div id="quiet-more"></div>` : '<div class="empty">Everyone has been around in the last week.</div>';
    const renew = rn.renewals.length ? `<div class="tablewrap feed"><table><tbody id="renew-body"></tbody></table></div><div id="renew-more"></div>` : '<div class="empty">Nothing is due in the next 30 days.</div>';
    swap(main, `${Host.head('Pipeline', 'New sign-ups, trials and renewals. Only plan and contact details: never anyone’s business data.')}
      <div class="grid g4"><div class="card stat"><div class="stat-label">Sign-ups this week</div><div class="stat-value">${p.signups.week}</div><div class="stat-note">${p.signups.month} in the last 30 days</div></div>
        <div class="card stat"><div class="stat-label">On a trial</div><div class="stat-value">${p.trials.length}</div><div class="stat-note">${p.trialDays}-day trials</div></div>
        <div class="card stat"><div class="stat-label">Trials ending in 7 days</div><div class="stat-value">${p.endingSoon}</div><div class="stat-note">worth a nudge</div></div>
        <div class="card stat"><div class="stat-label">All accounts</div><div class="stat-value">${p.signups.total}</div><div class="stat-note">since the start</div></div></div>
      <div class="card mt-lg"><h3>Where accounts stand</h3><div class="sub">The current state of every account.</div><div class="row wrap"><span class="chip blue">${p.outcome.trial} on trial</span><span class="chip green">${p.outcome.paid} paid</span><span class="chip green">${p.outcome.free} comped</span><span class="chip red">${p.outcome.ended} ended</span></div></div>
      <div class="card"><h3>Trials running</h3><div class="sub">Soonest to end first.</div>${trials}</div>
      <div class="card"><h3>Renewals, next 30 days</h3><div class="sub">Paid accounts running out and trials about to end, including any that just lapsed.</div>${renew}</div>
      <div class="card"><h3>Gone quiet</h3><div class="sub">Active accounts nobody has signed in to for over a week.</div>${quiet}</div>`);
    if (p.trials.length) UI.chunked({ body: main.querySelector('#trials-body'), foot: main.querySelector('#trials-more'), items: p.trials, noun: 'accounts', row: (t) => `<tr><td><b>${esc(t.business)}</b></td><td class="ident">${esc(t.code)}</td><td class="muted">${esc(t.email)}</td><td><span class="chip ${t.daysLeft <= 7 ? 'amber' : 'blue'}">${t.daysLeft} day${t.daysLeft === 1 ? '' : 's'}</span></td><td class="muted">${esc(fmt.ago(t.lastSeen))}</td></tr>` });
    if (p.quiet.length) UI.chunked({ body: main.querySelector('#quiet-body'), foot: main.querySelector('#quiet-more'), items: p.quiet, noun: 'accounts', row: (q) => `<tr><td><b>${esc(q.business)}</b></td><td class="ident">${esc(q.code)}</td><td><span class="chip">${esc(q.plan)}</span></td><td class="muted">last seen ${esc(fmt.ago(q.lastSeen))}</td></tr>` });
    if (rn.renewals.length) UI.chunked({ body: main.querySelector('#renew-body'), foot: main.querySelector('#renew-more'), items: rn.renewals, noun: 'accounts', row: (x) => `<tr><td><b>${esc(x.business)}</b></td><td class="ident">${esc(x.code)}</td><td><span class="chip ${kind[x.kind][0]}">${kind[x.kind][1]}</span></td><td class="muted">${esc(x.email)}</td><td>${x.lapsed ? `<span class="chip red">Ended ${esc(fmt.date(x.endsAt))}</span>` : `<span class="chip amber">Ends ${esc(fmt.date(x.endsAt))}</span>`}</td></tr>` });
  };
})();
