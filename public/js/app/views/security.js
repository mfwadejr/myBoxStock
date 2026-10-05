// APP / views / security — the signed-in person's optional two-factor.
(() => {
  const { esc, toast, sheet, swap } = UI;

  AccountApp.views.security = async (main) => {
    const r = await AccountApp.api('GET', '/me'); AccountApp.me = r.user; const me = r.user;
    swap(main, `<div class="page-head"><h1>Security</h1><p>Reseller ID <span class="ident">${esc(me.accountCode)}</span> · username <span>${esc(me.username)}</span></p></div>
      <div class="card"><div class="row spread wrap"><div><h3>Two-factor authentication</h3><div class="sub mb-0">${me.totpEnabled ? 'On.' : 'Optional, and a good idea. Adds a code from your phone at sign-in.'}</div></div>${me.totpEnabled ? '<button class="btn danger" id="off">Turn off</button>' : '<button class="btn" id="on">Set up</button>'}</div></div>
      <div class="card"><div class="row spread wrap"><div><h3>Email address</h3><div class="sub mb-0">${me.email ? `${esc(me.email)} · ${me.emailVerified ? 'confirmed' : 'not confirmed yet'}` : 'No email address on your account.'} A new address takes effect once you confirm it from that mailbox.</div></div><button class="btn secondary" id="em">Change email</button></div></div>
      <div class="card"><div class="row spread wrap"><div><h3>Password</h3><div class="sub mb-0">Changing it keeps your access to the encrypted data.</div></div><button class="btn secondary" id="pw">Change password</button></div></div>
      ${me.role === 'Administrator' && AccountApp.vault.state?.enabled ? `<div class="card"><div class="row spread wrap"><div><h3>Recovery key</h3><div class="sub mb-0">${AccountApp.vault.state.recoveryConfirmed ? 'Saved. It is the only way to restore access if every password is forgotten.' : 'Not confirmed yet.'} Creating a new one makes the old one stop working.</div></div><button class="btn secondary" id="rk">Create new recovery key</button></div></div>` : ''}
      ${AccountApp.can('users.manage') && me.hostLinkAllowed ? `<div class="card"><div class="row spread wrap"><div><h3>Host administrator</h3><div class="sub mb-0">${me.hostLinked ? 'Linked. Your name menu at the top right has a Site admin entry that opens the Site admin console.' : 'Run the site as well as this account? Link your Host administrator sign-in to get a Site admin entry in your name menu at the top right. Nothing from this account is shared with the Host side, and you still sign in to each separately.'}</div></div>${me.hostLinked ? '<button class="btn secondary" id="hlo">Remove link</button>' : '<button class="btn secondary" id="hl">Link Host administrator</button>'}</div></div>` : ''}
      ${AccountApp.can('users.manage') ? `<div class="card"><h3>Your data</h3><div class="sub">You can take everything with you at any time.</div>
        <div class="setting"><div><div class="setting-title">Export everything</div><div class="setting-desc">One file with your CSV spreadsheets and settings. It is built in your browser and never passes through the server.</div></div><button class="btn secondary" id="xall">Export</button></div>
        <div class="setting"><div><div class="setting-title">Close my account</div><div class="setting-desc">Locks the account for ${7} days, then erases it for good. Until then an Administrator can restore it.</div></div><button class="btn danger" id="close">Close account</button></div></div>` : ''}
      <div class="card"><h3>Encryption</h3><div class="sub mb-0">${AccountApp.vault.state?.enabled ? 'Your inventory, customers and sales are encrypted in your browser. The hosting service stores them but cannot read them.' : 'Not turned on yet.'}</div></div>
      <div id="act" class="mt-lg"></div>`);
    main.querySelector('#pw')?.addEventListener('click', async () => {
      const ok = await sheet(`<h2>Change password</h2><div class="field mt-md"><label>Current password</label><input type="password" id="a" autocomplete="current-password"></div><div class="field"><label>New password</label><input type="password" id="b" autocomplete="new-password"><div class="hint">At least 10 characters with letters and numbers.</div></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Change</button></div>`,
        { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { const a = el.querySelector('#a').value, b = el.querySelector('#b').value; const keys = await AccountApp.vault.keysForNewPassword(a, b); await AccountApp.api('POST', '/change-password', { current: a, next: b, keys }); close(true); } catch (e) { toast(e.message, true); } }) });
      if (ok) toast('Password changed');
    });
    main.querySelector('#em')?.addEventListener('click', async () => {
      const ok = await sheet(`<h2>Change email address</h2><p class="sub">We will send a link to the new address. Your current one stays in use until you click it.</p><div class="field mt-md"><label>New email address</label><input type="email" id="ne" autocomplete="email"></div><div class="field"><label>Password</label><input type="password" id="pw2" autocomplete="current-password"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Send confirmation</button></div>`,
        { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await AccountApp.api('POST', '/email/change', { email: el.querySelector('#ne').value, password: el.querySelector('#pw2').value }); close(true); } catch (e) { toast(e.message, true); } }) });
      if (ok) toast('Check the new mailbox for the confirmation link');
    });
    main.querySelector('#xall')?.addEventListener('click', () => { const n = AccountApp.exportEverything(); toast(`Exported ${n} files`); });
    main.querySelector('#close')?.addEventListener('click', async () => {
      const ok = await sheet(`<h2>Close this account?</h2><p class="sub">The account is locked straight away: only Administrators can sign in, and only to look around, export or restore it. After 7 days everything is erased automatically: the people, the devices, customers and sales. We email you now and again when it is done.</p>
        <div class="banner mb-md">Backups kept by the site may still hold an encrypted copy until they expire. It cannot be opened without your password or recovery key.</div>
        <div class="row mb-md"><button class="btn secondary" id="xs">Export everything first</button></div>
        <div class="field"><label>Your password</label><input type="password" id="cp" autocomplete="current-password"></div><div class="field"><label>Type your Reseller ID (<b>${esc(me.accountCode)}</b>)</label><input type="text" id="ci" autocomplete="off" autocapitalize="none"></div>
        <div class="actions"><button class="btn secondary" data-cancel>Keep my account</button><button class="btn danger" id="go">Close account</button></div>`,
        { onMount: (el, close) => {
          el.querySelector('#xs').addEventListener('click', () => { AccountApp.exportEverything(); toast('Exported'); });
          el.querySelector('#go').addEventListener('click', async () => { try { await AccountApp.api('POST', '/account/close', { password: el.querySelector('#cp').value, resellerId: el.querySelector('#ci').value }); close(true); } catch (e) { toast(e.message, true); } });
        } });
      if (ok) { toast('Account closing'); const r2 = await AccountApp.api('GET', '/me'); AccountApp.me = r2.user; AccountApp.route(); }
    });
    main.querySelector('#hl')?.addEventListener('click', async () => {
      const ok = await sheet(`<h2>Link Host administrator</h2><p class="sub">Enter your Host Console sign-in once to prove it is you.</p><div class="field mt-md"><label>Host username</label><input type="text" id="u" autocapitalize="none" autocomplete="off"></div><div class="field"><label>Host password</label><input type="password" id="p" autocomplete="off"></div><div class="field"><label>Two-factor code (if your Host sign-in uses one)</label><input type="text" id="c" inputmode="numeric" autocomplete="off"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Link</button></div>`,
        { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await AccountApp.api('POST', '/hostlink', { username: el.querySelector('#u').value, password: el.querySelector('#p').value, code: el.querySelector('#c').value }); close(true); } catch (e) { toast(e.message, true); } }) });
      if (ok) { toast('Linked'); const r2 = await AccountApp.api('GET', '/me'); AccountApp.me = r2.user; AccountApp.showShell(); location.hash = '#/security'; }
    });
    main.querySelector('#hlo')?.addEventListener('click', async () => {
      if (!await UI.confirmBox({ title: 'Remove the link?', body: 'The Site admin entry goes away on both sides. You can link again later.', confirmLabel: 'Remove' })) return;
      await AccountApp.api('DELETE', '/hostlink'); const r2 = await AccountApp.api('GET', '/me'); AccountApp.me = r2.user; AccountApp.showShell(); location.hash = '#/security'; AccountApp.route();
    });
    main.querySelector('#rk')?.addEventListener('click', async () => {
      if (!await UI.confirmBox({ title: 'Create a new recovery key?', body: 'The old key will stop working. You will need to save the new one.', confirmLabel: 'Create' })) return;
      await AccountApp.vault.newRecovery(); AccountApp.vault.state.recoveryConfirmed = true; location.hash = '#/security'; AccountApp.showShell();
    });
    AccountApp.activity.render(main.querySelector('#act'), '/activity/me', false).catch((e) => toast(e.message, true));
    main.querySelector('#on')?.addEventListener('click', async () => { if (await UI.totpSetup(AccountApp.api)) AccountApp.route(); });
    main.querySelector('#off')?.addEventListener('click', async () => {
      const ok = await sheet(`<h2>Turn off two-factor</h2><div class="field mt-md"><label>Password</label><input type="password" id="p"></div><div class="field"><label>Authenticator code</label><input type="text" id="c"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn danger" id="go">Turn off</button></div>`,
        { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await AccountApp.api('POST', '/totp/disable', { password: el.querySelector('#p').value, code: el.querySelector('#c').value }); close(true); } catch (e) { toast(e.message, true); } }) });
      if (ok) AccountApp.route();
    });
  };
})();
