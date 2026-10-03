// APP / views / activity — sign-in history and active sessions (shared pieces + the team Activity page).
(() => {
  const { esc, fmt, toast, swap } = UI;
  const RESULT = { signed_in: ['green', 'Signed in'], wrong_password: ['red', 'Wrong password'], code_failed: ['red', 'Wrong code'], blocked: ['amber', 'Blocked'] };

  const sessionsCard = (sessions, showWho) => `<div class="card"><h3>Where ${showWho ? 'people are' : 'you’re'} signed in</h3>
    <div class="tablewrap"><table><thead><tr>${showWho ? '<th>Person</th>' : ''}<th>Device</th><th>IP address</th><th>Started</th><th>Last active</th><th></th></tr></thead><tbody>${sessions.length ? sessions.map(s => `<tr>${showWho ? `<td class="mono">${esc(s.login || '')}</td>` : ''}<td>${esc(s.device)}${s.current ? ' <span class="chip blue">This device</span>' : ''}</td><td class="mono">${esc(s.ip)}</td><td class="muted">${fmt.date(s.startedAt)}</td><td class="muted">${fmt.ago(s.lastSeen)}</td><td class="right">${s.current ? '' : `<button class="btn secondary small" data-revoke="${esc(s.id)}">Sign out</button>`}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">No active sessions.</td></tr>'}</tbody></table></div></div>`;

  const rows = (list, showWho) => list.map(h => { const [c, t] = RESULT[h.result] || ['', h.result]; return `<tr>${showWho ? `<td class="mono">${esc(h.login)}</td>` : ''}<td class="muted">${fmt.dateTime(h.ts)}</td><td><span class="chip ${c}">${t}</span>${h.attempts > 1 ? ` <span class="muted text-sm">× ${h.attempts}</span>` : ''}${h.newIp ? ' <span class="chip amber">New location</span>' : ''}</td><td class="mono">${esc(h.ip)}</td><td>${esc(h.device)}</td></tr>`; }).join('');

  const historyCard = (title, showWho, h) => `<div class="card"><h3>${title}</h3><div class="tablewrap"><table><thead><tr>${showWho ? '<th>Person</th>' : ''}<th>When</th><th>Result</th><th>IP address</th><th>Device</th></tr></thead><tbody id="hist">${h.history.length ? rows(h.history, showWho) : '<tr><td colspan="5" class="empty">Nothing recorded yet.</td></tr>'}</tbody></table></div>${h.more ? '<div class="row mt-md"><button class="btn secondary small" id="more">Load more</button></div>' : ''}</div>`;

  // Fills `host` with both cards and wires Sign out / Load more. base is '/activity/me' or '/activity/team'.
  async function render(host, base, showWho) {
    const h = await AccountApp.api('GET', base);
    swap(host, sessionsCard(h.sessions, showWho) + historyCard(showWho ? 'Team sign-in history' : 'Recent sign-ins', showWho, h));
    host.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', async () => {
      try { await AccountApp.api('POST', `${showWho ? '/activity/team' : '/activity'}/sessions/${b.dataset.revoke}/revoke`); toast('Signed out'); render(host, base, showWho); } catch (e) { toast(e.message, true); }
    }));
    let last = h.history.length ? h.history[h.history.length - 1].ts : 0;
    host.querySelector('#more')?.addEventListener('click', async (e) => {
      const n = await AccountApp.api('GET', `${base}?before=${last}`);
      host.querySelector('#hist').insertAdjacentHTML('beforeend', rows(n.history, showWho)); last = n.history.length ? n.history[n.history.length - 1].ts : last;
      if (!n.more) e.target.hidden = true;
    });
  }
  AccountApp.activity = { render };

  AccountApp.views.activity = async (main) => {
    if (!AccountApp.can('users.manage')) return swap(main, '<div class="page-head"><h1>Activity</h1></div><div class="card"><div class="empty">Only administrators can see team activity.</div></div>');
    swap(main, '<div class="page-head"><h1>Activity</h1><p>Who signed in to your account, from where, and which devices are signed in now.</p></div><div id="act"></div>');
    await render(main.querySelector('#act'), '/activity/team', true);
  };
})();
