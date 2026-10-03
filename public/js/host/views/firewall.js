// HOST / views / firewall — rate limiting, address rules, bans, listening ports.
(() => {
  const { esc, fmt, toast, swap } = UI;

  Host.views.firewall = async (main) => {
    const d = await Host.api('GET', '/firewall'), L = d.limits;
    swap(main, `${Host.head('Firewall', 'Rate limiting, address rules and the ports this container is listening on.')}
      <div class="grid g3"><div class="card stat"><div class="stat-label">Blocked</div><div class="stat-value">${d.stats.blocked}</div><div class="stat-note">since start</div></div><div class="card stat"><div class="stat-label">Rate-limited</div><div class="stat-value">${d.stats.limited}</div><div class="stat-note">since start</div></div><div class="card stat"><div class="stat-label">Temporary bans</div><div class="stat-value">${d.stats.activeBans}</div><div class="stat-note">right now</div></div></div>
      <div class="card mt-lg"><div class="row spread"><div><h3>Rate limiting</h3><div class="sub">Slows down floods and password guessing. Your address: <span class="mono">${esc(d.yourIp)}</span></div></div><label class="switch"><input type="checkbox" id="en" ${L.enabled ? 'checked' : ''}><i></i></label></div>
        <div class="grid g3"><div class="field"><label>Requests per IP</label><input type="number" id="mr" value="${L.maxRequests}"></div><div class="field"><label>…per window (seconds)</label><input type="number" id="ws" value="${L.windowSec}"></div><div class="field"><label>Sign-in attempts per IP</label><input type="number" id="am" value="${L.authMaxAttempts}"></div>
          <div class="field"><label>…per window (seconds)</label><input type="number" id="aw" value="${L.authWindowSec}"></div><div class="field"><label>Ban after N violations</label><input type="number" id="bv" value="${L.banAfterViolations}"></div><div class="field"><label>Ban length (minutes)</label><input type="number" id="bm" value="${L.banMinutes}"></div></div>
        <div class="setting"><div><div class="setting-title">Host console: allow-listed addresses only</div><div class="setting-desc">When on, only addresses with an “allow” rule below can reach this console.</div></div><label class="switch"><input type="checkbox" id="ho" ${L.hostConsoleAllowOnly ? 'checked' : ''}><i></i></label></div>
        <div class="row mt-sm"><button class="btn" id="save">Save</button></div></div>
      <div class="card"><h3>Address rules</h3><div class="sub">Block or always allow an address or range (CIDR). Allow rules also skip rate limiting.</div>
        <div class="row wrap"><div class="seg" id="kind"><button data-k="deny" class="on">Block</button><button data-k="allow">Allow</button></div><input type="text" id="cidr" placeholder="203.0.113.0/24 or 198.51.100.7" class="maxw-md"><input type="text" id="note" placeholder="Note (optional)" class="maxw-sm"><button class="btn secondary" id="add">Add rule</button></div>
        <div class="tablewrap mt-sm">${d.rules.length ? `<table><tbody>${d.rules.map(r => `<tr><td><span class="chip ${r.kind === 'allow' ? 'green' : 'red'}">${r.kind}</span></td><td class="mono">${esc(r.cidr)}</td><td class="muted">${esc(r.note || '')}</td><td class="right nowrap"><label class="switch switch-sm"><input type="checkbox" data-tg="${r.id}" ${r.enabled ? 'checked' : ''}><i></i></label> <button class="btn danger small" data-rm="${r.id}">Remove</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No rules.</div>'}</div></div>
      ${d.bans.length ? `<div class="card"><h3>Temporary bans</h3><div class="tablewrap">${d.bans.map(b => `<div class="setting"><div class="mono">${esc(b.ip)} <span class="faint">until ${fmt.date(b.expires)}</span></div><button class="btn secondary small" data-unban="${esc(b.ip)}">Lift</button></div>`).join('')}</div></div>` : ''}
      <div class="card"><h3>Ports in this container</h3><div class="sub">Discovered live. Rules and limits are enforced on the web port; other ports are shown for visibility.</div>
        <div class="tablewrap"><table><thead><tr><th>Port</th><th>Service</th><th>Reachable on</th><th>Enforcement</th></tr></thead><tbody>${d.ports.map(p => `<tr><td class="mono">${p.port}</td><td>${esc(p.label)}</td><td class="muted">${esc(p.scope)}</td><td>${p.enforced ? '<span class="chip green">active</span>' : '<span class="chip">visibility only</span>'}</td></tr>`).join('')}</tbody></table></div></div>`);
    const n = (id) => Number(main.querySelector(id).value);
    main.querySelector('#save').addEventListener('click', async () => {
      try { await Host.api('PUT', '/firewall/limits', { enabled: main.querySelector('#en').checked, maxRequests: n('#mr'), windowSec: n('#ws'), authMaxAttempts: n('#am'), authWindowSec: n('#aw'), banAfterViolations: n('#bv'), banMinutes: n('#bm'), hostConsoleAllowOnly: main.querySelector('#ho').checked }); toast('Saved'); }
      catch (e) { toast(e.message, true); }
      Host.route();
    });
    let kind = 'deny';
    main.querySelectorAll('#kind button').forEach(b => b.addEventListener('click', () => { kind = b.dataset.k; main.querySelectorAll('#kind button').forEach(x => x.classList.toggle('on', x === b)); }));
    main.querySelector('#add').addEventListener('click', async () => { try { await Host.api('POST', '/firewall/rules', { kind, cidr: main.querySelector('#cidr').value.trim(), note: main.querySelector('#note').value }); toast('Rule added'); Host.route(); } catch (e) { toast(e.message, true); } });
    main.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', async () => { await Host.api('DELETE', `/firewall/rules/${b.dataset.rm}`); Host.route(); }));
    main.querySelectorAll('[data-tg]').forEach(b => b.addEventListener('change', async () => { await Host.api('POST', `/firewall/rules/${b.dataset.tg}/toggle`, { enabled: b.checked }); }));
    main.querySelectorAll('[data-unban]').forEach(b => b.addEventListener('click', async () => { await Host.api('POST', '/firewall/unban', { ip: b.dataset.unban }); Host.route(); }));
  };
})();
