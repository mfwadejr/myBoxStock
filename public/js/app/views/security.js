// APP / views / security — the signed-in person's optional two-factor.
(() => {
  const { esc, toast, sheet, swap } = UI;

  AccountApp.views.security = async (main) => {
    const r = await AccountApp.api('GET', '/me'); AccountApp.me = r.user; const me = r.user;
    swap(main, `<div class="page-head"><h1>Security</h1><p>Your sign-in: <span class="mono">${esc(me.login)}</span></p></div>
      <div class="card"><div class="row spread wrap"><div><h3>Two-factor authentication</h3><div class="sub mb-0">${me.totpEnabled ? 'On.' : 'Optional, and a good idea. Adds a code from your phone at sign-in.'}</div></div>${me.totpEnabled ? '<button class="btn danger" id="off">Turn off</button>' : '<button class="btn" id="on">Set up</button>'}</div></div><div id="act" class="mt-lg"></div>`);
    AccountApp.activity.render(main.querySelector('#act'), '/activity/me', false).catch((e) => toast(e.message, true));
    main.querySelector('#on')?.addEventListener('click', async () => { if (await UI.totpSetup(AccountApp.api)) AccountApp.route(); });
    main.querySelector('#off')?.addEventListener('click', async () => {
      const ok = await sheet(`<h2>Turn off two-factor</h2><div class="field mt-md"><label>Password</label><input type="password" id="p"></div><div class="field"><label>Authenticator code</label><input type="text" id="c"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn danger" id="go">Turn off</button></div>`,
        { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await AccountApp.api('POST', '/totp/disable', { password: el.querySelector('#p').value, code: el.querySelector('#c').value }); close(true); } catch (e) { toast(e.message, true); } }) });
      if (ok) AccountApp.route();
    });
  };
})();
