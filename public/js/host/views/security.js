// HOST / views / security — your two-factor, password, and the list of host administrators.
(() => {
  const { esc, fmt, toast, sheet, swap } = UI;

  Host.views.security = async (main) => {
    const [mine, admins] = await Promise.all([Host.api('GET', '/me'), Host.api('GET', '/admins')]); Host.me = mine.user; const me = Host.me;
    swap(main, `${Host.head('Security', 'Protect the host console.')}
      <div class="card"><div class="row spread wrap"><div><h3>Two-factor authentication</h3><div class="sub mb-0">${me.totpEnabled ? 'On — a code from your authenticator app is required at sign-in.' : 'Off — strongly recommended for the host administrator.'}</div></div>
        ${me.totpEnabled ? '<button class="btn danger" id="off">Turn off</button>' : '<button class="btn" id="on">Set up</button>'}</div></div>
      <div class="card"><h3>Password</h3><div class="sub">Change the password for ${esc(me.username)}.</div><button class="btn secondary" id="pw">Change password</button></div>
      <div class="card"><div class="row spread"><h3>Host administrators</h3><button class="btn secondary small" id="addadm">Add administrator</button></div>
        <div class="tablewrap mt-sm"><table><thead><tr><th>Username</th><th>Two-factor</th><th>Last sign-in</th></tr></thead><tbody>${admins.map(a => `<tr><td>${esc(a.username)}</td><td>${a.totp_enabled ? '<span class="chip green">on</span>' : '<span class="chip amber">off</span>'}</td><td class="muted">${fmt.ago(a.last_login)}</td></tr>`).join('')}</tbody></table></div>
        <div class="hint">Locked out? Run <span class="mono">node server.mjs reset-host-admin</span> on the server.</div></div>`);

    main.querySelector('#on')?.addEventListener('click', async () => { if (await UI.totpSetup(Host.api)) Host.route(); });
    main.querySelector('#off')?.addEventListener('click', async () => {
      const r = await sheet(`<h2>Turn off two-factor</h2><div class="field mt-md"><label>Password</label><input type="password" id="p"></div><div class="field"><label>Authenticator code</label><input type="text" id="c" inputmode="numeric"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn danger" id="go">Turn off</button></div>`,
        { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await Host.api('POST', '/totp/disable', { password: el.querySelector('#p').value, code: el.querySelector('#c').value }); close(true); } catch (e) { toast(e.message, true); } }) });
      if (r) Host.route();
    });
    main.querySelector('#pw').addEventListener('click', () => sheet(`<h2>Change password</h2><div class="field mt-md"><label>Current</label><input type="password" id="a"></div><div class="field"><label>New</label><input type="password" id="b"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Update</button></div>`,
      { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await Host.api('POST', '/change-password', { current: el.querySelector('#a').value, next: el.querySelector('#b').value }); toast('Password updated'); close(true); } catch (e) { toast(e.message, true); } }) }));
    main.querySelector('#addadm').addEventListener('click', () => sheet(`<h2>Add host administrator</h2><div class="field mt-md"><label>Username</label><input type="text" id="u"></div><div class="field"><label>Email</label><input type="email" id="e"></div><div class="field"><label>Temporary password</label><input type="password" id="p"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Add</button></div>`,
      { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await Host.api('POST', '/admins', { username: el.querySelector('#u').value, email: el.querySelector('#e').value, password: el.querySelector('#p').value }); toast('Administrator added'); close(true); Host.route(); } catch (e) { toast(e.message, true); } }) }));
  };
})();
