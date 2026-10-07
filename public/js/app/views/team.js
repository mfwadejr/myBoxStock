// APP / views / team — people who can sign in to the account, and their user types (roles).
(() => {
  const { esc, fmt, toast, sheet, swap } = UI;

  // In an encrypted account the new person's temporary password also wraps the account key, so they can open the data at first sign-in.
  // (the account key is only in memory once encryption is set up or unlocked, so having it means the account is encrypted)
  const keysFor = async (pw) => AccountApp.vault.adk && pw ? Vault.keysFor(pw, AccountApp.vault.adk) : undefined;

  AccountApp.views.team = async (main) => {
    const me = AccountApp.me;
    if (!AccountApp.can('users.manage')) return swap(main, '<div class="page-head"><h1>Team</h1></div><div class="card"><div class="empty">Only administrators can manage the team.</div></div>');
    const [users, roles] = await Promise.all([AccountApp.api('GET', '/users'), AccountApp.api('GET', '/roles')]);
    swap(main, `<div class="page-head row spread"><div><h1>Team</h1><p>People who can sign in to ${esc(me.businessName)}. They all use the Reseller ID <b>${esc(me.accountCode)}</b> with their own username.</p></div><button class="btn" id="add">Add person</button></div>
      <div class="card"><div class="tablewrap"><table><thead><tr><th>Username</th><th>Role</th><th>2FA</th><th>Last sign-in</th><th>From IP</th><th>Signed in on</th><th></th></tr></thead><tbody>${users.map(u => `<tr><td>${esc(u.username)}${u.pending ? ' <span class="chip amber">Pending invitation</span>' : ''}</td><td><span class="chip">${esc(u.role)}</span></td><td>${u.totp_enabled ? '<span class="chip green">on</span>' : '<span class="chip">off</span>'}</td><td class="muted">${fmt.ago(u.last_login)}</td><td class="tab-num muted">${esc(u.last_ip || '—')}</td><td class="muted">${Number(u.active_sessions)} device${Number(u.active_sessions) === 1 ? '' : 's'}</td><td class="right">${u.id === me.id ? '' : `<button class="btn secondary small" data-reset="${u.id}">${u.pending ? 'Set up access' : 'Reset access'}</button> <button class="btn danger small" data-rm="${u.id}">Delete</button> <button class="btn ${u.disabled ? 'secondary' : 'danger'} small" data-dis="${u.id}" data-to="${u.disabled ? 0 : 1}">${u.disabled ? 'Enable' : 'Disable'}</button>`}</td></tr>`).join('')}</tbody></table></div></div>`);
    main.querySelectorAll('[data-dis]').forEach(b => b.addEventListener('click', async () => { await AccountApp.api('POST', `/users/${b.dataset.dis}/disabled`, { disabled: b.dataset.to === '1' }); AccountApp.route(); }));
    main.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', async () => {
      const u = users.find(x => x.id === b.dataset.reset);
      const ok = await sheet(`<h2>Reset access</h2><p class="sub">Gives ${esc(u.login)} a new temporary password and signs them out. They will choose their own at next sign-in and keep access to the data.</p><div class="field mt-md"><label>New temporary password</label><input type="password" id="p" autocomplete="new-password"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Reset</button></div>`,
        { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { const pw = el.querySelector('#p').value; await AccountApp.api('POST', `/users/${u.id}/reset-access`, { password: pw, keys: await keysFor(pw) }); close(true); } catch (e) { toast(e.message, true); } }) });
      if (ok) toast('Access reset');
    }));
    main.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', async () => {
      const u = users.find(x => x.id === b.dataset.rm);
      const c = await UI.confirmBox({ title: 'Delete person?', body: `${esc(u.login)} will be removed and can no longer sign in. This cannot be undone.`, confirmLabel: 'Delete', danger: true, typeToConfirm: u.login });
      if (c) { try { await AccountApp.api('DELETE', `/users/${u.id}`, { confirm: c }); toast('Person deleted'); AccountApp.route(); } catch (e) { toast(e.message, true); } }
    }));
    main.querySelector('#add').addEventListener('click', async () => {
      const ok = await sheet(`<h2>Add person</h2><div class="field mt-md"><label>Username</label><input type="text" id="u" autocapitalize="none"></div><div class="field"><label>Email (optional)</label><input type="email" id="e"></div>
        <div class="field"><label>Role</label>${UI.select.html({ id: 'r', options: roles.map(r => [r.name, r.name]) })}</div><div class="field"><label>Temporary password</label><input type="password" id="p" autocomplete="new-password"><div class="hint">They’ll be asked to change it at first sign-in.</div></div>
        <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Add</button></div>`,
        { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await AccountApp.api('POST', '/users', { username: el.querySelector('#u').value, email: el.querySelector('#e').value, role: UI.select.value(el.querySelector('#r')), password: el.querySelector('#p').value, keys: await keysFor(el.querySelector('#p').value) }); close(true); } catch (e) { toast(e.message, true); } }) });
      if (ok) { toast('Person added'); AccountApp.route(); }
    });
  };
})();
